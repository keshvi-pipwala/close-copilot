# Close Copilot — agent-assisted transaction categorization

**Live:** https://close-copilot.vercel.app

An agent categorizes every transaction in a close and scores its own confidence. High-confidence rows post automatically. Anything uncertain is routed to a human review queue with the agent's reasoning attached — instead of guessing.

> **Result on a 104-transaction labeled test set:** 100% precision on auto-posted rows · 96.2% overall accuracy.
> The first number is the one a controller cares about: an auto-post that's wrong costs far more than a review click.

## Why it exists

Month-end close is a queue of small classification decisions with asymmetric costs. Getting 96% of them right is easy; getting *zero* wrong on the ones nobody looks at is the actual product requirement. Close Copilot is built around that asymmetry.

## How it works

```
CSV upload ──► agent categorizes each row ──► confidence score
                                              │
                        ┌─────────────────────┴──────────────────────┐
                        ▼                                            ▼
              confidence ≥ 0.85                            confidence < 0.85
              auto-post                                    human review queue
              (category + reasoning logged)                (reasoning + suggested category shown)
                        │                                            │
                        └─────────────► reconciliation summary ◄─────┘
                                        counts · totals · anomalies flagged
```

- **Confidence routing.** The threshold (0.85) was chosen by walking the precision/recall curve on the labeled set and picking the highest recall that still gives 100% precision on auto-posts. Lower recall on auto-posts is an acceptable trade; a silent mis-post is not.
- **Anomaly flagging.** Rows that look wrong for reasons other than category (duplicate, out-of-pattern amount, unexpected counterparty) are surfaced separately from "low confidence."
- **Real-time reconciliation summary.** Auto-posted vs. queued counts and totals update as the agent works, so the reviewer knows what's left before opening the queue.
- **Bring your own key.** Optional Claude API key; the demo runs without one.

## The decisions I owned

1. **Trust model over accuracy.** Framed the product around "never wrong when unattended" instead of "highest accuracy," which changed the UI (review queue is first-class, not an error state) and the eval.
2. **The eval set.** Built the 104-transaction labeled set and used it to choose the threshold; the metrics above come from that set, not from the agent's self-report.
3. **What the human sees.** Every queued row shows the agent's suggested category *and* its reasoning, so review is a confirm/override click, not a re-categorization.

## Stack

TypeScript · React · Vercel · Claude API (optional)

## Run locally

```bash
git clone https://github.com/keshvi-pipwala/close-copilot
cd close-copilot
npm install
npm run dev
```

## Honest note on authorship

Product spec, trust model, threshold selection, labeled eval set, and QA are mine. Implementation was AI-assisted under my direction. I'd rather say that here than have you find out in the interview.

— Keshvi Pipwala · keshvipipwalan@gmail.com · [portfolio](https://keshvi-portfolio-ten.vercel.app/)
