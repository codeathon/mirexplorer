import os
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, redirect, send_from_directory, request, jsonify
from loguru import logger
from werkzeug.utils import secure_filename

from mirexplorer_audio.forms import AudioUploadInternal
from mirexplorer_audio.storage import (
	ROOT_DIR,
	UPLOADS_FOLDER,
	save_audio,
	format_audio_metadata,
)

# Internal upload API (called only from gateway with shared token).
upload_api = Blueprint("upload_api", __name__)


def _require_internal_token() -> bool:
	expected = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
	got = request.headers.get("X-Internal-Token", "")
	return bool(expected) and got == expected


@upload_api.route("/v1/process-upload", methods=["POST"])
def process_upload():
	"""Replicate legacy index POST handling; returns JSON for gateway redirects."""
	if not _require_internal_token():
		return jsonify(ok=False, errors=["Unauthorized"]), 403

	errors = []

	example_key = request.form.get("example_file")
	if example_key:
		path = ROOT_DIR / "frontend/static/example_audio" / example_key
		try:
			meta = format_audio_metadata(path)
			temp_filename = f"{uuid4()}_{meta}.wav"
			save_audio(path, temp_filename)
			return jsonify(ok=True, filename=temp_filename)
		except Exception as e:
			logger.error(f"Error processing example audio: {e}")
			errors.append(f"Error processing example audio: {e}")
			return jsonify(ok=False, errors=errors), 400

	filo = request.files.get("file")
	if filo and filo.filename == "recorded_audio.webm":
		filename = secure_filename(filo.filename)
		ext = Path(filename).suffix.lower()
		uu = uuid4()
		temp_filename = str(uu) + ext
		save_path = os.path.join(UPLOADS_FOLDER, temp_filename)
		filo.save(save_path)
		try:
			meta = format_audio_metadata(save_path)
			temp_filename_new = f"{uu}_{meta}.wav"
			save_audio(save_path, temp_filename_new)
			return jsonify(ok=True, filename=temp_filename_new)
		except Exception as e:
			logger.error(f"Error processing audio file: {e}")
			errors.append(f"Error processing audio file: {e}")
			return jsonify(ok=False, errors=errors), 400

	form = AudioUploadInternal()
	if form.is_submitted():
		if form.validate():
			file = form.file.data
			filename = secure_filename(file.filename)
			ext = Path(filename).suffix.lower()
			uu = uuid4()
			temp_filename = str(uu) + ext
			save_path = os.path.join(UPLOADS_FOLDER, temp_filename)
			file.save(save_path)
			try:
				meta = format_audio_metadata(save_path)
				temp_filename_new = f"{uu}_{meta}.wav"
				save_audio(save_path, temp_filename_new)
				return jsonify(ok=True, filename=temp_filename_new)
			except Exception as e:
				logger.error(f"Error processing audio file: {e}")
				errors.append(f"Error processing audio file: {e}")
				return jsonify(ok=False, errors=errors), 400
		else:
			for error in form.errors.values():
				for error_inner in error:
					errors.append(f"Error: {error_inner}")
					logger.error(error_inner)
			return jsonify(ok=False, errors=errors), 400

	return jsonify(ok=False, errors=["No upload payload recognised"]), 400


@upload_api.route("/health")
def health():
	return jsonify(ok=True, service="audio"), 200


@upload_api.route("/uploads/<filename>")
def uploaded_file(filename):
	dev_env = os.getenv("DEVELOPMENT_ENV", None)

	if dev_env == "true":
		return send_from_directory(UPLOADS_FOLDER, filename)
	elif dev_env == "false":
		gcs_url = f"https://storage.googleapis.com/mirexplorer/{filename}"
		return redirect(gcs_url)
	else:
		raise ValueError
