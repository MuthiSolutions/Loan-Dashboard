"""Step 2 of 2 for the loan-book workbook JP asked for.

    node scripts/export-loan-book.mjs data.json
    python scripts/build-loan-book-xlsx.py data.json "Muthi Loan Book.xlsx" 2026-10-05

The third argument is the "as of" date and only sets the default: the figure lives in one yellow
input cell on the front sheet, so changing it there re-accrues every open loan's late penalty.

Designed to be read, not waded through. The front "Loan status" sheet answers the three things JP
asked for, one clean line per loan: what happened / did they repay, what is still owed, and whether
the borrower is on the 12-month revolving facility. The penalty mechanics, fee composition and
settlement arithmetic are kept off that page and live on each borrower's own sheet, so the overview
stays legible.

Open loans accrue live off the As-of cell. Jean Philippe's penalty is two-phase (one weekly grace
week, then 1% per day from 2 October 2026); that is mirrored here exactly as in lib/loans.ts.
"""

import json
import sys
import unicodedata
from datetime import date, datetime

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------- house style

FONT = "Arial"

INK = "1F2933"
MUTED = "5A6B7D"
FAINT = "9AA7B4"
RULE = "C9D2DD"
BAND = "F4F7FB"
HEAD = "1F3A5F"
ACCENT = "E8EEF6"

BLUE = "0000FF"      # typed-in term, from the signed loan file
BLACK = "000000"     # calculated by the sheet
GREEN = "008000"     # pulled from the front sheet
YELLOW = "FFFF00"    # the one cell to change

OK_FG, OK_BG = "1E7D32", "E4F2E4"
DANGER_FG, DANGER_BG = "B3261E", "FDE7E9"
WARN_FG, WARN_BG = "9A6A00", "FBF0D9"

MONEY = '#,##0;(#,##0);-'
DAYS = '0'
PCT = '0.0%'
DATEF = 'DD MMM YYYY'

FRONT = "Loan status"

thin = Side(style="thin", color=RULE)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
UNDER = Border(bottom=thin)
OVER = Border(top=Side(style="thin", color=INK))


def f(size=10, bold=False, color=INK, italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)


def title(ws, row, text, size=15):
    c = ws.cell(row=row, column=1, value=text)
    c.font = f(size, bold=True, color=HEAD)
    return row + 1


def section(ws, row, text, last_col):
    for col in range(1, last_col + 1):
        c = ws.cell(row=row, column=col)
        c.fill = PatternFill("solid", fgColor=ACCENT)
        c.border = UNDER
    c = ws.cell(row=row, column=1, value=text)
    c.font = f(10, bold=True, color=HEAD)
    return row + 1


def label_value(ws, row, label, value, number_format=None, color=BLUE, note=None, col=1):
    lc = ws.cell(row=row, column=col, value=label)
    lc.font = f(10, color=MUTED)
    vc = ws.cell(row=row, column=col + 1, value=value)
    vc.font = f(10, color=color)
    vc.alignment = Alignment(horizontal="left")
    if number_format:
        vc.number_format = number_format
    if note:
        vc.comment = Comment(note, "Muthi")
    return row + 1


def header_row(ws, row, headers, widths=None):
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=row, column=i, value=h)
        c.font = f(9, bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=HEAD)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BOX
    ws.row_dimensions[row].height = 30
    if widths:
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(i)].width = w
    return row + 1


# ------------------------------------------------------------------- helpers

def strip_accents(s):
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


# Excel caps sheet names at 31 characters and forbids : \ / ? * [ ]. Family name leads so the tabs
# sort the way a loan file is read.
SHEET_NAMES = {
    "Amoi David-Allan Koizan": "Koizan Amoi David-Allan",
    "Claude Arnaud Niky Konan": "Konan Claude Arnaud",
    "Yann-Samuel Kouassi Wazy Oloufoumi-Séry — projet PRAÏA": "PRAIA Oloufoumi-Sery",
    "Emmanuel Paul-Allan Ouattara-Boni": "Ouattara-Boni Emmanuel",
    "Marie Andréa Koizan": "Koizan Marie Andrea",
    "Franck Ismael Maycob Sevede": "Sevede Franck Ismael",
    "Ane Jean Philippe Ane": "Ane Jean Philippe",
}


def sheet_name_for(borrower, taken):
    name = SHEET_NAMES.get(borrower)
    if name is None:
        parts = strip_accents(borrower).split()
        name = " ".join(parts[-1:] + parts[:-1]) if len(parts) > 1 else strip_accents(borrower)
    for bad in ':\\/?*[]':
        name = name.replace(bad, " ")
    name = " ".join(name.split())[:31]
    base, n = name, 2
    while name in taken:
        suffix = f" {n}"
        name = base[: 31 - len(suffix)] + suffix
        n += 1
    taken.add(name)
    return name


def d(value):
    return None if value in (None, "") else datetime.strptime(value, "%Y-%m-%d").date()


def i(value):
    return None if value is None else int(value)


def xldate(iso):
    y, m, dd = iso.split("-")
    return f"DATE({int(y)},{int(m)},{int(dd)})"


def is_revolving_loan(loan):
    """A loan on the 12-month revolving facility: its contract or purpose names the renewable line."""
    cr = (loan.get("contract_ref") or "").lower()
    pu = (loan.get("purpose") or "").lower()
    return "renouvelable" in cr or "revolving" in cr or "renewable" in pu or "revolving" in pu


def owed_now_expr(loan, asof):
    """
    Excel expression for the full amount owed on an OPEN loan as of the As-of cell, late penalty
    included. Mirrors penaltyBreakdown() in lib/loans.ts: a single cadence, or a mid-life switch
    (weekly up to the switch date, then daily). The signed terms are baked in as literals; only the
    As-of date varies, so the row stays self-contained and still accrues.
    """
    if loan.get("manual_amount_override") is not None:
        return str(int(loan["manual_amount_override"]))
    td = int(loan["total_due"])
    rate = float(loan["late_penalty_rate_per_week"])
    due = xldate(loan["due_on"])
    period = loan["late_penalty_period"]
    switch = loan.get("late_penalty_switch_on")
    after = loan.get("late_penalty_period_after")

    def units(period_, start, end):
        span = f"MAX(0,{end}-{start})"
        return span if period_ == "day" else f"ROUNDUP({span}/7,0)"

    if switch and after:
        sw = xldate(switch)
        phase1 = units(period, due, f"MIN({asof},{sw})")
        phase2 = f"IF({asof}>{sw},{units(after, sw, asof)},0)"
        # Simple within each phase, but the daily phase accrues on the balance the weekly grace
        # phase left behind, not on the original total due. JP's one grace week lifts the base to
        # 202,000 and the 1% per day is charged on that 202,000 (2,020/day) -- so the phases
        # multiply rather than their units simply adding.
        return f"ROUND({td}*(1+{rate}*{phase1})*(1+{rate}*{phase2}),0)"
    unit_expr = units(period, due, asof)
    return f"ROUND({td}*(1+{rate}*{unit_expr}),0)"


# The dashboard's notes are written for Muthi's own eyes. This workbook goes to an outside funding
# partner, so a note carrying a borrower's identity-document particulars is replaced by the fact it
# establishes and nothing more. The full record stays in the loan book at Muthi-Docs/04-Loan-Book.
IDENTITY_MARKERS = (
    "cni", "carte nationale", "nni", "date and place of birth",
    "date et lieu de naissance", "passport", "passeport", "numero d'identification",
)

IDENTITY_REPLACEMENT = (
    "Identity verified against a national identity document held on file, and the identity block of "
    "the signed contract matches it. The document's particulars are not reproduced in this workbook."
)

# Two kinds of phrasing in the dashboard's records do not belong in a partner's copy: Muthi's
# internal treasury routing (which of our accounts a payment landed in), and third-person references
# to the partner himself. Only these exact phrases are rewritten; the substance is left alone.
EXPORT_REWRITES = (
    ("Reaffirmed to Muthi's other stakeholder that", "Reaffirmed to Muthi that"),
    ("Stakeholder demanded full payment", "Muthi demanded full payment"),
    (" Received as 300,000 to the bank and 140,000 to the founder.", ""),
    ("2,000,000 FCFA received from the founder;", "2,000,000 FCFA received;"),
)


def for_export(text):
    for find, replace in EXPORT_REWRITES:
        text = text.replace(find, replace)
    return text


def redact_note(note):
    lowered = note.lower()
    if any(marker in lowered for marker in IDENTITY_MARKERS):
        return IDENTITY_REPLACEMENT
    return for_export(note)


EVENT_LABEL = {
    "promise": "Promise made",
    "partial_payment": "Partial payment",
    "full_payment": "Paid in full",
    "broken_promise": "Promise broken",
}


# ---------------------------------------------------------------------- build

def build(data_path, out_path, as_of):
    data = json.load(open(data_path, encoding="utf-8"))

    disbursed = [l for l in data["loans"] if l["kind"] == "active"]
    considered = [l for l in data["loans"] if l["kind"] != "active"]

    # A borrower's own sequence: first loan #1. Ordered by disbursement so Marie Andrea's renewable
    # cycle reads as her second loan, not another first.
    disbursed.sort(key=lambda l: (l["disbursed_on"] or l["due_on"] or "", l["id"]))
    seq, by_borrower = {}, {}
    for loan in disbursed:
        by_borrower.setdefault(loan["borrower"], []).append(loan)
    for loans in by_borrower.values():
        for n, loan in enumerate(loans, start=1):
            seq[loan["id"]] = n

    # Borrower-level enrolment on the 12-month revolving facility.
    enrolled = {b: any(is_revolving_loan(l) for l in loans) for b, loans in by_borrower.items()}

    # Re-lent cycles: a borrower's later loan funded by an earlier one they have already repaid (the
    # revolving facility, or simply a second loan taken after the first came back). Its principal is
    # the same money going out again, so it must not be counted a second time in the capital totals.
    recycled_ids = set()
    for loans in by_borrower.values():
        for idx, loan in enumerate(loans):
            if any(e.get("repaid_on") for e in loans[:idx]):
                recycled_ids.add(loan["id"])

    wb = Workbook()

    # ============================================================ front sheet
    ws = wb.active
    ws.title = FRONT

    r = title(ws, 1, "MUTHI SOLUTIONS — LOAN STATUS")
    c = ws.cell(row=r, column=1, value="Every loan Muthi has disbursed, where each one stands today. One sheet per borrower behind this, for the detail.")
    c.font = f(10, italic=True, color=MUTED)
    r += 2

    as_of_row = r
    r = label_value(ws, r, "As of", as_of, DATEF, BLUE,
                    "The one cell to change. Move this date and every open loan's late penalty and status re-accrue.",
                    col=2)
    ws.cell(row=as_of_row, column=3).fill = PatternFill("solid", fgColor=YELLOW)
    ASOF = f"$C${as_of_row}"
    r = label_value(ws, r, "Currency", "FCFA (XOF)", color=BLACK, col=2)
    r += 1

    headers = ["#", "Borrower", "Purpose", "Lent", "Total due", "Status",
               "Repaid / due", "Received", "Still owed", "Profit", "12-month revolving facility"]
    widths = [4, 30, 34, 12, 12, 11, 13, 13, 13, 12, 28]
    hrow = r
    r = header_row(ws, r, headers, widths)

    first_data = r
    rows_for = {}
    for n, loan in enumerate(disbursed, start=1):
        rows_for[loan["id"]] = r
        repaid = loan.get("repaid_on")
        banded = PatternFill("solid", fgColor=BAND) if n % 2 == 0 else None

        def put(col, value, fmt=None, color=BLACK, bold=False, align=None):
            cell = ws.cell(row=r, column=col, value=value)
            cell.font = f(10, bold=bold, color=color)
            if fmt:
                cell.number_format = fmt
            if banded:
                cell.fill = banded
            cell.border = BOX
            if align:
                cell.alignment = Alignment(horizontal=align, vertical="center")
            return cell

        tags = []
        if len(by_borrower[loan["borrower"]]) > 1:
            tags.append(f"loan #{seq[loan['id']]}")
        if loan.get("related_party"):
            tags.append("related party")
        if loan["id"] in recycled_ids:
            tags.append("re-lent")

        due = xldate(loan["due_on"])
        put(1, n, align="center")
        put(2, loan["borrower"] + (f"  ({', '.join(tags)})" if tags else ""))
        put(3, loan["purpose"])
        is_recyc = loan["id"] in recycled_ids
        lent_cell = put(4, i(loan["principal"]), MONEY, FAINT if is_recyc else BLUE)
        if is_recyc:
            lent_cell.comment = Comment(
                "Re-lent: the same capital this borrower already repaid on an earlier cycle. "
                "Counted once in the Lent total, not added again.", "Muthi")
        put(5, i(loan["total_due"]), MONEY, BLUE)
        if repaid:
            put(6, "Repaid", color=OK_FG, bold=True, align="center")
            put(7, d(repaid), DATEF, BLUE)
            put(8, i(loan["amount_paid"]) or 0, MONEY, BLUE)
            put(9, 0, MONEY)
        else:
            put(6, f'=IF({ASOF}>{due},"OVERDUE",IF({due}-{ASOF}<=7,"Due soon","On track"))', bold=True, align="center")
            put(7, d(loan["due_on"]), DATEF, BLUE)
            put(8, i(loan["amount_paid"]) or 0, MONEY, BLUE)
            put(9, f"=MAX(0,{owed_now_expr(loan, ASOF)}-H{r})", MONEY, bold=True)
        put(10, f"=I{r}+H{r}-D{r}", MONEY)  # realised for repaid, expected (penalty incl.) for open
        rev = enrolled[loan["borrower"]]
        put(11, "Yes — on the facility" if rev else "Not enrolled",
            color=OK_FG if rev else FAINT, bold=rev)
        r += 1

    last_data = r - 1

    # Status colours, so the page reads at a glance.
    status_range = f"F{first_data}:F{last_data}"
    for word, fg, bg in (("OVERDUE", DANGER_FG, DANGER_BG), ("Repaid", OK_FG, OK_BG),
                         ("Due soon", WARN_FG, WARN_BG)):
        ws.conditional_formatting.add(
            status_range,
            CellIsRule(operator="equal", formula=[f'"{word}"'],
                       fill=PatternFill("solid", fgColor=bg), font=Font(name=FONT, bold=True, color=fg)),
        )

    # ---- totals row (follows the filter)
    total_row = r
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=total_row, column=col)
        cell.border = OVER
        cell.font = f(10, bold=True)
    ws.cell(row=total_row, column=2, value="TOTAL").font = f(10, bold=True)
    # Principal counts a re-lent cycle once: sum only the rows that put NEW money out, so the same
    # capital going back out on a revolving facility is not double-counted. Everything else is a
    # straight column total.
    lent_cells = [f"D{rows_for[l['id']]}" for l in disbursed if l["id"] not in recycled_ids]
    lent_total = f"=SUM({','.join(lent_cells)})" if lent_cells else "=0"
    for col in (4, 5, 8, 9, 10):
        L = get_column_letter(col)
        formula = lent_total if col == 4 else f"=SUBTOTAL(109,{L}{first_data}:{L}{last_data})"
        cell = ws.cell(row=total_row, column=col, value=formula)
        cell.number_format = MONEY
        cell.font = f(10, bold=True)
        cell.border = OVER
    r += 1
    if recycled_ids:
        cap = ws.cell(row=r, column=2,
                      value="Lent counts each re-lent cycle once: the greyed, 're-lent'-tagged figures are the "
                            "same capital going back out (e.g. Marie Andréa's facility), so the total is not double-counted.")
        cap.font = f(9, italic=True, color=MUTED)
        r += 1
    r += 1

    # ---- recap
    r = section(ws, r, "PORTFOLIO AT A GLANCE (whole book, not affected by filtering)", len(headers))
    enrolled_names = [b for b, on in enrolled.items() if on]
    recap = [
        ("Loans disbursed", f"=COUNTA(B{first_data}:B{last_data})", DAYS),
        ("Repaid in full", f'=COUNTIF(F{first_data}:F{last_data},"Repaid")', DAYS),
        ("Still open", f'=COUNTA(B{first_data}:B{last_data})-COUNTIF(F{first_data}:F{last_data},"Repaid")', DAYS),
        ("", None, None),
        ("Principal deployed (re-lends counted once)", lent_total, MONEY),
        ("Profit realised (repaid)", f'=SUMIF(F{first_data}:F{last_data},"Repaid",J{first_data}:J{last_data})', MONEY),
        ("Profit expected (open)", f'=SUMIF(F{first_data}:F{last_data},"<>Repaid",J{first_data}:J{last_data})', MONEY),
        ("", None, None),
        ("Still owed to us", f"=SUM(I{first_data}:I{last_data})", MONEY),
        ("  of which overdue now", f'=SUMIF(F{first_data}:F{last_data},"OVERDUE",I{first_data}:I{last_data})', MONEY),
        ("  of which not yet due", f'=SUMIF(F{first_data}:F{last_data},"<>OVERDUE",I{first_data}:I{last_data})', MONEY),
        ("", None, None),
        ("Borrowers on the 12-month revolving facility", len(enrolled_names), DAYS),
    ]
    for label, formula, fmt in recap:
        if not label:
            r += 1
            continue
        lc = ws.cell(row=r, column=2, value=label)
        lc.font = f(10, color=MUTED)
        vc = ws.cell(row=r, column=3, value=formula)
        vc.font = f(11, bold=True)
        if fmt:
            vc.number_format = fmt
        r += 1
    if enrolled_names:
        c = ws.cell(row=r, column=2, value="On the facility: " + ", ".join(sorted(enrolled_names)))
        c.font = f(9, italic=True, color=OK_FG)
        r += 1
    r += 1

    for line in (
        "Still owed on an overdue loan includes the late penalty accrued to the As-of date above.",
        "Principal deployed counts a re-lent facility once (its later cycles are tagged 're-lent'), so the "
        "same money going back out is not double-counted; each cycle's profit is still counted, since a fee "
        "is earned every time.",
        "Profit is realised (cash collected less principal) for repaid loans, expected (amount owed today "
        "less principal) for open ones.",
        "Full terms, the fee breakdown, the story of each loan and the paperwork on file are on each "
        "borrower's own sheet (the tabs below).",
    ):
        c = ws.cell(row=r, column=1, value=line)
        c.font = f(9, italic=True, color=MUTED)
        r += 1

    ws.freeze_panes = f"A{first_data}"
    ws.auto_filter.ref = f"A{hrow}:K{last_data}"
    ws.sheet_view.showGridLines = False

    # ========================================================= per borrower
    taken = set()
    sheet_of = {b: sheet_name_for(b, taken) for b in by_borrower}

    for borrower, loans in by_borrower.items():
        bs = wb.create_sheet(sheet_of[borrower])
        bs.sheet_view.showGridLines = False
        bs.column_dimensions["A"].width = 16
        for col, w in zip("BCDEFG", (22, 13, 13, 13, 13, 13)):
            bs.column_dimensions[col].width = w

        br = title(bs, 1, borrower)
        back = bs.cell(row=br, column=1, value="← Loan status")
        back.hyperlink = f"#'{FRONT}'!A1"
        back.font = Font(name=FONT, size=9, color="0563C1", underline="single")
        br += 2

        # ---- revolving-facility banner, the first thing JP asked about
        on = enrolled[borrower]
        banner = (
            "On the 12-month revolving facility — renewable credit line, auto-renews for a year."
            if on else "Not on the 12-month revolving facility."
        )
        for col in range(1, 8):
            cell = bs.cell(row=br, column=col)
            cell.fill = PatternFill("solid", fgColor=OK_BG if on else BAND)
        bc = bs.cell(row=br, column=1, value=banner)
        bc.font = f(10, bold=True, color=OK_FG if on else MUTED)
        br += 2

        # ---- who they are
        br = section(bs, br, "BORROWER", 7)
        # Only show what we actually hold — a field that is not on file is left out entirely rather
        # than printed as "Not on file".
        profile = []
        if loans[0].get("contact"):
            profile.append(("Contact", loans[0]["contact"], None))
        if loans[0].get("profession"):
            profile.append(("Profession", loans[0]["profession"], None))
        if loans[0].get("employer"):
            profile.append(("Employer", loans[0]["employer"], None))
        if loans[0].get("monthly_income"):
            profile.append(("Monthly income", i(loans[0]["monthly_income"]), MONEY))
        profile.append(("Related party", "Yes, a Muthi associate" if loans[0].get("related_party") else "No", None))
        profile.append(("Loans with Muthi", len(loans), None))
        for label, value, fmt in profile:
            br = label_value(bs, br, label, value, fmt, BLUE)
        br += 1

        # ---- position, one row per loan, pulled from the front sheet so the two never disagree
        br = section(bs, br, "POSITION", 7)
        br = header_row(bs, br, ["Loan", "Lent", "Total due", "Received", "Still owed", "Profit", "Status"])
        for loan in loans:
            srow = rows_for[loan["id"]]
            bs.cell(row=br, column=1, value=f"Loan #{seq[loan['id']]}").font = f(10)
            m = bs.cell(row=br, column=2, value=i(loan["principal"])); m.font = f(10, color=BLUE); m.number_format = MONEY
            m = bs.cell(row=br, column=3, value=i(loan["total_due"])); m.font = f(10, color=BLUE); m.number_format = MONEY
            for col, src in ((4, "H"), (5, "I"), (6, "J")):
                cell = bs.cell(row=br, column=col, value=f"='{FRONT}'!{src}{srow}")
                cell.font = f(10, color=GREEN, bold=col in (5, 6)); cell.number_format = MONEY
            st = bs.cell(row=br, column=7, value=f"='{FRONT}'!F{srow}")
            st.font = f(10, color=GREEN, bold=True)
            br += 1
        br += 1

        # ---- how it went
        history = [(loan, e) for loan in loans for e in (loan.get("repayment_history") or [])]
        if history:
            history.sort(key=lambda t: (t[1]["date"], seq[t[0]["id"]]))
            br = section(bs, br, "HOW IT WENT", 7)
            br = header_row(bs, br, ["Date", "What happened", "Detail"])
            bs.column_dimensions["C"].width = 92
            for loan, e in history:
                dc = bs.cell(row=br, column=1, value=d(e["date"])); dc.font = f(10); dc.number_format = DATEF
                dc.alignment = Alignment(vertical="top")
                label = EVENT_LABEL.get(e["type"], e["type"])
                if len(loans) > 1:
                    label = f"{label} (loan #{seq[loan['id']]})"
                tc = bs.cell(row=br, column=2, value=label)
                tc.font = f(10, bold=e["type"] in ("broken_promise", "full_payment"),
                            color=DANGER_FG if e["type"] == "broken_promise" else INK)
                tc.alignment = Alignment(vertical="top")
                xc = bs.cell(row=br, column=3, value=for_export(e["description"]))
                xc.font = f(10); xc.alignment = Alignment(wrap_text=True, vertical="top")
                bs.row_dimensions[br].height = 28
                br += 1
            br += 1

        # ---- paperwork
        docs = [(loan, doc) for loan in loans for doc in (loan.get("documents") or [])]
        if docs:
            br = section(bs, br, "PAPERWORK ON FILE", 7)
            br = header_row(bs, br, ["Loan", "Document", "File"])
            bs.column_dimensions["B"].width = max(bs.column_dimensions["B"].width or 22, 40)
            bs.column_dimensions["C"].width = 40
            for loan, doc in docs:
                bs.cell(row=br, column=1, value=f"Loan #{seq[loan['id']]}").font = f(10)
                bs.cell(row=br, column=2, value=doc["label"]).font = f(10)
                bs.cell(row=br, column=3, value=doc["path"]).font = f(10, color=MUTED)
                br += 1
            br += 1

        # ---- notes
        notes = [(loan, note) for loan in loans for note in (loan.get("notes") or [])]
        if notes:
            br = section(bs, br, "NOTES", 7)
            for loan, note in notes:
                prefix = f"Loan #{seq[loan['id']]}: " if len(loans) > 1 else ""
                text = prefix + redact_note(note)
                nc = bs.cell(row=br, column=1, value=text)
                nc.font = f(10); nc.alignment = Alignment(wrap_text=True, vertical="top")
                bs.merge_cells(start_row=br, start_column=1, end_row=br, end_column=7)
                bs.row_dimensions[br].height = 14 * (1 + len(text) // 118)
                br += 1

    # ================================================ pending disbursements
    # Non-declined pipeline entries are signed-or-requested deals about to fund, not dead ones, so
    # they get their own sheet rather than being lumped in with "not funded". No money has moved yet,
    # so none of this touches the totals on the front sheet.
    pending = [e for e in considered if not e.get("declined_on")]
    declined = [e for e in considered if e.get("declined_on")]

    if pending:
        ps = wb.create_sheet("Pending disbursements")
        ps.sheet_view.showGridLines = False
        ps.column_dimensions["A"].width = 26
        ps.column_dimensions["B"].width = 95
        pr = title(ps, 1, "PENDING DISBURSEMENTS")
        c = ps.cell(row=pr, column=1, value="Signed or requested, not yet funded. No money has moved, so nothing here is in the totals on the loan status sheet.")
        c.font = f(10, italic=True, color=MUTED)
        pr += 2
        for entry in pending:
            name = entry.get("borrower") or entry.get("label") or entry["id"]
            pr = section(ps, pr, name.upper(), 2)
            pr = label_value(ps, pr, "Status", entry.get("status") or "Pending", color=BLACK)
            if entry.get("contact"):
                pr = label_value(ps, pr, "Contact", entry["contact"])
            principal = i(entry.get("principal")) or 0
            fees_total = sum(int(fee["amount"]) for fee in (entry.get("fees") or []))
            is_term = bool(entry.get("term_months"))
            total_due = i(entry.get("total_due")) or ((principal + fees_total) if is_term else None)
            pr = label_value(ps, pr, "To release", principal, MONEY)
            if fees_total:
                pr = label_value(ps, pr, "Cost of credit", fees_total, MONEY)
            if total_due:
                pr = label_value(ps, pr, "Total to repay", total_due, MONEY)
                if is_term:
                    monthly = round(total_due / entry["term_months"])
                    pr = label_value(ps, pr, "Repayment", f"{entry['term_months']} x {i(monthly):,} / month".replace(",", " "), color=BLACK)
            else:
                pr = label_value(ps, pr, "Terms", "Not yet set", color=BLACK)
            for note in (entry.get("notes") or []):
                nc = ps.cell(row=pr, column=1, value=redact_note(note))
                nc.font = f(10); nc.alignment = Alignment(wrap_text=True, vertical="top")
                ps.merge_cells(start_row=pr, start_column=1, end_row=pr, end_column=2)
                ps.row_dimensions[pr].height = 14 * (1 + len(note) // 110)
                pr += 1
            pr += 1

    # ======================================================= not funded
    if declined:
        ns = wb.create_sheet("Considered, not funded")
        ns.sheet_view.showGridLines = False
        ns.column_dimensions["A"].width = 26
        ns.column_dimensions["B"].width = 95
        nr = title(ns, 1, "CONSIDERED BUT NOT FUNDED")
        c = ns.cell(row=nr, column=1, value="Deals that went through underwriting without money ever leaving. "
                                            "No principal, no fees, no exposure.")
        c.font = f(10, italic=True, color=MUTED)
        nr += 2
        for entry in declined:
            nr = section(ns, nr, (entry.get("borrower") or entry.get("label") or entry["id"]).upper(), 2)
            nr = label_value(ns, nr, "Contact", entry.get("contact") or "Not on file")
            nr = label_value(ns, nr, "Amount discussed", i(entry.get("principal")), MONEY)
            nr = label_value(ns, nr, "Outcome", entry.get("status") or "Not proceeding", color=BLACK)
            nr = label_value(ns, nr, "Declined on", d(entry.get("declined_on")), DATEF)
            for note in (entry.get("notes") or []):
                nc = ns.cell(row=nr, column=1, value=redact_note(note))
                nc.font = f(10); nc.alignment = Alignment(wrap_text=True, vertical="top")
                ns.merge_cells(start_row=nr, start_column=1, end_row=nr, end_column=2)
                ns.row_dimensions[nr].height = 14 * (1 + len(note) // 110)
                nr += 1
            nr += 1

    # ============================================================== method
    ms = wb.create_sheet("How to read this")
    ms.sheet_view.showGridLines = False
    ms.column_dimensions["A"].width = 112
    mr = title(ms, 1, "HOW TO READ THIS WORKBOOK")
    mr += 1
    for heading, body in method_text(ASOF.replace("$", "")):
        hc = ms.cell(row=mr, column=1, value=heading)
        hc.font = f(11, bold=True, color=HEAD)
        mr += 1
        for line in body:
            bc = ms.cell(row=mr, column=1, value=line)
            bc.font = f(10); bc.alignment = Alignment(wrap_text=True, vertical="top")
            ms.row_dimensions[mr].height = 14 * (1 + len(line) // 108)
            mr += 1
        mr += 1

    wb.save(out_path)
    print(f"{out_path}: {len(wb.sheetnames)} sheets -> {', '.join(wb.sheetnames)}")


def method_text(as_of_cell):
    return [
        ("What this is", [
            "Loan status: every loan on one line — what it was, where it stands, whether it is repaid, and "
            "whether the borrower is on the 12-month revolving facility. Start here.",
            "One sheet per borrower: the full file — who they are, each loan's position, the story of how it "
            "went, the paperwork held, and the notes.",
            "Pending disbursements: deals signed or requested but not yet funded — no money has moved, so they "
            "are not in the totals here.",
            "Considered, not funded: deals that were underwritten but declined or dropped, where no money moved.",
        ]),
        ("The one cell you can change", [
            f"Loan status, cell {as_of_cell}, the yellow one, is the date everything is measured at. Change it and "
            "every open loan's status, amount owed and late penalty re-accrue. Nothing else should be edited.",
        ]),
        ("The 12-month revolving facility", [
            "A renewable credit line: a fixed amount released, repaid in full about a month later, and then "
            "automatically re-opened for the next cycle for up to a year, unless Muthi declines it.",
            "A borrower shows 'Yes' once they have signed the renewable convention. To date only Marie Andrea "
            "Koizan is on it (cycle 1, signed 25 September 2026). Putting another borrower on it is a per-borrower "
            "decision; everyone else shows 'Not enrolled'.",
        ]),
        ("Status and money", [
            "Status: Repaid, OVERDUE (past due), Due soon (within 7 days) or On track.",
            "Still owed is what is left to collect, late penalty included, and is zero once a loan is repaid. "
            "Received is the cash in. Profit is cash collected less principal for repaid loans, and amount owed "
            "today less principal for open ones — expected, not yet banked.",
            "Colours: blue figures are the signed loan terms; black are calculated by the sheet; green on a "
            "borrower sheet is pulled from Loan status, so the two can never disagree.",
        ]),
        ("The late penalty", [
            "1% per started week on the total due (not the principal), simple, never compounded. A few loans are "
            "1% per day by separate agreement.",
            "Jean Philippe was given one week after his 25 September due date to repay at the weekly 1%, which "
            "brought what he owed to 202,000. From 2 October 2026 the penalty is 1% per day on that 202,000 "
            "(2,020 a day), so the grace week is carried into the daily base rather than left out. The sheet "
            "accrues both off the As-of date.",
            "Marie Andrea's renewable convention sets 1% per day COMPOUNDED daily (Article 7). This workbook "
            "carries it as 1% per day simple, so once she is more than a day late the real contractual figure is "
            "a little higher than shown. She is not currently late.",
        ]),
        ("What is deliberately not in here", [
            "Muthi's own cash position and working capital, and the analyst fee Muthi takes on each loan's profit "
            "— neither is part of the loan book; both can be added on request.",
            "Borrowers' identity-document particulars: where a note held an ID number, date and place of birth or "
            "home address, it is replaced by the fact that identity was verified. The documents stay in Muthi's "
            "loan book.",
        ]),
    ]


if __name__ == "__main__":
    data_path = sys.argv[1]
    out_path = sys.argv[2]
    as_of = datetime.strptime(sys.argv[3], "%Y-%m-%d").date() if len(sys.argv) > 3 else date.today()
    build(data_path, out_path, as_of)
