import os
import unittest
from unittest.mock import Mock, patch

import httpx

os.environ.setdefault("REDIS_URI", "memory://")
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-token")
os.environ.setdefault("AUDIO_SERVICE_URL", "http://audio:8001")
os.environ.setdefault("ANALYSIS_SERVICE_URL", "http://analysis:8002")
os.environ.setdefault("CHAT_SERVICE_URL", "http://chat:8003")
os.environ.setdefault("DEVELOPMENT_ENV", "true")

from mirexplorer_gateway.app import create_flask_app


class TestGatewayService(unittest.TestCase):
	def setUp(self):
		self.app = create_flask_app()
		self.app.config["TESTING"] = True
		self.client = self.app.test_client()

	def test_explorer_redirects_without_filename(self):
		resp = self.client.get("/explorer")
		self.assertEqual(resp.status_code, 302)

	def test_trigger_action_forwards_to_analysis(self):
		resp_obj = Mock()
		resp_obj.content = b'{"success": true, "out": [1,2]}'
		resp_obj.status_code = 200
		with patch("mirexplorer_gateway.routes.httpx.post", return_value=resp_obj) as mock_post:
			resp = self.client.post("/trigger_action", json={"action": "Beat Tracking", "audio_url": "x.wav"})
		self.assertEqual(resp.status_code, 200)
		self.assertEqual(resp.json["success"], True)
		mock_post.assert_called_once()

	def test_trigger_action_returns_502_when_analysis_unreachable(self):
		with patch("mirexplorer_gateway.routes.httpx.post", side_effect=httpx.RequestError("boom")):
			resp = self.client.post("/trigger_action", json={"action": "Beat Tracking", "audio_url": "x.wav"})
		self.assertEqual(resp.status_code, 502)

	def test_send_message_forwards_to_chat(self):
		resp_obj = Mock()
		resp_obj.content = b'{"success": true, "out": "ok"}'
		resp_obj.status_code = 200
		with patch("mirexplorer_gateway.routes.httpx.post", return_value=resp_obj) as mock_post:
			resp = self.client.post("/send_message", json={"user_message": "hi"})
		self.assertEqual(resp.status_code, 200)
		self.assertTrue(resp.json["success"])
		mock_post.assert_called_once()


if __name__ == "__main__":
	unittest.main()
