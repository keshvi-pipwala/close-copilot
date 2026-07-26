import { NextResponse } from "next/server";
import { CHART_OF_ACCOUNTS, classify } from "@/lib/engine.mjs";

export const runtime = "nodejs";

interface In {
  transactions: { date: string; description: string; amount: number }[];
  apiKey?: string; // optional "bring your own key" from the client
}

/**
 * Optional Claude-backed categorization.
 * Key resolution: a per-request key sent by the visitor ("bring your own key")
 * takes priority; otherwise the server's ANTHROPIC_API_KEY is used if present.
 * If neither exists we return { fallback: true } and the client runs the
 * on-device agent — so the app never hard-depends on a key.
 * A visitor-supplied key is used only for that single request and never stored.
 * We ALWAYS keep the on-device result as a safety net if parsing fails, so a
 * bad model response can't break close.
 */
export async function POST(req: Request) {
  const { transactions, apiKey }: In = await req.json();
  const key = (apiKey && apiKey.trim()) || process.env.ANTHROPIC_API_KEY;

  // On-device baseline (also the fallback).
  const baseline = transactions.map((t) => classify(t.description));

  if (!key) return NextResponse.json({ fallback: true, results: baseline });

  try {
    const list = transactions
      .map((t, i) => `${i}. "${t.description}" ($${t.amount})`)
      .join("\n");

    const prompt =
      `You are a bookkeeping agent. Categorize each transaction into exactly one of these accounts:\n` +
      `${CHART_OF_ACCOUNTS.join(", ")}.\n\n` +
      `For each, return your confidence 0-1. Be conservative: if the merchant is ` +
      `ambiguous or unknown, use "Uncategorized" with low confidence so a human reviews it.\n\n` +
      `Transactions:\n${list}\n\n` +
      `Respond with ONLY a JSON array, one object per transaction in order: ` +
      `[{"category": "...", "confidence": 0.0, "reason": "..."}]`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return NextResponse.json({ fallback: true, results: baseline });

    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ fallback: true, results: baseline });

    const parsed = JSON.parse(match[0]) as { category: string; confidence: number; reason?: string }[];
    const results = transactions.map((_, i) => {
      const p = parsed[i];
      if (!p || !CHART_OF_ACCOUNTS.includes(p.category)) return baseline[i];
      return {
        category: p.category,
        confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
        matchedKeyword: null,
        reason: p.reason ?? "Categorized by Claude",
        alternatives: [] as string[],
      };
    });
    return NextResponse.json({ fallback: false, results });
  } catch {
    return NextResponse.json({ fallback: true, results: baseline });
  }
}
