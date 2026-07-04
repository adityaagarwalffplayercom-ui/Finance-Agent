type StatCardProps = {
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "warning" | "neutral";
};

export function StatCard({ label, value, delta, tone }: StatCardProps) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className={`stat-delta stat-delta-${tone}`}>{delta}</p>
    </div>
  );
}
