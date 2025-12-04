import os
from pathlib import Path
from uuid import uuid4

from flask import render_template, request, redirect, url_for, send_from_directory, Blueprint
from werkzeug.utils import secure_filename

from backend import APP_DATA
from backend.crud import AudioUpload, preprocess_audio_on_upload, save_audio, UPLOADS_FOLDER


# Create a blueprint
main_routes = Blueprint("main", __name__)


@main_routes.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOADS_FOLDER, filename)


@main_routes.route("/", methods=["GET", "POST"])
def index():
    form = AudioUpload()

    # This checks to make sure, e.g., that the audio is valid, and throws an error if not
    if form.validate_on_submit():

        # Grab the filepath uploaded to the form
        file = form.file.data
        filename = secure_filename(file.filename)

        # Extract extension from filepath
        #  We will have already validated this extension so don't need to do it again
        ext = Path(filename).suffix.lower()

        # Create temporary filename to upload to
        temp_filename = str(uuid4()) + ext
        save_path = os.path.join(UPLOADS_FOLDER, temp_filename)

        # Preprocess the audio file, truncate to desired length, etc
        file_prep = preprocess_audio_on_upload(file)

        # Save the preprocessed file
        save_audio(file_prep, save_path)

        # Redirect to analyzer page with filename as query param
        return redirect(url_for("main.explorer", filename=temp_filename))

    # TODO: throw an error to the user here
    else:
        pass

    return render_template("index.html", form=form, app_data=APP_DATA)


@main_routes.route("/explorer")
def explorer():
    """
    Page that displays waveform and analyser
    """
    filename = request.args.get("filename")
    if not filename:
        return redirect(url_for("main.index"))

    audio_url = url_for("main.uploaded_file", filename=filename)
    return render_template("explorer.html", app_data=APP_DATA, audio_url=audio_url)


@main_routes.route("/about")
def about():
    return render_template("about.html", app_data=APP_DATA)


@main_routes.route("/service")
def service():
    return render_template("service.html", app_data=APP_DATA)


@main_routes.route("/contact")
def contact():
    return render_template("contact.html", app_data=APP_DATA)
