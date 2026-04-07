import os
from pathlib import Path

from flask import Blueprint, request, jsonify
from loguru import logger
from werkzeug.exceptions import HTTPException

from mirexplorer_audio.storage import load_audio, UPLOADS_FOLDER
from mirexplorer_analysis.analyse import extract_spectral_features, route_to_function

analysis_api = Blueprint("analysis_api", __name__)


def _require_internal_token() -> bool:
	expected = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
	got = request.headers.get("X-Internal-Token", "")
	return bool(expected) and got == expected


@analysis_api.errorhandler(Exception)
def handle_exception(e):
	if isinstance(e, HTTPException):
		return jsonify(error=str(e)), e.code
	return jsonify(error=str(e)), 500


@analysis_api.route("/v1/trigger", methods=["POST"])
def trigger_action():
	if not _require_internal_token():
		return jsonify(success=False, error="Unauthorized"), 403

	js = request.get_json()
	caller = route_to_function(js["action"])
	audio_fpath = Path(js["audio_url"]).name
	audio_loaded = load_audio(audio_fpath)
	try:
		call_out = caller(audio_loaded, audio_fpath)
	except Exception as e:
		logger.error(f"Error processing audio file: {e}")
		return jsonify(dict(success=False, error=str(e))), 500
	return jsonify(dict(success=True, out=call_out)), 200


@analysis_api.route("/v1/spectral", methods=["POST"])
def spectral_features():
	if not _require_internal_token():
		return jsonify(success=False, error="Unauthorized"), 403

	data = request.get_json()
	filepath = data.get("filepath")
	if not filepath:
		return jsonify(success=False, error="Missing filepath"), 400
	full_path = UPLOADS_FOLDER / Path(filepath).name
	try:
		feats = extract_spectral_features(full_path)
	except Exception as e:
		logger.error(f"spectral_features: {e}")
		return jsonify(success=False, error=str(e)), 500
	return jsonify(success=True, out=feats), 200


@analysis_api.route("/health")
def health():
	return jsonify(ok=True, service="analysis"), 200
