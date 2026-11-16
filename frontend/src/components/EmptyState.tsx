import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, action, icon, compact = false }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? " empty-state--compact" : ""}`}>
      {icon ? <span className="empty-state__icon" aria-hidden="true">{icon}</span> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
