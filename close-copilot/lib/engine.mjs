// Close Copilot — categorization engine (single source of truth).
// Imported by both the Next.js app (lib/classifier.ts) and the eval harness
// (scripts/eval.mjs) so the accuracy we publish is exactly what ships.

/** Chart of accounts. Order is stable; used across the app. */
export const CHART_OF_ACCOUNTS = [
  "Software & SaaS",
  "Travel",
  "Meals & Entertainment",
  "Office Supplies",
  "Payroll",
  "Rent & Facilities",
  "Utilities",
  "Marketing & Advertising",
  "Professional Services",
  "Bank & Card Fees",
  "Cost of Goods Sold",
  "Taxes",
  "Insurance",
  "Shipping & Postage",
  "Uncategorized",
];

// Keyword rules. weight 3 = strong/unambiguous merchant signal,
// 2 = solid, 1 = weak/generic (often routed to human review).
const RULES = [
  { category: "Software & SaaS", keywords: [
    ["aws", 3], ["amazon web services", 3], ["google cloud", 3], ["gcp", 3],
    ["microsoft azure", 3], ["azure", 2], ["github", 3], ["gitlab", 3],
    ["vercel", 3], ["netlify", 3], ["render.com", 3], ["datadog", 3],
    ["stripe billing", 2], ["notion", 3], ["figma", 3], ["slack", 3],
    ["zoom", 3], ["atlassian", 3], ["jira", 3], ["openai", 3], ["anthropic", 3],
    ["hubspot", 3], ["salesforce", 3], ["dropbox", 3], ["adobe", 3],
    ["1password", 3], ["linear", 2], ["snowflake", 3], ["mongodb", 3],
    ["saas", 1], ["subscription", 1], ["software", 1] ] },
  { category: "Travel", keywords: [
    ["united airlines", 3], ["delta air", 3], ["american airlines", 3],
    ["jetblue", 3], ["southwest air", 3], ["airlines", 2], ["airline", 2],
    ["uber", 2], ["lyft", 3], ["marriott", 3], ["hilton", 3], ["hyatt", 3],
    ["airbnb", 3], ["expedia", 3], ["amtrak", 3], ["hertz", 3], ["avis", 3],
    ["enterprise rent", 3], ["taxi", 2], ["parking", 2], ["hotel", 2],
    ["flight", 2] ] },
  { category: "Meals & Entertainment", keywords: [
    ["starbucks", 3], ["dunkin", 3], ["chipotle", 3], ["mcdonald", 3],
    ["doordash", 3], ["uber eats", 3], ["ubereats", 3], ["grubhub", 3],
    ["sweetgreen", 3], ["restaurant", 2], ["cafe", 2], ["coffee", 2],
    ["pizza", 2], ["catering", 2], ["bar & grill", 2], ["diner", 2],
    ["tst*", 2], ["sq *", 1] ] },
  { category: "Office Supplies", keywords: [
    ["staples", 3], ["office depot", 3], ["officemax", 3], ["uline", 3],
    ["amazon.com", 1], ["amzn mktp", 1], ["best buy", 2], ["apple store", 2],
    ["ikea", 2], ["office supplies", 2], ["stationery", 2], ["printer ink", 2] ] },
  { category: "Payroll", keywords: [
    ["adp", 3], ["gusto", 3], ["paychex", 3], ["rippling", 3], ["justworks", 3],
    ["trinet", 3], ["payroll", 3], ["direct deposit", 2], ["salary", 2],
    ["wages", 2], ["deel", 3] ] },
  { category: "Rent & Facilities", keywords: [
    ["wework", 3], ["regus", 3], ["industrious", 3], ["rent payment", 3],
    ["office rent", 3], ["lease", 2], ["property mgmt", 2], ["landlord", 2],
    ["cleaning service", 2], ["janitorial", 2] ] },
  { category: "Utilities", keywords: [
    ["con edison", 3], ["coned", 3], ["national grid", 3], ["pg&e", 3],
    ["verizon", 3], ["at&t", 3], ["t-mobile", 3], ["comcast", 3], ["xfinity", 3],
    ["spectrum", 3], ["electric", 2], ["water bill", 2], ["gas bill", 2],
    ["internet", 2], ["utility", 2], ["utilities", 2] ] },
  { category: "Marketing & Advertising", keywords: [
    ["google ads", 3], ["facebook ads", 3], ["meta platforms", 3],
    ["linkedin ads", 3], ["tiktok ads", 3], ["mailchimp", 3], ["hootsuite", 3],
    ["semrush", 3], ["advertising", 2], ["ad spend", 2], ["marketing", 2],
    ["sponsorship", 2], ["billboard", 2] ] },
  { category: "Professional Services", keywords: [
    ["law", 2], ["legal", 2], ["attorney", 3], ["accounting", 2], ["cpa", 3],
    ["consulting", 2], ["consultant", 2], ["deloitte", 3], ["pwc", 3],
    ["kpmg", 3], ["ernst & young", 3], ["notary", 2], ["bookkeeping", 3],
    ["advisory", 2] ] },
  { category: "Bank & Card Fees", keywords: [
    ["wire fee", 3], ["overdraft", 3], ["service charge", 3], ["atm fee", 3],
    ["monthly fee", 2], ["card fee", 2], ["interest charge", 2],
    ["foreign transaction fee", 3], ["stripe fee", 3], ["processing fee", 2],
    ["nsf fee", 3] ] },
  { category: "Cost of Goods Sold", keywords: [
    ["alibaba", 3], ["wholesale", 2], ["supplier", 2], ["manufacturing", 2],
    ["raw materials", 3], ["inventory", 2], ["freight in", 2], ["packaging", 2],
    ["cogs", 3] ] },
  { category: "Taxes", keywords: [
    ["irs", 3], ["dept of revenue", 3], ["franchise tax", 3], ["sales tax", 3],
    ["payroll tax", 3], ["estimated tax", 3], ["tax payment", 3],
    ["state tax", 2], ["fed tax", 2] ] },
  { category: "Insurance", keywords: [
    ["insurance", 3], ["geico", 3], ["state farm", 3], ["hiscox", 3],
    ["the hartford", 3], ["premium payment", 2], ["liability policy", 2],
    ["workers comp", 3] ] },
  { category: "Shipping & Postage", keywords: [
    ["fedex", 3], ["ups store", 3], ["ups*", 3], ["usps", 3], ["dhl", 3],
    ["postage", 2], ["shipstation", 3], ["pitney bowes", 3], ["shipping", 2],
    ["courier", 2] ] },
];

/** Escape nothing fancy — we do plain substring matching on normalized text. */
function normalize(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Classify one transaction description.
 * Returns { category, confidence (0..1), matchedKeyword, reason, alternatives }.
 * Confidence is intentionally conservative: weak or ambiguous matches score
 * low so they get routed to human review instead of guessing.
 */
export function classify(description) {
  const text = normalize(description);
  if (!text) {
    return { category: "Uncategorized", confidence: 0.05,
      matchedKeyword: null, reason: "Empty description", alternatives: [] };
  }

  // Collect best weight per category.
  const hits = [];
  for (const rule of RULES) {
    let best = 0, bestKw = null;
    for (const [kw, w] of rule.keywords) {
      if (text.includes(kw) && w > best) { best = w; bestKw = kw; }
    }
    if (best > 0) hits.push({ category: rule.category, weight: best, keyword: bestKw });
  }

  if (hits.length === 0) {
    return { category: "Uncategorized", confidence: 0.12,
      matchedKeyword: null, reason: "No known merchant or keyword matched",
      alternatives: [] };
  }

  hits.sort((a, b) => b.weight - a.weight);
  const top = hits[0];

  // Base confidence from match strength.
  let confidence = { 3: 0.95, 2: 0.72, 1: 0.45 }[top.weight] ?? 0.4;

  // Ambiguity penalty: another category matched at the same strength.
  const contenders = hits.filter((h) => h.weight === top.weight);
  const alternatives = hits.slice(1, 3).map((h) => h.category);
  let reason;
  if (contenders.length > 1) {
    confidence -= 0.28;
    reason = `Matched "${top.keyword}" but ${contenders.length} categories tied — needs review`;
  } else {
    reason = `Matched "${top.keyword}" (strength ${top.weight}/3)`;
  }

  confidence = Math.max(0.1, Math.min(0.99, Number(confidence.toFixed(2))));
  return { category: top.category, confidence, matchedKeyword: top.keyword,
    reason, alternatives };
}
