import os
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault("REDIS_URI", "memory://")
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-token")
os.environ.setdefault("DEVELOPMENT_ENV", "true")

from mirexplorer_analysis.app import create_analysis_app


class TestAnalysisService(unittest.TestCase):
	def setUp(self):
		self.app = create_analysis_app()
		self.client = self.app.test_client()
		self.headers = {"X-Internal-Token": "test-token"}

	def test_health(self):
		resp = self.client.get("/health")
		self.assertEqual(resp.status_code, 200)
		self.assertEqual(resp.json["service"], "analysis")

	def test_trigger_rejects_missing_token(self):
		resp = self.client.post("/v1/trigger", json={"action": "Beat Tracking", "audio_url": "/uploads/a.wav"})
		self.assertEqual(resp.status_code, 403)

	@patch("mirexplorer_analysis.routes.load_audio", return_value=[0.1, 0.2])
	@patch("mirexplorer_analysis.routes.route_to_function")
	def test_trigger_success(self, mock_router, _mock_load):
		fake_caller = Mock(return_value=[0.12, 0.34])
		mock_router.return_value = fake_caller
		resp = self.client.post(
			"/v1/trigger",
			json={"action": "Beat Tracking", "audio_url": "http://localhost/uploads/test.wav"},
			headers=self.headers,
		)
		self.assertEqual(resp.status_code, 200)
		self.assertTrue(resp.json["success"])
		self.assertEqual(resp.json["out"], [0.12, 0.34])

	def test_spectral_requires_filepath(self):
		resp = self.client.post("/v1/spectral", json={}, headers=self.headers)
		self.assertEqual(resp.status_code, 400)
		self.assertIn("Missing filepath", resp.json["error"])

	@patch("mirexplorer_analysis.routes.extract_spectral_features", return_value={"rms": 0.9})
	def test_spectral_success(self, _mock_extract):
		resp = self.client.post("/v1/spectral", json={"filepath": "x.wav"}, headers=self.headers)
		self.assertEqual(resp.status_code, 200)
		self.assertEqual(resp.json["out"]["rms"], 0.9)


if __name__ == "__main__":
	unittest.main()
