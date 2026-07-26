// Close Copilot — accuracy harness.
// Runs the SHIPPING classifier (lib/engine.mjs) over a labeled test set and
// reports the numbers we publish in the README. Run: `npm run eval`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classify } from "../lib/engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const AUTO_APPROVE_THRESHOLD = 0.85; // rows at/above this post automatically

const labels = JSON.parse(readFileSync(join(HERE, "labels.json"), "utf8"));

let correct = 0;
let autoApproved = 0, autoCorrect = 0;
let routedToReview = 0, reviewThatNeededIt = 0;
const confusion = {};

for (const { description, true: truth } of labels) {
  const { category, confidence } = classify(description);
  const isCorrect = category === truth;
  if (isCorrect) correct++;

  if (confidence >= AUTO_APPROVE_THRESHOLD) {
    autoApproved++;
    if (isCorrect) autoCorrect++;
    else (confusion[`${truth} -> ${category}`] ??= 0, confusion[`${truth} -> ${category}`]++);
  } else {
    routedToReview++;
    // "Needed review" = the auto guess would have been wrong OR truly unknown.
    if (!isCorrect || truth === "Uncategorized") reviewThatNeededIt++;
  }
}

const n = labels.length;
const results = {
  generatedAt: new Date().toISOString(),
  testSetSize: n,
  autoApproveThreshold: AUTO_APPROVE_THRESHOLD,
  overallTop1Accuracy: +(100 * correct / n).toFixed(1),
  autoApprovedShare: +(100 * autoApproved / n).toFixed(1),
  autoApprovedPrecision: +(100 * autoCorrect / Math.max(1, autoApproved)).toFixed(1),
  routedToReviewShare: +(100 * routedToReview / n).toFixed(1),
  reviewPrecision: +(100 * reviewThatNeededIt / Math.max(1, routedToReview)).toFixed(1),
  misroutedAutoPosts: confusion,
};

writeFileSync(join(ROOT, "data", "eval-results.json"), JSON.stringify(results, null, 2));

console.log("Close Copilot — evaluation");
console.log("  test set:                 ", n, "labeled transactions");
console.log("  overall top-1 accuracy:   ", results.overallTop1Accuracy + "%");
console.log("  auto-approved:            ", results.autoApprovedShare + "% of rows");
console.log("  precision on auto-posts:  ", results.autoApprovedPrecision + "%  <-- the number that matters");
console.log("  routed to human review:   ", results.routedToReviewShare + "%");
console.log("  of those, genuinely needed it:", results.reviewPrecision + "%");
if (Object.keys(confusion).length)
  console.log("  mis-routed auto-posts:    ", confusion);
else
  console.log("  mis-routed auto-posts:     none");
