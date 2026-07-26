import type { RawTxn } from "./types";

/** Minimal, dependency-free CSV parser. Handles quoted fields and commas. */
export function parseCsv(text: string): RawTxn[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const di = header.findIndex((h) => h.includes("date"));
  const pi = header.findIndex((h) => h.includes("desc") || h.includes("merchant") || h.includes("memo") || h.includes("name"));
  const ai = header.findIndex((h) => h.includes("amount") || h.includes("value") || h.includes("debit"));

  const out: RawTxn[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => c.trim() === "")) continue;
    const desc = (pi >= 0 ? cells[pi] : cells[1] ?? "").trim();
    if (!desc) continue;
    const amtRaw = (ai >= 0 ? cells[ai] : cells[2] ?? "0").replace(/[$,()]/g, "").trim();
    out.push({
      date: (di >= 0 ? cells[di] : cells[0] ?? "").trim(),
      description: desc,
      amount: Number(amtRaw) || 0,
    });
  }
  return out;
}
