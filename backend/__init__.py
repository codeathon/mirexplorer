import os

from flask import Flask

from backend.extensions import cache, limiter
from backend.tasks import get_scheduler

# Check if we're in development mode
IS_DEVELOPMENT = os.environ.get("DEVELOPMENT_ENV", "false").lower() == "true"

FLASK_CONFIG = {
    "DEBUG": IS_DEVELOPMENT,
    "SECRET_KEY": os.urandom(32),
    "MAX_CONTENT_LENGTH": 50 * 1024 * 1024,
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 1800
}


def create_flask_app():
    from backend.crud import UPLOADS_FOLDER
    from backend.routes import main_routes

    app = Flask(__name__, static_folder="../frontend/static", template_folder="../frontend/templates")
    app.config.from_mapping(FLASK_CONFIG)

    app.config["UPLOAD_FOLDER"] = UPLOADS_FOLDER
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    app.register_blueprint(main_routes)

    cache.init_app(app)
    limiter.init_app(app)

    # Add is_development flag to templates
    @app.context_processor
    def inject_config():
        return dict(is_development=IS_DEVELOPMENT)

    return app


app_data = {
    "name": "MIRExplorer",
    "description": "A basic Flask app for exploring audio files",
    "author": "Huw Cheston",
    "html_title": "MIRExplorer",
    "project_name": "MIRExplorer",
    "keywords": "flask, webapp, template, basic",
}
FLASK_APP = create_flask_app()
