import type { RiskLevel } from "../types";

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
}

export function RiskBadge({ level, label }: RiskBadgeProps) {
  return <span className={`risk-badge risk-badge--${level}`}>{label ?? `${level} risk`}</span>;
}
