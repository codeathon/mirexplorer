import os

from flask import Flask

from mirexplorer_chat.routes import chat_api

IS_DEVELOPMENT = os.environ.get("DEVELOPMENT_ENV", "false").lower() == "true"

FLASK_CONFIG = {
	"DEBUG": IS_DEVELOPMENT,
	"SECRET_KEY": os.urandom(32),
	"MAX_CONTENT_LENGTH": 10 * 1024 * 1024,
}


def create_chat_app():
	app = Flask(__name__)
	app.config.from_mapping(FLASK_CONFIG)
	app.register_blueprint(chat_api)
	return app


CHAT_APP = create_chat_app()
