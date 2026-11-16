import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "lavender" | "yellow" | "green" | "rose";
}

export function MetricCard({ label, value, detail, icon, tone = "lavender" }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${tone}`} aria-hidden="true">{icon}</div>
      <div className="metric-card__body">
        <p className="metric-card__label">{label}</p>
        <p className="metric-card__value">{value}</p>
        <p className="metric-card__detail">{detail}</p>
      </div>
    </article>
  );
}
