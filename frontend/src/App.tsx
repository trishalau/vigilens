import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, ViewTransition } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { LoadingState } from "./components/LoadingState";
import { PageTransition } from "./components/PageTransition";
import { TopNavigation } from "./components/TopNavigation";
import { api } from "./lib/api";
import type { HealthResponse, ModelInfoResponse, SessionPrediction } from "./types";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage").then((module) => ({ default: module.TransactionsPage })));
const PredictPage = lazy(() => import("./pages/PredictPage").then((module) => ({ default: module.PredictPage })));
const ModelPage = lazy(() => import("./pages/ModelPage").then((module) => ({ default: module.ModelPage })));
const AboutPage = lazy(() => import("./pages/AboutPage").then((module) => ({ default: module.AboutPage })));

interface RuntimeContextValue {
  health: HealthResponse | null;
  modelInfo: ModelInfoResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface PredictionContextValue {
  predictions: SessionPrediction[];
  addPredictions: (records: SessionPrediction[]) => void;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);
const PredictionContext = createContext<PredictionContextValue | null>(null);

export function useRuntime() {
  const context = useContext(RuntimeContext);
  if (!context) throw new Error("useRuntime must be used inside RuntimeContext.");
  return context;
}

export function useSessionPredictions() {
  const context = useContext(PredictionContext);
  if (!context) throw new Error("useSessionPredictions must be used inside PredictionContext.");
  return context;
}

function AppProviders({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<SessionPrediction[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [healthResult, infoResult] = await Promise.allSettled([api.getHealth(), api.getModelInfo()]);
    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value);
    } else {
      setHealth(null);
    }
    if (infoResult.status === "fulfilled") {
      setModelInfo(infoResult.value);
    } else {
      setModelInfo(null);
    }
    const failedResult = healthResult.status === "rejected" ? healthResult : infoResult.status === "rejected" ? infoResult : null;
    setError(failedResult ? (failedResult.reason instanceof Error ? failedResult.reason.message : "The API is unavailable.") : null);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addPredictions = useCallback((records: SessionPrediction[]) => {
    setPredictions((current) => [...records, ...current]);
  }, []);

  const runtimeValue = useMemo(() => ({ health, modelInfo, loading, error, refresh }), [health, modelInfo, loading, error, refresh]);
  const predictionValue = useMemo(() => ({ predictions, addPredictions }), [predictions, addPredictions]);

  return (
    <RuntimeContext.Provider value={runtimeValue}>
      <PredictionContext.Provider value={predictionValue}>{children}</PredictionContext.Provider>
    </RuntimeContext.Provider>
  );
}

function AppShell() {
  const { health, loading } = useRuntime();
  return (
    <div className="app-layout">
      <TopNavigation />
      <div className="app-main">
        <Header health={health} loading={loading} />
        <main className="page-content" id="main-content">
          <Suspense fallback={<ViewTransition exit="page-fade-out"><LoadingState label="Loading workspace…" /></ViewTransition>}>
            <Routes>
              <Route path="/" element={<PageTransition><DashboardPage /></PageTransition>} />
              <Route path="/transactions" element={<PageTransition><TransactionsPage /></PageTransition>} />
              <Route path="/predict" element={<PageTransition><PredictPage /></PageTransition>} />
              <Route path="/model" element={<PageTransition><ModelPage /></PageTransition>} />
              <Route path="/about" element={<PageTransition><AboutPage /></PageTransition>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="page-footer">
          <span>VigiLens is a demonstration system, not a production banking decision service.</span>
          <span>Historical evaluation · local inference</span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppProviders>
  );
}
