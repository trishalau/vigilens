"""Model information and prediction endpoints."""

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest, UnsupportedMediaType

from ..schemas.transaction import TransactionValidationError, validate_transaction


predictions_bp = Blueprint("predictions", __name__)


def _model_service():
    service = current_app.extensions.get("vigilens_model_service")
    if service is None:
        return None, (
            jsonify(
                {
                    "error": {
                        "code": "model_unavailable",
                        "message": "The fraud model is unavailable. Check the local model artifact and metadata configuration.",
                    }
                }
            ),
            503,
        )
    return service, None


@predictions_bp.get("/model/info")
def model_info():
    service, unavailable = _model_service()
    if unavailable:
        return unavailable
    return jsonify(
        {
            "model": service.model_name,
            "feature_names": service.feature_names,
            "feature_count": len(service.feature_names),
            "threshold": service.threshold,
            "evaluation_metrics": service.evaluation_metrics,
            "confusion_matrix": service.confusion_matrix,
            "confusion_matrix_labels": service.confusion_matrix_labels,
            "preprocessing": "Raw numeric features in the recorded training order; no scaling is used by the selected XGBoost model.",
            "metadata_source": service.metadata_filename,
        }
    )


@predictions_bp.post("/predict")
def predict():
    try:
        payload = request.get_json()
    except (BadRequest, UnsupportedMediaType):
        return jsonify(
            {
                "error": {
                    "code": "invalid_json",
                    "message": "Request body must be valid JSON with Content-Type: application/json.",
                }
            }
        ), 400

    if not isinstance(payload, dict):
        return jsonify(
            {
                "error": {
                    "code": "invalid_body",
                    "message": "Request body must be a JSON object containing transaction features.",
                }
            }
        ), 400

    service, unavailable = _model_service()
    if unavailable:
        return unavailable

    try:
        ordered_features = validate_transaction(payload, service.feature_names)
    except TransactionValidationError as error:
        return jsonify({"error": {"code": error.code, "message": error.message}}), 400

    try:
        risk_score = service.predict_risk_score(ordered_features)
    except Exception:
        # Do not return exception details, file paths, or transaction values to clients.
        current_app.logger.error("Model prediction failed.")
        return jsonify(
            {
                "error": {
                    "code": "prediction_failed",
                    "message": "The model could not score this request.",
                }
            }
        ), 500

    predicted_class = int(risk_score >= service.threshold)
    if risk_score < 0.25:
        risk_level = "low"
    elif risk_score < service.threshold:
        risk_level = "medium"
    else:
        risk_level = "high"

    return jsonify(
        {
            "risk_score": risk_score,
            "predicted_class": predicted_class,
            "risk_level": risk_level,
            "threshold": service.threshold,
            "model": service.model_name,
        }
    )
