import { NextResponse } from "next/server";
import { insertLoan, type NewLoanInput } from "@/lib/repo";

function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip combining diacritics left after NFD normalization
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "deal"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const kind = body.kind;
  const nameField = kind === "pipeline_term" ? body.label : body.borrower;
  if (!nameField || typeof nameField !== "string") {
    return NextResponse.json({ error: "Borrower / label is required." }, { status: 400 });
  }
  if (!body.principal || Number(body.principal) <= 0) {
    return NextResponse.json({ error: "Principal must be a positive number." }, { status: 400 });
  }
  if (!["active", "pipeline_term", "pipeline_pending"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  }
  if (kind === "active" && !body.dueOn) {
    return NextResponse.json({ error: "Due date is required for an active loan." }, { status: 400 });
  }

  const fees = Array.isArray(body.fees)
    ? body.fees
        .filter((f: unknown) => f && typeof f === "object")
        .map((f: { label?: string; amount?: number }) => ({
          label: String(f.label ?? "Fee"),
          amount: Number(f.amount ?? 0),
        }))
        .filter((f: { amount: number }) => f.amount > 0)
    : [];

  const feesTotal = fees.reduce((sum: number, f: { amount: number }) => sum + f.amount, 0);
  const principal = Number(body.principal);
  const totalDue = body.totalDue ? Number(body.totalDue) : principal + feesTotal;

  const notes: string[] = typeof body.notes === "string"
    ? body.notes.split("\n").map((s: string) => s.trim()).filter(Boolean)
    : [];

  const id = `${slugify(nameField)}-${Date.now().toString(36)}`;

  const input: NewLoanInput = {
    id,
    kind,
    borrower: nameField,
    purpose: body.purpose || undefined,
    contact: body.contact || undefined,
    principal,
    fees,
    totalDue: kind === "pipeline_term" ? undefined : totalDue,
    disbursedOn: body.disbursedOn || undefined,
    dueOn: body.dueOn || undefined,
    latePenaltyRatePerWeek: body.latePenaltyRatePerWeek ? Number(body.latePenaltyRatePerWeek) : undefined,
    contractRef: body.contractRef || undefined,
    relatedParty: Boolean(body.relatedParty),
    requestedAmount: body.requestedAmount ? Number(body.requestedAmount) : undefined,
    termMonths: body.termMonths ? Number(body.termMonths) : undefined,
    deferralMonths: body.deferralMonths ? Number(body.deferralMonths) : undefined,
    status: body.status || undefined,
    notes,
  };

  await insertLoan(input);

  return NextResponse.json({ ok: true, id });
}
