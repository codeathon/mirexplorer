import ast
import os
import json
import time
import urllib.request
from pathlib import Path
from typing import Callable, Optional, Any
from uuid import uuid4

import librosa
import librosa.feature
import numpy as np
import requests
from loguru import logger
from yarl import URL

from mirexplorer_audio.storage import AUDIO_SAMPLE_RATE, save_audio, pad_or_truncate_array
from mirexplorer_analysis.extensions import cache

MOISES_URL = URL(r"https://api.music.ai/v1/")
MOISES_HEADERS = {"Authorization": os.environ.get("MOISES_TOKEN")}

TIMEOUT_SECONDS = 120
BACKOFF_SECONDS = 5

MAX_TAGS = 3
GENRE_MAPPING = {
    "electronicDance": "Electronic & Dance",
    "folkCountry": "Folk & Country",
    "funkSoul": "Funk & Soul",
    "indieAlternative": "Indie & Alternative",
    "rapHipHop": "Rap & Hip-Hop",
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

ROOT_NOTES = [
    "C", "D", "E", "F", "G", "A", "B",
    "C#", "D#", "F#", "G#", "A#",
    "Db", "Eb", "Fb", "Gb", "Ab", "Bb"
]

LYRICS_THRESHOLD = 0.3  # words with confidence scores below this threshold will be rejected


def try_get_precached_features(filepath: str, key: str):
    from mirexplorer_common.paths import repo_root

    precached_features_path = repo_root() / "frontend/static/example_audio/precached_features.json"
    with open(precached_features_path, "r") as js:
        read = json.load(js)

    fp_split = filepath.split(".")[0].split("_")[1:4]
    match = []
    for m in read:
        if set(m["out"]) == set(fp_split):
            match.append(m)
    if len(match) == 0 or len(match) > 1:
        return None

    else:
        try:
            out = match[0][key]
            logger.info(f"Matched {key}: {out}")
            return out
        except (IndexError, KeyError):
            return None


@cache.memoize()
def beat_track(audio, filename):
    pcache = try_get_precached_features(filename, "beats")
    if pcache is not None:
        return pcache

    logger.info("Starting beat track")
    _, beats = librosa.beat.beat_track(y=audio, sr=AUDIO_SAMPLE_RATE, units="time")

    # also render a click track that we can display on the frontend
    clicked = pad_or_truncate_array(librosa.clicks(times=beats, sr=AUDIO_SAMPLE_RATE), len(audio))
    logger.info("Creating filename")
    clicked_fpath = Path(str(Path(filename).stem) + "_clicks" + str(Path(filename).suffix))
    logger.info(f"Writing clicks to {clicked_fpath}")

    save_audio(audio + clicked, clicked_fpath)

    return beats.tolist()


def genre_identification(_, filename) -> list[str]:

    pcache = try_get_precached_features(filename, "genre")
    if pcache is not None:
        return pcache

    logger.info("Starting genre classification")

    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_METADATA_WORKFLOW"))
    out = _decode_moises_metadata_results(out)

    genres = out["genre"]
    if isinstance(genres, str):
        genres = [genres]

    # Map genres correctly
    return ["Genre: " + GENRE_MAPPING[g] if g in GENRE_MAPPING else "Genre: " + g.title() for g in genres][:MAX_TAGS]


def instrument_identification(_, filename) -> list[str]:
    logger.info("Starting instruments classification")

    pcache = try_get_precached_features(filename, "instrument")
    if pcache is not None:
        return pcache

    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_METADATA_WORKFLOW"))
    out = _decode_moises_metadata_results(out)

    instruments = out["instruments"]
    if isinstance(instruments, str):
        instruments = [instruments]

    # Map genres correctly
    return ["Instrument: " + INSTRUMENT_MAPPING[g] if g in INSTRUMENT_MAPPING else "Instrument: " + g.title() for g in
            instruments][:MAX_TAGS]


def mood_identification(_, filename) -> list[str]:
    logger.info("Starting mood classification")

    pcache = try_get_precached_features(filename, "mood")
    if pcache is not None:
        return pcache

    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_METADATA_WORKFLOW"))
    out = _decode_moises_metadata_results(out)

    mood = out["mood"]
    if isinstance(mood, str):
        mood = [mood]

    # No need for a mapping, these are all one word anyway
    return ["Mood: " + m.title() for m in mood][:MAX_TAGS]


def time_signature_detection(_, filename) -> str:
    logger.info("Starting time signature detection")

    pcache = try_get_precached_features(filename, "time_signature")
    if pcache is not None:
        return pcache[0]

    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_METADATA_WORKFLOW"))
    out = _decode_moises_metadata_results(out)

    ts = out["time_signature"]
    if not isinstance(ts, str):
        raise ValueError("Time signature detection failed: expected str, got {}".format(type(ts)))
    elif isinstance(ts, list):
        ts = ts[0]

    try:
        _, __ = ts.split("/")
    except ValueError:
        raise ValueError("Time signature detection failed: expected X/Y format, got {}".format(ts))

    return "Time Signature: " + ts.upper()


def musical_era_detection(_, filename) -> str:
    logger.info("Starting musical era detection")

    pcache = try_get_precached_features(filename, "era")
    if pcache is not None:
        return pcache[0]

    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_METADATA_WORKFLOW"))
    out = _decode_moises_metadata_results(out)

    ts = out["musical_era"]
    return "Era: " + ts


def lyrics_transcription(_, filename) -> list[dict]:
    logger.info("Starting lyrics transcription")

    pcache = try_get_precached_features(filename, "lyrics")
    if pcache is not None:
        return pcache

    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_LYRICS_WORKFLOW"))

    lyrics_json_url = out["lyrics"]
    lyrics_data = download_json_from_url(lyrics_json_url)

    if not isinstance(lyrics_data, list) or len(lyrics_data) == 0:
        raise ValueError("No lyrics detected!")

    words_list = []
    for lyrics_inner in lyrics_data:
        if not isinstance(lyrics_inner, dict) or "words" not in lyrics_inner.keys():
            raise ValueError("Expected lyrics to be dictionary but got type {}".format(type(lyrics_inner)))
        words_outer = lyrics_inner["words"]

        for words in words_outer:

            # malformed results: set score to 0
            score = words["score"] if "score" in words.keys() and isinstance(words["score"], float) else 0
            if score <= LYRICS_THRESHOLD:
                logger.warning(
                    f"Lyrics score for word {words['word']} (start {words['start']}, end {words['end']}) below threshold: score {score}")
                continue

            # keep valid words
            words_list.append(words)

    if len(words_list) == 0:
        raise ValueError("No lyrics detected!")
    return words_list


def chord_transcription(_, filename) -> list[dict]:
    pcache = try_get_precached_features(filename, "chords")
    if pcache is not None:
        return pcache

    # run the workflow
    logger.info("Starting chord transcription")
    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_CHORD_WORKFLOW"))

    # Moises returns a URL pointing to a JSON, so we need to load this is an actual Python dictionary
    chord_json_url = out["chords"]
    chord_data = download_json_from_url(chord_json_url)

    # defensive raise on invalid results
    if not isinstance(chord_data, list) or len(chord_data) == 0:
        raise ValueError("No chords detected!")

    # Simplify chord data: only need start/end timestamps, and chord_simple_pop
    cols_reqd = ["start", "end", "chord_simple_pop"]
    return [{k: c[k] for k in cols_reqd} for c in chord_data]


def key_transcription(_, filename) -> str:
    logger.info("Starting key transcription")

    pcache = try_get_precached_features(filename, "key")
    if pcache is not None:
        return pcache[0]

    # run the workflow
    #  the chord workflow returns both chords + key, so we can easily grab from this
    download_url = upload_audio_to_moises(filename)
    out = process_audio_with_moises(download_url, workflow_slug=os.environ.get("MOISES_CHORD_WORKFLOW"))

    # validate results
    if "key" not in out:
        raise ValueError(f"Invalid results: expected 'key' in dict, but got {', '.join(list(out.keys()))}")
    key = out["key"]

    if not isinstance(key, str):
        raise ValueError("Invalid results: expected 'key' to be 'str', but got {}".format(type(key)))

    root, quality = key.split(" ")
    if root not in ROOT_NOTES:
        logger.error(f"Root note '{root}' may be invalid!")
    if quality not in ["major", "minor"]:
        logger.error(f"Key quality '{quality}' may be invalid!")

    return key


def download_json_from_url(url: str) -> dict:
    with urllib.request.urlopen(url) as url:
        # This should be a list of dictionaries
        data = json.loads(url.read().decode())
    return data


def route_to_function(function_name) -> Callable:
    # Pattern extraction: calls Librosa running on backend server
    if function_name == 'Beat Tracking':
        return beat_track
    elif function_name == "Time Signature Detection":
        return time_signature_detection

    # Metadata extraction: calls Cyanite through Music.AI
    elif function_name == 'Genre Identification':
        return genre_identification
    elif function_name == "Instrument Identification":
        return instrument_identification
    elif function_name == "Mood Identification":
        return mood_identification
    elif function_name == "Musical Era Identification":
        return musical_era_detection

    # Transcription: calls Moises
    elif function_name == "Lyrics Transcription":
        return lyrics_transcription
    elif function_name == "Chord Transcription":
        return chord_transcription
    elif function_name == "Key Estimation":
        return key_transcription

    # Chat
    elif function_name == "Chat":
        return start_chat

    else:
        raise ValueError(f"Invalid function name: '{function_name}'")


def start_chat(_, filename) -> None:
    return


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
    from mirexplorer_audio.storage import UPLOADS_FOLDER

    assert os.environ["DEVELOPMENT_ENV"] == "true", "Should only be used with a development env!"

    # Upload the audio file
    filepath = UPLOADS_FOLDER / Path(filepath).name
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
    response_out = requests.get(MOISES_URL / "job" / job_id, headers=MOISES_HEADERS)

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


def _decode_moises_metadata_results(out: dict) -> dict[str, Any]:
    """
    Output from Moises is a dict that may contain lists/dicts represented as strings, so need to evaluate safely
    """
    decoded = {}
    for k, v in out.items():
        try:
            v = ast.literal_eval(v)
        except (ValueError, SyntaxError):
            logger.error(f"Could not parse Moises result: key {k} (type: {type(k)}), value: {v} (type: {type(v)})")
        decoded[k] = v
    return decoded


def _run_moises_workflow(download_url: str, workflow_slug: str) -> dict:
    """
    Runs given Moises workflow on audio available at `download_url`
    """
    # Run the workflow with the required payload
    response_out = requests.post(
        MOISES_URL / 'job',
        headers={
            **MOISES_HEADERS,
            "Content-Type": "application/json"
        },
        json={
            "name": str(uuid4()),
            "workflow": workflow_slug,
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
def upload_audio_to_moises(filename: str) -> str:
    """
    Uploads given audio to Moises, returns URL to download (required for processors)
    """
    dev_env = os.environ["DEVELOPMENT_ENV"]

    # Development environment: need publicly accessible URL
    if dev_env == "true":
        # Request URLs to upload to Moises
        upload_url, download_url = _request_moises_upload_urls()
        # Do the upload
        _upload_audio_to_moises(filename, upload_url)

    # Production environment: we can just use the public GCS link
    elif dev_env == "false":
        filename = filename.replace("/uploads/", "")
        download_url = f"https://storage.googleapis.com/mirexplorer/{filename}"

    else:
        raise ValueError(f"Unknown environment '{dev_env}'")

    return download_url


@cache.memoize()
def process_audio_with_moises(download_url: str, workflow_slug: str) -> dict:
    """
    Processes audio using a given Moises workflow
    """
    # Run the workflow
    out = _run_moises_workflow(download_url, workflow_slug)

    # Catch time out errors
    if out is None:
        raise ValueError("Job timed out!")

    # Return the result
    return out["result"]


@cache.memoize()
def extract_spectral_features(filepath) -> dict[str, float]:
    from mirexplorer_audio.storage import load_audio

    y = load_audio(filepath)
    logger.info("Extracting spectral features")

    # Compute magnitude spectrogram ONCE, using entire signal
    s = np.abs(librosa.stft(y, n_fft=len(y), hop_length=len(y)))

    res = {"spectral_centroid": float(
        librosa.feature.spectral_centroid(S=s, sr=AUDIO_SAMPLE_RATE)[0, 0]
    ), "spectral_bandwidth": float(
        librosa.feature.spectral_bandwidth(S=s, sr=AUDIO_SAMPLE_RATE)[0, 0]
    ), "spectral_rolloff": float(
        librosa.feature.spectral_rolloff(S=s, sr=AUDIO_SAMPLE_RATE)[0, 0]
    ), "spectral_contrast": float(
        librosa.feature.spectral_contrast(S=s, sr=AUDIO_SAMPLE_RATE).mean()
    ), "rms": float(
        librosa.feature.rms(y=y, frame_length=len(y), hop_length=len(y))[0, 0]
    )}

    # RMS does NOT need STFT
    return res
