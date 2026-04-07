import os

from flask import Flask

from mirexplorer_gateway.extensions import limiter
from mirexplorer_gateway.routes import main_routes

IS_DEVELOPMENT = os.environ.get("DEVELOPMENT_ENV", "false").lower() == "true"

FLASK_CONFIG = {
	"DEBUG": IS_DEVELOPMENT,
	"SECRET_KEY": os.urandom(32),
	"MAX_CONTENT_LENGTH": 50 * 1024 * 1024,
	"WTF_CSRF_ENABLED": True,
}


def create_flask_app():
	app = Flask(
		__name__,
		static_folder=str(_repo_root() / "frontend" / "static"),
		template_folder=str(_repo_root() / "frontend" / "templates"),
	)
	app.config.from_mapping(FLASK_CONFIG)
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
