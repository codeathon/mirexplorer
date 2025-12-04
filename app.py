#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIRExplorer main app
"""

from backend import create_flask_app, create_vite_app


DEVELOPMENT_ENV = True

app = create_flask_app()
vite = create_vite_app(app)


if __name__ == "__main__":
    app.run(debug=DEVELOPMENT_ENV)
