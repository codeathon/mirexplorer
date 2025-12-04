let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

let audioContext = null;
let analyser = null;
let dataArray = null;
let sourceNode = null;
let animationId = null;
let recordingTimeout = null;

let displayedVolume = 0;
const smoothing = 0.1;
const bottomOffset = 5;
const maxHeight = 18;

let micClipRect, recordLabel, recordText, micFill;

document.addEventListener('DOMContentLoaded', () => {
    micClipRect = document.getElementById('mic-clip-rect');
    recordLabel = document.getElementById('record-label');
    recordText = document.getElementById('record-text');
    micFill = document.getElementById('mic-fill');

    recordLabel.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });
});

async function initRecorder() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});

        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm',
            audioBitsPerSecond: 128_000
        });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            cancelAnimationFrame(animationId);
            clearTimeout(recordingTimeout);

            if (audioChunks.length === 0) {
                if (recordText) {
                    recordText.textContent = 'No audio recorded';
                    recordText.classList.add('text-red-600');
                }
                return;
            }

            const blob = new Blob(audioChunks, {type: 'audio/webm'});
            audioChunks = [];

            // Prepare form data
            const form = document.getElementById('record-form');
            if (!form) return;

            const formData = new FormData(form);
            const file = new File([blob], 'recorded_audio.webm', {type: 'audio/webm'});
            formData.append('file', file);

            fetch(form.action, {
                method: 'POST',
                body: formData
            })
                .then(response => {
                    if (response.redirected) {
                        window.location.href = response.url; // follow redirect manually
                    } else {
                        // handle upload success/failure
                        recordText.textContent = response.ok ? 'Recording uploaded!' : 'Upload failed';
                    }
                })
                .catch(err => {
                    console.error(err);
                    if (!recordText) return;

                    recordText.textContent = 'Upload error';
                    recordText.classList.add('text-red-600');

                    if (micFill) {
                        micFill.setAttribute('y', '18.75');
                        micFill.setAttribute('height', '0');
                    }
                });
        };

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        sourceNode.connect(analyser);

    } catch (err) {
        console.error('Microphone access error:', err);
        if (recordText) {
            recordText.textContent = 'Microphone access denied';
            recordText.classList.add('text-red-600');
        }
    }
}

function animateVolume() {
    if (!analyser || !micClipRect) return;

    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    displayedVolume += (rms - displayedVolume) * smoothing;

    const height = Math.min(displayedVolume * maxHeight * 3, maxHeight);
    const y = 24 - bottomOffset - height;

    micClipRect.setAttribute('y', y);
    micClipRect.setAttribute('height', height);

    animationId = requestAnimationFrame(animateVolume);
}

async function startRecording() {
    if (!mediaRecorder) await initRecorder();

    audioChunks = [];
    mediaRecorder.start();
    isRecording = true;

    if (recordText) {
        recordText.textContent = 'Recording... click to stop';
        recordText.classList.add('text-red-600');
        recordText.classList.remove('text-green-600');
    }

    animateVolume();

    recordingTimeout = setTimeout(() => {
        if (isRecording) stopRecording();
    }, 30_000); // auto-stop after 30s
}

function stopRecording() {
    if (!mediaRecorder || !isRecording) return;

    isRecording = false;
    mediaRecorder.stop();

    if (recordText) {
        recordText.textContent = 'Processing...';
        recordText.classList.remove('text-red-600');
    }
}