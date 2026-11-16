"""Train and compare reproducible fraud-detection baseline models.

Run from the repository root with ``python -m ml.training.train``. A complete
training run fits both models and can take several minutes on a laptop.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml.training.evaluate import (
    classification_metrics,
    save_confusion_matrix_plot,
    save_precision_recall_plot,
    tune_threshold_for_f1,
)


RANDOM_STATE = 42
TARGET_COLUMN = "Class"
FEATURE_COLUMNS = ["Time", *[f"V{i}" for i in range(1, 29)], "Amount"]
EXPECTED_COLUMNS = [*FEATURE_COLUMNS, TARGET_COLUMN]
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def load_and_validate_dataset(dataset_path: Path) -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    """Load the source CSV and validate schema, numeric types, and target labels."""
    if not dataset_path.is_file():
        raise FileNotFoundError(
            f"Dataset not found: {dataset_path}\n"
            "Download the ULB Credit Card Fraud Detection dataset from "
            "https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud and place "
            "the original creditcard.csv file in data/."
        )

    frame = pd.read_csv(dataset_path)
    missing_columns = sorted(set(EXPECTED_COLUMNS).difference(frame.columns))
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {missing_columns}")

    non_numeric = [
        column
        for column in frame.columns
        if not pd.api.types.is_numeric_dtype(frame[column])
    ]
    if non_numeric:
        raise TypeError(f"Expected numeric feature and target columns; non-numeric columns: {non_numeric}")

    if frame[EXPECTED_COLUMNS].isna().any().any():
        missing_by_column = frame[EXPECTED_COLUMNS].isna().sum()
        missing_by_column = missing_by_column[missing_by_column > 0].to_dict()
        raise ValueError(f"Missing values found in required columns: {missing_by_column}")

    values = frame[TARGET_COLUMN].unique()
    invalid_labels = sorted(set(values).difference({0, 1}))
    if invalid_labels:
        raise ValueError(f"Target column {TARGET_COLUMN!r} must contain only 0 and 1; found {invalid_labels}")
    if len(values) < 2:
        raise ValueError("Target column must contain both classes 0 (legitimate) and 1 (fraud).")

    feature_values = frame[FEATURE_COLUMNS].to_numpy(dtype=np.float64, copy=False)
    if not np.isfinite(feature_values).all():
        raise ValueError("Feature columns contain infinite or non-finite values.")

    features = frame.loc[:, FEATURE_COLUMNS].copy()
    target = frame[TARGET_COLUMN].astype(np.int8).copy()
    schema = {
        "dataset_path": str(dataset_path.resolve()),
        "row_count": int(len(frame)),
        "columns": list(frame.columns),
        "dtypes": {column: str(dtype) for column, dtype in frame.dtypes.items()},
        "feature_names_order": list(FEATURE_COLUMNS),
        "target_column": TARGET_COLUMN,
        "target_labels": {"0": "legitimate", "1": "fraud"},
        "class_counts": {str(int(label)): int(count) for label, count in target.value_counts().sort_index().items()},
        "missing_cells_in_required_columns": int(frame[EXPECTED_COLUMNS].isna().sum().sum()),
        "duplicate_rows": int(frame.duplicated().sum()),
    }
    return features, target, schema


def stratified_split(
    features: pd.DataFrame,
    target: pd.Series,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, pd.Series]:
    """Return 70/15/15 random stratified train, validation, and test partitions."""
    x_train, x_holdout, y_train, y_holdout = train_test_split(
        features,
        target,
        test_size=0.30,
        random_state=RANDOM_STATE,
        stratify=target,
    )
    x_validation, x_test, y_validation, y_test = train_test_split(
        x_holdout,
        y_holdout,
        test_size=0.50,
        random_state=RANDOM_STATE,
        stratify=y_holdout,
    )
    return x_train, x_validation, x_test, y_train, y_validation, y_test


def build_logistic_regression() -> Pipeline:
    """Create a scaler-plus-logistic-regression pipeline fitted only on training data."""
    return Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "classifier",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=2000,
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )


def build_xgboost(scale_pos_weight: float):
    """Create the XGBoost classifier; import it only when a training run is requested."""
    try:
        from xgboost import XGBClassifier
    except ImportError as error:
        raise RuntimeError(
            "XGBoost is required to train and compare both models, but it is not installed in this Python environment. "
            "Install project dependencies with `python -m pip install -r requirements.txt`, then retry."
        ) from error

    return XGBClassifier(
        objective="binary:logistic",
        eval_metric="logloss",
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        tree_method="hist",
        verbosity=0,
    )


def report_validation_metrics(metrics_by_model: dict[str, dict[str, Any]]) -> None:
    """Print a compact, row-free validation comparison."""
    print("\nValidation metrics at threshold 0.5")
    print(f"{'Model':<24} {'Precision':>11} {'Recall':>11} {'F1':>11} {'PR-AUC':>11} {'ROC-AUC':>11}")
    for name, metrics in metrics_by_model.items():
        print(
            f"{name:<24} {metrics['precision']:>11.4f} {metrics['recall']:>11.4f} "
            f"{metrics['f1']:>11.4f} {metrics['average_precision']:>11.4f} {metrics['roc_auc']:>11.4f}"
        )


def run_training(dataset_path: Path, artifacts_dir: Path) -> dict[str, Any]:
    """Fit candidate models, select on validation PR-AUC, tune F1 threshold, and test once."""
    features, target, schema = load_and_validate_dataset(dataset_path)
    x_train, x_validation, x_test, y_train, y_validation, y_test = stratified_split(features, target)
    split_counts = {
        "train": {str(int(label)): int(count) for label, count in y_train.value_counts().sort_index().items()},
        "validation": {str(int(label)): int(count) for label, count in y_validation.value_counts().sort_index().items()},
        "test": {str(int(label)): int(count) for label, count in y_test.value_counts().sort_index().items()},
    }

    print(
        "Random stratified split (not a temporal evaluation): "
        f"train={len(y_train):,} ({len(y_train) / len(target):.0%}), "
        f"validation={len(y_validation):,} ({len(y_validation) / len(target):.0%}), "
        f"test={len(y_test):,} ({len(y_test) / len(target):.0%})"
    )
    print(f"Rows retained, including {schema['duplicate_rows']:,} exact duplicate rows.")

    positive_count = int((y_train == 1).sum())
    negative_count = int((y_train == 0).sum())
    if positive_count == 0:
        raise ValueError("Training split has no fraud examples; cannot derive XGBoost imbalance weight.")
    scale_pos_weight = negative_count / positive_count

    models = {
        "Logistic Regression": build_logistic_regression(),
        "XGBoost": build_xgboost(scale_pos_weight),
    }
    validation_probabilities: dict[str, np.ndarray] = {}
    validation_metrics: dict[str, dict[str, Any]] = {}

    for name, model in models.items():
        print(f"Fitting {name}...", flush=True)
        model.fit(x_train, y_train)
        probabilities = model.predict_proba(x_validation)[:, 1]
        validation_probabilities[name] = probabilities
        validation_metrics[name] = classification_metrics(y_validation.to_numpy(), probabilities, 0.5)

    report_validation_metrics(validation_metrics)
    selected_name = max(
        validation_metrics,
        key=lambda name: validation_metrics[name]["average_precision"],
    )
    selected_model = models[selected_name]
    selected_validation_probabilities = validation_probabilities[selected_name]
    tuned_threshold, tuned_validation_f1 = tune_threshold_for_f1(
        y_validation.to_numpy(), selected_validation_probabilities
    )
    selected_validation_tuned_metrics = classification_metrics(
        y_validation.to_numpy(), selected_validation_probabilities, tuned_threshold
    )

    # Test labels are held aside until candidate selection and threshold tuning are complete.
    test_probabilities = selected_model.predict_proba(x_test)[:, 1]
    test_metrics_default = classification_metrics(y_test.to_numpy(), test_probabilities, 0.5)
    test_metrics_tuned = classification_metrics(y_test.to_numpy(), test_probabilities, tuned_threshold)

    artifacts_dir.mkdir(parents=True, exist_ok=True)
    model_path = artifacts_dir / "vigilens_model.joblib"
    metrics_path = artifacts_dir / "evaluation.json"
    precision_recall_path = artifacts_dir / "validation_precision_recall.png"
    confusion_matrix_path = artifacts_dir / "test_confusion_matrix.png"

    joblib.dump(selected_model, model_path)
    save_precision_recall_plot(y_validation.to_numpy(), validation_probabilities, precision_recall_path)
    save_confusion_matrix_plot(
        test_metrics_tuned["confusion_matrix"],
        confusion_matrix_path,
        f"Test confusion matrix — {selected_name}, threshold={tuned_threshold:.4f}",
    )

    report: dict[str, Any] = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "random_state": RANDOM_STATE,
        "training_configuration": {
            "logistic_regression": {
                "class_weight": "balanced",
                "max_iter": 2000,
                "random_state": RANDOM_STATE,
                "preprocessing": "StandardScaler in a Pipeline, fit on training partition only",
            },
            "xgboost": {
                "objective": "binary:logistic",
                "eval_metric": "logloss",
                "n_estimators": 300,
                "learning_rate": 0.05,
                "max_depth": 5,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "scale_pos_weight": scale_pos_weight,
                "random_state": RANDOM_STATE,
                "tree_method": "hist",
                "early_stopping": False,
            },
        },
        "split": {
            "method": "random stratified split; not a temporal evaluation",
            "proportions": {"train": 0.70, "validation": 0.15, "test": 0.15},
            "row_counts": {"train": len(y_train), "validation": len(y_validation), "test": len(y_test)},
            "class_counts": split_counts,
        },
        "dataset_schema": schema,
        "candidate_models_validation_threshold_0_5": validation_metrics,
        "selection": {
            "criterion": "highest validation average precision (PR-AUC)",
            "selected_model": selected_name,
            "validation_average_precision": validation_metrics[selected_name]["average_precision"],
        },
        "threshold_tuning": {
            "criterion": "maximize validation F1",
            "default_threshold": 0.5,
            "selected_threshold": tuned_threshold,
            "best_validation_f1": tuned_validation_f1,
            "selected_model_validation_at_default_threshold": validation_metrics[selected_name],
            "selected_model_validation_at_tuned_threshold": selected_validation_tuned_metrics,
        },
        "test_evaluation": {
            "selected_model": selected_name,
            "frozen_threshold": tuned_threshold,
            "metrics_at_frozen_threshold": test_metrics_tuned,
            "metrics_at_default_threshold_0_5": test_metrics_default,
        },
        "artifacts": {
            "model": model_path.name,
            "validation_precision_recall_plot": precision_recall_path.name,
            "test_confusion_matrix_plot": confusion_matrix_path.name,
        },
    }

    with metrics_path.open("w", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)

    print(f"\nSelected model by validation PR-AUC: {selected_name}")
    print(f"Validation-tuned F1 threshold: {tuned_threshold:.6f} (validation F1={tuned_validation_f1:.4f})")
    print("Test metrics at frozen validation-tuned threshold:")
    for key in ("precision", "recall", "f1", "average_precision", "roc_auc"):
        print(f"  {key}: {test_metrics_tuned[key]:.4f}")
    print(f"Artifacts saved in: {artifacts_dir.resolve()}")
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train and compare VigiLens fraud detection baselines.")
    parser.add_argument(
        "--data-path",
        type=Path,
        default=PROJECT_ROOT / "data" / "creditcard.csv",
        help="Path to the original creditcard.csv (default: data/creditcard.csv).",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=PROJECT_ROOT / "ml" / "artifacts",
        help="Directory for the selected model, metrics JSON, and plots.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Load and validate the dataset without fitting models or writing artifacts.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        if args.validate_only:
            features, target, schema = load_and_validate_dataset(args.data_path)
            print(f"Dataset validation passed: {len(target):,} rows, {len(features.columns)} features.")
            print(f"Class counts: {schema['class_counts']}")
            print(f"Exact duplicate rows retained: {schema['duplicate_rows']:,}")
            return 0
        run_training(args.data_path, args.artifacts_dir)
        return 0
    except (FileNotFoundError, TypeError, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
