"""Health endpoint."""

from flask import Blueprint, current_app, jsonify


health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    service = current_app.extensions.get("vigilens_model_service")
    if service is None:
        return jsonify(
            {
                "status": "unavailable",
                "model_loaded": False,
                "model_identifier": None,
            }
        ), 503

    return jsonify(
        {
            "status": "ok",
            "model_loaded": True,
            "model_identifier": service.model_name,
        }
    )
