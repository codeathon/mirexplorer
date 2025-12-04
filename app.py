#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIRExplorer main app
"""

from backend import FLASK_APP, get_scheduler, app_data

DEVELOPMENT_ENV = True

if __name__ == "__main__":
    # Start the task scheduler (runs in same process as app)
    get_scheduler().start()
    # Start the app
    FLASK_APP.run(debug=DEVELOPMENT_ENV)
