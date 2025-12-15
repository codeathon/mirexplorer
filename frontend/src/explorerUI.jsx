import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

let sampleRate = 22050;
let gridResolutionSecs = 5
let defaultFMin = 200
let defaultFMax = 8000
let defaultSpectType = "Linear"
let defaultColour = '#ef9b97'
let defaultHeight = 376

let wavesurfer = null;
let spectsurfer = null;

export {wavesurfer}
export {spectsurfer}

let currentShown = "wave"
let hoverColour = defaultColour

let looping = false

let beats = null
let beatColour = "#0000007F"
let beatsRegions = null


function cleanContainer() {
    // Destroy previous instances if it exists
    if (wavesurfer) {
        wavesurfer.destroy();
    }
    if (spectsurfer) {
        spectsurfer.destroy()
        wavesurfer.destroy()
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

function addGrid() {
    // all of this handles horizontal (time) grid
    const waveformContainer = document.querySelector('.waveform-container');
    const duration = wavesurfer.getDuration();
    const containerWidth = waveformContainer.offsetWidth;

    const waveYAxBack = document.getElementById("wave-yaxis-backing")
    waveYAxBack.hidden = currentShown === "spect";

    waveformContainer.querySelectorAll('.explorer-gridline-major').forEach(line => line.remove());
    waveformContainer.querySelectorAll('.explorer-gridline-text').forEach(line => line.remove());
    waveformContainer.querySelectorAll('.explorer-gridline-minor').forEach(line => line.remove());

    let currentTime = 0;
    while (currentTime <= duration) {
        if (currentTime >= 30) {
            break
        }

        const position = (currentTime / duration) * containerWidth;

        const line = document.createElement('div');
        line.classList.add('explorer-gridline-major');
        line.style.left = `${position}px`;
        waveformContainer.appendChild(line);

        const lineText = document.createElement("div");
        lineText.classList.add("explorer-gridline-text");
        lineText.innerText = `0:${String(currentTime).padStart(2, '0')}`;
        lineText.style.left = `${position + 5}px`;
        waveformContainer.appendChild(lineText);

        currentTime += gridResolutionSecs;
    }

    let maxTime = Math.round(duration)
    for (const i of Array(maxTime).keys()) {
        if (i % gridResolutionSecs !== 0) {
            const position = (i / duration) * containerWidth;

            const lineMinor = document.createElement('div');
            lineMinor.classList.add('explorer-gridline-minor');
            lineMinor.style.left = `${position}px`;

            waveformContainer.appendChild(lineMinor);
        }
    }

    // now move on to handling vertical (frequency/amplitude) grid
    // this is dependent on what is currently shown
    // remove all current vertical grid
    waveformContainer.querySelectorAll('.explorer-gridline-major-vertical').forEach(line => line.remove());
    waveformContainer.querySelectorAll('.explorer-gridline-vertical-text').forEach(line => line.remove());
    waveformContainer.querySelectorAll('.explorer-gridline-minor-vertical').forEach(line => line.remove());


    let displayVal = [1, 0.5, 0, -0.5, -1.0];
    let yText = "Amplitude"
    if (currentShown === "spect") {
        yText = "Frequency (Hz)"
    }

    // title
    let yAxLabel = document.getElementById("explorer-yaxis-text")
    yAxLabel.innerText = yText

    if (currentShown === "spect") {
        return
    }

    // major ticks
    let iterVal = [0.95, 0.75, 0.5, 0.25, 0.05];

    for (const val in iterVal) {
        let vertPosition = (iterVal[val] * defaultHeight) - 160;
        const majTickText = document.createElement("div")
        majTickText.classList.add("explorer-gridline-vertical-text")
        majTickText.innerText = String(displayVal[val])
        majTickText.style.bottom = `${vertPosition - 12}px`;
        waveformContainer.appendChild(majTickText)
    }
}

async function finaliseSurfer(surfer) {
    surfer.on('seek',
        function (position) {
            let currentTime = position * wavesurfer.getDuration();
            surfer.seekTo(currentTime)
        });

    // time functionality
    const timeEl = document.getElementById('waveform-time');
    const waveformContainer = document.querySelector('.waveform-container');
    surfer.on('timeupdate', (currentTime) => {
        timeEl.textContent = formatTime(currentTime);
        const duration = surfer.getDuration();
        const containerWidth = waveformContainer.clientWidth;
        let leftPos = (currentTime / duration) * containerWidth;
        leftPos = Math.min(leftPos, containerWidth - timeEl.offsetWidth);
        timeEl.style.position = 'absolute';
        timeEl.style.left = `${leftPos}px`;
    });

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

    // don't know why this needs to be added here
    // but the grid resizing breaks without it
    addGrid()

    // progress bar
    // await updateCursorColour()

    // add beats if present
    addBeatMarkers()
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
        height: defaultHeight,
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
    // type coersion
    spectFMin = Number(spectFMin)
    spectFMax = Number(spectFMax)

    console.log("Creating spectrogram: ", spectFMin, typeof (spectFMin), spectFMax, typeof (spectFMax), spectType)

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
        labels: true,
        labelsBackground: "rgba(0, 0, 0, 0.5)",
        height: defaultHeight,
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
    fMinSlider.value = Number(defaultFMin)
    fMaxSlider.value = Number(defaultFMax)
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
        createSpect(window.audio_url, Number(fMinSlider.value), Number(fMaxSlider.value), spectTypeSelect.value)
    }

    const updateSelectDebounced = debounce(updateSelect, 1000);

    function updateSliderTooltip(slider, label) {
        label.innerHTML = `${slider.value} Hz`
        // recreate the spectrogram with the new values
        createSpect(window.audio_url, Number(fMinSlider.value), Number(fMaxSlider.value), spectTypeSelect.value)
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

function addHoverStyle(hoverElement, transformElement = null) {
    if (transformElement === null) {
        transformElement = [hoverElement]
    }

    hoverElement.addEventListener('mouseover', () => {
        transformElement.forEach(te => {
            te.style.transition = 'color 0.1s ease';
            te.style.color = hoverColour;
        })
    });
    hoverElement.addEventListener('mouseout', () => {
        transformElement.forEach(te => {
            te.style.color = '';
        })
    })
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


function modifySpectLabels() {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;

    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        const canvas = this.canvas;
        if (canvas?.getAttribute?.("part") === "spec-labels") {
            if (String(text).toLowerCase().includes("hz")) {
                text = ""
            } else if (String(text).toLowerCase().includes(".")) {
                let num = Number(text) * 1000
                if (num < 100) {
                    num = num * 1000;
                }
                text = numberWithCommas(num)
            }

            this.font = '16px "TASA Orbiter Display", serif';
            this.fillStyle = "#fff";
        }
        x += 5
        return originalFillText.call(this, text, x, y, maxWidth);
    };
}


function addBeatPluginPill() {
    const container = document.getElementById("plugins-interface");

    const pluginDiv = document.createElement("div");
    pluginDiv.id = "plugin-beats";
    pluginDiv.classList.add("explorer-plugin-pill");

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "#000000");
    svg.id = "plugin-beats-icon";
    svg.setAttribute("height", "16");
    svg.setAttribute("width", "16");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "m12.8297625 6.92526875 2.1870375 -2.4059c0.3337625 -0.376225 0.1350875 -0.972675 -0.3576125 -1.0736125 -0.22319375 -0.045725 -0.4540875 0.028125 -0.609325 0.19488125l-1.67825 1.84566875 -1.4046625 -4.41571875c-0.17118125 -0.54333125 -0.67575625 -0.91225 -1.24541875 -0.91058125h-3.44388125c-0.56965625 -0.00166875 -1.07423125 0.36725 -1.2454125 0.91058125L0.8745875 14.13725C0.6065 14.98005 1.23559375 15.84015625 2.12 15.84h11.76c0.88440625 0.00015625 1.5135 -0.85995 1.2454125 -1.70275Zm-0.19763125 3.68806875h-3.1556l2.3373 -2.57086875ZM6.27765 1.466675h3.44388125l1.63333125 5.13683125 -3.6439625 4.00983125H3.36705ZM2.12 14.53333125 2.95136875 11.92H13.0478125l0.8321875 2.61333125Z");
    path.setAttribute("stroke-width", "0.0625");
    svg.appendChild(path);

    const textDiv = document.createElement("div");
    textDiv.id = "plugin-beats-text";
    textDiv.classList.add("explorer-plugin-pill-text");
    textDiv.innerText = "Beats";

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("explorer-plugin-pill-close")
    closeBtn.innerText = "×";

    closeBtn.addEventListener("click", () => {
        beats = null
        container.removeChild(pluginDiv);
        beatsRegions.regions.forEach(region => {
            region.remove()
        })
        beatsRegions.destroy()
    });

    pluginDiv.appendChild(svg);
    pluginDiv.appendChild(textDiv);
    pluginDiv.appendChild(closeBtn)

    container.appendChild(pluginDiv);

    addHoverStyle(pluginDiv, [textDiv, svg])
}


function addBeatMarkers(response = null) {
    if (beats === null && response != null) {
        beats = response.out
        console.log("Setting beats")
    } else if (beats === null && response === null) {
        return
    } else {
        console.log("Using saved beats")
    }

    // remove any old regions and destroy the old plugin
    if (beatsRegions != null) {
        beatsRegions.regions.forEach(region => {
            region.remove()
        })
        beatsRegions.destroy()
    }

    // create the pill for the plugin if it doesn't already exist
    if (document.getElementById("plugin-beats") === null) {
        addBeatPluginPill()
    }

    // register the plugin with the surfer
    beatsRegions = RegionsPlugin.create()
    wavesurfer.registerPlugin(beatsRegions)

    // update beat regions
    beats.forEach(mark => {
        beatsRegions.addRegion({
            start: mark,
            color: beatColour
        })
    })
}


function routeFrontendResponse(actionName) {
    if (actionName === "Pattern Recognition") {
        return addBeatMarkers
    } else {
        throw new Error(`Action ${actionName} unknown`)
    }
}

function addFuncsToSidebarLinks() {
    // for each
    const sidebarLinks = document.querySelectorAll('.explorer-sidebar-labels');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', async function (e) {
            e.preventDefault();
            const action = this.innerText.trim();
            fetch('/trigger_action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({action: action, audio_url: window.audio_url})
            })
                .then(async response => {
                    if (!response.ok) {
                        let responseText = await response.text()
                        throw new Error('Backend response was not ok' + responseText);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Backend response:', data);
                    let funcToCall = routeFrontendResponse(action)
                    let funcResponse = funcToCall(data)
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        });
    });
}


globalThis.createWave = createWave;
window.colourChanged = colourChanged;


document.addEventListener('DOMContentLoaded', () => {
    // sidebar open/close button
    // const toggleBtn = document.getElementById("toggleSidebar");
    // toggleBtn.addEventListener("click", () => toggleSidebar());

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

    // gridlines: watch on resize of container
    const waveformContainer = document.querySelector('.waveform-container');
    const observer = new ResizeObserver(() => {
        addGrid();
    });
    observer.observe(waveformContainer);

    // start with a waveform by default
    if (window.audio_url) {
        createWave(window.audio_url);
    }

    // observe spectrogram labels, change font size
    modifySpectLabels();

    // add backend functionality to siderbar links
    addFuncsToSidebarLinks()

});
