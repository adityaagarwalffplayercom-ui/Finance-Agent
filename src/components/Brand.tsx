export function Brand({ className }: { className?: string }) {
  return (
    <div className={className ? `brand ${className}` : "brand"}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
        <line x1="7" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
        <circle cx="21" cy="7" r="5" fill="var(--color-amber)" opacity="0.9" />
      </svg>
      <span className="brand-word">Ledger</span>
    </div>
  );
}
