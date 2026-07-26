import type { Txn } from "./types";

export interface CategoryTotal { category: string; count: number; total: number; }

export interface Reconciliation {
  totalCount: number;
  totalAmount: number;
  autoCount: number;
  reviewCount: number;
  resolvedCount: number; // approved or corrected by a human
  anomalyCount: number;
  pendingReviewCount: number;
  byCategory: CategoryTotal[];
  autoApprovedShare: number;
}

export function reconcile(txns: Txn[]): Reconciliation {
  const byCat: Record<string, CategoryTotal> = {};
  let totalAmount = 0, autoCount = 0, reviewCount = 0, resolvedCount = 0,
    anomalyCount = 0, pending = 0;

  for (const t of txns) {
    totalAmount += t.amount;
    (byCat[t.category] ??= { category: t.category, count: 0, total: 0 });
    byCat[t.category].count++;
    byCat[t.category].total += t.amount;

    if (t.status === "auto") autoCount++;
    if (t.status === "review") { reviewCount++; pending++; }
    if (t.status === "approved" || t.status === "corrected") resolvedCount++;
    if (t.anomalies.length) anomalyCount++;
  }

  return {
    totalCount: txns.length,
    totalAmount: round2(totalAmount),
    autoCount,
    reviewCount,
    resolvedCount,
    anomalyCount,
    pendingReviewCount: pending,
    byCategory: Object.values(byCat)
      .map((c) => ({ ...c, total: round2(c.total) }))
      .sort((a, b) => b.total - a.total),
    autoApprovedShare: txns.length ? Math.round((100 * autoCount) / txns.length) : 0,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
