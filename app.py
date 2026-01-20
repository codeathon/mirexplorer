#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIRExplorer main app
"""

import json
import os

from dotenv import load_dotenv, find_dotenv

from backend import FLASK_APP, get_scheduler, app_data
from backend.extensions import limiter


def vite_asset(entry):
    manifest_path = FLASK_APP.static_folder + "/dist/.vite/manifest.json"
    with open(manifest_path) as f:
        manifest = json.load(f)
    return manifest[entry]


# make gunicorn happy :)
app = FLASK_APP
app.jinja_env.globals["vite_asset"] = vite_asset


if __name__ == "__main__":
    # load env variables
    load_dotenv(find_dotenv())

    DEVELOPMENT_ENV = os.getenv("DEVELOPMENT_ENV") == "true"

    # Start the task scheduler (runs in same process as app)
    get_scheduler().start()

    # Disable the limiter if running in a development environment
    if DEVELOPMENT_ENV:
        limiter.enabled = False

    # Start the app
    FLASK_APP.run(debug=DEVELOPMENT_ENV)
