import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'

let sampleRate = 22050;
let defaultFMin = 200
let defaultFMax = 8000
let defaultSpectType = "Linear"
let defaultColour = '#ef9b97'

let wavesurfer = null;
let spectsurfer = null;

export {wavesurfer}
export {spectsurfer}

let currentShown = "wave"
let hoverColour = defaultColour

let looping = false


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


function handlePlayButton() {
    const playIcon = document.getElementById("explorer-play-icon");
    if (wavesurfer.isPlaying()) {
        playIcon.style.strokeWidth = "1.5";
        wavesurfer.pause()
    } else {
        playIcon.style.strokeWidth = "2.5";
        wavesurfer.play()
    }
}

function handleLoopButton() {
    const loopIcon = document.getElementById("explorer-loop-icon");

    looping = !looping
    if (looping) {
        loopIcon.style.strokeWidth = "2.5"
    } else {
        loopIcon.style.strokeWidth = "1.5"
    }

}


async function finaliseSurfer(surfer) {
    surfer.on('seek',
        function (position) {
            let currentTime = position * wavesurfer.getDuration();
            surfer.seekTo(currentTime)
        });
    const timeEl = document.getElementById('waveform-time')
    surfer.on(
        'timeupdate',
        (currentTime) => (timeEl.textContent = formatTime(currentTime))
    )

    // looping functionality
    surfer.on('finish', function () {
        if (looping) {
            surfer.seekTo(0.0);
            surfer.play();
        } else {
            const playIcon = document.getElementById("explorer-play-icon");
            playIcon.style.strokeWidth = "1.5";
            surfer.pause()
        }
    });
}

function getCurrentChosenColour() {
    // get current color from picker
    let currentColour = document.getElementById("explorer-colour-picker").getAttribute("data-current-color")
    if (!currentColour) {
        currentColour = defaultColour
    }
    return currentColour.toLowerCase()
}


function getProgressColour(currentColour) {
    // progress colour will be +/-50 added to R/G/B, depending on total sum
    let currentRgb = hexToRgb(currentColour)
    let totalSum = currentRgb.r + currentRgb.g + currentRgb.b

    let progCol;

    if (totalSum > (255 * 1.5)) {
        progCol = {
            r: Math.max(currentRgb.r - 50, 0),
            g: Math.max(currentRgb.g - 50, 0),
            b: Math.max(currentRgb.b - 50, 0)
        }
    } else {
        progCol = {
            r: Math.min(currentRgb.r + 50, 255),
            g: Math.min(currentRgb.g + 50, 255),
            b: Math.min(currentRgb.b + 50, 255)
        }
    }
    return rgbToHex(progCol.r, progCol.g, progCol.b)
}

async function createWave(audioFile) {
    cleanContainer()

    // get currently chosen color
    let currentColour = getCurrentChosenColour()

    // progress colour will be +/-50 added to R/G/B, depending on total sum
    let currentProgressColour = getProgressColour(currentColour)

    // Create new instance
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: currentColour,
        progressColor: currentProgressColour,
        height: 376,
        sampleRate: sampleRate
    });

    await wavesurfer.load(audioFile);
    await finaliseSurfer(wavesurfer)
}

function generateCmap(r, g, b) {
    const colorArray = [];

    // Define the background and most intense colours
    //  background colour is always constant, intense (foreground) dynamic based on colour picker element
    const background = {r: 245 / 255, g: 245 / 255, b: 245 / 255, alpha: 1};
    const intense = {r: r / 255, g: g / 255, b: b / 255, alpha: 1};

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

function componentToHex(c) {
    let hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

async function createSpect(
    audioFile,
    spectFMin = defaultFMin,
    spectFMax = defaultFMax,
    spectType = defaultSpectType,
) {
    console.log("Creating spectrogram: ", spectFMin, spectFMax, spectType)

    let currentColour = getCurrentChosenColour()
    let currentProg = getProgressColour(currentColour)

    cleanContainer()
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: currentProg, //
        progressColor: currentProg,
        sampleRate: sampleRate,
        height: 0
    })

    // generate the cmap
    // need to parse hex color input to RGB values
    let rgb = hexToRgb(currentColour)
    const cArr = generateCmap(rgb.r, rgb.g, rgb.b)

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
        currentShown = "wave"
        toggleSpectrogramOptions(false)
        await createWave(window.audio_url)
    }
    // create spectrogram otherwise
    else if (textContent === "Spectrogram") {
        currentShown = "spect"
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

async function colourChanged() {
    hoverColour = getCurrentChosenColour()

    // // update play/pause buttons
    // if (wavesurfer.isPlaying()) {
    //     const playIcon = document.getElementById("explorer-play-icon");
    //     playIcon.style.fill = hoverColour;
    // }

    // for waveforms, we can update the surfer without having to recreate it
    if (currentShown === "wave") {
        let currentProg = getProgressColour(hoverColour)
        wavesurfer.setOptions({
            waveColor: hoverColour,
            progressColor: currentProg
        })
    }
        // for spectrograms, we need to recreate it
    // see https://github.com/katspaugh/wavesurfer.js/discussions/3095
    else {
        const fMinSlider = document.getElementById("fMin");
        const fMaxSlider = document.getElementById("fMax");
        const spectTypeSelect = document.getElementById("spectTypeSelect")
        await createSpect(window.audio_url, fMinSlider.value, fMaxSlider.value, spectTypeSelect.value)
    }
}

function addHoverStyle(hoverElement) {
    hoverElement.addEventListener('mouseover', () => {
        hoverElement.style.transition = 'color 0.1s ease';
        hoverElement.style.color = hoverColour;
    });
    hoverElement.addEventListener('mouseout', () => {
        hoverElement.style.color = '';
    })
}


globalThis.createWave = createWave;
window.colourChanged = colourChanged;


document.addEventListener('DOMContentLoaded', () => {
    // start with a waveform by default
    if (window.audio_url) {
        createWave(window.audio_url);
    }

    // sidebar open/close button
    const toggleBtn = document.getElementById("toggleSidebar");
    toggleBtn.addEventListener("click", () => toggleSidebar());

    // play button
    const playBtn = document.getElementById("explorer-play-button");
    playBtn.onclick = handlePlayButton;
    addHoverStyle(playBtn);

    // loop button
    const loopBtn = document.getElementById("explorer-loop-button");
    loopBtn.onclick = handleLoopButton;
    addHoverStyle(loopBtn);

    // rewind button
    const rewindBtn = document.getElementById("explorer-rewind-button")
    rewindBtn.onclick = function () {
        wavesurfer.seekTo(0.0)
    }
    addHoverStyle(rewindBtn)

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

    // dynamically set hover style for all labels
    const elements = document.querySelectorAll('.explorer-sidebar-labels');
    elements.forEach(hoverElement => addHoverStyle(hoverElement));

});
