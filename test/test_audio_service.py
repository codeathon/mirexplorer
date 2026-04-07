import io
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("REDIS_URI", "memory://")
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-token")
os.environ.setdefault("DEVELOPMENT_ENV", "true")

from mirexplorer_audio.app import create_audio_app


class TestAudioService(unittest.TestCase):
	def setUp(self):
		self.app = create_audio_app()
		self.client = self.app.test_client()
		self.headers = {"X-Internal-Token": "test-token"}

	def test_health(self):
		resp = self.client.get("/health")
		self.assertEqual(resp.status_code, 200)
		self.assertEqual(resp.json["service"], "audio")

	def test_process_upload_rejects_missing_token(self):
		resp = self.client.post("/v1/process-upload", data={})
		self.assertEqual(resp.status_code, 403)
		self.assertFalse(resp.json["ok"])

	@patch("mirexplorer_audio.upload_routes.format_audio_metadata", return_value="meta")
	@patch("mirexplorer_audio.upload_routes.save_audio")
	def test_process_upload_example_file(self, mock_save_audio, _mock_meta):
		resp = self.client.post(
			"/v1/process-upload",
			data={"example_file": "demo.wav"},
			headers=self.headers,
		)
		self.assertEqual(resp.status_code, 200)
		self.assertTrue(resp.json["ok"])
		mock_save_audio.assert_called_once()

	@patch("mirexplorer_audio.upload_routes.format_audio_metadata", return_value="track_artist_album_2024")
	@patch("mirexplorer_audio.upload_routes.save_audio")
	def test_process_upload_recorded_audio(self, mock_save_audio, _mock_meta):
		data = {
			"file": (io.BytesIO(b"abc"), "recorded_audio.webm"),
		}
		resp = self.client.post(
			"/v1/process-upload",
			data=data,
			content_type="multipart/form-data",
			headers=self.headers,
		)
		self.assertEqual(resp.status_code, 200)
		self.assertTrue(resp.json["ok"])
		mock_save_audio.assert_called_once()


if __name__ == "__main__":
	unittest.main()
