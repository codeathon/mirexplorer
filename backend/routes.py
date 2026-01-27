import os
from pathlib import Path
from uuid import uuid4
from io import BytesIO

from flask import render_template, request, redirect, url_for, send_from_directory, Blueprint, flash, jsonify
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename
from loguru import logger

from backend import app_data
from backend.crud import AudioUpload, preprocess_audio_on_upload, save_audio, ROOT_DIR, UPLOADS_FOLDER, load_audio, format_audio_metadata
from backend.extensions import limiter

# Create a blueprint
main_routes = Blueprint("main", __name__)


@main_routes.route("/uploads/<filename>")
# TODO: add rate limit here
def uploaded_file(filename):
    return send_from_directory(UPLOADS_FOLDER, filename)


@main_routes.route("/", methods=["GET", "POST"])
def index():

    example_key = request.form.get("example_file")

    if example_key:
        path = ROOT_DIR / "frontend/static/example_audio" / example_key

        try:
            # Reuse preprocessing logic
            meta = format_audio_metadata(path)

            # Generate temp filename exactly like uploads
            temp_filename = f"{uuid4()}_{meta}.wav"
            save_path = os.path.join(UPLOADS_FOLDER, temp_filename)

            file_prep = preprocess_audio_on_upload(path)
            save_audio(file_prep, save_path)

            return redirect(
                url_for("main.explorer", filename=temp_filename)
            )

        except Exception as e:
            flash(f"Error processing example audio: {e}", category="danger")
            logger.error(f"Error processing example audio: {e}")

    form = AudioUpload()

    filo = request.files.get("file")

    if filo and filo.filename == "recorded_audio.webm":
        filename = secure_filename(filo.filename)
        ext = Path(filename).suffix.lower()
        uu = uuid4()
        temp_filename = str(uu) + ext
        save_path = os.path.join(UPLOADS_FOLDER, temp_filename)

        filo.save(save_path)

        meta = format_audio_metadata(save_path)
        temp_filename_new = UPLOADS_FOLDER / f"{uu}_{meta}.wav"

        try:
            file_prep = preprocess_audio_on_upload(save_path)
            save_audio(file_prep, temp_filename_new)
            os.remove(save_path)

            return redirect(url_for("main.explorer", filename=temp_filename_new.name))

        except Exception as e:
            flash(f"Error processing audio file: {e}", category="danger")
            logger.error(f"Error processing audio file: {e}")

    # Check for traditional form submission
    elif form.is_submitted():
        if form.validate():
            file = form.file.data
            filename = secure_filename(file.filename)
            ext = Path(filename).suffix.lower()
            uu = uuid4()
            temp_filename = str(uu) + ext
            save_path = os.path.join(UPLOADS_FOLDER, temp_filename)

            filo.save(save_path)
            meta = format_audio_metadata(save_path)
            temp_filename_new = UPLOADS_FOLDER / f"{uu}_{meta}.wav"

            try:
                file_prep = preprocess_audio_on_upload(save_path)
                os.remove(save_path)
                save_audio(file_prep, temp_filename_new)
                return redirect(url_for("main.explorer", filename=temp_filename_new.name))
            except Exception as e:
                flash(f"Error processing audio file: {e}", category="danger")
                logger.error(f"Error processing audio file: {e}")

        else:
            for error in form.errors.values():
                for error_inner in error:
                    error_inner = f"Error: {error_inner}"
                    flash(error_inner, category="danger")
                    logger.error(error_inner)

    return render_template("index.html", form=form, app_data=app_data)


@main_routes.errorhandler(Exception)
def handle_exception(e):
    # If it's an HTTPException, preserve the error code
    if isinstance(e, HTTPException):
        return jsonify(error=str(e)), e.code
    # Otherwise it's a real crash
    return jsonify(error=str(e)), 500


@main_routes.route("/trigger_action", methods=["POST"])
@limiter.limit("15 per hour")
def trigger_action():
    """
    Handles actions within the explorer: route to the correct function and return results to frontend as a JSON
    """
    from backend.analyse import route_to_function

    js = request.get_json()
    caller = route_to_function(js["action"])

    audio_fpath = Path(UPLOADS_FOLDER) / Path(js["audio_url"]).name
    audio_loaded = load_audio(audio_fpath)

    # Make the call
    try:
        call_out = caller(audio_loaded, audio_fpath)
    except Exception as e:
        logger.error(f"Error processing audio file: {e}", category="danger")
        return jsonify(dict(success=False, error=str(e))), 500
    else:
        return jsonify(dict(success=True, out=call_out)), 200


@main_routes.route("/explorer")
def explorer():
    """
    Page that displays waveform and analyser
    """
    filename = request.args.get("filename")
    if not filename:
        return redirect(url_for("main.index"))

    audio_url = url_for("main.uploaded_file", filename=filename)
    return render_template("explorer.html", app_data=app_data, audio_url=audio_url)


@main_routes.route("/about")
def about():
    logger.info("clicked about")
    return render_template("about.html", app_data=app_data)


@main_routes.route("/service")
def service():
    return render_template("service.html", app_data=app_data)


@main_routes.route("/contact")
def contact():
    return render_template("contact.html", app_data=app_data)


@main_routes.route("/send_message", methods=["POST"])
@limiter.limit("15 per hour")
async def send_message():
    from backend.analyse import extract_spectral_features
    from backend.chat import route_chat_response

    data = request.get_json()
    user_message = data.get("user_message")
    filepath = data.get("filepath")
    message_history = data.get("message_history")
    full_path = UPLOADS_FOLDER / Path(filepath).name

    _, track, artist, album, date = full_path.stem.split("_")

    # compute spectral features
    spectral_feats = extract_spectral_features(full_path)
    logger.info(spectral_feats)

    # create dependencies
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

    # create the chat completion
    try:
        result = await route_chat_response(user_message, message_history, deps)
    except Exception as e:
        logger.error(f"Error processing user message: {e}", category="danger")
        return jsonify(success=False, error=str(e)), 500

    return jsonify(success=True, out=result), 200
