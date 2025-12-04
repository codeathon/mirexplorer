from io import BytesIO

import librosa
import numpy as np
import soundfile as sf

from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileRequired, FileAllowed, FileSize
from werkzeug.datastructures import FileStorage
from wtforms import SubmitField
from wtforms.validators import ValidationError

AUDIO_FILE_FORMATS = ["wav", "aac", "aiff", "flac", "m4a", "mp3", "ogg", "wav", "wma"]
MAX_SIZE = 16 * 1000000    # 16 MB default

MAX_AUDIO_DURATION = 30    # load only first 30 seconds of audio by default
AUDIO_SAMPLE_RATE = 22050    # audio resampled to this
MAX_AUDIO_SAMPLES = round(MAX_AUDIO_DURATION * AUDIO_SAMPLE_RATE)


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
    submit = SubmitField('Upload')


def pad_or_truncate_array(y: np.ndarray, val: int) -> np.ndarray:
    """
    Pad or truncate `y` to match `val`. Right-padding used, with zeros
    """
    # Truncate or pad audio to match desired number of samples
    if len(y) < MAX_AUDIO_SAMPLES:
        return np.pad(y, (0, MAX_AUDIO_SAMPLES - len(y)), mode='constant', constant_values=0)
    elif len(y) > MAX_AUDIO_SAMPLES:
        return y[:MAX_AUDIO_SAMPLES]
    else:
        return y


def preprocess_audio_on_upload(audio_stream) -> np.ndarray:
    """
    Preprocess an uploaded audio file: convert to mono, resample, and trim to maximum duration
    """
    # Audio should have been validated beforehand, so we know that it is safe
    audio_buffer = BytesIO(audio_stream.read())
    y, sr = librosa.load(audio_buffer, sr=AUDIO_SAMPLE_RATE, offset=0, mono=True, duration=MAX_AUDIO_DURATION)

    # Truncate or pad audio to match desired number of samples
    return pad_or_truncate_array(y, MAX_AUDIO_SAMPLES)


def save_audio(y: np.ndarray, filepath: str) -> np.ndarray:
    """
    Save numpy array of audio to file
    """
    sf.write(filepath, y, AUDIO_SAMPLE_RATE,)
