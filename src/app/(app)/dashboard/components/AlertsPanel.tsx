type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
};

type AlertsPanelProps = {
  alerts: Alert[];
};

function getAlertTone(severity: Alert["severity"]) {
  if (severity === "critical") {
    return {
      label: "High",
      icon: "🚨",
      color: "var(--color-danger)",
      border: "rgba(255,138,149,0.30)",
      background: "rgba(255,138,149,0.085)",
    };
  }

  if (severity === "warning") {
    return {
      label: "Medium",
      icon: "⚠️",
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.30)",
      background: "rgba(255,209,102,0.085)",
    };
  }

  return {
    label: "Info",
    icon: "💡",
    color: "var(--color-sage)",
    border: "rgba(46,213,115,0.28)",
    background: "rgba(46,213,115,0.075)",
  };
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <section
      className="alerts-card"
      style={{
        padding: 18,
        display: "grid",
        gap: 16,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 5,
            minWidth: 0,
          }}
        >
          <p
            className="section-title"
            style={{
              margin: 0,
            }}
          >
            AI recommendations
          </p>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Priority actions based on approved financial data.
          </p>
        </div>

        <span
          style={{
            border: "1px solid rgba(245,158,11,0.28)",
            background: "rgba(245,158,11,0.09)",
            color: "var(--color-gold)",
            borderRadius: 999,
            padding: "7px 10px",
            fontSize: 11,
            fontWeight: 950,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
          }}
        >
          {alerts.length} insight{alerts.length === 1 ? "" : "s"}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div
          style={{
            border: "1px dashed rgba(245,158,11,0.22)",
            background: "rgba(245,158,11,0.045)",
            borderRadius: 18,
            padding: 16,
            display: "grid",
            gap: 8,
          }}
        >
          <strong
            style={{
              color: "var(--color-text-primary)",
              fontSize: 14,
            }}
          >
            No major alerts yet
          </strong>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Upload and approve more finance documents to generate stronger AI
            recommendations.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            minWidth: 0,
          }}
        >
          {alerts.map((alert) => {
            const tone = getAlertTone(alert.severity);

            return (
              <article
                key={alert.id}
                className="alert-item"
                style={{
                  border: `1px solid ${tone.border}`,
                  background: `linear-gradient(135deg, ${tone.background}, rgba(255,255,255,0.022))`,
                  borderRadius: 18,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gap: 12,
                  alignItems: "flex-start",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: tone.background,
                    border: `1px solid ${tone.border}`,
                    fontSize: 16,
                    flex: "0 0 auto",
                  }}
                >
                  {tone.icon}
                </span>

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: "fit-content",
                      maxWidth: "100%",
                      border: `1px solid ${tone.border}`,
                      background: tone.background,
                      color: tone.color,
                      borderRadius: 999,
                      padding: "5px 8px",
                      fontSize: 10,
                      fontWeight: 950,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      lineHeight: 1.2,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {tone.label}
                  </span>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--color-text-primary)",
                      fontSize: 13,
                      lineHeight: 1.6,
                      fontWeight: 750,
                      minWidth: 0,
                      maxWidth: "100%",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {alert.message}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}