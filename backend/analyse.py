from typing import Callable
from pathlib import Path

import librosa
from loguru import logger

from backend.crud import AUDIO_SAMPLE_RATE, save_audio, pad_or_truncate_array


def beat_track(audio, filename):
    logger.info("Starting beat track")
    _, beats = librosa.beat.beat_track(y=audio, sr=AUDIO_SAMPLE_RATE, units="time")

    # also render a click track that we can display on the frontend
    clicked = pad_or_truncate_array(librosa.clicks(times=beats, sr=AUDIO_SAMPLE_RATE), len(audio))
    clicked_fpath = filename.parent / Path(str(filename.stem) + "_clicks" + str(filename.suffix))

    if not clicked_fpath.exists():
        save_audio(audio + clicked, clicked_fpath)

    return beats.tolist()


def route_to_function(function_name) -> Callable:
    if function_name == 'Beat Tracking':
        return beat_track
    else:
        raise ValueError(f"Invalid function name: '{function_name}'")
