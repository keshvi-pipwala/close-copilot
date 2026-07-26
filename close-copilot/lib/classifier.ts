// Typed wrapper around the shared engine so the app and the eval harness
// classify identically. The engine is plain JS (.mjs) precisely so the eval
// can import the exact code that ships.
import { classify as engineClassify, CHART_OF_ACCOUNTS } from "./engine.mjs";
import type { Classification, RawTxn, Txn } from "./types";

export const AUTO_APPROVE_THRESHOLD = 0.85;
export { CHART_OF_ACCOUNTS };

export function classify(description: string): Classification {
  return engineClassify(description) as Classification;
}

let counter = 0;
const uid = () => `txn_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/** Classify a batch and assign the auto/review status from the confidence gate. */
export function classifyBatch(raw: RawTxn[]): Txn[] {
  return raw.map((r) => {
    const c = classify(r.description);
    return {
      ...r,
      ...c,
      id: uid(),
      originalCategory: c.category,
      status: c.confidence >= AUTO_APPROVE_THRESHOLD ? "auto" : "review",
      anomalies: [],
      source: "agent",
    };
  });
}
