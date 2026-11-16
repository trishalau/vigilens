import { ArrowUpRight, CircleCheck, CircleX, Loader2, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { TransitionLink } from "./TransitionLink";
import type { HealthResponse } from "../types";

const pageTitles: Record<string, { title: string; description: string }> = {
  "/": { title: "Overview", description: "A clear view of predictions made in this session." },
  "/transactions": { title: "Transaction explorer", description: "Review model responses from your current session." },
  "/predict": { title: "Fraud prediction", description: "Score a CSV using the trained VigiLens model." },
  "/model": { title: "Model intelligence", description: "Understand the selected model and its held-out evaluation." },
  "/about": { title: "Settings & about", description: "Project details, API status, and responsible-use notes." },
};

interface HeaderProps {
  health: HealthResponse | null;
  loading: boolean;
}

export function Header({ health, loading }: HeaderProps) {
  const { pathname } = useLocation();
  const page = pageTitles[pathname] ?? pageTitles["/"];

  return (
    <header className={`topbar${pathname === "/" ? " topbar--overview" : ""}`}>
      <div className="topbar__title">
        <p className="eyebrow">INTELLIGENT FRAUD DETECTION &amp; RISK ANALYTICS</p>
        <h1>{page.title}</h1>
        <p className="topbar__description">{page.description}</p>
      </div>
      <div className="topbar__actions">
        <div className={`connection-pill ${loading ? "connection-pill--loading" : health?.model_loaded ? "connection-pill--connected" : "connection-pill--offline"}`}>
          {loading ? <Loader2 size={15} className="spin-icon" /> : health?.model_loaded ? <CircleCheck size={15} /> : <CircleX size={15} />}
          <span>{loading ? "Connecting" : health?.model_loaded ? "Model connected" : "API unavailable"}</span>
        </div>
        {pathname !== "/predict" ? (
          <TransitionLink className="button button--primary button--compact" to="/predict">
            <Sparkles size={16} />
            <span>New prediction</span>
            <ArrowUpRight size={14} />
          </TransitionLink>
        ) : null}
      </div>
    </header>
  );
}
