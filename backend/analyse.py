from typing import Callable

import librosa
from loguru import logger

from backend.crud import AUDIO_SAMPLE_RATE


def beat_track(audio):
    logger.info("Starting beat track")
    logger.info(type(audio))
    _, beats = librosa.beat.beat_track(y=audio, sr=AUDIO_SAMPLE_RATE, units="time")
    return beats.tolist()


def route_to_function(function_name) -> Callable:
    if function_name == 'Pattern Recognition':
        return beat_track
    else:
        raise ValueError(f"Invalid function name: '{function_name}'")
