# VigiLens Frontend

Responsive React dashboard for the local VigiLens Flask API. The frontend only displays predictions returned by the model; it does not generate substitute transaction data or ML results.

## Local development

Prerequisites: Node.js 20+ and npm. Start the Flask API in a separate terminal from the repository root, then in another terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173`. The default API origin is `http://127.0.0.1:5000`. Override it with `VITE_API_BASE_URL` in `.env.local`; this variable is a public URL only and must never contain credentials or secrets. The Flask CORS allowlist must include the frontend origin.

Type-check and build:

```bash
npm run typecheck
npm run build
```

## Pages and data behavior

- **Overview:** counts and risk distribution use successful predictions from the current in-memory browser session only. The initial state is empty; no historical transaction totals are invented.
- **Transaction explorer:** searches, filters, sorts, paginates, and opens a feature detail panel for successful API responses in this session. The source dataset provides no transaction identifier, merchant, customer identity, location, or clock timestamp, so none are shown.
- **Fraud prediction:** validates a CSV against the feature list returned by `/api/model/info`, previews the first rows, and calls `/api/predict` for each row. The API supports one transaction per request, so the frontend caps a file at 250 rows and 2 MB and sends at most four requests concurrently. On the first request failure, in-flight requests finish and remaining rows are marked skipped. Successful, failed, and skipped rows are distinguished in the results and downloadable CSV.
- **Model intelligence:** reads model name, threshold, held-out test metrics, and actual confusion-matrix counts from `/api/model/info`. No precision-recall curve is drawn because the API does not expose curve coordinates.
- **Settings & about:** describes the dataset and limitations and checks the live API health endpoint.

The risk score is the XGBoost model probability. The class is fraud when the score is greater than or equal to the saved threshold from metadata. Display labels are application categories: low `< 0.25`, medium `0.25` to below the threshold, and high at or above the threshold. They are not separately validated risk ratings.

## Feature schema

The model expects 30 finite numeric columns: `Time`, `V1` through `V28`, and `Amount`. `V1`–`V28` are anonymised PCA components. `Time` is elapsed seconds in the historical dataset, not a real clock time. CSV column order may vary; rows are mapped into the metadata's saved model order before calling the API. Missing or extra columns, blank values, non-numeric values, NaN, and infinity are rejected before requests are sent.

## API client and limitations

The typed client in `src/lib/api.ts` calls `GET /api/health`, `GET /api/model/info`, and `POST /api/predict`. The dashboard reports unavailable state on network/API failures and never substitutes successful results. The Flask API currently has no authentication or rate limiting; keep it local and do not expose it publicly.

Model metrics are historical held-out test metrics, not production guarantees. The dataset is historical and anonymised, evaluation used a random stratified split rather than a temporal holdout, and duplicate rows were retained. No SHAP explanations or feature attributions are currently implemented.
