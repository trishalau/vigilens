import { ArrowUpRight, CircleCheck, CircleX, Database, ExternalLink, RefreshCw, ShieldAlert, Waypoints } from "lucide-react";
import { useRuntime } from "../App";
import { LoadingState } from "../components/LoadingState";
import { API_BASE_URL } from "../lib/api";

export function AboutPage() {
  const { health, modelInfo, loading, error, refresh } = useRuntime();

  return (
    <div className="page-stack about-page">
      <section className="about-hero panel">
        <div className="about-hero__copy">
          <span className="about-hero__eyebrow"><span className="about-hero__mark"><Waypoints size={18} /></span> PROJECT OVERVIEW</span>
          <h2>Risk analytics,<br /><span>built to be understood.</span></h2>
          <p>VigiLens is a portfolio demonstration of an existing fraud classifier and a model-backed transaction review workflow. It makes historical model outputs easier to inspect; it is not a banking product.</p>
        </div>
        <div className="about-hero__visual" aria-label="Live project architecture and API status">
          <div className="about-hero__ring about-hero__ring--one" /><div className="about-hero__ring about-hero__ring--two" />
          <div className="about-live-card">
            <span className="about-live-card__mark"><Waypoints size={20} /></span>
            <span className="about-live-card__eyebrow">VIGILENS STACK</span>
            <strong>{modelInfo?.model ?? (loading ? "Loading model…" : "Model unavailable")}</strong>
            <div className="about-live-card__detail"><span>Feature schema</span><b>{modelInfo ? `${modelInfo.feature_count} inputs` : "Unavailable"}</b></div>
            <div className="about-live-card__detail"><span>API status</span><b className={health?.model_loaded ? "is-online" : ""}>{loading ? "Checking" : health?.model_loaded ? "Connected" : "Unavailable"}</b></div>
          </div>
          <span className="about-hero__spark about-hero__spark--one" /><span className="about-hero__spark about-hero__spark--two" />
        </div>
      </section>

      <section className="about-grid">
        <article className="panel about-card">
          <div className="about-card__icon"><Waypoints size={18} /></div><h3>Model architecture</h3>
          <p>A trained XGBoost binary classifier returns a probability for the fraud class. The API applies the saved validation-selected threshold to produce a predicted class.</p>
          <div className="architecture-flow"><span>Numeric features</span><ArrowUpRight size={14} /><span>XGBoost</span><ArrowUpRight size={14} /><span>Risk score</span></div>
          <small>{modelInfo ? `${modelInfo.feature_count} ordered features · threshold ${modelInfo.threshold.toFixed(6)}` : "Model metadata unavailable"}</small>
        </article>
        <article className="panel about-card">
          <div className="about-card__icon about-card__icon--butter"><Database size={18} /></div><h3>Dataset source</h3>
          <p>Credit Card Fraud Detection dataset associated with the Machine Learning Group at Université Libre de Bruxelles. V1–V28 are anonymised PCA features.</p>
          <a className="inline-link" href="https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud" target="_blank" rel="noreferrer">View source on Kaggle <ExternalLink size={13} /></a>
        </article>
      </section>

      <section className="panel connection-settings">
        <div className="panel-heading"><div><h2>API connection</h2><p>Local development endpoint and model availability.</p></div><button className="button button--secondary button--compact" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh status</button></div>
        <div className="connection-settings__body">
          <div className="connection-detail"><span>API base URL</span><code>{API_BASE_URL}</code></div>
          <div className="connection-detail"><span>Health check</span><strong className={health?.model_loaded ? "text-success" : "text-danger"}>{loading ? "Checking…" : health?.model_loaded ? "Connected · model loaded" : "Unavailable"}</strong></div>
          <div className="connection-detail"><span>Metadata endpoint</span><strong>{modelInfo ? "Loaded" : "Not available"}</strong></div>
        </div>
        {loading ? <LoadingState label="Checking Flask API…" compact /> : null}
        {!loading && error ? <div className="inline-error"><CircleX size={15} /><span>{error}</span></div> : null}
        {!loading && !error && health?.model_loaded ? <div className="inline-success"><CircleCheck size={15} /><span>Ready to score validated feature vectors.</span></div> : null}
      </section>

      <section className="panel limitation-list">
        <div className="panel-heading"><div><h2>Demo status &amp; limitations</h2><p>Important context before using scores.</p></div><span className="demo-label"><ShieldAlert size={14} /> Demonstration system</span></div>
        <ul>
          <li>Evaluation scores are from a historical held-out test set and are not production performance guarantees.</li>
          <li>The split was random and stratified, not temporal; duplicate dataset rows were retained.</li>
          <li>Time is elapsed seconds in the source data, not a real transaction clock timestamp.</li>
          <li>The API accepts anonymised features only. It has no merchant, cardholder, identity, or location fields.</li>
          <li>Risk categories are display labels. No SHAP or per-transaction feature attribution is currently available.</li>
          <li>The local API has no authentication or rate limiting. Do not expose it publicly.</li>
        </ul>
      </section>
    </div>
  );
}
