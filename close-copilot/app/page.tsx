"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AUTO_APPROVE_THRESHOLD,
  CHART_OF_ACCOUNTS,
  classifyBatch,
} from "@/lib/classifier";
import { flagAnomalies, periodOf } from "@/lib/anomalies";
import { reconcile, money } from "@/lib/reconcile";
import { parseCsv } from "@/lib/csv";
import type { Txn } from "@/lib/types";
import evalResults from "@/data/eval-results.json";

export default function Page() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [threshold, setThreshold] = useState(AUTO_APPROVE_THRESHOLD);
  const [loading, setLoading] = useState(false);
  const [useLLM, setUseLLM] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [note, setNote] = useState<string>("");
  const [tab, setTab] = useState<"all" | "review" | "anomalies">("review");

  // Load sample data on first paint so the page is never empty.
  useEffect(() => { runSample(); /* eslint-disable-next-line */ }, []);

  async function ingest(raw: { date: string; description: string; amount: number }[]) {
    setLoading(true);
    let classified: Txn[];
    if (useLLM) {
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transactions: raw, apiKey: apiKey.trim() || undefined }),
        });
        const data = await res.json();
        if (data.fallback || !res.ok) {
          setNote("No Claude key in play — ran the free on-device agent instead. It still categorizes everything and routes the uncertain rows to review.");
          classified = gate(classifyBatch(raw));
        } else {
          classified = gate(
            raw.map((r, i) => {
              const c = data.results[i];
              return {
                ...r, ...c, id: `llm_${i}`, originalCategory: c.category,
                status: "auto", anomalies: [], source: "llm" as const,
              } as Txn;
            })
          );
          setNote("Categorized with Claude.");
        }
      } catch {
        setNote("Claude call failed — ran the on-device agent instead.");
        classified = gate(classifyBatch(raw));
      }
    } else {
      setNote("");
      classified = gate(classifyBatch(raw));
    }
    setTxns(flagAnomalies(classified));
    setLoading(false);
  }

  function gate(list: Txn[], t = threshold): Txn[] {
    return list.map((x) =>
      x.status === "approved" || x.status === "corrected"
        ? x
        : { ...x, status: x.confidence >= t ? "auto" : "review" }
    );
  }

  async function runSample() {
    try {
      const res = await fetch("/sample-transactions.csv");
      const text = await res.text();
      await ingest(parseCsv(text));
    } catch {
      setNote("Could not load sample data.");
    }
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => ingest(parseCsv(String(reader.result)));
    reader.readAsText(file);
  }

  // Re-gate live when the threshold slider moves.
  useEffect(() => {
    setTxns((prev) => (prev.length ? flagAnomalies(gate(prev)) : prev));
    // eslint-disable-next-line
  }, [threshold]);

  const recon = useMemo(() => reconcile(txns), [txns]);
  const period = useMemo(() => periodOf(txns), [txns]);
  const reviewQueue = txns.filter((t) => t.status === "review");
  const anomalies = txns.filter((t) => t.anomalies.length);

  function approve(id: string) {
    setTxns((p) => p.map((t) => (t.id === id ? { ...t, status: "approved" } : t)));
  }
  function correct(id: string, category: string) {
    setTxns((p) =>
      p.map((t) =>
        t.id === id
          ? { ...t, category, status: "corrected", confidence: 1, reason: "Corrected by reviewer" }
          : t
      )
    );
  }
  function approveAllHighest() {
    setTxns((p) => p.map((t) => (t.status === "review" && t.confidence >= 0.6 ? { ...t, status: "approved" } : t)));
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Header ev={evalResults} />

      {/* Controls */}
      <section className="mt-6 rounded-xl border border-white/10 bg-panel/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={runSample}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
            Run on sample data
          </button>
          <label className="cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5">
            Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={onUpload} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={useLLM} onChange={(e) => setUseLLM(e.target.checked)} />
            Use Claude (optional)
          </label>
          {useLLM && (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your Anthropic API key (sk-ant-…)"
              className="w-56 rounded-lg border border-white/15 bg-panel px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500"
            />
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-400">Auto-approve confidence ≥</span>
            <input type="range" min={0.5} max={0.99} step={0.01} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))} className="w-40 accent-indigo-500" />
            <span className="w-12 font-mono text-indigo-300">{threshold.toFixed(2)}</span>
          </div>
        </div>
        {useLLM && (
          <p className="mt-3 text-xs text-slate-400">
            Bring your own Anthropic key to run categorization through Claude — it&apos;s used only for your request and never stored. Leave it blank and the free on-device agent handles it (great for clean data; Claude helps on messier descriptions).
          </p>
        )}
        {note && <p className="mt-2 text-xs text-amber-300/90">{note}</p>}
      </section>

      {/* Summary cards */}
      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Transactions" value={String(recon.totalCount)} sub={period ? `period ${period}` : ""} />
        <Stat label="Total value" value={money(recon.totalAmount)} />
        <Stat label="Auto-approved" value={`${recon.autoApprovedShare}%`} sub={`${recon.autoCount} rows`} accent="green" />
        <Stat label="Needs review" value={String(recon.pendingReviewCount)} sub="held by the gate" accent="amber" />
        <Stat label="Anomalies" value={String(recon.anomalyCount)} sub="flagged" accent="red" />
      </section>

      {/* Tabs */}
      <nav className="mt-8 flex gap-1 border-b border-white/10 text-sm">
        {([["review", `Review queue (${reviewQueue.length})`], ["all", `All transactions (${txns.length})`], ["anomalies", `Anomalies (${anomalies.length})`]] as const).map(
          ([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === k ? "border-indigo-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
              {label}
            </button>
          )
        )}
        {tab === "review" && reviewQueue.length > 0 && (
          <button onClick={approveAllHighest}
            className="ml-auto self-center text-xs text-indigo-300 hover:text-indigo-200">
            Approve all ≥0.60
          </button>
        )}
      </nav>

      {loading && <p className="mt-6 text-sm text-slate-400">Classifying…</p>}

      {/* Review queue */}
      {tab === "review" && (
        <div className="mt-4 space-y-2">
          {reviewQueue.length === 0 && (
            <p className="rounded-lg border border-white/10 bg-panel/40 p-6 text-center text-sm text-slate-400">
              Nothing waiting. The agent auto-approved everything above the confidence line.
            </p>
          )}
          {reviewQueue.map((t) => (
            <ReviewCard key={t.id} t={t} onApprove={approve} onCorrect={correct} />
          ))}
        </div>
      )}

      {/* All transactions */}
      {tab === "all" && <TxnTable txns={txns} />}

      {/* Anomalies */}
      {tab === "anomalies" && (
        <div className="mt-4">
          {anomalies.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-panel/40 p-6 text-center text-sm text-slate-400">No anomalies flagged.</p>
          ) : <TxnTable txns={anomalies} showAnomalies />}
        </div>
      )}

      {/* Reconciliation */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Reconciliation summary</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-slate-400">
              <tr><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Count</th><th className="px-4 py-2 text-right">Total</th></tr>
            </thead>
            <tbody>
              {recon.byCategory.map((c) => (
                <tr key={c.category} className="border-t border-white/5">
                  <td className="px-4 py-2">{c.category}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-300">{c.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(c.total)}</td>
                </tr>
              ))}
              <tr className="border-t border-white/15 font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">{recon.totalCount}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(recon.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <Footer />
    </main>
  );
}

/* ---------- components ---------- */

function Header({ ev }: { ev: typeof import("@/data/eval-results.json") }) {
  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Close Copilot</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            An agent categorizes every transaction and <span className="text-slate-200">scores its own confidence</span>.
            High-confidence rows post automatically; anything uncertain is routed to a{" "}
            <span className="text-slate-200">human review queue</span> instead of guessing.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge big value={`${ev.autoApprovedPrecision}%`} label="precision on auto-posts" tone="green" />
          <Badge value={`${ev.overallTop1Accuracy}%`} label="overall accuracy" />
          <Badge value={ev.testSetSize + ""} label="labeled test set" />
        </div>
      </div>
    </header>
  );
}

function Badge({ value, label, tone, big }: { value: string; label: string; tone?: "green"; big?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${tone === "green" ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
      <div className={`font-bold tabular-nums ${big ? "text-xl text-emerald-300" : "text-lg text-white"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "green" | "amber" | "red" }) {
  const color = accent === "green" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : accent === "red" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-panel/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Conf({ c }: { c: number }) {
  const tone = c >= 0.85 ? "bg-emerald-500" : c >= 0.6 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${tone}`} style={{ width: `${Math.round(c * 100)}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-xs text-slate-300">{c.toFixed(2)}</span>
    </div>
  );
}

function ReviewCard({ t, onApprove, onCorrect }: { t: Txn; onApprove: (id: string) => void; onCorrect: (id: string, c: string) => void }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-white">{t.description}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {t.date} · {money(t.amount)} · agent guessed <span className="text-slate-200">{t.category}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{t.reason}</div>
          {t.anomalies.length > 0 && (
            <div className="mt-1 text-xs text-rose-300">⚠ {t.anomalies.join(" · ")}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Conf c={t.confidence} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => onApprove(t.id)}
          className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400">
          Approve as “{t.category}”
        </button>
        <span className="text-xs text-slate-500">or correct →</span>
        <select defaultValue="" onChange={(e) => e.target.value && onCorrect(t.id, e.target.value)}
          className="rounded-md border border-white/15 bg-panel px-2 py-1.5 text-xs text-slate-200">
          <option value="" disabled>Pick category…</option>
          {CHART_OF_ACCOUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
}

function statusPill(s: Txn["status"]) {
  const map: Record<Txn["status"], string> = {
    auto: "bg-emerald-500/15 text-emerald-300",
    approved: "bg-emerald-500/15 text-emerald-300",
    corrected: "bg-indigo-500/15 text-indigo-300",
    review: "bg-amber-500/15 text-amber-300",
  };
  const label: Record<Txn["status"], string> = { auto: "auto", approved: "approved", corrected: "corrected", review: "review" };
  return <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${map[s]}`}>{label[s]}</span>;
}

function TxnTable({ txns, showAnomalies }: { txns: Txn[]; showAnomalies?: boolean }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Confidence</th>
            <th className="px-4 py-2">Status</th>
            {showAnomalies && <th className="px-4 py-2">Flags</th>}
          </tr>
        </thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id} className="border-t border-white/5">
              <td className="whitespace-nowrap px-4 py-2 text-slate-400">{t.date}</td>
              <td className="max-w-[280px] truncate px-4 py-2">{t.description}</td>
              <td className="px-4 py-2 text-right tabular-nums">{money(t.amount)}</td>
              <td className="px-4 py-2">{t.category}</td>
              <td className="px-4 py-2"><Conf c={t.confidence} /></td>
              <td className="px-4 py-2">{statusPill(t.status)}</td>
              {showAnomalies && <td className="px-4 py-2 text-xs text-rose-300">{t.anomalies.join(" · ")}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-white/10 pt-5 text-xs text-slate-500">
      Built by Keshvi Pipwala. The on-device agent runs with zero configuration; add an{" "}
      <code className="text-slate-400">ANTHROPIC_API_KEY</code> to route categorization through Claude.
      Accuracy figures come from <code className="text-slate-400">npm run eval</code> over a committed labeled test set — the same classifier that runs here.
    </footer>
  );
}
