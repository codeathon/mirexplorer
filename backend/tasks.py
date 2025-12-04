import os
from pathlib import Path
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from loguru import logger


def clear_old_uploads():
    """
    Clears files in the UPLOADS_FOLDER older than 'hours' hours.
    """
    from backend.crud import UPLOADS_FOLDER, DEFAULT_FILE_TTL_HOURS

    logger.info("Clearing old uploads...")

    now = datetime.now()
    cutoff = now - timedelta(hours=DEFAULT_FILE_TTL_HOURS)

    for file_path in Path(UPLOADS_FOLDER).iterdir():
        if file_path.is_file():
            file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            if file_mtime < cutoff:
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted {file_path}")
                except Exception as e:
                    logger.error(f"Failed to delete {file_path}: {e}")

    logger.info("Finished clearing old uploads!")


TASKS = [
    (clear_old_uploads, dict(hours=6))
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
