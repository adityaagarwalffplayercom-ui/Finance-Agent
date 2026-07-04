import type { ExecutiveRecommendation } from "@/lib/financial-profile";

const PRIORITY_LABEL: Record<ExecutiveRecommendation["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_CLASS: Record<ExecutiveRecommendation["priority"], string> = {
  high: "alert-warning",
  medium: "alert-info",
  low: "alert-info",
};

export function ExecutivePanel({
  summary,
  recommendations,
}: {
  summary: string;
  recommendations: ExecutiveRecommendation[];
}) {
  return (
    <section className="alerts-card" style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <p className="section-title">Executive summary</p>
        <p className="section-hint">
          AI CFO-style interpretation of your current financial position
        </p>
      </div>

      <p
        style={{
          margin: "0 0 22px",
          color: "var(--color-text-secondary)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {summary}
      </p>

      <div style={{ marginBottom: 12 }}>
        <p className="section-title">Recommended actions</p>
        <p className="section-hint">
          Prioritized next steps based on the processed documents
        </p>
      </div>

      <ul className="alerts-list">
        {recommendations.map((recommendation) => (
          <li
            key={recommendation.id}
            className={`alert-item ${PRIORITY_CLASS[recommendation.priority]}`}
          >
            <span className="alert-dot" />
            <div>
              <span className="alert-severity">
                {PRIORITY_LABEL[recommendation.priority]}
              </span>
              <p>
                <strong style={{ color: "var(--color-text-primary)" }}>
                  {recommendation.title}:
                </strong>{" "}
                {recommendation.action}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}