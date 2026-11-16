import type { HealthResponse, ModelInfoResponse, PredictionResponse, FeatureValues } from "../types";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBaseUrl || "http://127.0.0.1:5000").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Could not reach the VigiLens API. Check that the backend is running.", 0, "network_error");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("The API returned an empty or invalid response.", response.status, "invalid_response");
  }

  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? body as { error?: { message?: string; code?: string } } : {};
    throw new ApiError(
      errorBody.error?.message || `The API request failed with status ${response.status}.`,
      response.status,
      errorBody.error?.code,
    );
  }
  return body as T;
}

export const api = {
  getHealth: () => requestJson<HealthResponse>("/api/health"),
  getModelInfo: () => requestJson<ModelInfoResponse>("/api/model/info"),
  predict: (features: FeatureValues) =>
    requestJson<PredictionResponse>("/api/predict", {
      method: "POST",
      body: JSON.stringify(features),
    }),
};
