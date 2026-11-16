"""Evaluation helpers shared by the VigiLens training pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)


def tune_threshold_for_f1(y_true: np.ndarray, probabilities: np.ndarray) -> tuple[float, float]:
    """Choose a probability threshold that maximizes F1 on the supplied validation set."""
    precision, recall, thresholds = precision_recall_curve(y_true, probabilities)
    if thresholds.size == 0:
        return 0.5, float(f1_score(y_true, probabilities >= 0.5, zero_division=0))

    denominator = precision[:-1] + recall[:-1]
    f1_values = np.divide(
        2 * precision[:-1] * recall[:-1],
        denominator,
        out=np.zeros_like(denominator),
        where=denominator != 0,
    )
    best_index = int(np.argmax(f1_values))
    return float(thresholds[best_index]), float(f1_values[best_index])


def classification_metrics(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    threshold: float = 0.5,
) -> dict[str, Any]:
    """Calculate threshold-dependent metrics and threshold-independent ranking metrics."""
    predictions = probabilities >= threshold
    matrix = confusion_matrix(y_true, predictions, labels=[0, 1])
    return {
        "threshold": float(threshold),
        "precision": float(precision_score(y_true, predictions, zero_division=0)),
        "recall": float(recall_score(y_true, predictions, zero_division=0)),
        "f1": float(f1_score(y_true, predictions, zero_division=0)),
        "average_precision": float(average_precision_score(y_true, probabilities)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "confusion_matrix": matrix.tolist(),
        "confusion_matrix_labels": ["legitimate (0)", "fraud (1)"],
    }


def save_precision_recall_plot(
    y_true: np.ndarray,
    probabilities_by_model: dict[str, np.ndarray],
    output_path: Path,
) -> None:
    """Save validation precision-recall curves for each candidate model."""
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(8, 6))
    for name, probabilities in probabilities_by_model.items():
        precision, recall, _ = precision_recall_curve(y_true, probabilities)
        ap = average_precision_score(y_true, probabilities)
        ax.plot(recall, precision, label=f"{name} (AP = {ap:.4f})")

    baseline = float(np.mean(y_true))
    ax.axhline(baseline, color="gray", linestyle="--", label=f"Fraud prevalence = {baseline:.4f}")
    ax.set(
        title="Validation precision-recall curves",
        xlabel="Recall",
        ylabel="Precision",
        xlim=(0, 1),
        ylim=(0, 1.02),
    )
    ax.legend(loc="best")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def save_confusion_matrix_plot(
    matrix: list[list[int]],
    output_path: Path,
    title: str,
) -> None:
    """Save a labeled confusion matrix for a selected threshold."""
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 5))
    image = ax.imshow(np.asarray(matrix), cmap="Blues")
    fig.colorbar(image, ax=ax, label="Transaction count")
    ax.set(
        title=title,
        xlabel="Predicted label",
        ylabel="True label",
        xticks=[0, 1],
        yticks=[0, 1],
        xticklabels=["Legitimate", "Fraud"],
        yticklabels=["Legitimate", "Fraud"],
    )
    for row in range(2):
        for column in range(2):
            ax.text(column, row, f"{matrix[row][column]:,}", ha="center", va="center", color="black")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
