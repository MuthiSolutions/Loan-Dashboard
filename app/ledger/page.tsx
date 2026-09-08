import { getAllCashMovements, getCashPosition } from "@/lib/repo";
import { formatFCFA } from "@/lib/loans";
import { Header } from "@/components/Header";
import { LedgerTable } from "@/components/LedgerTable";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const asOf = new Date();
  const [movements, cashPosition] = await Promise.all([getAllCashMovements(), getCashPosition()]);

  const bankMovements = movements.filter((m) => m.account === "bank");
  const founderMovements = movements.filter((m) => m.account === "founder");
  const total = cashPosition.inBank + cashPosition.heldByFounder;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/ledger" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <p className="eyebrow text-[11px]">Full accounting detail</p>
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Ledger</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--slate-soft)]">
            Every cash movement Muthi has recorded, one account at a time, in standard debit/credit form. For an asset
            account like these, a debit is money coming in and a credit is money going out — the balance at the
            bottom of each table is a running total, not a hand-entered figure.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--sapphire-line)] bg-[var(--sapphire)] p-6 text-[var(--paper)] shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs tracking-wide text-[var(--azure-soft)] uppercase">Bank</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular">{formatFCFA(cashPosition.inBank)}</p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-[var(--azure-soft)] uppercase">Founder</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular">{formatFCFA(cashPosition.heldByFounder)}</p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-[var(--azure-soft)] uppercase">Total cash</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular">{formatFCFA(total)}</p>
            </div>
          </div>
        </div>

        <LedgerTable title="Bank account (exploitation)" movements={bankMovements} />
        <LedgerTable title="Founder-held cash" movements={founderMovements} />
      </main>
    </div>
  );
}
