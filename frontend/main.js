import "./src/styles.css";
import WaveSurfer from 'wavesurfer.js';

let wavesurfer = null;

function createWave(audioFile) {
    // Destroy previous instance if it exists
    if (wavesurfer) {
        wavesurfer.destroy();
    }

    // Clear the container
    document.getElementById('waveform').innerHTML = '';

    // Create new instance
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple'
    });

    wavesurfer.load(audioFile);
}

window.createWave = createWave;
console.log("Hello from renamed frontend!")