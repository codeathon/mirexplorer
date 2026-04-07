import os
import unittest
from unittest.mock import patch

os.environ.setdefault("REDIS_URI", "memory://")
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-token")
os.environ.setdefault("DEVELOPMENT_ENV", "true")

from mirexplorer_chat.app import create_chat_app


class TestChatService(unittest.TestCase):
	def setUp(self):
		self.app = create_chat_app()
		self.client = self.app.test_client()
		self.headers = {"X-Internal-Token": "test-token"}

	def test_health(self):
		resp = self.client.get("/health")
		self.assertEqual(resp.status_code, 200)
		self.assertEqual(resp.json["service"], "chat")

	def test_send_message_rejects_missing_token(self):
		resp = self.client.post("/v1/send_message", json={})
		self.assertEqual(resp.status_code, 403)

	@patch("mirexplorer_chat.routes.extract_spectral_features", return_value={"rms": 0.5})
	@patch("mirexplorer_chat.routes.asyncio.run", return_value="hello")
	def test_send_message_success(self, _mock_run, _mock_extract):
		payload = {
			"user_message": "What is this track?",
			"filepath": "uuid_track_artist_album_2024.wav",
			"message_history": [],
			"key": "C major",
			"time_signature": "4/4",
			"genres": [],
			"instruments": [],
			"mood": [],
			"era": "2000s",
			"lyrics": [],
			"chords": [],
		}
		resp = self.client.post("/v1/send_message", json=payload, headers=self.headers)
		self.assertEqual(resp.status_code, 200)
		self.assertTrue(resp.json["success"])
		self.assertEqual(resp.json["out"], "hello")

	@patch("mirexplorer_chat.routes.extract_spectral_features", return_value={"rms": 0.5})
	def test_send_message_missing_filepath_returns_500_current_behavior(self, _mock_extract):
		payload = {
			"user_message": "What is this track?",
			"message_history": [],
		}
		resp = self.client.post("/v1/send_message", json=payload, headers=self.headers)
		self.assertEqual(resp.status_code, 500)


if __name__ == "__main__":
	unittest.main()
