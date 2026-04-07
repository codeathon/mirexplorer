import asyncio
import os
from pathlib import Path

from flask import Blueprint, request, jsonify
from loguru import logger

from mirexplorer_analysis.analyse import extract_spectral_features
from mirexplorer_audio.storage import UPLOADS_FOLDER
from mirexplorer_chat.chat import route_chat_response

chat_api = Blueprint("chat_api", __name__)


def _require_internal_token() -> bool:
	expected = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
	got = request.headers.get("X-Internal-Token", "")
	return bool(expected) and got == expected


@chat_api.route("/v1/send_message", methods=["POST"])
def send_message():
	if not _require_internal_token():
		return jsonify(success=False, error="Unauthorized"), 403

	data = request.get_json()
	user_message = data.get("user_message")
	filepath = data.get("filepath")
	message_history = data.get("message_history")
	full_path = UPLOADS_FOLDER / Path(filepath).name

	_, track, artist, album, date = full_path.stem.split("_")

	spectral_feats = extract_spectral_features(full_path)

	deps = {
		"filename": full_path,
		"key": data.get("key"),
		"time_signature": data.get("time_signature"),
		"genres": data.get("genres"),
		"instruments": data.get("instruments"),
		"mood": data.get("mood"),
		"era": data.get("era"),
		"lyrics": data.get("lyrics"),
		"chords": data.get("chords"),
		"track": track.replace("-", " "),
		"artist": artist.replace("-", " "),
		"album": album.replace("-", " "),
		"date": date.replace("-", " "),
		**spectral_feats
	}

	try:
		result = asyncio.run(route_chat_response(user_message, message_history, deps))
	except Exception as e:
		logger.error(f"Error processing user message: {e}")
		return jsonify(success=False, error=str(e)), 500

	return jsonify(success=True, out=result), 200


@chat_api.route("/health")
def health():
	return jsonify(ok=True, service="chat"), 200
