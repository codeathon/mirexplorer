import ast
import os
import time
from pathlib import Path
from typing import Callable, Optional, Any
from uuid import uuid4

import librosa
import requests
from loguru import logger
from yarl import URL

from backend.crud import AUDIO_SAMPLE_RATE, save_audio, pad_or_truncate_array
from backend.extensions import cache


MOISES_URL = URL(r"https://api.music.ai/v1/")
MOISES_HEADERS = {"Authorization": os.environ.get("MOISES_TOKEN")}

TIMEOUT_SECONDS = 30
BACKOFF_SECONDS = 5

MAX_TAGS = 3
GENRE_MAPPING = {
    "electronicDance": "Electronic & Dance",
    "folkCountry": "Folk & Country",
    "funkSoul": "Funk & Soul",
    "indieAlternative": "Indie & Alternative",
    "rapHipHop" : "Rap & Hip-Hop",
    "rnb": "R&B",
    "singerSongwriters": "Singer-Songwriter"
}
INSTRUMENT_MAPPING = {
    "acousticGuitar": "Acoustic Guitar",
    "bassGuitar": "Bass Guitar",
    "electricGuitar": "Electric Guitar",
    "synth": "Synthesiser",
    "brassWoodwinds": "Brass & Woodwinds"
}


@cache.memoize()
def beat_track(audio, filename):
    logger.info("Starting beat track")
    _, beats = librosa.beat.beat_track(y=audio, sr=AUDIO_SAMPLE_RATE, units="time")

    # also render a click track that we can display on the frontend
    clicked = pad_or_truncate_array(librosa.clicks(times=beats, sr=AUDIO_SAMPLE_RATE), len(audio))
    clicked_fpath = filename.parent / Path(str(filename.stem) + "_clicks" + str(filename.suffix))

    if not clicked_fpath.exists():
        save_audio(audio + clicked, clicked_fpath)

    return beats.tolist()


def genre_identification(_, filename) -> list[str]:
    logger.info("Starting genre classification")

    out = process_audio_with_moises(filename)

    genres = out["genre"]
    if isinstance(genres, str):
        genres = [genres]

    # Map genres correctly
    return ["Genre: " + GENRE_MAPPING[g] if g in GENRE_MAPPING else "Genre: " + g.title() for g in genres][:MAX_TAGS]


def instrument_identification(_, filename) -> list[str]:
    logger.info("Starting instruments classification")

    out = process_audio_with_moises(filename)

    instruments = out["instruments"]
    if isinstance(instruments, str):
        instruments = [instruments]

    # Map genres correctly
    return ["Instrument: " + INSTRUMENT_MAPPING[g] if g in INSTRUMENT_MAPPING else "Instrument: " + g.title() for g in instruments][:MAX_TAGS]



def mood_identification(_, filename) -> list[str]:
    logger.info("Starting mood classification")

    out = process_audio_with_moises(filename)

    mood = out["mood"]
    if isinstance(mood, str):
        mood = [mood]

    # No need for a mapping, these are all one word anyway
    return ["Mood: " + m.title() for m in mood][:MAX_TAGS]


def route_to_function(function_name) -> Callable:
    # Beat tracking: calls librosa running on backend server
    if function_name == 'Beat Tracking':
        return beat_track

    # Metadata extraction: calls Cyanite through Music.AI
    elif function_name == 'Genre Identification':
        return genre_identification
    elif function_name == "Instrument Identification":
        return instrument_identification
    elif function_name == "Mood Identification":
        return mood_identification

    else:
        raise ValueError(f"Invalid function name: '{function_name}'")


def _request_moises_upload_urls() -> tuple[str, str]:
    """
    Requests upload and download URLs from Moises
    """
    response = requests.get(str(MOISES_URL / "upload"), headers=MOISES_HEADERS)

    # Raises a HTTP error if one occurred
    response.raise_for_status()
    out_js = response.json()

    # Raise an error if filepaths don't look correct
    if "uploadUrl" not in out_js or "downloadUrl" not in out_js:
        raise ValueError(f"Malformed response when requesting upload/download URLs from Moises! Response: {out_js}")

    # Return filepaths
    return out_js["uploadUrl"], out_js["downloadUrl"]


def _upload_audio_to_moises(filepath: str, upload_url: str) -> None:
    """
    Uploads audio to Moises at a given URL
    """
    # Upload the audio file
    with open(filepath, "rb") as f_in:
        response_upload = requests.put(
            upload_url,
            data=f_in,
            headers={"Content-Type": "audio/mpeg"}
        )

    # Will raise a HTTPError if one occurred
    response_upload.raise_for_status()
    # no need to return anything here


def _poll_moises_job(job_id: str, ) -> Optional[dict]:
    """
    Poll a running Moises job and return the result (if successful) or raise an error (if still running/unsuccessful)
    """
    # Make a request with the current job ID
    response_out = requests.get(f'{MOISES_URL}/job/{job_id}', headers=MOISES_HEADERS)

    # If a HTMLError occurred, raise it here
    response_out.raise_for_status()

    # Otherwise, get the response and current status
    response_js = response_out.json()
    current_state = response_js["status"]

    # Success: return the dictionary of results
    if current_state == "SUCCEEDED":
        return response_js

    # Error: raise the message
    elif current_state == "FAILED" or response_js["error"] is not None:
        response_error = response_js["error"]
        raise ValueError(f"Job ID {job_id}: raised error when processing. Error: {response_error}")

    # Started or queued: job still processing, so wait
    elif current_state == "STARTED" or current_state == "QUEUED":
        return None

    # Unexpected response state, so raise an error
    else:
        raise ValueError(f"Job ID {job_id}: got unexpected response state: '{current_state}'")


def _decode_moises_results(out: dict) -> dict[str, Any]:
    """
    Output from Moises is a dict that may contain lists/dicts represented as strings, so need to evaluate safely
    """
    decoded = {}
    for k, v in out.items():
        try:
            parsed = ast.literal_eval(v)
        except (ValueError, SyntaxError):
            logger.error(f"Could not parse Moises result: key {k} (type: {type(k)}), value: {v} (type: {type(v)})")
            pass
        else:
            decoded[k] = parsed
    return decoded


def _run_moises_workflow(download_url: str) -> dict:
    """
    Runs given Moises workflow on audio available at `download_url`
    """
    # Run the workflow with the required payload
    response_out = requests.post(
        f'{MOISES_URL}/job',
        headers={
            **MOISES_HEADERS,
            "Content-Type": "application/json"
        },
        json={
            "name": str(uuid4()),
            "workflow": os.environ.get("MOISES_WORKFLOW"),
            "params": {
                "inputUrl": download_url
            }
        }
    )
    response_out.raise_for_status()

    # ID of the job we just submitted
    job_id = response_out.json()["id"]
    logger.success(f"Job ID {job_id}: successfully started!")

    out = None
    start_time = time.time()

    logger.info(f"Job ID {job_id}: polling Moises for results...")
    while time.time() < start_time + TIMEOUT_SECONDS:
        # Query moises with the current job
        out = _poll_moises_job(job_id)

        # Job still running, so wait and try again
        if not out:
            logger.warning(f"Job ID {job_id}: still waiting for a response...")
            time.sleep(BACKOFF_SECONDS)

        # Otherwise, break out and return the results
        else:
            logger.success(f"Job ID {job_id}: successfully polled for results.")
            break

    return out


@cache.memoize()
def process_audio_with_moises(filename: str) -> dict:
    """
    Processes audio using Moises workflow
    """
    # Request URLs to upload to Moises
    upload_url, download_url = _request_moises_upload_urls()
    # Do the upload
    _upload_audio_to_moises(filename, upload_url)
    # Run the workflow
    out = _run_moises_workflow(download_url)
    # Decode the result
    return _decode_moises_results(out["result"])
