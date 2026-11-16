export type RiskLevel = "low" | "medium" | "high";

export interface HealthResponse {
  status: "ok" | "unavailable";
  model_loaded: boolean;
  model_identifier: string | null;
}

export interface EvaluationMetrics {
  precision: number;
  recall: number;
  f1: number;
  average_precision: number;
  roc_auc: number;
}

export interface ModelInfoResponse {
  model: string;
  feature_names: string[];
  feature_count: number;
  threshold: number;
  evaluation_metrics: EvaluationMetrics;
  confusion_matrix: [[number, number], [number, number]];
  confusion_matrix_labels: [string, string];
  preprocessing: string;
  metadata_source: string;
}

export interface PredictionResponse {
  risk_score: number;
  predicted_class: 0 | 1;
  risk_level: RiskLevel;
  threshold: number;
  model: string;
}

export type FeatureValues = Record<string, number>;

export interface SessionPrediction {
  id: string;
  reference: string;
  sourceFile: string;
  rowNumber: number;
  features: FeatureValues;
  prediction: PredictionResponse;
}

export type BatchOutcome =
  | { rowNumber: number; status: "success"; prediction: PredictionResponse }
  | { rowNumber: number; status: "error" | "skipped"; message: string };
