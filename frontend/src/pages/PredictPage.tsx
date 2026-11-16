import { useState } from "react";
import { AlertTriangle, Download, Check, CircleAlert, FileSpreadsheet, Play, RotateCcw } from "lucide-react";
import { useRuntime, useSessionPredictions } from "../App";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FileUpload } from "../components/FileUpload";
import { LoadingState } from "../components/LoadingState";
import { RiskBadge } from "../components/RiskBadge";
import { formatAmount } from "../components/TransactionTable";
import { api } from "../lib/api";
import { MAX_CSV_ROWS, parseTransactionsCsv, predictRowsWithLimit, type ParsedTransactionRow } from "../lib/csv";
import type { BatchOutcome, SessionPrediction } from "../types";

const REQUEST_CONCURRENCY = 4;

export function PredictPage() {
  const { modelInfo, health, refresh } = useRuntime();
  const { addPredictions } = useSessionPredictions();
  const [fileName, setFileName] = useState("");
  const [uploadId, setUploadId] = useState("");
  const [rows, setRows] = useState<ParsedTransactionRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<BatchOutcome[] | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setRows([]);
    setOutcomes(null);
    setValidationError(null);
    setProgress({ completed: 0, total: 0 });
    setUploadId(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);
    if (!modelInfo) {
      setValidationError("Connect to the Flask API to load the required feature schema before uploading.");
      return;
    }
    try {
      const parsedRows = await parseTransactionsCsv(file, modelInfo.feature_names);
      setRows(parsedRows);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "The CSV could not be validated.");
    }
  };

  const runPredictions = async () => {
    if (!modelInfo || !rows.length || running) return;
    setRunning(true);
    setOutcomes(null);
    setProgress({ completed: 0, total: rows.length });
    const batch = await predictRowsWithLimit(
      rows,
      (row) => api.predict(row.features),
      REQUEST_CONCURRENCY,
      (completed, total) => setProgress({ completed, total }),
    );

    const displayedOutcomes: BatchOutcome[] = batch.map((outcome, index) => {
      const rowNumber = rows[index].rowNumber;
      if (outcome.status === "success") return { rowNumber, status: "success", prediction: outcome.value };
      return { rowNumber, status: outcome.status, message: outcome.message };
    });
    const successfulRecords: SessionPrediction[] = displayedOutcomes.flatMap((outcome, index) => {
      if (outcome.status !== "success") return [];
      const row = rows[index];
      return [{
        id: `${uploadId}-${row.rowNumber}`,
        reference: `Row ${row.rowNumber}`,
        sourceFile: fileName,
        rowNumber: row.rowNumber,
        features: row.features,
        prediction: outcome.prediction,
      }];
    });
    addPredictions(successfulRecords);
    setOutcomes(displayedOutcomes);
    setRunning(false);
  };

  const resetUpload = () => {
    setFileName(""); setUploadId(""); setRows([]); setValidationError(null); setOutcomes(null); setProgress({ completed: 0, total: 0 });
  };

  const downloadResults = () => {
    if (!outcomes || !modelInfo) return;
    const exportFields = ["row_number", ...modelInfo.feature_names, "status", "risk_score", "predicted_class", "risk_level", "threshold", "model", "error"];
    const resultRows = outcomes.map((outcome, index) => {
      const row = rows[index];
      const base: Record<string, string | number> = { row_number: outcome.rowNumber, status: outcome.status };
      for (const name of modelInfo.feature_names) base[name] = row.features[name];
      if (outcome.status === "success") {
        base.risk_score = outcome.prediction.risk_score;
        base.predicted_class = outcome.prediction.predicted_class;
        base.risk_level = outcome.prediction.risk_level;
        base.threshold = outcome.prediction.threshold;
        base.model = outcome.prediction.model;
      } else {
        base.error = outcome.message;
      }
      return base;
    });
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [exportFields, ...resultRows.map((row) => exportFields.map((field) => row[field] ?? ""))]
      .map((line) => line.map(escapeCsv).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.replace(/\.csv$/i, "") || "vigilens"}-predictions.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const successCount = outcomes?.filter((outcome) => outcome.status === "success").length ?? 0;
  const errorCount = outcomes?.filter((outcome) => outcome.status === "error").length ?? 0;
  const skippedCount = outcomes?.filter((outcome) => outcome.status === "skipped").length ?? 0;

  return (
    <div className="page-stack">
      {!health?.model_loaded ? (
        <ErrorState title="Prediction API unavailable" message="Start the Flask API and confirm its model is loaded before uploading a file." onRetry={() => void refresh()} />
      ) : null}

      <div className="prediction-workspace">
        <section className="prediction-intro panel">
          <div className="prediction-intro__copy">
            <span className="eyebrow">MODEL-BACKED WORKFLOW</span>
            <h2>From feature file<br />to clear signals.</h2>
            <p>Score a schema-valid CSV with the existing VigiLens model. Successful results join this browser session.</p>
            <div className="prediction-path" aria-label="Prediction steps"><span><b>01</b> Choose CSV</span><i /><span><b>02</b> Validate</span><i /><span><b>03</b> Score</span></div>
            <div className="prediction-limits"><span className="prediction-limits__icon"><FileSpreadsheet size={17} /></span><span className="prediction-limits__value"><small>UPLOAD CAP</small><strong>{MAX_CSV_ROWS} rows</strong></span><small className="prediction-limits__size">2 MB max</small></div>
          </div>
        </section>

        <section className="panel upload-panel">
          <div className="panel-heading"><div><span className="eyebrow">STEP 01 · SELECT YOUR DATA</span><h2>Upload a transaction CSV</h2><p>Headers must match the model schema. Column order may vary.</p></div><span className="concurrency-chip">Up to {REQUEST_CONCURRENCY} in flight</span></div>
          <FileUpload onFile={(file) => void handleFile(file)} disabled={!modelInfo || running} fileName={fileName || undefined} />
          {validationError ? <div className="upload-error" role="alert"><CircleAlert size={16} /><span>{validationError}</span></div> : null}
          {fileName && !validationError && rows.length ? (
            <div className="validated-file"><span><Check size={15} /></span><div><strong>{fileName}</strong><small>{rows.length} valid rows · {modelInfo?.feature_count} numeric features</small></div><button className="text-button" type="button" onClick={resetUpload} disabled={running}><RotateCcw size={14} /> Reset</button></div>
          ) : null}
        </section>
      </div>

      {rows.length > 0 ? (
        <section className="panel preview-panel">
          <div className="panel-heading"><div><h2>Preview</h2><p>First five input rows · selected schema fields only.</p></div><span className="preview-count">{rows.length} rows ready</span></div>
          <div className="table-wrap preview-table-wrap"><table className="data-table preview-table"><thead><tr><th>CSV row</th><th>Time · elapsed sec</th><th>Amount</th><th>V1</th><th>V2</th><th>V3</th><th>V4</th></tr></thead><tbody>
            {rows.slice(0, 5).map((row) => <tr key={row.rowNumber}><td>Row {row.rowNumber}</td><td>{row.features.Time.toLocaleString()}</td><td>{formatAmount(row.features.Amount)}</td><td>{row.features.V1.toFixed(4)}</td><td>{row.features.V2.toFixed(4)}</td><td>{row.features.V3.toFixed(4)}</td><td>{row.features.V4.toFixed(4)}</td></tr>)}
          </tbody></table></div>
          <div className="preview-footer"><span><AlertTriangle size={14} /> V1–V28 are anonymised PCA components. No merchant or cardholder data is expected.</span>
            <button className="button button--primary" type="button" onClick={() => void runPredictions()} disabled={running || !health?.model_loaded}>
              <Play size={15} fill="currentColor" /> {running ? "Scoring rows…" : "Run predictions"}
            </button>
          </div>
        </section>
      ) : null}

      {running ? (
        <section className="panel progress-panel" aria-live="polite">
          <div className="progress-heading"><LoadingState label={`Scoring ${progress.completed} of ${progress.total} rows`} compact /><span>{progress.total ? Math.round(progress.completed / progress.total * 100) : 0}%</span></div>
          <div className="progress-track"><span style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></div>
          <p>Requests are bounded to {REQUEST_CONCURRENCY} at a time. If the API fails, unsent rows are marked as skipped.</p>
        </section>
      ) : null}

      {outcomes ? (
        <section className="panel batch-results-panel">
          <div className="panel-heading"><div><h2>Prediction results</h2><p>Only successful API responses are added to the explorer and overview.</p></div><button className="button button--secondary button--compact" type="button" onClick={downloadResults}><Download size={15} /> Download results CSV</button></div>
          <div className="batch-summary"><span className="summary-success"><Check size={15} /> {successCount} predicted</span>{errorCount ? <span className="summary-error"><CircleAlert size={15} /> {errorCount} failed</span> : null}{skippedCount ? <span className="summary-skipped">{skippedCount} not sent</span> : null}</div>
          {errorCount || skippedCount ? <ErrorState title="Some rows were not scored" message="Successful rows are shown as predictions. Failed and skipped rows remain clearly marked in the downloadable results." compact /> : null}
          <div className="table-wrap"><table className="data-table results-table"><thead><tr><th>CSV row</th><th>Status</th><th>Predicted class</th><th>Risk score</th><th>Risk category</th><th>Details</th></tr></thead><tbody>
            {outcomes.map((outcome) => <tr key={outcome.rowNumber}><td>Row {outcome.rowNumber}</td><td><span className={`result-status result-status--${outcome.status}`}>{outcome.status}</span></td>
              {outcome.status === "success" ? <><td>{outcome.prediction.predicted_class === 1 ? "Fraud (1)" : "Legitimate (0)"}</td><td>{(outcome.prediction.risk_score * 100).toFixed(2)}%</td><td><RiskBadge level={outcome.prediction.risk_level} /></td><td>{outcome.prediction.model}</td></> : <td colSpan={4} className="result-error-cell">{outcome.message}</td>}
            </tr>)}
          </tbody></table></div>
        </section>
      ) : null}

      {!fileName && !validationError ? <EmptyState title="Bring a feature CSV to begin" description="The model expects Time, Amount, and anonymised PCA features V1–V28. Uploads are validated before any request is sent." icon={<FileSpreadsheet size={20} />} compact /> : null}
    </div>
  );
}
