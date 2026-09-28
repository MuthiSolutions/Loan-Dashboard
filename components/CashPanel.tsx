import type { CashMovement, CashPosition } from "@/lib/types";
import { WORKING_CAPITAL_DEPOSITED, formatDate, formatFCFA } from "@/lib/loans";

const ACCOUNT_LABEL = { bank: "Bank", founder: "Founder" };

type DisplayMovement =
  | { kind: "single"; key: string; description: string; account: CashMovement["account"]; amount: number; occurredOn: string }
  | { kind: "transfer"; key: string; description: string; from: CashMovement["account"]; to: CashMovement["account"]; amount: number; occurredOn: string };

/** Groups the two legs of an internal transfer (same transferId) into one "A -> B" line instead of a debit and a credit that net to zero and read as unrelated entries. */
function toDisplayMovements(movements: CashMovement[]): DisplayMovement[] {
  const seen = new Set<number>();
  const result: DisplayMovement[] = [];

  for (const m of movements) {
    if (seen.has(m.id)) continue;
    const pair = m.transferId ? movements.find((o) => o.id !== m.id && o.transferId === m.transferId) : undefined;

    if (pair) {
      seen.add(m.id);
      seen.add(pair.id);
      const from = m.amount < 0 ? m : pair;
      const to = m.amount < 0 ? pair : m;
      result.push({
        kind: "transfer",
        key: m.transferId!,
        description: to.description,
        from: from.account,
        to: to.account,
        amount: Math.abs(m.amount),
        occurredOn: m.occurredOn,
      });
    } else {
      seen.add(m.id);
      result.push({ kind: "single", key: String(m.id), description: m.description, account: m.account, amount: m.amount, occurredOn: m.occurredOn });
    }
  }

  return result;
}

/**
 * `deployedPrincipal` is own money currently out with borrowers, so cash on hand plus deployed
 * is everything the working capital has become. Anything above the deposit is retained profit.
 */
export function CashPanel({ cash, deployedPrincipal }: { cash: CashPosition; deployedPrincipal: number }) {
  const total = cash.inBank + cash.heldByFounder;
  const displayMovements = toDisplayMovements(cash.movements);
  const capitalAccountedFor = total + deployedPrincipal;
  const aboveDeposit = capitalAccountedFor - WORKING_CAPITAL_DEPOSITED;

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-[var(--sapphire)] p-6 text-[var(--paper)] shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow text-[11px] text-[var(--azure-soft)]">Cash position</p>
        <p className="font-display text-3xl font-semibold tabular">{formatFCFA(total)}</p>
      </div>
      <p className="mt-1 text-xs text-[var(--mist-soft)]">
        Muthi deposited {formatFCFA(WORKING_CAPITAL_DEPOSITED)} for working capital
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs tracking-wide text-[var(--mist)] uppercase">In bank</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatFCFA(cash.inBank)}</p>
          <p className="mt-1 text-xs text-[var(--mist-soft)]">Liquid, available now</p>
        </div>
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs tracking-wide text-[var(--mist)] uppercase">Held by founder</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatFCFA(cash.heldByFounder)}</p>
          <p className="mt-1 text-xs text-[var(--mist-soft)]">Not yet deposited to the bank</p>
        </div>
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs tracking-wide text-[var(--mist)] uppercase">Out with borrowers</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatFCFA(deployedPrincipal)}</p>
          <p className="mt-1 text-xs text-[var(--mist-soft)]">Principal deployed, not yet back</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-xl bg-white/5 px-4 py-3 text-xs">
        <span className="text-[var(--mist-soft)]">
          On hand plus deployed{" "}
          <span className="tabular font-medium text-[var(--paper)]">{formatFCFA(capitalAccountedFor)}</span>
        </span>
        <span className="text-[var(--mist-soft)]">
          Against the {formatFCFA(WORKING_CAPITAL_DEPOSITED)} deposited{" "}
          <span className={`tabular font-medium ${aboveDeposit >= 0 ? "text-[var(--ok)]" : "text-[var(--mist)]"}`}>
            {aboveDeposit >= 0 ? "+" : ""}
            {formatFCFA(aboveDeposit)}
          </span>
        </span>
      </div>

      {displayMovements.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[11px] tracking-wide text-[var(--mist)] uppercase">Recent movements</p>
          <ul className="mt-2 space-y-1.5">
            {displayMovements.map((m) =>
              m.kind === "transfer" ? (
                <li key={m.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-[var(--mist-soft)]">
                    {m.description}
                    <span className="text-[var(--mist-soft)]/70">
                      {" "}
                      · {ACCOUNT_LABEL[m.from]} → {ACCOUNT_LABEL[m.to]} · {formatDate(m.occurredOn)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular font-medium text-[var(--paper)]">{formatFCFA(m.amount)}</span>
                </li>
              ) : (
                <li key={m.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-[var(--mist-soft)]">
                    {m.description}
                    <span className="text-[var(--mist-soft)]/70"> · {ACCOUNT_LABEL[m.account]} · {formatDate(m.occurredOn)}</span>
                  </span>
                  <span className={`shrink-0 tabular font-medium ${m.amount >= 0 ? "text-[var(--ok)]" : "text-[var(--mist)]"}`}>
                    {m.amount >= 0 ? "+" : ""}
                    {formatFCFA(m.amount)}
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
