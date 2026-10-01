"""Step 2 of 2 for the Excel loan book JP asked for.

Builds a workbook with a summary sheet plus one sheet per borrower from the JSON
that scripts/export-loan-book.mjs dumps.

    node scripts/export-loan-book.mjs data.json
    python scripts/build-loan-book-xlsx.py data.json "Muthi Loan Book.xlsx" 2026-10-01

The third argument is the "as of" date and only sets the default: the figure lives
in one input cell on the summary sheet, so changing it there re-accrues every open
loan's late penalty across the whole workbook.

Everything derived is a formula, never a Python-computed constant, so the workbook
still recalculates once it leaves here. Only the loan terms themselves are typed in
as values, and those are the blue cells.
"""

import json
import sys
import unicodedata
from datetime import date, datetime

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------- house style

FONT = "Arial"

INK = "1F2933"
RULE = "C9D2DD"
BAND = "F2F5F9"
HEAD = "1F3A5F"
ACCENT = "E8EEF6"

BLUE = "0000FF"      # typed-in input
BLACK = "000000"     # formula
GREEN = "008000"     # link to another sheet
YELLOW = "FFFF00"    # fill it in / key assumption

MONEY = '#,##0;(#,##0);-'
DAYS = '0'
PCT = '0.0%'
DATEF = 'DD MMM YYYY'

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
    lc.font = f(10, color="5A6B7D")
    vc = ws.cell(row=row, column=col + 1, value=value)
    vc.font = f(10, color=color)
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


# Excel caps sheet names at 31 characters and forbids : \ / ? * [ ]. Reversing the
# name so the family name leads keeps the tabs sorted the way a loan file is read.
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


# The dashboard's notes are written for Muthi's own eyes. This workbook goes to an outside
# funding partner, so a note carrying a borrower's identity-document particulars is replaced
# by the fact it establishes and nothing more. The full record stays in the loan book at
# Muthi-Docs/04-Loan-Book, which is where it belongs.
IDENTITY_MARKERS = (
    "cni", "carte nationale", "nni", "date and place of birth",
    "date et lieu de naissance", "passport", "passeport", "numero d'identification",
)

IDENTITY_REPLACEMENT = (
    "Identity verified against a national identity document held on file, and the identity "
    "block of the signed contract matches it. The document's particulars are not reproduced "
    "in this workbook."
)


# Two kinds of phrasing in the dashboard's own records do not belong in a partner's copy:
# Muthi's internal treasury routing (which of our accounts a payment landed in), and the
# third-person references to the partner himself that read oddly when he is the reader.
# Only these exact phrases are rewritten, the originals stay in the loan dashboard, and the
# substance of every record is left alone. Deliberately NOT rewritten: historical balances
# quoted as they were understood at the time, which are statements of record.
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

    # A borrower's own sequence: their first loan is #1. Ordered by disbursement so
    # Marie Andrea's renewable cycle reads as her second loan, not another first.
    disbursed.sort(key=lambda l: (l["disbursed_on"] or l["due_on"] or "", l["id"]))
    seq, by_borrower = {}, {}
    for loan in disbursed:
        by_borrower.setdefault(loan["borrower"], []).append(loan)
    for loans in by_borrower.values():
        for n, loan in enumerate(loans, start=1):
            seq[loan["id"]] = n

    wb = Workbook()

    # ============================================================== summary
    ws = wb.active
    ws.title = "Loan book"

    r = title(ws, 1, "MUTHI SOLUTIONS LOAN BOOK")
    c = ws.cell(row=r, column=1, value="Every loan disbursed to date, with one sheet per borrower behind this one.")
    c.font = f(10, italic=True, color="5A6B7D")
    r += 2

    as_of_row = r
    r = label_value(ws, r, "As of", as_of, DATEF, BLUE,
                    "Change this date and every open loan's late penalty re-accrues across the whole workbook.",
                    col=2)
    ws.cell(row=as_of_row, column=3).fill = PatternFill("solid", fgColor=YELLOW)
    AS_OF = f"$C${as_of_row}"

    r = label_value(ws, r, "Currency", "FCFA (XOF)", color=BLACK, col=2)
    r = label_value(ws, r, "Source", "Muthi loan dashboard database", color=BLACK, col=2)
    r += 1

    headers = ["Loan #", "Borrower", "Purpose", "Disbursed", "Due", "Repaid",
               "Principal", "Fees", "Total due", "Penalty rate", "Penalty per",
               "Days late", "Late penalty", "Settlement adj.", "Owed now", "Received",
               "Still outstanding", "Profit", "Status"]
    widths = [7, 56, 46, 12, 12, 12, 13, 12, 13, 9, 9, 9, 12, 13, 13, 13, 14, 13, 11]
    hrow = r
    r = header_row(ws, r, headers, widths)

    first_data = r
    rows_for = {}
    for n, loan in enumerate(disbursed, start=1):
        rows_for[loan["id"]] = r
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
                cell.alignment = Alignment(horizontal=align)
            return cell

        put(1, n, align="center")
        tags = []
        if len(by_borrower[loan["borrower"]]) > 1:
            tags.append(f"loan #{seq[loan['id']]}")
        if loan.get("related_party"):
            tags.append("related party")
        put(2, loan["borrower"] + (f"  ({', '.join(tags)})" if tags else ""))
        put(3, loan["purpose"])
        put(4, d(loan["disbursed_on"]), DATEF, BLUE)
        put(5, d(loan["due_on"]), DATEF, BLUE)
        put(6, d(loan["repaid_on"]), DATEF, BLUE)
        put(7, i(loan["principal"]), MONEY, BLUE)
        put(8, f"=I{r}-G{r}", MONEY)
        put(9, i(loan["total_due"]), MONEY, BLUE)
        put(10, float(loan["late_penalty_rate_per_week"]), PCT, BLUE)
        put(11, loan["late_penalty_period"], color=BLUE, align="center")
        # Accrual stops on the day a loan is settled; an open loan keeps running to "As of".
        put(12, f'=IF(E{r}="","",IF(F{r}="",MAX(0,{AS_OF}-E{r}),MAX(0,F{r}-E{r})))', DAYS)
        # The contractual penalty, by the rule on this row: whole days or whole started weeks,
        # per each loan's own contract. It is computed the same way whether the loan is closed
        # or still running, so the figure can always be checked against the rate beside it.
        put(13, f'=IF(L{r}="","",ROUND(I{r}*J{r}*IF(K{r}="day",L{r},IF(L{r}=0,0,ROUNDUP(L{r}/7,0))),0))', MONEY)
        # Anything collected above or below total due plus that penalty was negotiated, not
        # computed. PRAIA settled at 6,680,000 against a rule figure of 6,562,500; without this
        # column the 117,500 difference would hide inside "Late penalty" and refuse to reconcile.
        put(14, f'=IF(F{r}="",0,P{r}-I{r}-M{r})', MONEY)
        put(15, f'=IF(F{r}="",I{r}+M{r},P{r})', MONEY)
        put(16, i(loan["amount_paid"]) or 0, MONEY, BLUE)
        put(17, f"=MAX(0,O{r}-P{r})", MONEY)
        put(18, f"=O{r}-G{r}", MONEY, bold=True)
        put(19, f'=IF(F{r}<>"","Repaid",IF(E{r}="","",IF(L{r}>0,"OVERDUE",IF(E{r}-{AS_OF}<=7,"Due soon","On track"))))',
            align="center")
        r += 1

    last_data = r - 1
    total_row = r
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=total_row, column=col)
        cell.border = OVER
        cell.font = f(10, bold=True)
    ws.cell(row=total_row, column=2, value="TOTAL (follows the filter)").font = f(10, bold=True)
    # SUBTOTAL, not SUM: the table has an autofilter, and a total that ignores filtering sits
    # next to the filtered rows contradicting them. "Owed now" is deliberately not totalled -
    # adding cash already banked to cash still owed produces a number with no meaning.
    for col in (7, 8, 9, 13, 14, 16, 17, 18):
        L = get_column_letter(col)
        cell = ws.cell(row=total_row, column=col, value=f"=SUBTOTAL(109,{L}{first_data}:{L}{last_data})")
        cell.number_format = MONEY
        cell.font = f(10, bold=True)
        cell.border = OVER
    r += 2

    # ---- recap
    r = section(ws, r, "PORTFOLIO RECAP (whole book, not affected by filtering)", len(headers))
    recap = [
        ("Loans disbursed", f"=COUNTA(B{first_data}:B{last_data})", DAYS),
        ("Principal put out", f"=SUM(G{first_data}:G{last_data})", MONEY),
        ("Fees contracted on it", f"=SUM(H{first_data}:H{last_data})", MONEY),
        ("Late penalties charged", f"=SUM(M{first_data}:M{last_data})", MONEY),
        ("Settled above the rule", f"=SUM(N{first_data}:N{last_data})", MONEY),
        ("", None, None),
        ("Loans repaid in full", f'=COUNTIF(S{first_data}:S{last_data},"Repaid")', DAYS),
        ("Cash collected on them", f'=SUMIF(S{first_data}:S{last_data},"Repaid",P{first_data}:P{last_data})', MONEY),
        ("Profit realised", f'=SUMIF(S{first_data}:S{last_data},"Repaid",R{first_data}:R{last_data})', MONEY),
        ("", None, None),
        ("Loans still open", f'=COUNTA(B{first_data}:B{last_data})-COUNTIF(S{first_data}:S{last_data},"Repaid")', DAYS),
        ("Principal still out", f'=SUMIF(S{first_data}:S{last_data},"<>Repaid",G{first_data}:G{last_data})', MONEY),
        ("Overdue, collectable today", f'=SUMIF(S{first_data}:S{last_data},"OVERDUE",Q{first_data}:Q{last_data})', MONEY),
        ("Not yet due", f'=SUMIF(S{first_data}:S{last_data},"<>OVERDUE",Q{first_data}:Q{last_data})', MONEY),
        ("Total still owed to us", f"=SUM(Q{first_data}:Q{last_data})", MONEY),
        ("Profit expected on it", f'=SUMIF(S{first_data}:S{last_data},"<>Repaid",R{first_data}:R{last_data})', MONEY),
    ]

    for label, formula, fmt in recap:
        if not label:
            r += 1
            continue
        lc = ws.cell(row=r, column=2, value=label)
        lc.font = f(10, color="5A6B7D")
        vc = ws.cell(row=r, column=3, value=formula)
        vc.font = f(11, bold=True)
        vc.number_format = fmt
        r += 1

    r += 1
    for line in (
        "Blue figures are the signed loan terms, typed in from the loan files. "
        "Black figures are calculated by the sheet.",
        "Principal put out is cumulative. 300,000 of it is cycle 1 of Marie Andrea Koizan's renewable "
        "facility, which re-lent principal she had repaid two days earlier, so new money required was "
        "6,150,000 rather than 6,450,000.",
    ):
        c = ws.cell(row=r, column=1, value=line)
        c.font = f(9, italic=True, color="5A6B7D")
        r += 1

    ws.freeze_panes = f"C{first_data}"
    ws.auto_filter.ref = f"A{hrow}:S{last_data}"
    ws.sheet_view.showGridLines = False

    # ========================================================= per borrower
    taken = set()
    sheet_of = {}
    for borrower in by_borrower:
        sheet_of[borrower] = sheet_name_for(borrower, taken)

    for borrower, loans in by_borrower.items():
        bs = wb.create_sheet(sheet_of[borrower])
        bs.sheet_view.showGridLines = False
        ncol = 1 + len(loans)
        bs.column_dimensions["A"].width = 26
        for k in range(len(loans)):
            bs.column_dimensions[get_column_letter(2 + k)].width = 30

        br = title(bs, 1, borrower)
        back = bs.cell(row=br, column=1, value="Loan book summary")
        back.hyperlink = "#'Loan book'!A1"
        back.font = Font(name=FONT, size=9, color="0563C1", underline="single")
        br += 2

        # ---- who they are
        br = section(bs, br, "BORROWER", ncol)
        profile = [
            ("Contact", loans[0].get("contact")),
            ("Profession", loans[0].get("profession")),
            ("Employer", loans[0].get("employer")),
            ("Contract type", loans[0].get("employment_type")),
            ("Monthly income", i(loans[0].get("monthly_income"))),
            ("Years in post", loans[0].get("tenure_years")),
            ("Related party", "Yes, a Muthi associate" if loans[0].get("related_party") else "No"),
            ("Loans with Muthi", len(loans)),
        ]
        for label, value in profile:
            fmt = MONEY if label == "Monthly income" else None
            br = label_value(bs, br, label, value if value is not None else "Not on file", fmt,
                             BLUE if value is not None else "9AA7B4")
        br += 1

        # ---- the loans themselves, one column each, pulled from the summary
        br = section(bs, br, "LOAN TERMS AND POSITION", ncol)
        hdr = br
        bs.cell(row=hdr, column=1, value="").font = f(9, bold=True)
        for k, loan in enumerate(loans):
            c = bs.cell(row=hdr, column=2 + k, value=f"Loan #{seq[loan['id']]}")
            c.font = f(10, bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor=HEAD)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
        br += 1

        # (label, summary column, number format, bold)
        fields = [
            ("Contract", None, None, False),
            ("Purpose", "C", None, False),
            ("Disbursed", "D", DATEF, False),
            ("Due", "E", DATEF, False),
            ("Final deadline", "deadline", DATEF, False),
            ("Repaid", "F", DATEF, False),
            ("Principal released", "G", MONEY, False),
            ("Fees", "H", MONEY, False),
            ("Total due at maturity", "I", MONEY, True),
            ("Late penalty rate", "J", PCT, False),
            ("Charged per", "K", None, False),
            ("Days late", "L", DAYS, False),
            ("Late penalty", "M", MONEY, False),
            ("Settled above the rule", "N", MONEY, False),
            ("Owed now (incl. penalty)", "O", MONEY, True),
            ("Received to date", "P", MONEY, False),
            ("Still outstanding", "Q", MONEY, True),
            ("Profit", "R", MONEY, True),
            ("Status", "S", None, True),
        ]
        for label, col, fmt, bold in fields:
            lc = bs.cell(row=br, column=1, value=label)
            lc.font = f(10, bold=bold, color="5A6B7D")
            lc.border = UNDER
            lc.alignment = Alignment(vertical="top")
            for k, loan in enumerate(loans):
                srow = rows_for[loan["id"]]
                if col is None:
                    value, color = loan.get("contract_ref") or "Not on file", BLUE
                elif col == "deadline":
                    # A hard backstop communicated to the borrower beyond the ordinary due date.
                    # PRAIA had one; dropping it lost the only date that showed the deal was on
                    # its last extension.
                    value, color = d(loan.get("final_deadline")) or "None set", BLUE
                else:
                    value, color = f"=IF('Loan book'!{col}{srow}=\"\",\"\",'Loan book'!{col}{srow})", GREEN
                cell = bs.cell(row=br, column=2 + k, value=value)
                cell.font = f(10, bold=bold, color=color)
                cell.border = UNDER
                cell.alignment = Alignment(vertical="top", wrap_text=col is None)
                if fmt and not (col == "deadline" and isinstance(value, str)):
                    cell.number_format = fmt
            br += 1
        br += 1

        # ---- what the fees are actually made of
        br = section(bs, br, "WHAT THE FEES ARE MADE OF", ncol)
        br = header_row(bs, br, ["Loan", "Charge", "Amount"] + [""] * (ncol - 3 if ncol > 3 else 0))
        for loan in loans:
            for fee in (loan.get("fees") or []):
                bs.cell(row=br, column=1, value=f"Loan #{seq[loan['id']]}").font = f(10)
                bs.cell(row=br, column=2, value=fee["label"]).font = f(10)
                a = bs.cell(row=br, column=3, value=i(fee["amount"]))
                a.font = f(10, color=BLUE)
                a.number_format = MONEY
                br += 1
        bs.column_dimensions["C"].width = 16
        br += 1

        # ---- how it actually went
        history = [(loan, e) for loan in loans for e in (loan.get("repayment_history") or [])]
        if history:
            history.sort(key=lambda t: (t[1]["date"], seq[t[0]["id"]]))
            br = section(bs, br, "HOW IT WENT", ncol)
            br = header_row(bs, br, ["Date", "What happened", "Detail"])
            for loan, e in history:
                dc = bs.cell(row=br, column=1, value=d(e["date"]))
                dc.font = f(10)
                dc.number_format = DATEF
                dc.alignment = Alignment(vertical="top")
                label = EVENT_LABEL.get(e["type"], e["type"])
                if len(loans) > 1:
                    label = f"{label} (loan #{seq[loan['id']]})"
                tc = bs.cell(row=br, column=2, value=label)
                tc.font = f(10, bold=e["type"] in ("broken_promise", "full_payment"),
                            color="B3261E" if e["type"] == "broken_promise" else INK)
                tc.alignment = Alignment(vertical="top")
                xc = bs.cell(row=br, column=3, value=for_export(e["description"]))
                xc.font = f(10)
                xc.alignment = Alignment(wrap_text=True, vertical="top")
                bs.row_dimensions[br].height = 28
                br += 1
            bs.column_dimensions["C"].width = 90
            br += 1

        # ---- paperwork
        docs = [(loan, doc) for loan in loans for doc in (loan.get("documents") or [])]
        if docs:
            br = section(bs, br, "PAPERWORK ON FILE", ncol)
            br = header_row(bs, br, ["Loan", "Document", "File"])
            bs.column_dimensions["B"].width = max(bs.column_dimensions["B"].width or 30, 46)
            for loan, doc in docs:
                bs.cell(row=br, column=1, value=f"Loan #{seq[loan['id']]}").font = f(10)
                bs.cell(row=br, column=2, value=doc["label"]).font = f(10)
                bs.cell(row=br, column=3, value=doc["path"]).font = f(10, color="5A6B7D")
                br += 1
            br += 1

        # ---- notes
        notes = [(loan, n) for loan in loans for n in (loan.get("notes") or [])]
        if notes:
            br = section(bs, br, "NOTES", ncol)
            for loan, note in notes:
                prefix = f"Loan #{seq[loan['id']]}: " if len(loans) > 1 else ""
                note = redact_note(note)
                nc = bs.cell(row=br, column=1, value=prefix + note)
                nc.font = f(10)
                nc.alignment = Alignment(wrap_text=True, vertical="top")
                bs.merge_cells(start_row=br, start_column=1, end_row=br, end_column=max(3, ncol))
                bs.row_dimensions[br].height = 14 * (1 + len(note) // 110)
                br += 1

    # ======================================================= not funded
    if considered:
        ns = wb.create_sheet("Considered, not funded")
        ns.sheet_view.showGridLines = False
        ns.column_dimensions["A"].width = 26
        ns.column_dimensions["B"].width = 95
        nr = title(ns, 1, "CONSIDERED BUT NOT FUNDED")
        c = ns.cell(row=nr, column=1, value="Deals that went through underwriting without money ever leaving. "
                                            "No principal, no fees, no exposure.")
        c.font = f(10, italic=True, color="5A6B7D")
        nr += 2
        for entry in considered:
            nr = section(ns, nr, (entry.get("borrower") or entry.get("label") or entry["id"]).upper(), 2)
            nr = label_value(ns, nr, "Contact", entry.get("contact") or "Not on file")
            nr = label_value(ns, nr, "Amount discussed", i(entry.get("principal")), MONEY)
            nr = label_value(ns, nr, "Fees discussed",
                             sum(i(x["amount"]) for x in (entry.get("fees") or [])), MONEY)
            nr = label_value(ns, nr, "Term (months)", entry.get("term_months"))
            nr = label_value(ns, nr, "Deferral (months)", entry.get("deferral_months"))
            nr = label_value(ns, nr, "Outcome", entry.get("status") or "Not proceeding", color=BLACK)
            nr = label_value(ns, nr, "Declined on", d(entry.get("declined_on")), DATEF)
            for doc in (entry.get("documents") or []):
                nr = label_value(ns, nr, doc["label"], doc["path"], color="5A6B7D")
            for note in (entry.get("notes") or []):
                nc = ns.cell(row=nr, column=1, value=redact_note(note))
                nc.font = f(10)
                nc.alignment = Alignment(wrap_text=True, vertical="top")
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
    for heading, body in method_text(AS_OF.replace("$", "")):
        hc = ms.cell(row=mr, column=1, value=heading)
        hc.font = f(11, bold=True, color=HEAD)
        mr += 1
        for line in body:
            bc = ms.cell(row=mr, column=1, value=line)
            bc.font = f(10)
            bc.alignment = Alignment(wrap_text=True, vertical="top")
            ms.row_dimensions[mr].height = 14 * (1 + len(line) // 105)
            mr += 1
        mr += 1

    wb.save(out_path)
    print(f"{out_path}: {len(wb.sheetnames)} sheets -> {', '.join(wb.sheetnames)}")


def method_text(as_of_cell):
    """The as-of cell address is derived, never hardcoded: it moved once already."""
    return [
        ("Sheets", [
            "Loan book: every loan on one row. Start here.",
            "One sheet per borrower: the full file on that person, who they are, the terms of each "
            "loan they took, what the fees were made of, every promise and payment, and the paperwork held.",
            "Considered, not funded: deals underwritten where no money ever moved.",
        ]),
        ("The one cell you can change", [
            f"Loan book, cell {as_of_cell}, the yellow one, is the date everything is measured at. Change it and "
            "every open loan's days late and late penalty re-accrue. Nothing else should be edited.",
        ]),
        ("Colours", [
            "Blue figures were typed in from the signed loan files: principal, total due, the dates, "
            "the penalty rate, and cash actually received.",
            "Black figures are calculated by the sheet from those.",
            "Green figures on a borrower sheet are pulled from the Loan book sheet, so the two can never disagree.",
        ]),
        ("How the late penalty works", [
            "Each loan carries its own rate and its own period, both shown on its row. Most are 1% per "
            "started week on the total due; a few are 1% per day by separate agreement with the borrower.",
            "It is charged on the total due, not on the principal, and it is simple rather than compounded: "
            "ten days late at 1% per day is 10% of the total due, not 1.01 to the tenth power.",
            "Accrual runs from the due date to the date of repayment, or to the As of date while a loan is still open.",
            "Marie Andrea Koizan's renewable facility is the one place this understates the contract. "
            "Article 7 of the convention she signed on 25 September 2026 sets 1% per day compounded daily. "
            "The figure here is 1% per day simple, so once she is more than a day late the real contractual "
            "amount is higher than what this workbook shows. See the note on her sheet.",
        ]),
        ("Reading the totals", [
        "The TOTAL row uses SUBTOTAL, so it follows the filter: filter the table to one borrower and "
        "the totals describe that borrower. The PORTFOLIO RECAP below always describes the whole book.",
        "Owed now is deliberately not totalled. Adding cash already banked to cash still owed gives a "
        "number that means nothing; Total still owed to us in the recap is the figure to read.",
        "Still owed is split into what is overdue and collectable today and what is simply not due yet. "
        "Marie Andrea Koizan's 350,000 is not due until 25 October and is not a collection problem.",
    ]),
    ("Profit", [
            "For a repaid loan, profit is the cash actually collected less the principal released. It therefore "
            "includes any late penalty collected, which is why PRAIA shows 1,680,000 and not the 1,250,000 contracted.",
            "For an open loan it is the amount owed today, penalty included, less the principal. It is expected, not banked.",
        ]),
        ("What is deliberately not in here", [
            "Muthi's own cash position and working capital, and the analyst fee Muthi's own analysts take on each "
            "loan's profit. Neither is part of the loan book; both can be added on request.",
        ]),
    ]


if __name__ == "__main__":
    data_path = sys.argv[1]
    out_path = sys.argv[2]
    as_of = datetime.strptime(sys.argv[3], "%Y-%m-%d").date() if len(sys.argv) > 3 else date.today()
    build(data_path, out_path, as_of)
