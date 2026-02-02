import os
from datetime import datetime
from io import BytesIO
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from loguru import logger
from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileRequired, FileAllowed, FileSize
from google.api_core.retry import Retry
from google.cloud import storage
from google.oauth2 import service_account
from mutagen.easyid3 import EasyID3
from werkzeug.datastructures import FileStorage
from wtforms import SubmitField, HiddenField
from wtforms.validators import ValidationError

from backend.extensions import cache

AUDIO_FILE_FORMATS = ["wav", "aac", "aiff", "flac", "m4a", "mp3", "ogg", "wma", "webm"]
MAX_SIZE = 16 * 1000000  # 16 MB default

MAX_AUDIO_DURATION = 30  # load only first 30 seconds of audio by default
AUDIO_SAMPLE_RATE = 22050  # audio resampled to this
MAX_AUDIO_SAMPLES = round(MAX_AUDIO_DURATION * AUDIO_SAMPLE_RATE)

ROOT_DIR = Path(__file__).parent.parent
UPLOADS_FOLDER = ROOT_DIR / "uploads"
DEFAULT_FILE_TTL_HOURS = 2  # files live for 2 hours

# Define retrying logic for GCS downloads
NUM_RETRIES = 10
RETRY_WAIT = 10
RETRYING = Retry(
    # Initial wait time between retries (in seconds)
    initial=float(RETRY_WAIT),
    # Maximum wait time between retries (in seconds)
    maximum=60.0,
    # Factor by which the wait time is multiplied after each retry
    multiplier=2.0,
    # Total time (in seconds) before giving up
    deadline=300.0
)


@cache.memoize()
def load_audio(filepath) -> np.ndarray:
    filename = Path(filepath).name

    # Development environment: saved locally
    dev_env = os.environ.get("DEVELOPMENT_ENV", None)
    if dev_env == "true":
        y, sr = librosa.load(UPLOADS_FOLDER / filename, sr=AUDIO_SAMPLE_RATE, offset=0, mono=True, duration=MAX_AUDIO_DURATION)

    # Production environment: saved on GCS bucket
    elif dev_env == "false":
        # grab blob from bucket
        bucket = get_bucket()
        filo = bucket.blob(filename)

        # load blob from bucket as raw bytestream
        #  Very rarely getting a `DataCorruption` error when downloading a file that is otherwise healthy;
        #  solution apparently is to disable computing the checksum used to verify the integrity of a file
        #  Will try to download the file for a maximum of five minutes before giving up
        bio = BytesIO(filo.download_as_bytes(checksum=None, retry=RETRYING))

        # load up in librosa as before
        y, sr = librosa.load(bio, sr=AUDIO_SAMPLE_RATE, offset=0, mono=True, duration=MAX_AUDIO_DURATION)

    # Unknown environment
    else:
        raise ValueError(f"Unknown DEVELOPMENT_ENV: {dev_env}")

    # Normalize the audio with librosa
    y = librosa.util.normalize(y)
    return y


# @cache.memoize()
def get_client():
    service_account_info = {
        "type": os.getenv("GCP_TYPE"),
        "project_id": os.getenv("GCP_PROJECT_ID"),
        "private_key_id": os.getenv("GCP_PRIVATE_KEY_ID"),
        "private_key": os.getenv("GCP_PRIVATE_KEY").replace("\\n", "\n"),
        "client_email": os.getenv("GCP_CLIENT_EMAIL"),
        "client_id": os.getenv("GCP_CLIENT_ID"),
        "auth_uri": os.getenv("GCP_AUTH_URI"),
        "token_uri": os.getenv("GCP_TOKEN_URI"),
    }
    credentials = service_account.Credentials.from_service_account_info(
        service_account_info
    )
    return storage.Client(
        project=os.getenv("GCP_PROJECT_ID"),
        credentials=credentials
    )


# @cache.memoize()
def get_bucket():
    cl = get_client()
    bu = cl.get_bucket("mirexplorer")

    # need to patch CORS
    bu.cors = [
        {
            "origin": ["*"],
            "method": ["GET", "HEAD"],
            "responseHeader": ["Content-Type", "Accept-Ranges"],
            "maxAgeSeconds": 3600
        }
    ]
    bu.patch()

    return bu


class FileAudioValid:
    """
    Validate that an uploaded audio file is valid.
    """

    def __init__(self, message: str = None):
        self.message = message

    def __call__(self, form, field):
        data = field.data

        # If multiple files ever get allowed, normalise to list:
        files = [data] if not isinstance(data, list) else data

        # Ensure each file is a Werkzeug FileStorage
        for f in files:
            if not isinstance(f, FileStorage):
                raise ValidationError(self.message)

            # Read file into memory
            try:
                # Read binary content
                file_bytes = f.read()

                if not file_bytes:
                    raise ValidationError("Uploaded file is empty.")

                # Load audio with librosa from bytes
                # librosa.load requires a file-like object, so wrap bytes in io.BytesIO
                audio_stream = BytesIO(file_bytes)
                y, sr = librosa.load(audio_stream, sr=None, mono=True, duration=MAX_AUDIO_DURATION)

                # Validate audio array itself, valid_audio(y, ...) requires a numpy array
                if not librosa.util.valid_audio(y):
                    raise ValidationError("Audio file contains invalid samples or format.")

            # catch all exceptions
            except Exception as e:
                raise ValidationError(self.message + "\n Error: " + str(e))

            finally:
                # Reset stream so Flask can save the file normally later
                f.stream.seek(0)


class AudioUpload(FlaskForm):
    file = FileField(
        'AudioFile',
        validators=[
            FileRequired(),
            FileAllowed(AUDIO_FILE_FORMATS, f'Allowed file types are {", ".join(AUDIO_FILE_FORMATS)}'),
            FileSize(max_size=MAX_SIZE, message=f'File size must be less than {MAX_SIZE}'),
            FileAudioValid(message="File contains invalid or corrupted audio")
        ]
    )
    recorded_audio = HiddenField("Recorded Audio")
    submit = SubmitField('Upload')


def truncate_array(y: np.ndarray, val: int) -> np.ndarray:
    if len(y) > val:
        return y[:val]
    else:
        return y


def pad_or_truncate_array(y: np.ndarray, val: int) -> np.ndarray:
    """
    Pad or truncate `y` to match `val`. Right-padding used, with zeros
    """
    # Truncate or pad audio to match desired number of samples
    if len(y) < val:
        return np.pad(y, (0, val - len(y)), mode='constant', constant_values=0)
    elif len(y) > val:
        return y[:val]
    else:
        return y


def format_string(s: str) -> str:
    keep = "1234567890QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm -"
    return ''.join(ch for ch in s if ch in keep).replace(" ", "-")


def format_audio_metadata(audio_path: str) -> str:
    try:
        res = {}
        fields = ["title", "artist", "album", "date"]

        id3 = EasyID3(audio_path)

        for field in fields:
            # Fields should be a list of strings if present
            got = id3.get(field, None)

            # Just grab the first entry
            if got is not None and isinstance(got, list):
                got = got[0]

            # Will be None if field not present
            res[field] = got

        # Fill in any blanks
        for field in fields:
            if field not in res:
                res[field] = None

        # Try and parse the date field if present
        if res["date"] is not None:
            try:
                res["date"] = str(datetime.strptime(res["date"], "%Y-%m-%d %H:%M:%S").year)
            except:
                # Sometimes the date is just the year, so try grabbing this
                if isinstance(res["date"], str) and len(res["date"]) == 4:
                    res["date"] = res["date"][:4]
                else:
                    logger.exception(f"Failed to parse date from audio metadata")
                    res["date"] = None

        # Final loop
        for f, v in res.items():
            # Replace None with string representation
            if v is None:
                res[f] = "None"

            # Strip non-alphanumeric characters, truncate to given length, replace space with "-"
            else:
                fmtted = format_string(v)
                res[f] = fmtted

        # Combine everything into a big string, strip out alphanumeric
        tit, art, alb, yr = res["title"], res["artist"], res["album"], res["date"]
        out = "_".join([tit, art, alb, yr])

        return out

    except:
        logger.exception(f"Failed to grab audio metadata")
        return "None_None_None_None"


def save_audio(temp_filepath: str, out_filepath: str) -> np.ndarray:
    """
    Save numpy array of audio to file
    """
    if isinstance(temp_filepath, (str, Path)):
        logger.info(f"Writing audio file temp '{temp_filepath}' to {out_filepath}")

        # Load up temp saved file
        y, sr = librosa.load(temp_filepath, sr=AUDIO_SAMPLE_RATE, offset=0, mono=True, duration=MAX_AUDIO_DURATION)
        # Truncate to 30 seconds
        y = pad_or_truncate_array(y, MAX_AUDIO_SAMPLES)
        # Delete temporary file now it's in memory
        if "example_audio" not in str(temp_filepath):
            logger.info(f"Removing {temp_filepath}")
            os.remove(temp_filepath)

    elif isinstance(temp_filepath, np.ndarray):
        y = temp_filepath

    else:
        raise TypeError("Expected str or Path or array, got {}".format(type(temp_filepath)))

    # Development environment: save locally
    dev_env = os.environ.get("DEVELOPMENT_ENV", None)
    if dev_env == "true":
        sf.write(UPLOADS_FOLDER / out_filepath, y, AUDIO_SAMPLE_RATE, )

    # Production environment: save on GCS bucket
    elif dev_env == "false":
        logger.info("get bucket")
        bucket = get_bucket()
        logger.info("create blob")
        blob = bucket.blob(str(out_filepath))

        # Convert NumPy array to WAV in-memory
        logger.info("upload audio to bucket")
        audio_bytes_io = BytesIO()
        sf.write(audio_bytes_io, y, AUDIO_SAMPLE_RATE, format='WAV')
        audio_bytes_io.seek(0)  # rewind to start

        # Upload to GCS
        blob.upload_from_file(audio_bytes_io, content_type="audio/wav")

    # Unknown environment
    else:
        raise ValueError(f"Unknown DEVELOPMENT_ENV: {dev_env}")
