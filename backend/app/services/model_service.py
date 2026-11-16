"""Trusted local model loading and prediction service."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

import joblib
import pandas as pd


class ModelArtifactError(RuntimeError):
    """Raised when the configured local model or its metadata is missing or incompatible."""


@lru_cache(maxsize=4)
def _load_model_bundle(model_path: str, metadata_path: str) -> tuple[Any, dict[str, Any]]:
    """Load a trusted local artifact once per process for each configured path pair."""
    model_file = Path(model_path)
    metadata_file = Path(metadata_path)
    if not model_file.is_file():
        raise ModelArtifactError("Configured model artifact is missing.")
    if not metadata_file.is_file():
        raise ModelArtifactError("Configured model metadata is missing.")

    try:
        metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ModelArtifactError("Configured model metadata is unreadable or invalid JSON.") from error
    if not isinstance(metadata, dict):
        raise ModelArtifactError("Configured model metadata must be a JSON object.")

    try:
        # joblib can execute code during deserialization: only use trusted local artifacts.
        model = joblib.load(model_file)
    except Exception as error:
        raise ModelArtifactError("Configured trusted model artifact could not be loaded.") from error

    return model, metadata


class ModelService:
    """Expose the selected model, threshold, schema, and held-out evaluation metrics."""

    def __init__(self, model_path: Path, metadata_path: Path) -> None:
        self.model_path = model_path.resolve()
        self.metadata_path = metadata_path.resolve()
        self.metadata_filename = self.metadata_path.name
        model, metadata = _load_model_bundle(str(self.model_path), str(self.metadata_path))

        try:
            self.model_name = str(metadata["selection"]["selected_model"])
            self.threshold = float(metadata["threshold_tuning"]["selected_threshold"])
            self.feature_names = list(metadata["dataset_schema"]["feature_names_order"])
            raw_metrics = metadata["test_evaluation"]["metrics_at_frozen_threshold"]
            self.evaluation_metrics = {
                name: float(raw_metrics[name])
                for name in ("precision", "recall", "f1", "average_precision", "roc_auc")
            }
            raw_matrix = raw_metrics["confusion_matrix"]
            self.confusion_matrix = [[int(value) for value in row] for row in raw_matrix]
            self.confusion_matrix_labels = list(raw_metrics["confusion_matrix_labels"])
        except (KeyError, TypeError, ValueError) as error:
            raise ModelArtifactError("Model metadata is missing required model, threshold, feature, or metric fields.") from error

        if not math.isfinite(self.threshold) or not 0 <= self.threshold <= 1:
            raise ModelArtifactError("Metadata classification threshold must be finite and between 0 and 1.")
        if not self.feature_names or any(not isinstance(name, str) or not name for name in self.feature_names):
            raise ModelArtifactError("Metadata feature names must be a non-empty list of strings.")
        if len(set(self.feature_names)) != len(self.feature_names):
            raise ModelArtifactError("Metadata feature names must be unique.")
        if (
            len(self.confusion_matrix) != 2
            or any(len(row) != 2 for row in self.confusion_matrix)
            or any(value < 0 for row in self.confusion_matrix for value in row)
            or len(self.confusion_matrix_labels) != 2
        ):
            raise ModelArtifactError("Metadata confusion matrix must contain non-negative 2x2 counts and two labels.")
        if not callable(getattr(model, "predict_proba", None)):
            raise ModelArtifactError("Loaded model is incompatible: predict_proba is required.")
        if self.model_name != "XGBoost" or type(model).__name__ != "XGBClassifier":
            raise ModelArtifactError("Loaded model does not match the selected XGBoost model in metadata.")

        artifact_features = getattr(model, "feature_names_in_", None)
        if artifact_features is None:
            booster = getattr(model, "get_booster", lambda: None)()
            artifact_features = getattr(booster, "feature_names", None)
        if artifact_features is None or [str(name) for name in artifact_features] != self.feature_names:
            raise ModelArtifactError("Model feature names or order do not match the metadata feature schema.")

        for metric_name, metric_value in self.evaluation_metrics.items():
            if not math.isfinite(metric_value):
                raise ModelArtifactError(f"Metadata evaluation metric {metric_name!r} is not finite.")
        self.model = model

    def predict_risk_score(self, ordered_features: Mapping[str, float]) -> float:
        """Score one feature mapping in metadata order, using the model's raw training inputs."""
        row = [[float(ordered_features[name]) for name in self.feature_names]]
        frame = pd.DataFrame(row, columns=self.feature_names)
        probabilities = self.model.predict_proba(frame)
        if getattr(probabilities, "ndim", 0) != 2 or probabilities.shape[0] != 1 or probabilities.shape[1] < 2:
            raise RuntimeError("Model returned an incompatible probability output.")
        score = float(probabilities[0, 1])
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise RuntimeError("Model returned an invalid risk score.")
        return score
