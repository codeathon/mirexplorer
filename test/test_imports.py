"""
Smoke test: service packages import (run with project dependencies installed).
"""

import os
import unittest

os.environ.setdefault("REDIS_URI", "memory://")
os.environ.setdefault("DEVELOPMENT_ENV", "true")


class TestServiceImports(unittest.TestCase):
	def test_gateway_app_factory(self):
		from mirexplorer_gateway.app import create_flask_app

		app = create_flask_app()
		self.assertEqual(app.name, "mirexplorer_gateway.app")

	def test_audio_app_factory(self):
		from mirexplorer_audio.app import create_audio_app

		app = create_audio_app()
		self.assertEqual(app.name, "mirexplorer_audio.app")

	def test_analysis_app_factory(self):
		from mirexplorer_analysis.app import create_analysis_app

		app = create_analysis_app()
		self.assertEqual(app.name, "mirexplorer_analysis.app")

	def test_chat_app_factory(self):
		from mirexplorer_chat.app import create_chat_app

		app = create_chat_app()
		self.assertEqual(app.name, "mirexplorer_chat.app")


if __name__ == "__main__":
	unittest.main()
