"""API contract and model integration tests using synthetic inputs only."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from backend.app import PROJECT_ROOT, create_app
from backend.app.services.model_service import ModelService


FEATURE_NAMES = ["Time", *[f"V{index}" for index in range(1, 29)], "Amount"]
THRESHOLD = 0.749298


class FakeModelService:
    """Small deterministic service for request validation and threshold tests."""

    model_name = "XGBoost"
    feature_names = FEATURE_NAMES
    threshold = THRESHOLD
    evaluation_metrics = {
        "precision": 0.8451,
        "recall": 0.8108,
        "f1": 0.8276,
        "average_precision": 0.8380,
        "roc_auc": 0.9632,
    }
    confusion_matrix = [[42637, 11], [14, 60]]
    confusion_matrix_labels = ["legitimate (0)", "fraud (1)"]
    metadata_filename = "evaluation.json"

    def predict_risk_score(self, ordered_features):
        assert list(ordered_features) == self.feature_names
        return float(ordered_features["Time"])


@pytest.fixture
def fake_service():
    return FakeModelService()


@pytest.fixture
def app(fake_service):
    return create_app({"TESTING": True, "MODEL_SERVICE": fake_service})


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def valid_payload():
    return {name: 0.0 for name in FEATURE_NAMES}


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {
        "status": "ok",
        "model_loaded": True,
        "model_identifier": "XGBoost",
    }


def test_cors_only_allows_the_configured_local_frontend_origin(client):
    allowed = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    blocked = client.get("/api/health", headers={"Origin": "https://untrusted.example"})
    assert allowed.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert blocked.headers.get("Access-Control-Allow-Origin") is None


def test_wildcard_cors_configuration_is_rejected():
    with pytest.raises(ValueError, match="Wildcard CORS"):
        create_app({"TESTING": True, "MODEL_SERVICE": FakeModelService(), "CORS_ORIGINS": "*"})


def test_model_metadata_endpoint(client):
    response = client.get("/api/model/info")
    assert response.status_code == 200
    body = response.json
    assert body["model"] == "XGBoost"
    assert body["feature_names"] == FEATURE_NAMES
    assert body["feature_count"] == 30
    assert body["threshold"] == THRESHOLD
    assert body["evaluation_metrics"]["average_precision"] == 0.8380
    assert body["confusion_matrix"] == [[42637, 11], [14, 60]]
    assert body["metadata_source"] == "evaluation.json"


def test_successful_prediction_returns_model_score(client, valid_payload):
    valid_payload["Time"] = 0.82
    response = client.post("/api/predict", json=valid_payload)
    assert response.status_code == 200
    assert response.json == {
        "risk_score": 0.82,
        "predicted_class": 1,
        "risk_level": "high",
        "threshold": THRESHOLD,
        "model": "XGBoost",
    }


def test_missing_features_return_400(client, valid_payload):
    valid_payload.pop("V7")
    response = client.post("/api/predict", json=valid_payload)
    assert response.status_code == 400
    assert response.json["error"]["code"] == "missing_features"
    assert "V7" in response.json["error"]["message"]


def test_extra_features_return_400(client, valid_payload):
    valid_payload["merchant_name"] = "not part of this dataset"
    response = client.post("/api/predict", json=valid_payload)
    assert response.status_code == 400
    assert response.json["error"]["code"] == "unexpected_features"


def test_non_numeric_feature_returns_400(client, valid_payload):
    valid_payload["V2"] = "0.5"
    response = client.post("/api/predict", json=valid_payload)
    assert response.status_code == 400
    assert response.json["error"]["code"] == "non_numeric_feature"


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_feature_returns_400(client, valid_payload, value):
    valid_payload["V3"] = value
    response = client.post("/api/predict", json=valid_payload)
    assert response.status_code == 400
    assert response.json["error"]["code"] == "non_finite_feature"


def test_invalid_json_returns_400(client):
    response = client.post(
        "/api/predict",
        data='{"Time":',
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json["error"]["code"] == "invalid_json"


def test_json_body_must_be_an_object(client):
    response = client.post("/api/predict", json=[1, 2, 3])
    assert response.status_code == 400
    assert response.json["error"]["code"] == "invalid_body"


def test_json_member_order_is_normalized_to_training_order(client, valid_payload):
    reverse_order_payload = dict(reversed(list(valid_payload.items())))
    response = client.post("/api/predict", json=reverse_order_payload)
    assert response.status_code == 200


@pytest.mark.parametrize(
    ("risk_score", "predicted_class"),
    [(THRESHOLD - 1e-6, 0), (THRESHOLD, 1), (THRESHOLD + 1e-6, 1)],
)
def test_threshold_is_inclusive(risk_score, predicted_class, client, valid_payload):
    valid_payload["Time"] = risk_score
    response = client.post("/api/predict", json=valid_payload)
    assert response.status_code == 200
    assert response.json["predicted_class"] == predicted_class


def test_unavailable_model_health_is_clear_and_does_not_expose_paths(tmp_path):
    app = create_app(
        {
            "TESTING": True,
            "MODEL_PATH": tmp_path / "missing.joblib",
            "METADATA_PATH": tmp_path / "missing.json",
        }
    )
    response = app.test_client().get("/api/health")
    assert response.status_code == 503
    assert response.json["model_loaded"] is False
    assert str(tmp_path) not in response.get_data(as_text=True)


def test_actual_saved_model_prediction_matches_direct_inference():
    model_path = PROJECT_ROOT / "ml" / "artifacts" / "vigilens_model.joblib"
    metadata_path = PROJECT_ROOT / "ml" / "artifacts" / "evaluation.json"
    if not model_path.is_file() or not metadata_path.is_file():
        pytest.skip("Saved model or its evaluation metadata is not available in this checkout.")

    service = ModelService(model_path, metadata_path)
    app = create_app({"TESTING": True, "MODEL_SERVICE": service})
    client = app.test_client()

    # Deterministic synthetic values satisfy the feature schema; these are not dataset rows.
    synthetic_payload = {name: 0.0 for name in service.feature_names}
    synthetic_payload["Time"] = 3600.0
    synthetic_payload["V4"] = 0.25
    synthetic_payload["Amount"] = 12.5
    ordered_frame = pd.DataFrame(
        [[synthetic_payload[name] for name in service.feature_names]],
        columns=service.feature_names,
    )
    direct_score = float(service.model.predict_proba(ordered_frame)[0, 1])

    response = client.post("/api/predict", json=synthetic_payload)
    assert response.status_code == 200
    body = response.json
    assert math.isfinite(body["risk_score"])
    assert 0.0 <= body["risk_score"] <= 1.0
    assert np.isclose(body["risk_score"], direct_score, rtol=0.0, atol=1e-12)
    assert body["predicted_class"] == int(direct_score >= service.threshold)
