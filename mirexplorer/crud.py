from io import BytesIO

import librosa

from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileRequired, FileAllowed, FileSize
from werkzeug.datastructures import FileStorage
from wtforms import SubmitField
from wtforms.validators import ValidationError

AUDIO_FILE_FORMATS = ["wav", "aac", "aiff", "flac", "m4a", "mp3", "ogg", "wav", "wma"]
MAX_SIZE = 16 * 1000000    # 16 MB default


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
                y, sr = librosa.load(audio_stream, sr=None, mono=False)

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
            FileAllowed(AUDIO_FILE_FORMATS, 'Allowed file types are jpg, png, pdf'),
            FileSize(max_size=MAX_SIZE, message=f'File size must be less than {MAX_SIZE}'),
            FileAudioValid(message="File contains invalid or corrupted audio")
        ]
    )
    submit = SubmitField('Upload')
