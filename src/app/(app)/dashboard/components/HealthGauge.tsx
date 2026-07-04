type HealthGaugeProps = {
  score: number;
  label: string;
};

const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function toneForScore(score: number) {
  if (score >= 70) return { stroke: "var(--color-sage)", name: "Healthy" };
  if (score >= 40) return { stroke: "var(--color-amber)", name: "Watch" };
  return { stroke: "var(--color-coral)", name: "At risk" };
}

export function HealthGauge({ score, label }: HealthGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const tone = toneForScore(clamped);

  return (
    <div className="health-gauge">
      <svg
        viewBox="0 0 200 200"
        width="200"
        height="200"
        role="img"
        aria-label={`Business health score ${clamped} out of 100, ${tone.name}`}
      >
        <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth="14" />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke={tone.stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
        />
        <text x="100" y="96" textAnchor="middle" className="gauge-score">
          {clamped}
        </text>
        <text x="100" y="120" textAnchor="middle" className="gauge-of">
          / 100
        </text>
      </svg>
      <div className="gauge-caption">
        <span className="gauge-tone" style={{ color: tone.stroke }}>
          {tone.name}
        </span>
        <p>{label}</p>
      </div>
    </div>
  );
}
