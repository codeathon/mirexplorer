#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIRExplorer main app
"""

import os
from pathlib import Path
from uuid import uuid4

from flask import Flask, render_template, send_from_directory, url_for, request, redirect
from flask_vite import Vite
from werkzeug.utils import secure_filename

from backend.crud import AudioUpload, preprocess_audio_on_upload, save_audio


DEVELOPMENT_ENV = True

app = Flask(__name__, static_folder="frontend/static")

app.config["SECRET_KEY"] = os.urandom(32)
app.config['VITE_FOLDER_PATH'] = 'frontend'
app.config["UPLOAD_FOLDER"] = os.path.join(os.getcwd(), "uploads")
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

vite = Vite(app)

app_data = {
    "name": "MIRExplorer",
    "description": "A basic Flask app for exploring audio files",
    "author": "Huw Cheston",
    "html_title": "MIRExplorer",
    "project_name": "MIRExplorer",
    "keywords": "flask, webapp, template, basic",
}


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/", methods=["GET", "POST"])
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
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], temp_filename)

        # Preprocess the audio file, truncate to desired length, etc
        file_prep = preprocess_audio_on_upload(file)

        # Save the preprocessed file
        save_audio(file_prep, save_path)

        # Redirect to analyzer page with filename as query param
        return redirect(url_for("explorer", filename=temp_filename))

    # TODO: throw an error to the user here
    else:
        pass

    return render_template("index.html", form=form, app_data=app_data)


@app.route("/explorer")
def explorer():
    """Page that displays waveform."""
    filename = request.args.get("filename")
    if not filename:
        return redirect(url_for("index"))

    audio_url = url_for("uploaded_file", filename=filename)
    return render_template("explorer.html", app_data=app_data, audio_url=audio_url)


@app.route("/about")
def about():
    return render_template("about.html", app_data=app_data)


@app.route("/service")
def service():
    return render_template("service.html", app_data=app_data)


@app.route("/contact")
def contact():
    return render_template("contact.html", app_data=app_data)

if __name__ == "__main__":
    app.run(debug=DEVELOPMENT_ENV)
