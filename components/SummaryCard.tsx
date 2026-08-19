export function SummaryCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger" | "azure" | "ok";
}) {
  const toneClass = {
    default: "text-[var(--ink)]",
    danger: "text-[var(--danger)]",
    azure: "text-[var(--azure-deep)]",
    ok: "text-[var(--ok)]",
  }[tone];

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-5 shadow-sm">
      <p className="eyebrow text-[11px]">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tabular md:text-[28px] ${toneClass}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-[var(--slate-soft)]">{sub}</p>}
    </div>
  );
}
