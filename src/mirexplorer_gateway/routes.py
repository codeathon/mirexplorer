import os

import httpx
from flask import render_template, request, redirect, url_for, send_from_directory, Blueprint, flash, jsonify, Response
from loguru import logger
from werkzeug.exceptions import HTTPException

from mirexplorer_gateway import app_data
from mirexplorer_audio.forms import AudioUpload
from mirexplorer_audio.storage import UPLOADS_FOLDER
from mirexplorer_gateway.extensions import limiter

main_routes = Blueprint("main", __name__)


@main_routes.route("/uploads/<filename>")
def uploaded_file(filename):
	# Same public behaviour as the monolith: dev serves local uploads; prod redirects to GCS.
	dev_env = os.getenv("DEVELOPMENT_ENV", None)
	if dev_env == "true":
		return send_from_directory(UPLOADS_FOLDER, filename)
	if dev_env == "false":
		gcs_url = f"https://storage.googleapis.com/mirexplorer/{filename}"
		return redirect(gcs_url)
	raise ValueError


def _forward_upload_to_audio_service():
	token = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
	audio_base = os.environ["AUDIO_SERVICE_URL"].rstrip("/")
	multipart_files = {}
	for key in request.files:
		f = request.files[key]
		multipart_files[key] = (f.filename, f.stream.read(), f.mimetype or "application/octet-stream")
	form_data = request.form.to_dict()
	return httpx.post(
		f"{audio_base}/v1/process-upload",
		files=multipart_files,
		data=form_data,
		headers={"X-Internal-Token": token},
		timeout=120.0,
	)


def _apply_audio_upload_response(form):
	try:
		r = _forward_upload_to_audio_service()
	except httpx.RequestError as e:
		logger.error(f"Audio service unreachable: {e}")
		flash("Could not reach upload service. Is the audio service running?", category="danger")
		return render_template("index.html", form=form, app_data=app_data)
	try:
		payload = r.json()
	except Exception:
		flash("Upload service returned an invalid response.", category="danger")
		return render_template("index.html", form=form, app_data=app_data)
	if payload.get("ok"):
		return redirect(
			url_for(
				"main.explorer",
				filename=payload["filename"],
				development_env=os.environ["DEVELOPMENT_ENV"],
			)
		)
	for err in payload.get("errors", []):
		flash(err, category="danger")
	return render_template("index.html", form=form, app_data=app_data)


@main_routes.route("/", methods=["GET", "POST"])
def index():
	example_key = request.form.get("example_file")
	if example_key:
		form = AudioUpload()
		return _apply_audio_upload_response(form)

	form = AudioUpload()
	filo = request.files.get("file")
	if filo and filo.filename == "recorded_audio.webm":
		return _apply_audio_upload_response(form)

	if form.is_submitted():
		if form.validate():
			return _apply_audio_upload_response(form)
		for error in form.errors.values():
			for error_inner in error:
				error_inner = f"Error: {error_inner}"
				flash(error_inner, category="danger")
				logger.error(error_inner)

	return render_template("index.html", form=form, app_data=app_data)


@main_routes.errorhandler(Exception)
def handle_exception(e):
	if isinstance(e, HTTPException):
		return jsonify(error=str(e)), e.code
	return jsonify(error=str(e)), 500


@main_routes.route("/trigger_action", methods=["POST"])
@limiter.limit("30 per hour")
def trigger_action():
	token = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
	base = os.environ["ANALYSIS_SERVICE_URL"].rstrip("/")
	js = request.get_json()
	try:
		r = httpx.post(
			f"{base}/v1/trigger",
			json=js,
			headers={"X-Internal-Token": token},
			timeout=240.0,
		)
	except httpx.RequestError as e:
		logger.error(f"Analysis service unreachable: {e}")
		return jsonify(dict(success=False, error=str(e))), 502
	return Response(r.content, status=r.status_code, mimetype="application/json")


@main_routes.route("/explorer")
def explorer():
	filename = request.args.get("filename")
	dev_env = request.args.get("development_env")
	if not filename:
		return redirect(url_for("main.index"))
	audio_url = url_for("main.uploaded_file", filename=filename)
	return render_template(
		"explorer.html",
		app_data=app_data,
		audio_url=audio_url,
		development_env=dev_env,
	)


@main_routes.route("/about")
def about():
	return render_template("about.html", app_data=app_data)


@main_routes.route("/service")
def service():
	return render_template("service.html", app_data=app_data)


@main_routes.route("/contact")
def contact():
	return render_template("contact.html", app_data=app_data)


@main_routes.route("/send_message", methods=["POST"])
@limiter.limit("30 per hour")
def send_message():
	token = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
	base = os.environ["CHAT_SERVICE_URL"].rstrip("/")
	data = request.get_json()
	try:
		r = httpx.post(
			f"{base}/v1/send_message",
			json=data,
			headers={"X-Internal-Token": token},
			timeout=120.0,
		)
	except httpx.RequestError as e:
		logger.error(f"Chat service unreachable: {e}")
		return jsonify(success=False, error=str(e)), 502
	return Response(r.content, status=r.status_code, mimetype="application/json")
