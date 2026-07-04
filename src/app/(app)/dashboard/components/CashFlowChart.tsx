type CashFlowChartProps = {
  points: number[];
  caption: string;
};

const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 24;

export function CashFlowChart({ points, caption }: CashFlowChartProps) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = (WIDTH - PADDING * 2) / (points.length - 1);

  const coords = points.map((value, index) => {
    const x = PADDING + index * stepX;
    const y = PADDING + (1 - (value - min) / range) * (HEIGHT - PADDING * 2);
    return [x, y] as const;
  });

  const linePath = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const lastX = coords[coords.length - 1][0].toFixed(1);
  const firstX = coords[0][0].toFixed(1);
  const areaPath = `${linePath} L ${lastX} ${HEIGHT - PADDING} L ${firstX} ${HEIGHT - PADDING} Z`;

  return (
    <div className="cashflow-card">
      <div className="cashflow-header">
        <p className="section-title">Cash flow trend</p>
        <span className="section-hint">{caption}</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="none"
        role="img"
        aria-label="Cash flow trend over recent months"
      >
        <defs>
          <linearGradient id="cashflow-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#cashflow-fill)" stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-amber)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={index === coords.length - 1 ? 4 : 2.5}
            fill="var(--color-amber)"
          />
        ))}
      </svg>
    </div>
  );
}
