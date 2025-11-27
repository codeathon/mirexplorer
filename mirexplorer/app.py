#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIRExplorer main app
"""

import os

from flask import Flask, render_template, flash, redirect, url_for
from werkzeug.utils import secure_filename

from mirexplorer.crud import AudioUpload


DEVELOPMENT_ENV = True

app = Flask(__name__)

app.config["SECRET_KEY"] = os.urandom(32)

app.config["UPLOAD_FOLDER"] = os.path.join(os.getcwd(), "uploads")
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

app_data = {
    "name": "MIRExplorer",
    "description": "A basic Flask app for exploring audio files",
    "author": "Huw Cheston",
    "html_title": "MIRExplorer",
    "project_name": "MIRExplorer",
    "keywords": "flask, webapp, template, basic",
}

@app.route("/", methods=["GET", "POST"])
def index():
    form = AudioUpload()
    if form.validate_on_submit():
        file = form.file.data
        filename = secure_filename(file.filename)

        # TODO: handle renaming file here
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(save_path)

        flash(f"Uploaded successfully: {filename}", "success")
        return redirect(url_for("index"))

    else:
        print(form.validate_on_submit())

    return render_template("index.html", form=form, app_data=app_data)


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
