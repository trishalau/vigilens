import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useSessionPredictions } from "../App";
import { EmptyState } from "../components/EmptyState";
import { TransactionTable } from "../components/TransactionTable";
import type { RiskLevel, SessionPrediction } from "../types";
import { formatAmount } from "../components/TransactionTable";

export function TransactionsPage() {
  const { predictions } = useSessionPredictions();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selected, setSelected] = useState<SessionPrediction | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return predictions.filter((record) => {
      if (classFilter !== "all" && String(record.prediction.predicted_class) !== classFilter) return false;
      if (riskFilter !== "all" && record.prediction.risk_level !== riskFilter) return false;
      if (!normalizedQuery) return true;
      return record.reference.toLowerCase().includes(normalizedQuery)
        || record.sourceFile.toLowerCase().includes(normalizedQuery)
        || Object.entries(record.features).some(([name, value]) => `${name} ${value}`.toLowerCase().includes(normalizedQuery));
    });
  }, [predictions, query, classFilter, riskFilter]);

  const clearFilters = () => { setQuery(""); setClassFilter("all"); setRiskFilter("all"); };
  const hasFilters = query !== "" || classFilter !== "all" || riskFilter !== "all";
  const flaggedCount = predictions.filter((record) => record.prediction.predicted_class === 1).length;
  const highRiskCount = predictions.filter((record) => record.prediction.risk_level === "high").length;

  return (
    <div className="page-stack">
      <section className="transactions-hero">
        <div className="transactions-hero__copy">
          <span className="transactions-hero__eyebrow"><span /> SESSION ARCHIVE</span>
          <h2>Every score,<br /><span>in focus.</span></h2>
          <p>Explore API-backed predictions from CSV files scored in this browser session.</p>
        </div>
        <div className="transactions-hero__orbit" aria-hidden="true"><span className="transactions-hero__orbit-core"><Search size={25} /></span><i /><i /><i /></div>
        <div className="transactions-hero__stats" aria-label="Current session counts">
          <div><span>Scored</span><strong>{predictions.length.toLocaleString()}</strong></div>
          <div><span>Flagged</span><strong>{flaggedCount.toLocaleString()}</strong></div>
          <div><span>High risk</span><strong>{highRiskCount.toLocaleString()}</strong></div>
        </div>
      </section>

      <div className="explorer-toolbar panel">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search predictions</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search row, file, or feature value" />
        </label>
        <div className="toolbar-select">
          <SlidersHorizontal size={15} aria-hidden="true" />
          <label htmlFor="class-filter">Class</label>
          <select id="class-filter" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="all">All classes</option><option value="0">Legitimate</option><option value="1">Fraud</option>
          </select>
        </div>
        <div className="toolbar-select">
          <label htmlFor="risk-filter">Risk</label>
          <select id="risk-filter" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="all">All categories</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </div>
        {hasFilters ? <button className="text-button clear-filters" type="button" onClick={clearFilters}><X size={14} /> Clear</button> : null}
      </div>

      <section className="panel explorer-panel">
        <div className="panel-heading explorer-heading">
          <div><h2>Session predictions</h2><p>{filtered.length} of {predictions.length} model responses</p></div>
          <span className="table-session-tag">Local session only</span>
        </div>
        {predictions.length === 0 ? (
          <EmptyState title="Your explorer is ready" description="Upload a schema-valid CSV to create model-backed rows for this session." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description="Try a different search term or clear the selected filters." action={<button className="button button--secondary button--compact" type="button" onClick={clearFilters}>Clear filters</button>} />
        ) : (
          <TransactionTable records={filtered} onSelect={setSelected} selectedId={selected?.id} pageSize={10} />
        )}
      </section>

      {selected ? <TransactionDetails record={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function TransactionDetails({ record, onClose }: { record: SessionPrediction; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const features: Array<[string, number]> = Object.entries(record.features);
  const level: RiskLevel = record.prediction.risk_level;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="details-drawer" role="dialog" aria-modal="true" aria-labelledby="details-title">
        <div className="details-drawer__header">
          <div><span className="eyebrow">PREDICTION DETAIL</span><h2 id="details-title">{record.reference}</h2><p>{record.sourceFile}</p></div>
          <button ref={closeButtonRef} className="icon-button" type="button" onClick={onClose} aria-label="Close details"><X size={18} /></button>
        </div>
        <div className={`score-panel score-panel--${level}`}>
          <span>Model risk score</span>
          <strong>{(record.prediction.risk_score * 100).toFixed(2)}<small>%</small></strong>
          <div className="score-track" role="progressbar" aria-label="Model risk score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(record.prediction.risk_score * 100)}><span style={{ width: `${record.prediction.risk_score * 100}%` }} /></div>
          <p>{record.prediction.predicted_class === 1 ? "Flagged by the saved threshold" : "Below the saved classification threshold"}</p>
        </div>
        <div className="detail-pair-grid">
          <div><span>Predicted class</span><strong>{record.prediction.predicted_class === 1 ? "Fraud (1)" : "Legitimate (0)"}</strong></div>
          <div><span>Display category</span><strong className={`text-${level}`}>{level[0].toUpperCase()} {level.slice(1)}</strong></div>
          <div><span>Threshold</span><strong>{record.prediction.threshold.toFixed(6)}</strong></div>
          <div><span>Model</span><strong>{record.prediction.model}</strong></div>
          <div><span>Amount</span><strong>{formatAmount(record.features.Amount)}</strong></div>
          <div><span>Elapsed time</span><strong>{record.features.Time.toLocaleString()} sec</strong></div>
        </div>
        <div className="feature-list-heading"><h3>Submitted model inputs</h3><span>30 features</span></div>
        <p className="feature-note">These are the anonymised input values sent to the model. They are not feature-attribution explanations.</p>
        <div className="feature-grid">
          {features.map(([name, value]) => <div className="feature-value" key={name}><span>{name}</span><strong>{value.toLocaleString(undefined, { maximumFractionDigits: 5 })}</strong></div>)}
        </div>
      </aside>
    </div>
  );
}
