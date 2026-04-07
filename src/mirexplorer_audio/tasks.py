import os
from pathlib import Path
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from loguru import logger


def clear_uploads():
	"""
	Clears ALL uploaded files, without checking TTL
	"""
	from mirexplorer_audio.storage import UPLOADS_FOLDER, get_bucket

	dev_env = os.environ.get("DEVELOPMENT_ENV", None)

	# development environment: all files saved locally
	if dev_env == "true":
		for file_path in Path(UPLOADS_FOLDER).iterdir():
			if file_path.is_file():
				os.remove(file_path)
				logger.info(f"Deleted {file_path}")

	# production environment, all files saved on GCS
	elif dev_env == "false":
		blobs = get_bucket().list_blobs()
		for blob in blobs:
			blob.delete()
			logger.info(f"Deleted {blob.name}")

	else:
		raise ValueError(f"Unknown DEVELOPMENT_ENV: {dev_env}")


TASKS = [
	(clear_uploads, dict(hours=1))
]


def get_scheduler() -> BackgroundScheduler:
	"""
	Initialise the task scheduler and add all tasks
	"""

	scheduler = BackgroundScheduler()
	logger.info(f"Adding tasks to scheduler...")

	for task, kwargs in TASKS:
		# Prevent somehow adding tasks twice
		if any(job.name == task.__name__ for job in scheduler.get_jobs()):
			logger.error(f"Task '{task.__name__}' already exists!")
		else:
			logger.info(f"Adding task '{task.__name__}'")
			scheduler.add_job(task, "interval", **kwargs)

	return scheduler
