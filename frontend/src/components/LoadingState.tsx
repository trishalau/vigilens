interface LoadingStateProps {
  label: string;
  compact?: boolean;
}

export function LoadingState({ label, compact = false }: LoadingStateProps) {
  return (
    <div className={`loading-state${compact ? " loading-state--compact" : ""}`} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
