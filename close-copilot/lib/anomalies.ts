import type { Txn } from "./types";

/**
 * Flag anomalies an accountant would want caught before close:
 *  - duplicate: same amount + description + date seen more than once
 *  - out-of-period: date outside the dominant month in the batch
 *  - uncategorizable: agent could not assign a real category
 * Mutates and returns the same array (anomalies field populated).
 */
export function flagAnomalies(txns: Txn[]): Txn[] {
  // Dominant month = the accounting period we're closing.
  const monthCounts: Record<string, number> = {};
  for (const t of txns) {
    const m = (t.date || "").slice(0, 7);
    if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
  }
  const period = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const seen: Record<string, number> = {};
  for (const t of txns) {
    const key = `${t.date}|${t.description}|${t.amount}`;
    seen[key] = (seen[key] || 0) + 1;
  }

  for (const t of txns) {
    const flags: string[] = [];
    const key = `${t.date}|${t.description}|${t.amount}`;
    if (seen[key] > 1) flags.push("Possible duplicate");
    if (period && t.date && t.date.slice(0, 7) !== period) flags.push(`Out of period (${t.date.slice(0, 7)})`);
    if (t.category === "Uncategorized") flags.push("Uncategorizable");
    t.anomalies = flags;
  }
  return txns;
}

export function periodOf(txns: Txn[]): string {
  const counts: Record<string, number> = {};
  for (const t of txns) {
    const m = (t.date || "").slice(0, 7);
    if (m) counts[m] = (counts[m] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
