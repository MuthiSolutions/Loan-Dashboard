import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";

export function Header({ asOf }: { asOf: Date }) {
  const updated = asOf.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="bg-[var(--sapphire)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <div>
            <p className="eyebrow text-[11px] text-[var(--azure-soft)]">Muthi Solutions</p>
            <h1 className="font-display text-2xl font-semibold text-[var(--paper)]">Loan Portfolio</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-[var(--mist)]">
            <p className="font-semibold text-[var(--mist-soft)]">Internal — confidential</p>
            <p>As of {updated}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
