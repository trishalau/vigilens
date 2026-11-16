# VigiLens

VigiLens is a portfolio project for explainable credit card transaction fraud detection. It currently includes exploratory analysis and a reproducible baseline training pipeline. Model explanation work and an eventual review interface are future phases.

## Project structure

```text
data/             Local datasets (CSV files are excluded from Git)
ml/notebooks/     Exploratory analysis notebooks
ml/training/      Model training code
ml/artifacts/     Generated model files (excluded from Git)
frontend/         Future user interface
backend/          Future application API
```

## Dataset

The project is organized around the [Credit Card Fraud Detection dataset on Kaggle](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud), associated with the Machine Learning Group at Université Libre de Bruxelles (ULB). The repository currently contains `data/creditcard.csv`; CSV files are intentionally ignored by Git because datasets should be stored locally and may have separate distribution terms. Obtain the dataset from its source and place it at `data/creditcard.csv` if needed.

## Setup

Create and activate a virtual environment, then install the Python dependencies:

```bash
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate        # Windows PowerShell
python -m pip install -r requirements.txt
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

**Phase 2: baseline ML pipeline.** Exploratory analysis and reproducible training code are in place. The current local run selected XGBoost by validation PR-AUC; detailed metrics and generated files are in the Git-ignored `ml/artifacts/` directory. A Flask API and frontend have not started.
