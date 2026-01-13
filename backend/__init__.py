import os

from flask import Flask

from backend.extensions import cache, vite, limiter
from backend.tasks import get_scheduler


FLASK_CONFIG = {
    "DEBUG": True,
    "SECRET_KEY": os.urandom(32),
    "VITE_FOLDER_PATH": "frontend",
    "MAX_CONTENT_LENGTH": 50 * 1024 * 1024,   # allow up to 50 MB uploads, for safety
    # Flask-Caching related configs
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 1800    # cache results for 30 minutes
}


def create_flask_app():
    from backend.crud import UPLOADS_FOLDER, clear_uploads
    from backend.routes import main_routes

    app = Flask(__name__, static_folder="../frontend/static", template_folder="../templates")

    # Configuration
    app.config.from_mapping(FLASK_CONFIG)

    # Handle upload folder: create if not existing, and clear everything inside it for a clean start
    app.config["UPLOAD_FOLDER"] = UPLOADS_FOLDER
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    # clear_uploads()

    # Register routes
    app.register_blueprint(main_routes)

    # Initialise extensions
    vite.init_app(app)
    cache.init_app(app)
    limiter.init_app(app)

    # Check all extensions have been defined
    assert "vite" in app.extensions, "vite is not defined"
    assert "cache" in app.extensions, "cache is not defined"
    assert "limiter" in app.extensions, "limiter is not defined"
    # assert "celery" in app.extensions, "celery is not defined"

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
