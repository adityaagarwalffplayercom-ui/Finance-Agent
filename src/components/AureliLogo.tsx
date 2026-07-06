type AureliLogoProps = {
  size?: number;
  showWordmark?: boolean;
  tagline?: string;
};

export function AureliLogo({
  size = 34,
  showWordmark = false,
  tagline,
}: AureliLogoProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 11,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          color: "var(--color-gold)",
          background:
            "radial-gradient(circle at 35% 25%, rgba(255,209,102,0.34), rgba(245,158,11,0.14) 42%, rgba(255,255,255,0.035) 72%)",
          border: "1px solid rgba(255,209,102,0.34)",
          boxShadow:
            "0 18px 46px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
          position: "relative",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <svg
          width={Math.round(size * 0.72)}
          height={Math.round(size * 0.72)}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display: "block",
            filter: "drop-shadow(0 8px 18px rgba(245,158,11,0.22))",
          }}
        >
          <path
            d="M13.5 51.5L29.6 13.7C30.5 11.6 33.5 11.6 34.4 13.7L50.5 51.5"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M23.5 39.5H40.5"
            stroke="currentColor"
            strokeWidth="5.2"
            strokeLinecap="round"
          />

          <path
            d="M25.5 45.8C31.2 42.8 36.1 38.9 41.5 31.8"
            stroke="var(--color-sage)"
            strokeWidth="3.8"
            strokeLinecap="round"
          />

          <path
            d="M42 31.8H35.8"
            stroke="var(--color-sage)"
            strokeWidth="3.8"
            strokeLinecap="round"
          />

          <path
            d="M42 31.8V38"
            stroke="var(--color-sage)"
            strokeWidth="3.8"
            strokeLinecap="round"
          />

          <circle cx="48" cy="16" r="3.2" fill="var(--color-gold)" />

          <path
            d="M48 8.5V11.2M48 20.8V23.5M55.5 16H52.8M43.2 16H40.5"
            stroke="var(--color-gold)"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.95"
          />
        </svg>
      </span>

      {showWordmark ? (
        <span
          style={{
            display: "grid",
            gap: 2,
            minWidth: 0,
            lineHeight: 1,
          }}
        >
          <span
            className="brand-word"
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 950,
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            Aureli
          </span>

          {tagline ? (
            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.02em",
                lineHeight: 1.2,
                overflowWrap: "anywhere",
              }}
            >
              {tagline}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}