export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="42" height="42" rx="2" stroke="var(--azure)" strokeWidth="2" />
      <path
        d="M13 32V16l11 11 11-11v16"
        stroke="var(--azure)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="12" y1="38" x2="36" y2="38" stroke="var(--azure)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
