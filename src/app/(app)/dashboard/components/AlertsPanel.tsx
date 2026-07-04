import type { Alert } from "@/lib/financial-profile";

const SEVERITY_LABEL: Record<Alert["severity"], string> = {
  critical: "Critical",
  warning: "Watch",
  info: "Note",
};

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="alerts-card">
      <div className="cashflow-header">
        <p className="section-title">What your finance team noticed</p>
        <span className="section-hint">Generated automatically, most important first</span>
      </div>
      <ul className="alerts-list">
        {alerts.map((alert) => (
          <li key={alert.id} className={`alert-item alert-${alert.severity}`}>
            <span className="alert-dot" aria-hidden="true" />
            <div>
              <span className="alert-severity">{SEVERITY_LABEL[alert.severity]}</span>
              <p>{alert.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
