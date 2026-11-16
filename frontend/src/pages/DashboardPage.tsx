import { useMemo } from "react";
import { Activity, ArrowRight, ArrowUpRight, CircleAlert, CircleCheck, Gauge, ScanEye, Sparkles, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useRuntime, useSessionPredictions } from "../App";
import { ChartCard } from "../components/ChartCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { TransactionTable } from "../components/TransactionTable";
import { TransitionLink } from "../components/TransitionLink";
import type { RiskLevel } from "../types";

const riskColors: Record<RiskLevel, string> = { low: "#4F9A79", medium: "#C18A35", high: "#C45A68" };

export function DashboardPage() {
  const { predictions } = useSessionPredictions();
  const { health, modelInfo, loading, error, refresh } = useRuntime();
  const flagged = predictions.filter((record) => record.prediction.predicted_class === 1).length;
  const flaggedRate = predictions.length ? `${((flagged / predictions.length) * 100).toFixed(1)}%` : "—";
  const averageScore = predictions.length
    ? `${(predictions.reduce((sum, record) => sum + record.prediction.risk_score, 0) / predictions.length * 100).toFixed(1)}%`
    : "—";
  const riskData = useMemo(() => (["low", "medium", "high"] as const)
    .map((level) => ({ name: `${level[0].toUpperCase()}${level.slice(1)} risk`, level, value: predictions.filter((record) => record.prediction.risk_level === level).length }))
    .filter((entry) => entry.value > 0), [predictions]);

  return (
    <div className="page-stack">
      <section className="overview-hero">
        <div className="overview-hero__copy">
          <div className="welcome-kicker"><span className="welcome-kicker__dot" /> VIGILENS · FRAUD &amp; RISK WORKSPACE</div>
          <h2>Fraud signals,<br /><span>beautifully clear.</span></h2>
          <p>Explore model-backed risk scores and see how each transaction moves from anonymised features to a decision-ready probability.</p>
          <div className="overview-hero__actions">
            <TransitionLink className="button button--dark" to="/predict">Analyze transactions <ArrowUpRight size={16} /></TransitionLink>
            <span><i className={health?.model_loaded ? "is-online" : ""} />{loading ? "Connecting to model" : health?.model_loaded ? "Model connected" : "API unavailable"}</span>
          </div>
        </div>
        <div className="overview-hero__art" aria-label="Model information from the connected API">
          <span className="hero-orbit hero-orbit--outer" />
          <span className="hero-orbit hero-orbit--inner" />
          <span className="hero-orbit-dot hero-orbit-dot--one" />
          <span className="hero-orbit-dot hero-orbit-dot--two" />
          <span className="hero-art__spark hero-art__spark--one"><Sparkles size={17} /></span>
          <div className="hero-model-card">
            <div className="hero-model-card__top"><span className="hero-model-icon"><ScanEye size={22} /></span><span className={health?.model_loaded ? "hero-live hero-live--online" : "hero-live"}><i />{health?.model_loaded ? "LIVE MODEL" : loading ? "CONNECTING" : "OFFLINE"}</span></div>
            <span className="hero-model-card__label">SELECTED MODEL</span>
            <strong>{modelInfo?.model ?? health?.model_identifier ?? (loading ? "Loading model…" : "Unavailable")}</strong>
            <div className="hero-model-card__rule" />
            <div className="hero-model-card__threshold"><span>Decision threshold</span><b>{modelInfo ? modelInfo.threshold.toFixed(6) : "—"}</b></div>
          </div>
          <div className="hero-float hero-float--feature"><span className="hero-float__icon"><Activity size={15} /></span><span><b>{modelInfo ? `${modelInfo.feature_count} features` : "Feature schema"}</b><small>Model inputs</small></span></div>
          <div className="hero-float hero-float--risk"><span className="hero-float__icon"><Gauge size={15} /></span><span><b>Risk score</b><small>Probability output</small></span></div>
          <div className="hero-art__caption">Scored by your local Flask API</div>
        </div>
      </section>

      <section className="pipeline-board" aria-label="VigiLens prediction pipeline">
        <div className="pipeline-board__topline">
          <span>FROM TRANSACTION DATA TO RISK SCORE</span>
          <span className="pipeline-board__tag"><ScanEye size={14} /> MODEL PIPELINE</span>
        </div>
        <div className="pipeline-board__flow">
          <article className="pipeline-stage">
            <span className="pipeline-stage__index">01</span>
            <span className="pipeline-stage__icon"><Activity size={21} /></span>
            <div><h3>Transaction features</h3><p>Time, Amount, and anonymised V1–V28 inputs</p></div>
          </article>
          <div className="pipeline-board__connector" aria-hidden="true"><span /><span /><span /><ArrowRight size={16} /></div>
          <article className="pipeline-stage pipeline-stage--model">
            <span className="pipeline-stage__index">02</span>
            <span className="pipeline-stage__icon"><ScanEye size={22} /></span>
            <div><h3>XGBoost model</h3><p>Existing fitted model loaded by the Flask API</p></div>
          </article>
          <div className="pipeline-board__connector" aria-hidden="true"><span /><span /><span /><ArrowRight size={16} /></div>
          <article className="pipeline-stage pipeline-stage--score">
            <span className="pipeline-stage__index">03</span>
            <span className="pipeline-stage__icon"><Gauge size={21} /></span>
            <div><h3>Risk classification</h3><p>Model probability and saved decision threshold</p></div>
          </article>
        </div>
        <div className="pipeline-board__footer"><span>MODEL STATUS</span><span className={health?.model_loaded ? "pipeline-model-status is-online" : "pipeline-model-status"}><i />{loading ? "Checking connection" : health?.model_loaded ? "Connected to local API" : "Waiting for local API"}</span></div>
      </section>

      <div className="section-heading-row">
        <div>
          <h2>Session snapshot</h2>
          <p>Only successful model responses made in this browser session are counted.</p>
        </div>
        <span className="session-chip"><span /> Session only</span>
      </div>

      <section className="metric-grid" aria-label="Session prediction metrics">
        <MetricCard label="Transactions analyzed" value={predictions.length.toLocaleString()} detail="Successful API predictions" icon={<Activity size={18} />} tone="lavender" />
        <MetricCard label="Flagged by model" value={flagged.toLocaleString()} detail="Predicted class 1" icon={<CircleAlert size={18} />} tone="rose" />
        <MetricCard label="Flagged share" value={flaggedRate} detail="Of successful predictions" icon={<TrendingUp size={18} />} tone="yellow" />
        <MetricCard label="Average risk score" value={averageScore} detail="Mean model probability" icon={<Gauge size={18} />} tone="green" />
      </section>

      <section className="dashboard-grid">
        <ChartCard title="Risk distribution" description="Application-defined categories from this session's model scores." className="risk-distribution-card">
          {riskData.length ? (
            <div className="risk-chart-layout">
              <div className="risk-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={4} stroke="none">
                      {riskData.map((entry) => <Cell key={entry.level} fill={riskColors[entry.level]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} predictions`, "Count"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="risk-chart-center"><strong>{predictions.length}</strong><span>scored</span></div>
              </div>
              <div className="risk-legend">
                {riskData.map((entry) => (
                  <div className="risk-legend__row" key={entry.level}>
                    <span className="risk-legend__swatch" style={{ background: riskColors[entry.level] }} />
                    <span>{entry.name}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Waiting for your first score" description="Risk distribution appears after the API returns prediction results." icon={<Gauge size={20} />} compact />
          )}
        </ChartCard>

        <ChartCard title="Model connection" description="Live status from the Flask health endpoint." action={<button className="text-button" type="button" onClick={() => void refresh()}>Refresh</button>}>
          {loading ? <LoadingState label="Checking model status…" compact /> : health?.model_loaded ? (
            <div className="model-status-card">
              <span className="status-orb status-orb--online"><CircleCheck size={18} /></span>
              <div><strong>Model is ready</strong><span>{health.model_identifier} · local API</span></div>
              <span className="status-label status-label--online">Operational</span>
            </div>
          ) : (
            <ErrorState title="API unavailable" message={error || "Start the Flask API to enable model predictions."} onRetry={() => void refresh()} compact />
          )}
          <div className="model-status-footnote">No transaction data is bundled into this dashboard. Connect the API and submit a CSV to see session activity.</div>
        </ChartCard>
      </section>

      <ChartCard title="Recent predictions" description="Most recent successful scores from this session." action={<TransitionLink className="text-button text-link" to="/transactions">View explorer <ArrowRight size={14} /></TransitionLink>}>
        <TransactionTable records={predictions.slice(0, 5)} compact sortByRisk={false} />
      </ChartCard>
    </div>
  );
}
