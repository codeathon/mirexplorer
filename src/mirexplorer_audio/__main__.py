import os

from dotenv import load_dotenv, find_dotenv

from mirexplorer_audio.app import create_audio_app
from mirexplorer_audio.tasks import get_scheduler

load_dotenv(find_dotenv())

if __name__ == "__main__":
	port = int(os.environ.get("AUDIO_SERVICE_PORT", "8001"))
	app = create_audio_app()
	if os.environ.get("AUDIO_SCHEDULER", "true").lower() == "true":
		get_scheduler().start()
	app.run(host="0.0.0.0", port=port, debug=os.environ.get("DEVELOPMENT_ENV") == "true")
