"""Flask application factory for the VigiLens API."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from flask import Flask
from flask_cors import CORS

from .routes.health import health_bp
from .routes.predictions import predictions_bp
from .services.model_service import ModelArtifactError, ModelService


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _cors_origins(value: str | list[str] | tuple[str, ...]) -> list[str]:
    if isinstance(value, str):
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return [str(origin).strip() for origin in value if str(origin).strip()]


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    """Create and configure a Flask app, loading the model bundle once per process."""
    app = Flask(__name__)
    app.config.from_mapping(
        MODEL_PATH=os.getenv("VIGILENS_MODEL_PATH", "ml/artifacts/vigilens_model.joblib"),
        METADATA_PATH=os.getenv("VIGILENS_METADATA_PATH", "ml/artifacts/evaluation.json"),
        CORS_ORIGINS=os.getenv("VIGILENS_CORS_ORIGINS", "http://localhost:5173"),
        TESTING=False,
        MODEL_SERVICE=None,
    )
    if test_config:
        app.config.update(test_config)

    origins = _cors_origins(app.config["CORS_ORIGINS"])
    if "*" in origins:
        raise ValueError("Wildcard CORS origins are not allowed; configure explicit trusted origins.")
    CORS(app, resources={r"/api/*": {"origins": origins}})

    service = app.config.get("MODEL_SERVICE")
    if service is None:
        model_path = Path(app.config["MODEL_PATH"])
        metadata_path = Path(app.config["METADATA_PATH"])
        if not model_path.is_absolute():
            model_path = PROJECT_ROOT / model_path
        if not metadata_path.is_absolute():
            metadata_path = PROJECT_ROOT / metadata_path
        try:
            service = ModelService(model_path, metadata_path)
            app.extensions["vigilens_model_error"] = None
        except ModelArtifactError as error:
            # Keep liveness/health endpoints available without exposing local paths.
            service = None
            app.extensions["vigilens_model_error"] = str(error)
            app.logger.error("VigiLens model unavailable; check the trusted local artifact and metadata configuration.")

    app.extensions["vigilens_model_service"] = service
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(predictions_bp, url_prefix="/api")
    return app
