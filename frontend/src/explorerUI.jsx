import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'

let sampleRate = 22050;
let defaultFMin = 200
let defaultFMax = 8000
let defaultSpectType = "Linear"

let wavesurfer = null;
let spectsurfer = null;

function cleanContainer() {
    // Destroy previous instances if it exists
    if (wavesurfer) {
        wavesurfer.destroy();
    }
    if (spectsurfer) {
        spectsurfer.destroy()
    }

    // Clear the container
    document.getElementById('waveform').innerHTML = '';
}


function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const secondsRemainder = Math.round(seconds) % 60
    const paddedSeconds = `0${secondsRemainder}`.slice(-2)
    return `${minutes}:${paddedSeconds}`
}


async function finaliseSurfer(surfer) {
    surfer.on('interaction', () => {
        wavesurfer.playPause()
    })
    const timeEl = document.getElementById('waveform-time')
    surfer.on(
        'timeupdate',
        (currentTime) => (timeEl.textContent = formatTime(currentTime))
    )
}


async function createWave(audioFile) {
    cleanContainer()
    // Create new instance
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#ef9b97',
        progressColor: '#ef6055',
        height: 376,
        sampleRate: sampleRate
    });
    await wavesurfer.load(audioFile);
    await finaliseSurfer(wavesurfer)
}

function generateCmap() {
    const colorArray = [];

    // Define the background and most intense colours
    const background = {r: 245 / 255, g: 245 / 255, b: 245 / 255, alpha: 1};
    const intense = {r: 239 / 255, g: 155 / 255, b: 151 / 255, alpha: 1};

    // Function to interpolate between two colours
    function interpolateColor(start, end, t) {
        return {
            r: start.r + (end.r - start.r) * t,
            g: start.g + (end.g - start.g) * t,
            b: start.b + (end.b - start.b) * t,
            alpha: start.alpha + (end.alpha - start.alpha) * t,
        };
    }

    // Generate the 256 colours
    for (let i = 0; i < 256; i++) {
        const t = i / 255;  // Interpolation factor: from 0 (background) to 1 (most intense)
        const color = interpolateColor(background, intense, t);
        colorArray.push([color.r, color.g, color.b, color.alpha]);
    }

    return colorArray
}

async function createSpect(
    audioFile,
    spectFMin = defaultFMin,
    spectFMax = defaultFMax,
    spectType = defaultSpectType
) {
    console.log("Creating spectrogram: ", spectFMin, spectFMax, spectType)

    cleanContainer()
    const cArr = generateCmap()
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#ef9b97',
        progressColor: '#ef6055',
        sampleRate: sampleRate,
        height: 0
    })
    spectsurfer = Spectrogram.create({
        colorMap: cArr,
        labels: false,
        height: 376,
        splitChannels: false,
        scale: spectType.toLowerCase(),
        useWebWorker: true,
        frequencyMin: spectFMin,
        frequencyMax: spectFMax,
        gainDB: 5,
    })
    wavesurfer.registerPlugin(spectsurfer)
    await wavesurfer.load(audioFile);

    await finaliseSurfer(wavesurfer)
}


async function handleChangeView(selection) {
    let textContent = selection.innerHTML

    // create waveform if not existing
    if (textContent === "Waveform") {
        toggleSpectrogramOptions(false)
        await createWave(window.audio_url)
    }
    // create spectrogram otherwise
    else if (textContent === "Spectrogram") {
        toggleSpectrogramOptions(true)
        await createSpect(window.audio_url)
    }

}

function toggleSpectrogramOptions(show) {
    let spectOpt = document.getElementById("spectrogramOptions")
    if (show) {
        spectOpt.classList.remove("hidden")
    } else if (!("hidden" in spectOpt.classList)) {
        spectOpt.classList.add("hidden")
    }

    const fMinSlider = document.getElementById("fMin");
    const fMaxSlider = document.getElementById("fMax");
    const fMinLabel = document.getElementById("tooltip-fMin")
    const fMaxLabel = document.getElementById("tooltip-fMax")
    const spectTypeSelect = document.getElementById("spectTypeSelect")

    // set defaults for slider
    fMinSlider.value = defaultFMin
    fMaxSlider.value = defaultFMax
    fMinLabel.innerHTML = `${defaultFMin} Hz`
    fMaxLabel.innerHTML = `${defaultFMax} Hz`
    spectTypeSelect.value = defaultSpectType

    let debounceTimer;

    function debounce(func, delay) {
        return function (...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                func(...args);
            }, delay);
        };
    }

    function updateSelect() {
        createSpect(window.audio_url, fMinSlider.value, fMaxSlider.value, spectTypeSelect.value)
    }
    const updateSelectDebounced = debounce(updateSelect, 1000);

    function updateSliderTooltip(slider, label) {
        label.innerHTML = `${slider.value} Hz`
        // recreate the spectrogram with the new values
        createSpect(window.audio_url, fMinSlider.value, fMaxSlider.value, spectTypeSelect.value)
    }
    const updateSliderTooltipDebounced = debounce(updateSliderTooltip, 1000);

    fMinSlider.addEventListener("input", function () {
        updateSliderTooltipDebounced(fMinSlider, fMinLabel);
    });

    fMaxSlider.addEventListener("input", function () {
        updateSliderTooltipDebounced(fMaxSlider, fMaxLabel);
    });
    spectTypeSelect.addEventListener("change", function () {
        updateSelectDebounced()
    })
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const icon = document.getElementById("sidebarIcon");
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
}


globalThis.createWave = createWave;


document.addEventListener('DOMContentLoaded', () => {
    // start with a waveform by default
    if (window.audio_url) {
        createWave(window.audio_url);
    }

    // sidebar open/close button
    const toggleBtn = document.getElementById("toggleSidebar");
    toggleBtn.addEventListener("click", () => toggleSidebar());

    // View as button (spectrogram/waveform)
    const viewAsHover = document.getElementById('viewAsBtn');
    const dropdown = document.getElementById('dropdownMenu');
    viewAsHover.addEventListener('mouseover', () => {
        dropdown.classList.remove('opacity-0', 'invisible');
        dropdown.classList.add('opacity-100', 'visible');
    });
    viewAsHover.addEventListener('mouseout', () => {
        dropdown.classList.remove('opacity-100', 'visible');
        dropdown.classList.add('opacity-0', 'invisible');
    });

    // need to add listeners to the dropdown menu buttons too
    const viewAsOptions = Array.from(document.getElementsByClassName("explorer-viewas-option"))
    viewAsOptions.forEach(option => {
        option.addEventListener('click', () => handleChangeView(option));
    });

});
