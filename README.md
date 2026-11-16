# VigiLens

VigiLens is a portfolio project for explainable credit card transaction fraud detection. It includes exploratory analysis, a reproducible baseline pipeline, and a local Flask REST API that loads the selected trained model. SHAP explanations and the frontend remain future phases.

## Project structure

```text
data/             Local datasets (CSV files are excluded from Git)
ml/notebooks/     Exploratory analysis notebooks
ml/training/      Model training code
ml/artifacts/     Generated model files (excluded from Git)
frontend/         React + TypeScript dashboard and CSV prediction workflow
backend/          Flask API, model service, schemas, and tests
```

## Dataset

The project is organized around the [Credit Card Fraud Detection dataset on Kaggle](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud), associated with the Machine Learning Group at Université Libre de Bruxelles (ULB). The repository currently contains `data/creditcard.csv`; CSV files are intentionally ignored by Git because datasets should be stored locally and may have separate distribution terms. Obtain the dataset from its source and place it at `data/creditcard.csv` if needed.

## Setup

Create and activate a virtual environment, then install the Python dependencies:

```bash
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate        # Windows PowerShell
python -m pip install -r requirements.txt -r backend/requirements.txt
```

## Train and evaluate baseline models

From the repository root, first run the lightweight data and schema validation:

```bash
python -m ml.training.train --validate-only
```

To train both candidates and save the selected model and evaluation outputs:

```bash
python -m ml.training.train
```

The training run makes a reproducible random stratified split of 70% training, 15% validation, and 15% test data with `random_state=42`. This is **not a temporal evaluation**. The Logistic Regression scaler is part of a scikit-learn pipeline, so its statistics are fit only on the training partition. Logistic Regression and XGBoost are compared on validation precision, recall, F1, average precision (PR-AUC), ROC-AUC, and confusion matrices. The selected model is chosen by validation PR-AUC; its F1 threshold is tuned on validation predictions. The untouched test partition is used only after those choices are frozen. The default `0.5` threshold is also recorded for comparison.

The run writes these generated files under `ml/artifacts/` (ignored by Git):

- `vigilens_model.joblib`: the fitted selected model or pipeline.
- `evaluation.json`: feature order, dataset schema, split and class counts, selected model, thresholds, and computed metrics.
- `validation_precision_recall.png`: validation PR curves for both candidates.
- `test_confusion_matrix.png`: confusion matrix for the selected model at the frozen validation-tuned threshold.

The XGBoost model uses a training-label-derived `scale_pos_weight`, a fixed seed, and histogram tree construction. No resampling or early stopping is used. A complete run fits both models and may take several minutes; the `--validate-only` option checks the data without fitting models or writing artifacts.

## Local Flask API

The backend loads `ml/artifacts/vigilens_model.joblib` and reads its actual saved metadata from `ml/artifacts/evaluation.json`. This repository does not have a separate `model_metadata.json`. The selected XGBoost model was trained on raw numeric features, so the API sends raw feature values in the saved feature order and does not apply scaling.

Start the local API from the repository root:

```bash
python -m backend.run
```

The development server binds to `127.0.0.1:5000`, loads the existing artifact, and allows CORS only from `http://localhost:5173` by default. See [backend/README.md](backend/README.md) for setup, the complete feature request schema, curl examples, testing, configuration, and troubleshooting.

## React frontend

The frontend lives in `frontend/` and calls the Flask API using `VITE_API_BASE_URL` (default `http://127.0.0.1:5000`). It includes session-only analytics, a transaction explorer, a CSV upload workflow with bounded per-row API requests, model information, and project limitations. It does not generate sample dashboard statistics or predictions.

Start the backend in one terminal, then run the frontend in another:

```bash
cd frontend
npm install
npm run dev
```

Type-check and create a production build with `npm run typecheck` and `npm run build` from `frontend/`. See [frontend/README.md](frontend/README.md) for feature-schema, CSV limits, data behavior, and API details. The backend CORS allowlist defaults to `http://localhost:5173`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service and model availability |
| `GET /api/model/info` | Model name, feature schema, threshold, saved test metrics, and confusion matrix |
| `POST /api/predict` | Model risk score, thresholded class, and display category |

The API is a local demonstration. It has no authentication or rate limiting and must not be exposed publicly without appropriate access controls.

### Saved held-out test metrics

The current run selected XGBoost by validation PR-AUC and tuned the classification threshold on validation F1. The following metrics are read from the saved test evaluation at the frozen threshold:

| Metric | Value |
| --- | ---: |
| Precision | 0.8451 |
| Recall | 0.8108 |
| F1 | 0.8276 |
| Average Precision (PR-AUC) | 0.8380 |
| ROC-AUC | 0.9632 |

These historical dataset results are not a guarantee of future performance.

## Limitations

- The split is random and stratified, so it does not measure performance on future transactions. `Time` is elapsed seconds, not a calendar timestamp.
- The source file contains exact duplicate rows. The pipeline reports and retains them; duplicate records can land in different random partitions and make evaluation optimistic.
- The validation-tuned threshold maximizes F1, which treats precision and recall symmetrically. A production threshold should reflect review capacity and the relative costs of false positives and missed fraud.
- This is a baseline modeling pipeline. SHAP or other per-transaction explanations, deployment, and a user interface are not implemented yet.
- Run-specific metrics and the selected threshold are stored in the generated, Git-ignored `ml/artifacts/evaluation.json`; they are not hard-coded in this README.

Start JupyterLab when you are ready to work in the notebooks:

```bash
jupyter lab
```

## Current development phase

**Phase 4: local web experience.** A React + TypeScript dashboard integrates with the local Flask API and supports bounded CSV prediction using the trained model. Database integration, SHAP explanations, authentication, rate limiting, and deployment have not started.
