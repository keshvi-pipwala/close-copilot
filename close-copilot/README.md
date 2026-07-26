# Close Copilot

**An AI agent that categorizes transactions, scores its own confidence, and routes the uncertain ones to a human review queue — instead of guessing.**

Built as a working slice of the office-of-the-CFO workflow: the agent does the repetitive work, a human owns the review gate, and nothing wrong gets posted unattended.

Next.js · TypeScript · Tailwind. The categorization agent runs **on-device with zero configuration** (that's what the live demo uses); add an `ANTHROPIC_API_KEY` to route categorization through Claude for messier real-world data.

---

## Measured, not claimed

Numbers below are produced by `npm run eval`, which runs the **exact classifier that ships** over a committed, hand-labeled test set. Reproduce them yourself in one command.

| Metric | Result |
|---|---|
| Labeled test set | **104 transactions** |
| Overall top-1 accuracy | **96.2%** |
| Auto-approved (confidence ≥ 0.85) | **82.7% of rows** |
| **Precision on auto-posted transactions** | **100%** |
| Routed to human review | 17.3% |

The headline is the last two rows together: the agent **auto-posted 83% of the ledger and got every one of them right — zero wrong categories posted without a human.** Every transaction it wasn't sure about went to the review queue. That is the whole point of the review gate: in bookkeeping, a confident wrong answer is far more expensive than an honest "a human should look at this."

```
$ npm run eval
Close Copilot — evaluation
  test set:                  104 labeled transactions
  overall top-1 accuracy:    96.2%
  auto-approved:             82.7% of rows
  precision on auto-posts:   100%   <-- the number that matters
  routed to human review:    17.3%
  mis-routed auto-posts:     none
```

---

## What it does

1. **Ingest** — upload a bank/transaction CSV, or click *Run on sample data*.
2. **Categorize** — the agent assigns each transaction an account from a chart of accounts and **scores its own confidence** with a reason.
3. **Gate** — a confidence threshold (adjustable live) splits the batch: high-confidence rows auto-post; the rest drop into a **review queue**.
4. **Review** — a human approves the agent's guess or corrects it; corrections are recorded and the reconciliation updates instantly.
5. **Flag anomalies** — duplicates, out-of-period dates, and uncategorizable rows are surfaced before close.
6. **Reconcile** — running totals by category, plus auto-vs-review breakdown.

Move the confidence slider and watch the auto/review split rebalance in real time — that's the core product tradeoff (throughput vs. safety) made tangible.

---

## Architecture

```
CSV upload ─► parser ─► categorization agent ─► confidence gate ─┬─ ≥ threshold ─► auto-posted
   (lib/csv)            (lib/engine.mjs)      (lib/classifier)    │
                              │                                   └─ < threshold ─► review queue ─► human approve/correct
                     optional Claude route                                                              │
                    (app/api/categorize)                                                                ▼
                                                             anomaly flags (lib/anomalies) + reconciliation (lib/reconcile)
```

**Single source of truth for the model.** The categorization logic lives in `lib/engine.mjs` (plain JS on purpose). The web app imports it through a typed wrapper (`lib/classifier.ts`) and the eval harness (`scripts/eval.mjs`) imports the *same file* — so the published accuracy is guaranteed to describe the code that actually runs. No "the demo does one thing, the benchmark another."

**Fail-safe LLM path.** `app/api/categorize` calls Claude when a key is present, but always computes the on-device result first and falls back to it if the key is missing, the call fails, or the model returns unparseable output. A bad model response can never break close.

**Confidence is conservative by design.** Weak or ambiguous keyword matches, and any two categories tying, get penalized below the auto-approve line — so ambiguity becomes a review, not a wrong post.

---

## Run it

```bash
npm install
npm run gen:data   # regenerate the labeled test set (optional; committed already)
npm run eval       # reproduce the accuracy numbers above
npm run dev        # http://localhost:3000
```

Optional Claude upgrade:

```bash
cp .env.example .env.local
# add ANTHROPIC_API_KEY=..., then check "Use Claude" in the UI
```

## Deploy (Vercel)

Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new), deploy. No env vars required for the on-device agent. Add `ANTHROPIC_API_KEY` in Vercel project settings to enable the Claude path.

---

## Project layout

```
app/
  page.tsx               UI: ingest, gate, review queue, anomalies, reconciliation
  api/categorize/route.ts optional Claude categorization with on-device fallback
lib/
  engine.mjs             the agent — rules + confidence scoring (shared source of truth)
  classifier.ts          typed wrapper + batch gating
  csv.ts                 dependency-free CSV parser
  anomalies.ts           duplicate / out-of-period / uncategorizable detection
  reconcile.ts           category totals + auto-vs-review breakdown
scripts/
  gen_data.py            generates the labeled test set (seeded, reproducible)
  eval.mjs               runs the shipping classifier over labels, writes data/eval-results.json
data/eval-results.json   committed metrics, rendered in the app header
public/sample-transactions.csv  demo data
```

---

## Notes & honest limits

- The on-device agent is a transparent rules-plus-confidence model, chosen so the demo runs anywhere with no key and so every decision is explainable. The Claude route is there for the long tail of messy descriptions a fixed rule set won't catch.
- Review-queue state lives in the client for the demo; a production build would persist corrections and feed them back as training signal for the categorizer.
- The test set is synthetic but realistic (real merchant strings, injected duplicates and out-of-period rows). The eval is honest: unknown merchants count against top-1 accuracy rather than being hidden.

Built by **Keshvi Pipwala** — [portfolio](https://keshvi-portfolio-ten.vercel.app) · [github](https://github.com/keshvi-pipwala).
