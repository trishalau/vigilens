"""Validation for the ULB dataset's anonymised numeric feature schema."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from numbers import Real


class TransactionValidationError(ValueError):
    """A client error with a stable API code and useful message."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def validate_transaction(payload: Mapping[str, object], feature_names: Sequence[str]) -> dict[str, float]:
    """Validate exact schema and return an ordered mapping matching training feature order."""
    if not isinstance(payload, Mapping):
        raise TransactionValidationError("invalid_body", "Request body must be a JSON object.")

    expected = list(feature_names)
    expected_set = set(expected)
    supplied_set = set(payload)
    missing = [name for name in expected if name not in supplied_set]
    unexpected = sorted(str(name) for name in supplied_set - expected_set)
    if missing:
        raise TransactionValidationError("missing_features", f"Missing required features: {', '.join(missing)}.")
    if unexpected:
        raise TransactionValidationError("unexpected_features", f"Unexpected features are not accepted: {', '.join(unexpected)}.")

    ordered: dict[str, float] = {}
    for name in expected:
        value = payload[name]
        if isinstance(value, bool) or not isinstance(value, Real):
            raise TransactionValidationError("non_numeric_feature", f"Feature {name!r} must be a JSON number.")
        numeric_value = float(value)
        if not math.isfinite(numeric_value):
            raise TransactionValidationError("non_finite_feature", f"Feature {name!r} must be finite.")
        ordered[name] = numeric_value
    return ordered
