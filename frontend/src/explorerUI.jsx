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
        waveColor: '#ef9b97',
        progressColor: '#ef6055',
        height: 376,
    });

    wavesurfer.load(audioFile);

    wavesurfer.on('interaction', () => {
        wavesurfer.playPause()
    })

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60)
        const secondsRemainder = Math.round(seconds) % 60
        const paddedSeconds = `0${secondsRemainder}`.slice(-2)
        return `${minutes}:${paddedSeconds}`
    }

    console.log(wavesurfer.p)

    const timeEl = document.getElementById('waveform-time')
    console.log(timeEl)
    wavesurfer.on('timeupdate', (currentTime) => (timeEl.textContent = formatTime(currentTime)))
}

globalThis.createWave = createWave;


document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('waveform');
    if (container) container.innerHTML = '';  // always start empty

    if (window.audio_url) {
        createWave(window.audio_url);
    }

    const toggleBtn = document.getElementById("toggleSidebar");
    const sidebar = document.getElementById("sidebar");
    const icon = document.getElementById("sidebarIcon");

    toggleBtn.addEventListener("click", () => {
        const isOpen = sidebar.classList.contains("translate-x-0");

        if (isOpen) {
            // close sidebar
            sidebar.classList.remove("translate-x-0");
            sidebar.classList.add("-translate-x-full");

            // rotate arrow to point right
            icon.style.transform = "rotate(180deg)";
        } else {
            // open sidebar
            sidebar.classList.remove("-translate-x-full");
            sidebar.classList.add("translate-x-0");

            // rotate arrow to point left
            icon.style.transform = "rotate(0deg)";
        }
    });

});
