export type TxnStatus = "auto" | "review" | "approved" | "corrected";

export interface RawTxn {
  date: string;
  description: string;
  amount: number;
}

export interface Classification {
  category: string;
  confidence: number;
  matchedKeyword: string | null;
  reason: string;
  alternatives: string[];
}

export interface Txn extends RawTxn, Classification {
  id: string;
  status: TxnStatus;
  originalCategory: string; // agent's first call, before any human correction
  anomalies: string[];
  source: "agent" | "llm";
}

export interface EvalResults {
  generatedAt: string;
  testSetSize: number;
  autoApproveThreshold: number;
  overallTop1Accuracy: number;
  autoApprovedShare: number;
  autoApprovedPrecision: number;
  routedToReviewShare: number;
  reviewPrecision: number;
  misroutedAutoPosts: Record<string, number>;
}
