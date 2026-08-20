import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/deadlines", label: "Deadlines" },
];

export function Header({ asOf, current = "/" }: { asOf: Date; current?: string }) {
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

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                current === item.href ? "bg-white/15 text-[var(--paper)]" : "text-[var(--mist)] hover:bg-white/10"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

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
