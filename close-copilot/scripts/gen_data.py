#!/usr/bin/env python3
"""Generate a labeled test set for Close Copilot.
Writes:
  public/sample-transactions.csv  -> what a user uploads (no labels)
  scripts/labels.json             -> ground-truth categories for the eval
Deterministic (seeded) so the published accuracy number is reproducible.
"""
import csv, json, random, os
random.seed(7)

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))

# (description template, true category). Clean, mappable merchants.
CLEAN = [
    ("AWS EMEA cloud services", "Software & SaaS"),
    ("GITHUB.COM subscription", "Software & SaaS"),
    ("VERCEL INC hosting", "Software & SaaS"),
    ("NOTION LABS annual plan", "Software & SaaS"),
    ("FIGMA monthly", "Software & SaaS"),
    ("ZOOM.US video", "Software & SaaS"),
    ("ATLASSIAN jira cloud", "Software & SaaS"),
    ("OPENAI API usage", "Software & SaaS"),
    ("ANTHROPIC api credits", "Software & SaaS"),
    ("DATADOG monitoring", "Software & SaaS"),
    ("SLACK T012345", "Software & SaaS"),
    ("ADOBE creative cloud", "Software & SaaS"),
    ("SNOWFLAKE computing", "Software & SaaS"),
    ("MONGODB ATLAS", "Software & SaaS"),
    ("DELTA AIR LINES 0062", "Travel"),
    ("UNITED AIRLINES ticket", "Travel"),
    ("JETBLUE airways", "Travel"),
    ("MARRIOTT hotels NYC", "Travel"),
    ("HILTON garden inn", "Travel"),
    ("AIRBNB * HMXYZ", "Travel"),
    ("LYFT ride", "Travel"),
    ("AMTRAK northeast", "Travel"),
    ("HERTZ rent a car", "Travel"),
    ("EXPEDIA travel", "Travel"),
    ("STARBUCKS store 118", "Meals & Entertainment"),
    ("CHIPOTLE 2201", "Meals & Entertainment"),
    ("DOORDASH * order", "Meals & Entertainment"),
    ("SWEETGREEN nomad", "Meals & Entertainment"),
    ("DUNKIN #33", "Meals & Entertainment"),
    ("GRUBHUB catering", "Meals & Entertainment"),
    ("UBER EATS delivery", "Meals & Entertainment"),
    ("STAPLES 00489", "Office Supplies"),
    ("OFFICE DEPOT #12", "Office Supplies"),
    ("ULINE shipping supplies", "Office Supplies"),
    ("BEST BUY business", "Office Supplies"),
    ("ADP payroll fees", "Payroll"),
    ("GUSTO pay run", "Payroll"),
    ("RIPPLING payroll", "Payroll"),
    ("JUSTWORKS peo", "Payroll"),
    ("DEEL contractor pay", "Payroll"),
    ("WEWORK membership", "Rent & Facilities"),
    ("REGUS office", "Rent & Facilities"),
    ("INDUSTRIOUS office", "Rent & Facilities"),
    ("OFFICE RENT april", "Rent & Facilities"),
    ("CON EDISON electric", "Utilities"),
    ("NATIONAL GRID gas bill", "Utilities"),
    ("VERIZON wireless", "Utilities"),
    ("AT&T business", "Utilities"),
    ("COMCAST xfinity internet", "Utilities"),
    ("SPECTRUM business", "Utilities"),
    ("GOOGLE ADS campaign", "Marketing & Advertising"),
    ("FACEBOOK ADS meta", "Marketing & Advertising"),
    ("LINKEDIN ADS", "Marketing & Advertising"),
    ("MAILCHIMP monthly", "Marketing & Advertising"),
    ("SEMRUSH seo", "Marketing & Advertising"),
    ("TIKTOK ADS", "Marketing & Advertising"),
    ("DELOITTE advisory", "Professional Services"),
    ("KPMG audit", "Professional Services"),
    ("SMITH ATTORNEY at law", "Professional Services"),
    ("ACME BOOKKEEPING svc", "Professional Services"),
    ("PWC consulting", "Professional Services"),
    ("WIRE FEE outgoing", "Bank & Card Fees"),
    ("MONTHLY SERVICE CHARGE", "Bank & Card Fees"),
    ("ATM FEE withdrawal", "Bank & Card Fees"),
    ("FOREIGN TRANSACTION FEE", "Bank & Card Fees"),
    ("STRIPE FEE payout", "Bank & Card Fees"),
    ("ALIBABA wholesale order", "Cost of Goods Sold"),
    ("RAW MATERIALS supplier", "Cost of Goods Sold"),
    ("PACKAGING inventory", "Cost of Goods Sold"),
    ("IRS USATAXPYMT", "Taxes"),
    ("NY DEPT OF REVENUE", "Taxes"),
    ("FRANCHISE TAX board", "Taxes"),
    ("SALES TAX remittance", "Taxes"),
    ("ESTIMATED TAX q2", "Taxes"),
    ("HISCOX insurance", "Insurance"),
    ("THE HARTFORD premium payment", "Insurance"),
    ("WORKERS COMP policy", "Insurance"),
    ("GEICO commercial", "Insurance"),
    ("FEDEX 8829", "Shipping & Postage"),
    ("USPS po box", "Shipping & Postage"),
    ("DHL express", "Shipping & Postage"),
    ("SHIPSTATION label", "Shipping & Postage"),
    ("PITNEY BOWES postage", "Shipping & Postage"),
]

# Ambiguous but still solvable (medium confidence expected).
MEDIUM = [
    ("APPLE STORE r123", "Office Supplies"),
    ("AMZN MKTP US*2K4", "Office Supplies"),
    ("SQ *THE CORNER CAFE", "Meals & Entertainment"),
    ("TST* BISTRO 44", "Meals & Entertainment"),
    ("PARKING garage 5th ave", "Travel"),
    ("LEGAL retainer", "Professional Services"),
    ("MARKETING sponsorship", "Marketing & Advertising"),
    ("INTERNET service", "Utilities"),
]

# Genuinely unknown merchants — the correct action is to ROUTE TO REVIEW,
# not to guess. Labeled with true category for scoring transparency.
UNKNOWN = [
    ("BLUE BOTTLE 44", "Meals & Entertainment"),
    ("HELVETICA STUDIO LLC", "Professional Services"),
    ("NORDSTROM #55", "Office Supplies"),
    ("VENMO * J DOE", "Uncategorized"),
    ("SQ *UNLISTED VENDOR", "Uncategorized"),
    ("CHECK #1043", "Uncategorized"),
    ("ZELLE payment", "Uncategorized"),
    ("POS DEBIT 8841", "Uncategorized"),
]

def amt(cat):
    ranges = {
        "Payroll": (4000, 22000), "Rent & Facilities": (2500, 9000),
        "Taxes": (800, 12000), "Cost of Goods Sold": (1200, 15000),
        "Insurance": (300, 2400), "Travel": (120, 1600),
        "Software & SaaS": (20, 1200), "Utilities": (60, 900),
        "Marketing & Advertising": (150, 5000),
        "Professional Services": (400, 6000),
        "Meals & Entertainment": (8, 320), "Office Supplies": (15, 900),
        "Bank & Card Fees": (3, 65), "Shipping & Postage": (9, 400),
        "Uncategorized": (20, 2000),
    }
    lo, hi = ranges.get(cat, (20, 800))
    return round(random.uniform(lo, hi), 2)

rows = []
def add(desc, cat, date):
    rows.append({"date": date, "description": desc, "amount": amt(cat), "_true": cat})

# In-period month = 2026-04. Fill clean + medium in period.
for desc, cat in CLEAN + MEDIUM + UNKNOWN:
    day = random.randint(1, 28)
    add(desc, cat, f"2026-04-{day:02d}")

# Inject 3 out-of-period rows (anomaly: wrong month).
add("STARBUCKS store 118", "Meals & Entertainment", "2026-03-27")
add("AWS EMEA cloud services", "Software & SaaS", "2026-05-02")
add("WEWORK membership", "Rent & Facilities", "2026-02-15")

# Inject 2 exact duplicates (anomaly: duplicate).
dupe = dict(rows[0]); rows.append(dupe)
dupe2 = dict(rows[10]); rows.append(dupe2)

random.shuffle(rows)

# Write user-facing CSV (no label column).
os.makedirs(os.path.join(ROOT, "public"), exist_ok=True)
with open(os.path.join(ROOT, "public", "sample-transactions.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["date", "description", "amount"])
    for r in rows:
        w.writerow([r["date"], r["description"], r["amount"]])

# Write labels for the eval.
with open(os.path.join(ROOT, "scripts", "labels.json"), "w") as f:
    json.dump([{"description": r["description"], "true": r["_true"]} for r in rows],
              f, indent=0)

print(f"wrote {len(rows)} transactions")
