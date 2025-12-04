import os

from flask import Flask
from flask_vite import Vite

from backend.tasks import get_scheduler


def create_flask_app():
    from backend.crud import UPLOADS_FOLDER
    from backend.routes import main_routes

    app = Flask(__name__, static_folder="../frontend/static", template_folder="../templates")

    # Configuration
    app.config["SECRET_KEY"] = os.urandom(32)
    app.config['VITE_FOLDER_PATH'] = 'frontend'
    app.config["UPLOAD_FOLDER"] = UPLOADS_FOLDER
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Register routes
    app.register_blueprint(main_routes)

    # Create Vite extension
    Vite(app)

    # Check all extensions have been defined
    assert "vite" in app.extensions, "vite is not defined"
    # assert "celery" in app.extensions, "celery is not defined"

    return app

APP_DATA = {
    "name": "MIRExplorer",
    "description": "A basic Flask app for exploring audio files",
    "author": "Huw Cheston",
    "html_title": "MIRExplorer",
    "project_name": "MIRExplorer",
    "keywords": "flask, webapp, template, basic",
}
FLASK_APP = create_flask_app()
VITE_APP = FLASK_APP.extensions["vite"]
