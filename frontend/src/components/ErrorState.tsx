import { CircleAlert, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ title, message, onRetry, compact = false }: ErrorStateProps) {
  return (
    <div className={`error-state${compact ? " error-state--compact" : ""}`} role="alert">
      <span className="error-state__icon"><CircleAlert size={18} /></span>
      <div className="error-state__content">
        <strong>{title}</strong>
        <p>{message}</p>
        {onRetry ? (
          <button className="text-button" type="button" onClick={onRetry}>
            <RefreshCw size={14} /> Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
