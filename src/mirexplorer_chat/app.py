import os
import secrets

from flask import Flask

from mirexplorer_chat.routes import chat_api

IS_DEVELOPMENT = os.environ.get("DEVELOPMENT_ENV", "false").lower() == "true"

def _build_config():
	# Build config at app creation time; prefer explicit env secret for stable sessions.
	return {
		"DEBUG": IS_DEVELOPMENT,
		"SECRET_KEY": os.environ.get("SECRET_KEY") or secrets.token_hex(32),
		"MAX_CONTENT_LENGTH": 10 * 1024 * 1024,
	}


def create_chat_app():
	app = Flask(__name__)
	app.config.from_mapping(_build_config())
	app.register_blueprint(chat_api)
	return app


CHAT_APP = create_chat_app()
