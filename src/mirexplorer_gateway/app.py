import os
import secrets

from flask import Flask

from mirexplorer_gateway.extensions import limiter
from mirexplorer_gateway.routes import main_routes

IS_DEVELOPMENT = os.environ.get("DEVELOPMENT_ENV", "false").lower() == "true"

def _build_config():
	# Build config at app creation time; prefer explicit env secret for stable sessions.
	return {
		"DEBUG": IS_DEVELOPMENT,
		"SECRET_KEY": os.environ.get("SECRET_KEY") or secrets.token_hex(32),
		"MAX_CONTENT_LENGTH": 50 * 1024 * 1024,
		"WTF_CSRF_ENABLED": True,
	}


def create_flask_app():
	app = Flask(
		__name__,
		static_folder=str(_repo_root() / "frontend" / "static"),
		template_folder=str(_repo_root() / "frontend" / "templates"),
	)
	app.config.from_mapping(_build_config())
	app.register_blueprint(main_routes)
	limiter.init_app(app)

	@app.context_processor
	def inject_config():
		return dict(is_development=IS_DEVELOPMENT)

	return app


def _repo_root():
	from mirexplorer_common.paths import repo_root
	return repo_root()


FLASK_APP = create_flask_app()
