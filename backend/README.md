# VigiLens Flask API

This local demonstration API loads the selected XGBoost classifier from the repository's existing trusted joblib artifact. It does not train a model, call an LLM, connect to a database, or use the transaction dataset at request time.

## Architecture

```text
backend/
  app/
    __init__.py                 Flask application factory and configuration
    routes/                     Health, model information, and prediction endpoints
    schemas/transaction.py      Exact feature and value validation
    services/model_service.py   Cached trusted artifact loading and model inference
  tests/test_predictions.py     Route, validation, threshold, and model integration tests
  run.py                        Local development entry point
  requirements.txt              Backend dependencies
```

The app factory loads the model service once and stores it in `app.extensions`. The underlying artifact loader is process-cached by model and metadata paths. The default metadata source is `ml/artifacts/evaluation.json`, because this repository does not contain a separate `model_metadata.json`. The loader reads the selected model, saved threshold, feature order, and held-out test metrics from that file and checks the feature order against the fitted XGBoost artifact.

XGBoost was trained on raw numeric features in the saved order. No scaling or other preprocessing is applied to this selected model at inference. The API constructs a DataFrame in that order even when the incoming JSON object lists keys differently. Do not point the app at an untrusted joblib file: deserializing joblib artifacts can execute code.

## Local setup

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate        # Windows PowerShell
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Start the local development server from the repository root:

```bash
python -m backend.run
```

Or from the `backend/` directory, with the repository virtual environment active:

```bash
python run.py
```

The server binds to `127.0.0.1:5000` by default and debug mode is off. `backend/.env` can set `FLASK_HOST`, `FLASK_PORT`, `FLASK_DEBUG`, and `VIGILENS_CORS_ORIGINS`. CORS defaults to the explicit local React origin `http://localhost:5173`. Configure only trusted origins; wildcard CORS is rejected.

## Endpoints

### `GET /api/health`

Returns service health, whether model and metadata loaded, and the model identifier. Returns HTTP 503 if the model bundle is unavailable. It does not include local paths or exception details.

### `GET /api/model/info`

Returns model name, the ordered feature names and count, saved classification threshold, held-out test metrics and confusion-matrix counts from `evaluation.json`, and a preprocessing description.

### `POST /api/predict`

Accepts one JSON object with exactly these 30 numeric fields, in the recorded training schema:

`Time`, `V1`, `V2`, `V3`, `V4`, `V5`, `V6`, `V7`, `V8`, `V9`, `V10`, `V11`, `V12`, `V13`, `V14`, `V15`, `V16`, `V17`, `V18`, `V19`, `V20`, `V21`, `V22`, `V23`, `V24`, `V25`, `V26`, `V27`, `V28`, `Amount`.

`V1`–`V28` are anonymised PCA components. `Time` is elapsed seconds in the source dataset, not a clock timestamp. The dataset has no merchant names, customer identities, or locations. JSON object member order does not affect the request; the API rebuilds the model input in the exact order above. Missing, extra, non-numeric, boolean, NaN, and infinite values are rejected with HTTP 400.

Example request below uses synthetic zeros only to demonstrate the schema; it is not a real transaction. The returned score is calculated by the loaded model and depends on the input:

```bash
curl -sS http://127.0.0.1:5000/api/predict \
  -H 'Content-Type: application/json' \
  -d '{
    "Time": 0, "V1": 0, "V2": 0, "V3": 0, "V4": 0,
    "V5": 0, "V6": 0, "V7": 0, "V8": 0, "V9": 0,
    "V10": 0, "V11": 0, "V12": 0, "V13": 0, "V14": 0,
    "V15": 0, "V16": 0, "V17": 0, "V18": 0, "V19": 0,
    "V20": 0, "V21": 0, "V22": 0, "V23": 0, "V24": 0,
    "V25": 0, "V26": 0, "V27": 0, "V28": 0, "Amount": 0
  }'
```

Response fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `risk_score` | number | Probability returned by the loaded model, from 0 to 1 |
| `predicted_class` | integer | `1` when `risk_score >= threshold`, otherwise `0` |
| `risk_level` | string | Application display category: `low`, `medium`, or `high` |
| `threshold` | number | Classification threshold loaded from `evaluation.json` |
| `model` | string | Selected model name, currently `XGBoost` |

`risk_level` is a display category, not a separately validated financial risk rating: **low** means score `< 0.25`; **medium** means `0.25 <= score < saved threshold`; **high** means score `>= saved threshold`. The current saved threshold is approximately `0.749298`. These labels are independent application display categories and do not add model confidence or explanation.

## Feature schema and model evaluation

The API loads `ml/artifacts/vigilens_model.joblib` and reads feature names, threshold, model name, and metrics from `ml/artifacts/evaluation.json`. If either artifact is absent, unreadable, or incompatible with the feature schema, the API reports the model as unavailable and prediction/info requests return HTTP 503.

Recorded held-out test results at the validation-tuned threshold:

| Metric | Value |
| --- | ---: |
| Precision | 0.8451 |
| Recall | 0.8108 |
| F1 | 0.8276 |
| Average Precision (PR-AUC) | 0.8380 |
| ROC-AUC | 0.9632 |

These are the current training run's saved results, not a guarantee of future performance. Model selection used validation PR-AUC and the threshold was selected by validation F1 before the held-out test evaluation.

## Tests

From the repository root, run:

```bash
python -m pytest -q backend/tests
```

Most endpoint tests use a deterministic fake model service. The integration test loads the actual saved artifact when it is present and compares an API score with direct inference on a clearly synthetic schema-valid input. It does not retrain or read transaction rows.

## Limitations and security

- This API is a local portfolio demonstration, not a production banking fraud prevention service.
- The underlying ULB dataset is historical and anonymised. `Time` is elapsed time; the features do not include merchant, identity, location, or current live transaction context.
- Evaluation used a random stratified split, not a temporal holdout, and exact duplicate rows were retained. Results may be optimistic and may not transfer to current transactions.
- The threshold optimizes validation F1, not a bank's review capacity or financial cost function. `risk_level` is only a UI category.
- CORS is restricted to configured origins, but CORS is not authentication. The API has no authentication, authorization, or rate limiting. Keep it bound to localhost; do not expose it publicly without access controls and rate limiting.
- Request bodies and feature values are not logged. Error responses avoid stack traces and local filesystem paths.
- Only load model files obtained from a trusted source. Joblib is a Python object serialization format and must not be used with untrusted artifacts.

## Troubleshooting

- **Model unavailable:** confirm the `.joblib` and `evaluation.json` files exist under `ml/artifacts/`; if using path overrides, check `VIGILENS_MODEL_PATH` and `VIGILENS_METADATA_PATH`.
- **Feature schema mismatch:** send all 30 feature keys with numeric finite values; do not send `Class`, merchant fields, or customer data.
- **CORS error in a browser:** set `VIGILENS_CORS_ORIGINS` to the exact frontend origin, including scheme and port, then restart the server.
- **Import errors:** activate the project virtual environment and install `backend/requirements.txt`.
