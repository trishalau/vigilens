# VigiLens

VigiLens is a portfolio project for exploring credit card transaction fraud detection. The planned work includes data exploration, model development, evaluation, and eventually a full-stack interface for reviewing fraud predictions.

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

Start JupyterLab when you are ready to work in the notebooks:

```bash
jupyter lab
```

## Current development phase

**Phase 1: repository scaffolding.** The folders, dependency list, and project documentation are in place. Model training, a Flask API, and frontend implementation have not started. No model performance or dataset analysis results are reported yet.
