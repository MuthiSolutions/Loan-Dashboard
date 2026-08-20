"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";

type Kind = "active" | "pipeline_pending" | "pipeline_term";

interface FeeRow {
  label: string;
  amount: string;
}

const inputClass =
  "w-full rounded-lg border border-[var(--cream-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--azure)]";
const labelClass = "text-xs font-semibold tracking-wide text-[var(--slate)] uppercase";

export default function NewLoanPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("active");
  const [borrower, setBorrower] = useState("");
  const [purpose, setPurpose] = useState("");
  const [contact, setContact] = useState("");
  const [principal, setPrincipal] = useState("");
  const [fees, setFees] = useState<FeeRow[]>([{ label: "", amount: "" }]);
  const [totalDue, setTotalDue] = useState("");
  const [disbursedOn, setDisbursedOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [latePenaltyPercent, setLatePenaltyPercent] = useState("1");
  const [contractRef, setContractRef] = useState("");
  const [relatedParty, setRelatedParty] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState("");
  const [termMonths, setTermMonths] = useState("36");
  const [deferralMonths, setDeferralMonths] = useState("0");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateFee(i: number, patch: Partial<FeeRow>) {
    setFees((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function addFee() {
    setFees((prev) => [...prev, { label: "", amount: "" }]);
  }

  function removeFee(i: number) {
    setFees((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!borrower.trim()) {
      setError(kind === "pipeline_term" ? "Deal label is required." : "Borrower name is required.");
      return;
    }
    if (!principal || Number(principal) <= 0) {
      setError("Principal must be a positive number.");
      return;
    }
    if (kind === "active" && !dueOn) {
      setError("Due date is required for an active loan.");
      return;
    }

    setLoading(true);

    const payload = {
      kind,
      borrower: kind !== "pipeline_term" ? borrower : undefined,
      label: kind === "pipeline_term" ? borrower : undefined,
      purpose: kind !== "pipeline_term" ? purpose : undefined,
      contact: contact || undefined,
      principal: Number(principal),
      fees: fees
        .filter((f) => f.label.trim() && Number(f.amount) > 0)
        .map((f) => ({ label: f.label.trim(), amount: Number(f.amount) })),
      totalDue: totalDue ? Number(totalDue) : undefined,
      disbursedOn: kind === "active" ? disbursedOn || undefined : undefined,
      dueOn: kind === "active" ? dueOn || undefined : undefined,
      latePenaltyRatePerWeek: kind === "active" ? Number(latePenaltyPercent) / 100 : undefined,
      contractRef: kind === "active" ? contractRef || undefined : undefined,
      relatedParty: kind === "active" ? relatedParty : undefined,
      requestedAmount: kind === "pipeline_pending" ? requestedAmount ? Number(requestedAmount) : undefined : undefined,
      termMonths: kind === "pipeline_term" ? Number(termMonths) : undefined,
      deferralMonths: kind === "pipeline_term" ? Number(deferralMonths) : undefined,
      status: kind !== "active" ? status || undefined : undefined,
      notes,
    };

    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
    }
  }

  const feesTotal = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const suggestedTotal = (Number(principal) || 0) + feesTotal;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <header className="bg-[var(--sapphire)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-6">
          <Logo className="h-8 w-8" />
          <div>
            <p className="eyebrow text-[11px] text-[var(--azure-soft)]">Muthi Solutions</p>
            <h1 className="font-display text-xl font-semibold text-[var(--paper)]">Add a deal</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <a href="/" className="text-sm text-[var(--azure-deep)] hover:underline">
          ← Back to dashboard
        </a>

        <form onSubmit={handleSubmit} className="mt-4 space-y-6 rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
          <div>
            <p className={labelClass}>Deal type</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  ["active", "Active loan (disbursed)"],
                  ["pipeline_pending", "Pipeline — awaiting disbursement"],
                  ["pipeline_term", "Pipeline — term loan negotiation"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                    kind === value
                      ? "border-[var(--azure)] bg-[var(--paper)] text-[var(--azure-deep)]"
                      : "border-[var(--cream-2)] text-[var(--slate)] hover:border-[var(--azure)]/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{kind === "pipeline_term" ? "Deal label" : "Borrower name"}</label>
              <input className={`${inputClass} mt-1`} value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="e.g. Jane Doe" />
            </div>
            <div>
              <label className={labelClass}>Contact</label>
              <input className={`${inputClass} mt-1`} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" />
            </div>
          </div>

          {kind !== "pipeline_term" && (
            <div>
              <label className={labelClass}>Purpose</label>
              <input className={`${inputClass} mt-1`} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What the financing is for" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Principal (FCFA)</label>
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min="0"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="150000"
              />
            </div>
            {kind !== "pipeline_term" && (
              <div>
                <label className={labelClass}>Total due (FCFA)</label>
                <input
                  className={`${inputClass} mt-1`}
                  type="number"
                  min="0"
                  value={totalDue}
                  onChange={(e) => setTotalDue(e.target.value)}
                  placeholder={suggestedTotal > 0 ? String(suggestedTotal) : "Principal + fees"}
                />
                <p className="mt-1 text-xs text-[var(--slate-soft)]">Leave blank to use principal + fees ({suggestedTotal.toLocaleString("fr-FR")}).</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={labelClass}>Fees</label>
              <button type="button" onClick={addFee} className="text-xs font-semibold text-[var(--azure-deep)] hover:underline">
                + Add fee
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {fees.map((fee, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Label (e.g. Financing fee 25%)"
                    value={fee.label}
                    onChange={(e) => updateFee(i, { label: e.target.value })}
                  />
                  <input
                    className={`${inputClass} max-w-[140px]`}
                    type="number"
                    min="0"
                    placeholder="Amount"
                    value={fee.amount}
                    onChange={(e) => updateFee(i, { amount: e.target.value })}
                  />
                  {fees.length > 1 && (
                    <button type="button" onClick={() => removeFee(i)} className="px-2 text-[var(--danger)]" aria-label="Remove fee">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {kind === "active" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Disbursed on</label>
                  <input className={`${inputClass} mt-1`} type="date" value={disbursedOn} onChange={(e) => setDisbursedOn(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Due on</label>
                  <input className={`${inputClass} mt-1`} type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Late penalty (%/week)</label>
                  <input
                    className={`${inputClass} mt-1`}
                    type="number"
                    step="0.1"
                    min="0"
                    value={latePenaltyPercent}
                    onChange={(e) => setLatePenaltyPercent(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Contract reference</label>
                  <input
                    className={`${inputClass} mt-1`}
                    value={contractRef}
                    onChange={(e) => setContractRef(e.target.value)}
                    placeholder="e.g. Convention de Prêt, 20 août 2026"
                  />
                </div>
                <label className="mt-6 flex items-center gap-2 text-sm text-[var(--slate)]">
                  <input type="checkbox" checked={relatedParty} onChange={(e) => setRelatedParty(e.target.checked)} />
                  Related-party loan (Muthi associate)
                </label>
              </div>
            </>
          )}

          {kind === "pipeline_pending" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Requested amount (if more than principal)</label>
                <input
                  className={`${inputClass} mt-1`}
                  type="number"
                  min="0"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <input className={`${inputClass} mt-1`} value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. Awaiting CNI" />
              </div>
            </div>
          )}

          {kind === "pipeline_term" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Term (months)</label>
                <input className={`${inputClass} mt-1`} type="number" min="1" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Deferral (months)</label>
                <input className={`${inputClass} mt-1`} type="number" min="0" value={deferralMonths} onChange={(e) => setDeferralMonths(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <input className={`${inputClass} mt-1`} value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. Under negotiation" />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Notes (one per line)</label>
            <textarea className={`${inputClass} mt-1`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--azure-deep)] px-4 py-2.5 font-semibold text-[var(--paper)] transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Add deal"}
          </button>
          <p className="text-xs text-[var(--slate-soft)]">
            Documents (contracts, fiches) aren&apos;t attached from here yet — send them separately and they&apos;ll be linked in.
          </p>
        </form>
      </main>
    </div>
  );
}
