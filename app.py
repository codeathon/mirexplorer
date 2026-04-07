#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIRExplorer gateway entrypoint (Flask UI + BFF to internal services).
"""

import json
import os

from dotenv import load_dotenv, find_dotenv

from mirexplorer_gateway.app import FLASK_APP
from mirexplorer_gateway.extensions import limiter


def vite_asset(entry):
	manifest_path = FLASK_APP.static_folder + "/dist/.vite/manifest.json"
	with open(manifest_path) as f:
		manifest = json.load(f)
	return manifest[entry]


# make gunicorn happy :)
app = FLASK_APP
app.jinja_env.globals["vite_asset"] = vite_asset


if __name__ == "__main__":
	load_dotenv(find_dotenv())

	DEVELOPMENT_ENV = os.getenv("DEVELOPMENT_ENV") == "true"

	if DEVELOPMENT_ENV:
		limiter.enabled = False

	FLASK_APP.run(debug=DEVELOPMENT_ENV)
