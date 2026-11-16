import { Activity, AlertTriangle, BarChart3, BookOpenCheck, CircleHelp, Crosshair, Info, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRuntime } from "../App";
import { ChartCard } from "../components/ChartCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";

const metricDescriptions: Record<string, { label: string; description: string; format: (value: number) => string }> = {
  precision: { label: "Precision", description: "Of transactions flagged by the model, the share labeled fraud.", format: (value) => `${(value * 100).toFixed(2)}%` },
  recall: { label: "Recall", description: "Of fraud cases in the held-out test set, the share detected.", format: (value) => `${(value * 100).toFixed(2)}%` },
  f1: { label: "F1 score", description: "Harmonic mean of precision and recall at the selected threshold.", format: (value) => `${(value * 100).toFixed(2)}%` },
  average_precision: { label: "PR-AUC", description: "Average precision across score thresholds; useful with imbalanced classes.", format: (value) => `${(value * 100).toFixed(2)}%` },
  roc_auc: { label: "ROC-AUC", description: "Ranking ability across false-positive and true-positive rates.", format: (value) => `${(value * 100).toFixed(2)}%` },
};

export function ModelPage() {
  const { modelInfo, health, loading, error, refresh } = useRuntime();
  const matrixData = modelInfo ? [
    { name: "Actual legitimate", predictedLegitimate: modelInfo.confusion_matrix[0][0], predictedFraud: modelInfo.confusion_matrix[0][1] },
    { name: "Actual fraud", predictedLegitimate: modelInfo.confusion_matrix[1][0], predictedFraud: modelInfo.confusion_matrix[1][1] },
  ] : [];

  return (
    <div className="page-stack model-page">
      <div className="model-intro panel">
        <div className="model-intro__icon"><BarChart3 size={22} /></div>
        <div className="model-intro__main">
          <div className="model-intro__title-row"><div><span className="eyebrow">CURRENT CLASSIFIER</span><h2>{modelInfo?.model ?? "Model information"}</h2></div><span className="historical-pill"><Info size={14} /> Historical evaluation</span></div>
          <p>Metrics below are from the saved held-out test evaluation. They describe this historical split, not production performance.</p>
        </div>
        <div className="threshold-block"><span>Selected threshold</span><strong>{modelInfo ? modelInfo.threshold.toFixed(6) : "—"}</strong><small>Selected using validation F1</small></div>
      </div>

      {loading && !modelInfo ? <LoadingState label="Loading model metadata…" /> : null}
      {!loading && !modelInfo ? <ErrorState title="Model metadata unavailable" message={error || "The API did not return model information."} onRetry={() => void refresh()} /> : null}

      {modelInfo ? <>
        <section className="metric-grid model-metric-grid" aria-label="Held-out model metrics">
          {Object.entries(metricDescriptions).map(([key, meta], index) => {
            const Icon = [Crosshair, Activity, ShieldCheck, BarChart3, BookOpenCheck][index];
            const value = modelInfo.evaluation_metrics[key as keyof typeof modelInfo.evaluation_metrics];
            return <MetricCard key={key} label={meta.label} value={meta.format(value)} detail={meta.description} icon={<Icon size={18} />} tone={index === 1 ? "green" : index === 2 ? "yellow" : "lavender"} />;
          })}
        </section>

        <section className="dashboard-grid model-visuals-grid">
          <ChartCard title="Test confusion matrix" description="Actual counts at the frozen validation-tuned threshold.">
            <div className="matrix-chart">
              <div className="matrix-axis matrix-axis--top"><span>Predicted legitimate</span><span>Predicted fraud</span></div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={matrixData} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 8 }} barCategoryGap={20}>
                  <CartesianGrid stroke="#EEEAF4" strokeDasharray="3 4" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#77758B", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={105} tickLine={false} axisLine={false} tick={{ fill: "#77758B", fontSize: 11 }} />
                  <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Transactions"]} />
                  <Bar dataKey="predictedLegitimate" stackId="counts" name="Predicted legitimate" fill="#9B84DC" radius={[5, 0, 0, 5]} />
                  <Bar dataKey="predictedFraud" stackId="counts" name="Predicted fraud" fill="#E5CD69" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="matrix-legend"><span><i className="legend-lavender" /> Predicted legitimate</span><span><i className="legend-rose" /> Predicted fraud</span></div>
              <div className="matrix-values" aria-label="Confusion matrix counts">
                <div><span>True legitimate · predicted legitimate</span><strong>{modelInfo.confusion_matrix[0][0].toLocaleString()}</strong></div>
                <div><span>True legitimate · predicted fraud</span><strong>{modelInfo.confusion_matrix[0][1].toLocaleString()}</strong></div>
                <div><span>True fraud · predicted legitimate</span><strong>{modelInfo.confusion_matrix[1][0].toLocaleString()}</strong></div>
                <div><span>True fraud · predicted fraud</span><strong>{modelInfo.confusion_matrix[1][1].toLocaleString()}</strong></div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Precision–recall curve" description="Curve coordinates are not exposed by the current API.">
            <EmptyState title="Curve data unavailable" description="No curve points are served by /api/model/info, so this chart is intentionally not approximated." icon={<CircleHelp size={20} />} compact />
            <div className="curve-note"><Info size={14} /><span>The saved evaluation includes a PR plot image, but not reusable point data.</span></div>
          </ChartCard>
        </section>

        <section className="panel model-info-panel">
          <div className="panel-heading"><div><h2>Model information</h2><p>Configuration read from the existing backend metadata.</p></div><span className="model-connected-tag"><span /> {health?.model_loaded ? "Connected" : "Unavailable"}</span></div>
          <div className="model-info-grid">
            <div><span>Selected model</span><strong>{modelInfo.model}</strong></div>
            <div><span>Input features</span><strong>{modelInfo.feature_count} numeric features</strong></div>
            <div><span>Preprocessing</span><strong>Raw features · no scaling</strong></div>
            <div><span>Metadata source</span><strong>{modelInfo.metadata_source}</strong></div>
          </div>
          <details className="feature-schema-details">
            <summary>View expected feature order</summary>
            <p>{modelInfo.feature_names.join(" · ")}</p>
          </details>
        </section>
      </> : null}

      <section className="limitation-banner">
        <span className="limitation-banner__icon"><AlertTriangle size={18} /></span>
        <div><strong>Dataset and evaluation limitations</strong><p>The ULB dataset is historical and anonymised. Time is elapsed seconds, not calendar time. The evaluation used a random stratified split, retained duplicate rows, and does not establish future or production performance.</p></div>
      </section>
    </div>
  );
}
