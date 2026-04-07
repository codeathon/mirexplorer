import os

from flask import Flask

from mirexplorer_analysis.extensions import cache
from mirexplorer_analysis.routes import analysis_api

IS_DEVELOPMENT = os.environ.get("DEVELOPMENT_ENV", "false").lower() == "true"

FLASK_CONFIG = {
	"DEBUG": IS_DEVELOPMENT,
	"SECRET_KEY": os.urandom(32),
	"MAX_CONTENT_LENGTH": 50 * 1024 * 1024,
	"CACHE_TYPE": "SimpleCache",
	"CACHE_DEFAULT_TIMEOUT": 1800,
}


def create_analysis_app():
	app = Flask(__name__)
	app.config.from_mapping(FLASK_CONFIG)
	app.register_blueprint(analysis_api)
	cache.init_app(app)
	return app


ANALYSIS_APP = create_analysis_app()
