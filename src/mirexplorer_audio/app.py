import os
import secrets

from flask import Flask

from mirexplorer_audio.extensions import cache
from mirexplorer_audio.storage import UPLOADS_FOLDER
from mirexplorer_audio.upload_routes import upload_api

IS_DEVELOPMENT = os.environ.get("DEVELOPMENT_ENV", "false").lower() == "true"

def _build_config():
	# Build config at app creation time; prefer explicit env secret for stable sessions.
	return {
		"DEBUG": IS_DEVELOPMENT,
		"SECRET_KEY": os.environ.get("SECRET_KEY") or secrets.token_hex(32),
		"MAX_CONTENT_LENGTH": 50 * 1024 * 1024,
		"CACHE_TYPE": "SimpleCache",
		"CACHE_DEFAULT_TIMEOUT": 1800,
		"UPLOAD_FOLDER": str(UPLOADS_FOLDER),
	}


def create_audio_app():
	app = Flask(__name__)
	app.config.from_mapping(_build_config())
	os.makedirs(UPLOADS_FOLDER, exist_ok=True)
	app.register_blueprint(upload_api)
	cache.init_app(app)
	return app


AUDIO_APP = create_audio_app()
