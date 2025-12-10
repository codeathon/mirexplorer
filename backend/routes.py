import os
from pathlib import Path
from uuid import uuid4
from io import BytesIO

from flask import render_template, request, redirect, url_for, send_from_directory, Blueprint, flash, jsonify
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename
from loguru import logger

from backend import app_data
from backend.crud import AudioUpload, preprocess_audio_on_upload, save_audio, UPLOADS_FOLDER, load_audio

# Create a blueprint
main_routes = Blueprint("main", __name__)


@main_routes.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOADS_FOLDER, filename)


@main_routes.route("/", methods=["GET", "POST"])
def index():
    form = AudioUpload()

    filo = request.files.get("file")
    if filo and filo.filename == "recorded_audio.webm":
        filename = secure_filename(filo.filename)
        ext = Path(filename).suffix.lower()
        temp_filename = str(uuid4()) + ext
        save_path = os.path.join(UPLOADS_FOLDER, temp_filename)

        filo.save(save_path)

        try:
            file_prep = preprocess_audio_on_upload(save_path)
            save_audio(file_prep, Path(save_path).with_suffix(".wav"))
            os.remove(save_path)
            return redirect(url_for("main.explorer", filename=str(Path(temp_filename).with_suffix(".wav"))))

        except Exception as e:
            flash(f"Error processing audio file: {e}", category="danger")
            logger.error(f"Error processing audio file: {e}")

    # Check for traditional form submission
    elif form.is_submitted():
        if form.validate():
            file = form.file.data
            filename = secure_filename(file.filename)
            ext = Path(filename).suffix.lower()
            temp_filename = str(uuid4()) + ext
            save_path = os.path.join(UPLOADS_FOLDER, temp_filename)

            try:
                file_prep = preprocess_audio_on_upload(BytesIO(file.read()))
                save_audio(file_prep, save_path)
                return redirect(url_for("main.explorer", filename=temp_filename))
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
def trigger_action():
    """
    Handles actions within the explorer: route to the correct function and return results to frontend as a JSON
    """
    from backend.analyse import route_to_function

    js = request.get_json()
    caller = route_to_function(js["action"])
    audio_loaded = load_audio(Path(UPLOADS_FOLDER) / Path(js["audio_url"]).name)
    call_out = caller(audio_loaded)
    logger.info(call_out)
    return jsonify({"success": True, "out": call_out}), 200


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
    return render_template("about.html", app_data=app_data)


@main_routes.route("/service")
def service():
    return render_template("service.html", app_data=app_data)


@main_routes.route("/contact")
def contact():
    return render_template("contact.html", app_data=app_data)
