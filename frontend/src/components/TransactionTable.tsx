import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SessionPrediction } from "../types";
import { EmptyState } from "./EmptyState";
import { RiskBadge } from "./RiskBadge";

interface TransactionTableProps {
  records: SessionPrediction[];
  onSelect?: (record: SessionPrediction) => void;
  pageSize?: number;
  compact?: boolean;
  selectedId?: string;
  sortByRisk?: boolean;
}

export function TransactionTable({ records, onSelect, pageSize = 8, compact = false, selectedId, sortByRisk = true }: TransactionTableProps) {
  const [page, setPage] = useState(1);
  const [descending, setDescending] = useState(true);
  const sorted = useMemo(
    () => sortByRisk ? [...records].sort((a, b) => (descending ? b.prediction.risk_score - a.prediction.risk_score : a.prediction.risk_score - b.prediction.risk_score)) : records,
    [records, descending, sortByRisk],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { setPage((current) => Math.min(current, pages)); }, [pages]);
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (records.length === 0) {
    return <EmptyState title="No predictions yet" description="Validated API responses will appear here after you score a CSV." compact={compact} />;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Source row</th>
            <th scope="col">Class</th>
            <th scope="col">
              {sortByRisk ? <button className="sort-button" type="button" onClick={() => setDescending((value) => !value)} aria-label={`Sort risk score ${descending ? "ascending" : "descending"}`}>
                Risk score {descending ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
              </button> : "Risk score"}
            </th>
            <th scope="col">Risk category</th>
            <th scope="col">Amount</th>
            {!compact ? <th scope="col">Elapsed time</th> : null}
            {onSelect ? <th scope="col"><span className="sr-only">Details</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((record) => (
            <tr key={record.id} className={selectedId === record.id ? "table-row--selected" : ""}>
              <td>
                <span className="row-reference">{record.reference}</span>
                <span className="table-subtext">{record.sourceFile}</span>
              </td>
              <td>
                <span className={`class-label class-label--${record.prediction.predicted_class === 1 ? "fraud" : "legitimate"}`}>
                  <span />{record.prediction.predicted_class === 1 ? "Fraud" : "Legitimate"}
                </span>
              </td>
              <td className="numeric-cell">{(record.prediction.risk_score * 100).toFixed(2)}%</td>
              <td><RiskBadge level={record.prediction.risk_level} /></td>
              <td className="numeric-cell">{formatAmount(record.features.Amount)}</td>
              {!compact ? <td className="numeric-cell">{formatElapsed(record.features.Time)}</td> : null}
              {onSelect ? (
                <td>
                  <button className="icon-button table-detail-button" type="button" onClick={() => onSelect(record)} aria-label={`View details for ${record.reference}`}>
                    <ExternalLink size={15} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!compact ? (
        <div className="table-pagination">
          <span>{records.length.toLocaleString()} session predictions</span>
          <div className="pagination-controls">
            <span>Page {page} of {pages}</span>
            <button className="icon-button" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <button className="icon-button" type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatElapsed(value: number): string {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} sec`;
}
