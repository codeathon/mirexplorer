import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import {
    hexToRgb,
    rgbToHex,
    generateCmap,
    finalisePopup,
    closePopup,
    createPopup,
    createSpinner, blurContent, unblurContent
} from "./explorerShared";

let sampleRate = 22050;
let gridResolutionSecs = 5
let defaultFMin = 200
let defaultFMax = 8000
let defaultSpectType = "Linear"
let defaultColour = '#979bef'
let defaultHeight = 376

let wavesurfer = null;
let spectsurfer = null;

export {wavesurfer}
export {spectsurfer}

// explorerUI.jsx
let state = {
    currentShown: "wave"
};
export {state};

let hoverColour = defaultColour

let looping = false

let beats = null
let beatColour = "#0000007F"
let beatsRegions = null

let chords = null

let lyrics = null

let timeSignatureContainer = null
let keyContainer = null
let genresContainer = null
let moodsContainer = null
let eraContainer = null
let instrumentsContainer = null

let loopRegion = RegionsPlugin.create()

let maxUserTurns = 4


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
    waveYAxBack.hidden = state.currentShown === "spect";

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
        lineText.innerText = String(currentTime);
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
    if (state.currentShown === "spect") {
        yText = "Frequency (Hz)"
    }

    // title
    let yAxLabel = document.getElementById("explorer-yaxis-text")
    yAxLabel.innerText = yText

    if (state.currentShown === "spect") {
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
    // looping region
    surfer.registerPlugin(loopRegion)
    loopRegion.enableDragSelection({
        content: " ",
        resize: true,
        drag: true,
        loop: true
    })

    loopRegion.on('region-created', (newRegion) => {
        // Remove all other regions
        Object.values(loopRegion.regions).forEach(region => {
            if (region.id !== newRegion.id) {
                region.remove();
            }
        });

        const shadow = document.querySelector('#waveform > div').shadowRoot;
        const regionContent = shadow.querySelector('[part="region-content"]');
        if (regionContent) {
            regionContent.textContent = "Loop"
            regionContent.style.fontFamily = '"TASA Orbiter Display", serif'
            regionContent.style.fontWeight = "400"

            // automatically set looping to true
            looping = false
            handleLoopButton()
        }

    });

    // double click of loop region: remove all regions and turn off looping
    loopRegion.on("region-double-clicked", () => {
        loopRegion.clearRegions()
        looping = true
        handleLoopButton()
    })

    // time functionality
    const timeEl = document.getElementById('waveform-time');
    const waveformContainer = document.querySelector('.waveform-container');

    // hand icons
    let handIcons = document.getElementsByClassName("hand-marker");

    surfer.on('timeupdate', (currentTime) => {
        const duration = surfer.getDuration();
        const containerWidth = waveformContainer.clientWidth;
        let leftPos = (currentTime / duration) * containerWidth;
        leftPos = Math.min(leftPos, containerWidth - timeEl.offsetWidth - 1);

        timeEl.textContent = String(Math.round(currentTime));
        timeEl.style.position = 'absolute';
        timeEl.style.left = `${leftPos}px`;

        // highlight closest beat hand if we have any
        if (handIcons.length > 0) {
            let closestHand = null;
            let minDistance = Infinity;

            const containerRect = waveformContainer.getBoundingClientRect();

            for (let hi of handIcons) {
                const handRect = hi.getBoundingClientRect();
                const handLeft = handRect.left - containerRect.left;
                const distance = leftPos - handLeft;

                const svgPath = hi.querySelector('svg path');
                if (svgPath) svgPath.setAttribute('stroke', 'lightgray');

                if (distance >= 0 && distance < minDistance) {  // only left-side hands
                    minDistance = distance;
                    closestHand = hi;
                }
            }


            if (closestHand) {
                const svgPath = closestHand.querySelector('svg path');
                // update using the hover colour
                if (svgPath) svgPath.setAttribute('stroke', hoverColour);
            }
        }

        if (looping) {
            let looper = loopRegion.regions[0]
            if (currentTime < looper.start || currentTime > looper.end) {
                surfer.seekTo(looper.start / duration)
            }
        }

        if (currentTime >= duration) {
            handlePlayButton()
        }
    });


    // don't know why this needs to be added here
    // but the grid resizing breaks without it
    addGrid()

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
            r: Math.max(currentRgb.r - 50, 0), g: Math.max(currentRgb.g - 50, 0), b: Math.max(currentRgb.b - 50, 0)
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

function getClickPath(filepath) {
    const parts = filepath.split('/');
    const filenameWithExt = parts.pop();
    const [filename, extension] = filenameWithExt.split('.');
    return [...parts, `${filename}_clicks.${extension}`].join('/');
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
        sampleRate: sampleRate,
    });
    await wavesurfer.load(audioFile);
    await finaliseSurfer(wavesurfer)
}

async function createSpect(audioFile, spectFMin = defaultFMin, spectFMax = defaultFMax, spectType = defaultSpectType,) {
    // type coersion
    spectFMin = Number(spectFMin)
    spectFMax = Number(spectFMax)

    console.log("Creating spectrogram: ", spectFMin, typeof (spectFMin), spectFMax, typeof (spectFMax), spectType)

    let currentColour = getCurrentChosenColour()
    let currentProg = getProgressColour(currentColour)

    cleanContainer()
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: currentProg,
        progressColor: currentProg,
        sampleRate: sampleRate,
        height: 0,
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
        state.currentShown = "wave"
        toggleSpectrogramOptions(false)
        await createWave(window.audio_url)
    }
    // create spectrogram otherwise
    else if (textContent === "Spectrogram") {
        state.currentShown = "spect"
        toggleSpectrogramOptions(true)
        await createSpect(window.audio_url)
    }

}

function toggleSpectrogramOptions(show) {
    let spectOpt = document.getElementById("spectrogramOptions")
    let currentShownLabel = document.getElementById("explorer-current-shown-label")

    if (show) {
        spectOpt.classList.remove("hidden")
        currentShownLabel.innerText = "Spectrogram"
        currentShownLabel.style.right = "620px"
    } else {
        spectOpt.classList.add("hidden")
        currentShownLabel.innerText = "Waveform"
        currentShownLabel.style.right = "150px"
    }


    const fMinSlider = document.getElementById("fMin");
    const fMaxSlider = document.getElementById("fMax");
    const fMinLabel = document.getElementById("tooltip-fMin")
    const fMaxLabel = document.getElementById("tooltip-fMax")
    const spectTypeSelect = document.getElementById("spectTypeSelect")

    // set defaults for slider
    fMinSlider.value = Number(defaultFMin)
    fMaxSlider.value = Number(defaultFMax)
    fMinLabel.innerHTML = `${numberWithCommas(defaultFMin)} Hz`
    fMaxLabel.innerHTML = `${numberWithCommas(defaultFMax)} Hz`
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

    const updateSelectDebounced = debounce(updateSelect, 500);

    function updateSliderTooltip(slider, label) {
        label.innerHTML = `${numberWithCommas(slider.value)} Hz`
        // recreate the spectrogram with the new values
        createSpect(window.audio_url, Number(fMinSlider.value), Number(fMaxSlider.value), spectTypeSelect.value)
    }

    const updateSliderTooltipDebounced = debounce(updateSliderTooltip, 500);

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

    // for waveforms, we can update the surfer without having to recreate it
    if (state.currentShown === "wave") {
        let currentProg = getProgressColour(hoverColour)
        wavesurfer.setOptions({
            waveColor: hoverColour, progressColor: currentProg
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

function addPill(pillPath, pillID, pillText) {
    const pluginDiv = document.createElement("div");
    pluginDiv.id = pillID;
    pluginDiv.classList.add("explorer-plugin-pill");

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "#000000");
    svg.setAttribute("height", "16");
    svg.setAttribute("width", "16");
    svg.id = "plugin-icon";

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", pillPath);
    path.setAttribute("stroke-width", "0.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    svg.appendChild(path);
    document.body.appendChild(svg);

    const textDiv = document.createElement("div");
    textDiv.id = "plugin-text";
    textDiv.classList.add("explorer-plugin-pill-text");
    textDiv.innerText = pillText;

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("explorer-plugin-pill-close")
    closeBtn.innerText = "×";

    closeBtn.addEventListener("click", () => {
        pluginDiv.remove()
    });

    pluginDiv.appendChild(svg);
    pluginDiv.appendChild(textDiv);
    pluginDiv.appendChild(closeBtn)

    addHoverStyle(pluginDiv, [textDiv, svg])

    return pluginDiv
}


function addHoverStyle(hoverElement, transformElements = null) {
    if (!transformElements) transformElements = [hoverElement];

    // mouseover handler
    const onOver = () => {
        transformElements.forEach(te => {
            te.style.transition = "color 0.1s ease";
            te.style.color = hoverColour; // dynamic globally scoped
        });
    };

    // mouseout handler
    const onOut = () => {
        transformElements.forEach(te => {
            te.style.color = "";
        });
    };

    hoverElement.addEventListener("mouseover", onOver);
    hoverElement.addEventListener("mouseout", onOut);

    // need to attach references so remove is possible later
    hoverElement.__hoverOnOver = onOver;
    hoverElement.__hoverOnOut = onOut;
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
        x += 10
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
    svg.setAttribute("stroke", "#000000");
    svg.setAttribute("height", "16");
    svg.setAttribute("width", "16");
    svg.id = "plugin-icon";

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "m12.8297625 6.92526875 2.1870375 -2.4059c0.3337625 -0.376225 0.1350875 -0.972675 -0.3576125 -1.0736125 -0.22319375 -0.045725 -0.4540875 0.028125 -0.609325 0.19488125l-1.67825 1.84566875 -1.4046625 -4.41571875c-0.17118125 -0.54333125 -0.67575625 -0.91225 -1.24541875 -0.91058125h-3.44388125c-0.56965625 -0.00166875 -1.07423125 0.36725 -1.2454125 0.91058125L0.8745875 14.13725C0.6065 14.98005 1.23559375 15.84015625 2.12 15.84h11.76c0.88440625 0.00015625 1.5135 -0.85995 1.2454125 -1.70275Zm-0.19763125 3.68806875h-3.1556l2.3373 -2.57086875ZM6.27765 1.466675h3.44388125l1.63333125 5.13683125 -3.6439625 4.00983125H3.36705ZM2.12 14.53333125 2.95136875 11.92H13.0478125l0.8321875 2.61333125Z");
    path.setAttribute("stroke-width", "0.0625");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    svg.appendChild(path);

    const textDiv = document.createElement("div");
    textDiv.id = "plugin-text";
    textDiv.classList.add("explorer-plugin-pill-text");
    textDiv.innerText = "Beats";

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("explorer-plugin-pill-close")
    closeBtn.innerText = "×";

    closeBtn.addEventListener("click", () => {
        removeBeatMarkers()
    });

    pluginDiv.appendChild(svg);
    pluginDiv.appendChild(textDiv);
    pluginDiv.appendChild(closeBtn)

    container.appendChild(pluginDiv);

    addHoverStyle(pluginDiv, [textDiv, svg])
}


function removeBeatHandMarkers() {
    let handIcons = Array.from(document.getElementsByClassName("hand-marker"));
    handIcons.forEach(hi => hi.remove());
}

function removeBeatMarkers() {
    beats = null
    document.getElementById("plugin-beats").remove();
    if (beatsRegions != null) {
        beatsRegions.regions.forEach(region => {
            region.remove()
        })
        beatsRegions.destroy()
    }
    removeBeatHandMarkers()

    // load up original audio, without clicks
    wavesurfer.load(window.audio_url)
    // spectsurfer.load(window.audio_url)
}

function addBeatHandMarkers() {
    removeBeatHandMarkers();

    const container = document.getElementById("waveform-container");
    const containerWidth = container.offsetWidth;
    const duration = wavesurfer.getDuration();

    beats.forEach(mark => {
        const hand = document.createElement("div");
        hand.className = "hand-marker";
        hand.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="#000000" viewBox="0 0 16 16" height="12" width="12">
                <path stroke="lightgray" transform="scale(1, -1) translate(0, -16)" d="M6.75 1a0.75 0.75 0 0 1 0.75 0.75V8a0.5 0.5 0 0 0 1 0V5.467l0.086 -0.004c0.317 -0.012 0.637 -0.008 0.816 0.027 0.134 0.027 0.294 0.096 0.448 0.182 0.077 0.042 0.15 0.147 0.15 0.314V8a0.5 0.5 0 1 0 1 0V6.435l0.106 -0.01c0.316 -0.024 0.584 -0.01 0.708 0.04 0.118 0.046 0.3 0.207 0.486 0.43 0.081 0.096 0.15 0.19 0.2 0.259V8.5a0.5 0.5 0 0 0 1 0v-1h0.342a1 1 0 0 1 0.995 1.1l-0.271 2.715a2.5 2.5 0 0 1 -0.317 0.991l-1.395 2.442a0.5 0.5 0 0 1 -0.434 0.252H6.035a0.5 0.5 0 0 1 -0.416 -0.223l-1.433 -2.15a1.5 1.5 0 0 1 -0.243 -0.666l-0.345 -3.105a0.5 0.5 0 0 1 0.399 -0.546L5 8.11V9a0.5 0.5 0 0 0 1 0V1.75A0.75 0.75 0 0 1 6.75 1M8.5 4.466V1.75a1.75 1.75 0 1 0 -3.5 0v5.34l-1.2 0.24a1.5 1.5 0 0 0 -1.196 1.636l0.345 3.106a2.5 2.5 0 0 0 0.405 1.11l1.433 2.15A1.5 1.5 0 0 0 6.035 16h6.385a1.5 1.5 0 0 0 1.302 -0.756l1.395 -2.441a3.5 3.5 0 0 0 0.444 -1.389l0.271 -2.715a2 2 0 0 0 -1.99 -2.199h-0.581a5 5 0 0 0 -0.195 -0.248c-0.191 -0.229 -0.51 -0.568 -0.88 -0.716 -0.364 -0.146 -0.846 -0.132 -1.158 -0.108l-0.132 0.012a1.26 1.26 0 0 0 -0.56 -0.642 2.6 2.6 0 0 0 -0.738 -0.288c-0.31 -0.062 -0.739 -0.058 -1.05 -0.046zm2.094 2.025" stroke-width="1"></path>
            </svg>
        `;

        const px = (mark / duration) * containerWidth;
        hand.style.position = "absolute";
        hand.style.left = `${px - 5}px`;
        hand.style.top = "-175px";
        hand.style.pointerEvents = "none";
        container.appendChild(hand);
    });
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
            start: mark, color: beatColour, drag: false
        })
    })

    // add hand icons, watch for resize
    const waveformContainer = document.querySelector('.waveform-container');
    const observer = new ResizeObserver(() => {
        addBeatHandMarkers();
    });
    observer.observe(waveformContainer);

    // load up click track
    wavesurfer.load(getClickPath(window.audio_url))
    wavesurfer.on("ready", function () {
        handlePlayButton()
        wavesurfer.stop()
    });
}

export function addGenrePills(response = null) {
    genresContainer = response["out"]

    const container = document.getElementById("plugins-interface");

    response["out"].forEach(piller => {
        let svgID = `plugin-genre-${piller}`;

        // if the pill already exists, skip over creating again
        if (document.getElementById(svgID)) {
            return
        }

        let svgPath = "m20.893 13.393-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 0 1-1.383-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236a1.125 1.125 0 0 0 1.302-.795l.208-.73a1.125 1.125 0 0 0-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 0 1-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 0 1-1.458-1.137l1.411-2.353a2.25 2.25 0 0 0 .286-.76m11.928 9.869A9 9 0 0 0 8.965 3.525m11.928 9.868A9 9 0 1 1 8.965 3.525"
        let pillDiv = addPill(svgPath, svgID, piller)
        container.appendChild(pillDiv)
    })
}

function addMoodPills(response = null) {
    moodsContainer = response["out"]

    const container = document.getElementById("plugins-interface");

    response["out"].forEach(piller => {
        let svgID = `plugin-mood-${piller}`;

        // if the pill already exists, skip over creating again
        if (document.getElementById(svgID)) {
            return
        }

        let svgPath = "M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
        let pillDiv = addPill(svgPath, svgID, piller)
        container.appendChild(pillDiv)
    })
}

function addInstrumentPills(response = null) {
    instrumentsContainer = response["out"]

    const container = document.getElementById("plugins-interface");

    response["out"].forEach(piller => {
        let svgID = `plugin-instrument-${piller}`;

        // if the pill already exists, skip over creating again
        if (document.getElementById(svgID)) {
            return
        }

        let svgPath = "m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
        let pillDiv = addPill(svgPath, svgID, piller)
        container.appendChild(pillDiv)
    })
}

function addKeyPill(response = null) {
    keyContainer = response["out"]

    // skip over creating pill if it exists
    let svgId = "plugin-key"
    if (document.getElementById(svgId)) {
        return
    }

    // create the pill
    let key = "Key: " + response["out"]
    let svgPath = "M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
    let pillDiv = addPill(svgPath, svgId, key)

    // add to the container
    const container = document.getElementById("plugins-interface");
    container.appendChild(pillDiv)
}

function addChordMarkers() {
    // check if we have chords
    if (!chords) {
        return
    }

    // start by removing any existing chord markers
    removeChordMarkers()

    const container = document.getElementById("waveform-container");
    const containerWidth = container.offsetWidth;
    const duration = wavesurfer.getDuration();

    // add label for chords
    const chordLabel = document.createElement("div")
    chordLabel.className = "explorer-chord-label"
    chordLabel.innerText = "Chords"
    container.appendChild(chordLabel)

    let chordCounter = 0

    chords.forEach(chord => {
        let chordName = chord["chord_simple_pop"]
        let chordStart = chord["start"]
        let chordEnd = chord["end"]
        let chordId = `chord-label-${chordCounter}`;

        // skip over creating chords that already exist
        if (document.getElementById(chordId)) {
            return
        }

        let chordDiv = document.createElement("div");
        chordDiv.id = chordId
        chordDiv.className = "explorer-chord-marker"

        // add the chord label
        const pxStart = (chordStart / duration) * containerWidth;
        chordDiv.style.left = `${pxStart}px`;
        chordDiv.innerText = chordName

        container.appendChild(chordDiv);

        // add line connecting chords
        const chordRightPx = chordDiv.offsetLeft + chordDiv.offsetWidth + 5;
        const pxEnd = (chordEnd / duration) * containerWidth;
        const chordLine = document.createElement("div");
        chordLine.className = "explorer-chord-horizontal-line";
        chordLine.style.left = `${chordRightPx}px`;
        chordLine.style.width = `${pxEnd - chordRightPx - 5}px`;

        container.appendChild(chordLine);
        chordCounter++
    })
}

function removeChordMarkers() {
    ["explorer-chord-marker", "explorer-chord-label", "explorer-chord-horizontal-line"].forEach(clsName => {
        let els = document.getElementsByClassName(clsName)
        Array.from(els).forEach(chordMarker => {
            chordMarker.remove()
        })
    })
}

function addChordPills(response = null) {
    // add chord markers and watch resize
    chords = response["out"]

    const observer = new ResizeObserver(() => {
        addChordMarkers()
    });
    observer.observe(document.getElementById("waveform-container"));

    // add a general chord pill
    let svgID = `plugin-chords`;

    // if the pill already exists, skip over creating again
    if (document.getElementById(svgID)) {
        return
    }

    // create the pill
    let svgPath = "m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
    let pillDiv = addPill(svgPath, svgID, "Chords")

    // need to update close function of pill
    let closeBtn = pillDiv.querySelector("button")
    closeBtn.addEventListener("click", () => {
        chords = null
        removeChordMarkers()
    });

    // add to the container
    const container = document.getElementById("plugins-interface");
    container.appendChild(pillDiv)

}

function addLyricMarkers() {
    // check if we have chords
    if (!lyrics) {
        return
    }

    // start by removing any existing chord markers
    removeLyricsMarkers()

    const container = document.getElementById("waveform-container");
    const containerWidth = container.offsetWidth;
    const duration = wavesurfer.getDuration();

    // add label for lyrics
    const lyricsLabel = document.createElement("div")
    lyricsLabel.className = "explorer-lyrics-label"
    lyricsLabel.innerText = "Lyrics"
    container.appendChild(lyricsLabel)

    let wordCounter = 0

    const markers = [];

    lyrics.forEach(word => {
        let wordName = word.word;
        let wordStart = word.start;
        let wordEnd = word.end;

        // skip words near the end of the excerpt
        if (wordEnd > 29) {
            return
        }

        let wordId = `word-label-${wordCounter}`;

        if (document.getElementById(wordId)) return;

        const wordDiv = document.createElement("div");
        wordDiv.id = wordId;
        wordDiv.className = "explorer-lyrics-marker";
        wordDiv.innerText = wordName;

        let x = (wordStart / duration) * containerWidth;

        container.appendChild(wordDiv);
        const width = wordDiv.offsetWidth;

        let collision = true;
        while (collision) {
            collision = false;
            for (const m of markers) {
                const mLeft = m.x;
                const mRight = m.x + m.width;

                if (x < mRight && x + width > mLeft) {
                    x = mRight + 6;
                    collision = true;
                }
            }
        }

        if (x > containerWidth) {
            return
        }

        wordDiv.style.left = `${x}px`;

        markers.push({x, width});
        wordCounter++;
    });

}


function removeLyricsMarkers() {
    ["explorer-lyrics-marker", "explorer-lyrics-label"].forEach(clsName => {
        let els = document.getElementsByClassName(clsName)
        Array.from(els).forEach(lyr => {
            lyr.remove()
        })
    })
}


function addLyricPills(response = null) {
    // add chord markers and watch resize
    lyrics = response["out"]

    const observer = new ResizeObserver(() => {
        if (lyrics) {
            addLyricMarkers()
        }
    });
    observer.observe(document.getElementById("waveform-container"));

    // add a general chord pill
    let svgID = `plugin-lyrics`;

    // if the pill already exists, skip over creating again
    if (document.getElementById(svgID)) {
        return
    }

    // create the pill
    let svgPath = "m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"
    let pillDiv = addPill(svgPath, svgID, "Lyrics")

    // need to update close function of pill
    let closeBtn = pillDiv.querySelector("button")
    closeBtn.addEventListener("click", () => {
        lyrics = null
        removeLyricsMarkers()
    });

    // add to the container
    const container = document.getElementById("plugins-interface");
    container.appendChild(pillDiv)
}

function getChatHistoryFromDOM() {
    const messages = [];
    const items = document.querySelectorAll("#chat-message-container li");

    items.forEach(li => {
        const div = li.firstElementChild;
        if (!div) return;

        if (div.classList.contains("chat-user-message")) {
            messages.push({role: "user", content: div.textContent});
        } else if (div.classList.contains("chat-assistant-message")) {
            messages.push({role: "assistant", content: div.textContent});
        }
    });

    return messages;
}


function sendUserMessage(text) {
    if (!text) return;

    const messageContainer = document.getElementById("chat-message-container");

    // disable send message button
    const userReplyButton = document.getElementById("chat-sendmessage-button")
    userReplyButton.disabled = true
    userReplyButton.style.pointerEvents = 'none';

    // add user message to the chat
    const li = document.createElement("li");
    li.className = "flex justify-end";
    const div = document.createElement("div");
    div.className = "chat-user-message relative";
    div.textContent = text;
    // order we add to the container is important: user message needs to be first, then typing indicator
    li.appendChild(div);
    messageContainer.appendChild(li);

    // show typing indicator for assistant response
    const typingLi = document.createElement("li");
    typingLi.className = "chat-typing-indicator";
    typingLi.id = "typing-indicator";
    const typingDiv = document.createElement("div");
    typingDiv.className = "chat-assistant-message relative";
    typingDiv.innerHTML = `
        <div class="flex gap-[4px] items-center">
            <div class="typing-dot" style="animation-delay: -0.32s;"></div>
            <div class="typing-dot" style="animation-delay: -0.16s;"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    typingLi.appendChild(typingDiv);
    messageContainer.appendChild(typingLi);

    // scroll down
    messageContainer.scrollTop = messageContainer.scrollHeight;

    const chatHistory = getChatHistoryFromDOM()
    const chatDeps = JSON.stringify({
        user_message: text,
        filepath: window.audio_url,
        message_history: chatHistory,
        key: keyContainer,
        time_signature: timeSignatureContainer,
        genres: genresContainer,
        instruments: instrumentsContainer,
        mood: moodsContainer,
        era: eraContainer,
        lyrics: lyrics,
        chords: chords
    })

    // wait for an openAI response here on the frontend
    fetch('/send_message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: chatDeps
    })
        .then(async response => {
            if (response.status === 429) {
                typingLi.remove();
                alert(`You've sent too many messages recently. Please try again later.`);
                return null;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Backend error:", errorText);
                throw new Error(errorText);
            }
            return response.json();
        })
        .then(data => {
            // remove thinking message, enable new message
            typingLi.remove()
            userReplyButton.disabled = false
            userReplyButton.style.pointerEvents = 'auto';

            // add assistant message to chat
            const asstResponse = data.out;
            const li = document.createElement("li");
            li.className = "flex justify-start";
            const div = document.createElement("div");
            div.className = "chat-assistant-message relative";

            // goodbye message has two parts
            if (asstResponse.startsWith("It's been great chatting with you about this recording!")) {
                const [asstResponse2, _] = asstResponse.split("===")
                div.textContent = asstResponse2
            } else {
                div.textContent = asstResponse
            }

            li.appendChild(div);
            messageContainer.appendChild(li);

            const nMessagesRemaining = maxUserTurns - document.getElementsByClassName("chat-user-message").length
            const messageCounter = document.getElementById("chat-message-counter")
            if (nMessagesRemaining === 1) {
                messageCounter.innerText = `${nMessagesRemaining} message left`
            } else {
                messageCounter.innerText = `${nMessagesRemaining} messages left`
            }


            // scroll down
            messageContainer.scrollTop = messageContainer.scrollHeight;

            // disable the reply button and input if the message is a goodbye
            // console.log(asstResponse, asstResponse.startsWith("It's been great chatting with you about this recording!"), asstResponse.startsWith("It's been great chatting with you"))
            if (asstResponse.startsWith("It's been great chatting with you about this recording!")) {
                const [_, copier] = asstResponse.split("===")
                const userReplyInput = document.getElementById("chat-userreply")

                // copy text button for goodbye message
                const copyTextButton = document.createElement("button")
                copyTextButton.innerText = "Copy text"
                copyTextButton.addEventListener("click", () => {
                    copyTextButton.innerText = "Copied!"
                    navigator.clipboard.writeText(copier);
                })

                messageContainer.appendChild(copyTextButton)

                userReplyButton.disabled = true;
                userReplyButton.style.pointerEvents = 'none';
                userReplyInput.disabled = true;
                userReplyInput.placeholder = "Thanks for chatting!"
            }

        })
        .catch(error => {
            console.error('Error:', error);
        })
}

function startChat(response = null) {
    if (document.getElementById("chat-container-123")) {
        return;
    }
    const chatContainer = document.createElement('div');
    chatContainer.className = "chat-container";
    chatContainer.id = "chat-container-123";

    // Header
    const header = document.createElement('div');
    header.className = "chat-header-container";
    const titleWrapper = document.createElement('div');

    titleWrapper.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none"
        viewBox="0 0 24 24" stroke-width="1.5"
        stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round"
            d="M8.625 9.75a.375.375 0 1 1-.75 0
            .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0
            .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0
            .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994
            2.707 3.227 1.087.16 2.185.283 3.293.369V21
            l4.184-4.183a1.14 1.14 0 0 1 .778-.332
            48.294 48.294 0 0 0 5.83-.498
            c1.585-.233 2.708-1.626 2.708-3.228V6.741
            c0-1.602-1.123-2.995-2.707-3.228A48.394
            48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513
            C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
    <div>AI Music Explorer Chat</div>
`;
    const closeBtn = document.createElement("button")
    closeBtn.innerText = "×";
    closeBtn.addEventListener("click", (e) => {
        // e.stopPropagation();
        // e.preventDefault();
        document.getElementById('explorer-overlay').style.display = 'none';
        unblurContent();
        chatContainer.remove();
    });
    titleWrapper.appendChild(closeBtn)

    header.append(titleWrapper);

    // Messages
    const messages = document.createElement('ul');
    messages.className = "chat-message-container";
    messages.id = "chat-message-container"
    messages.innerHTML = `
        <li class="flex justify-start">
            <div class="chat-assistant-message">
                Hi there! You can ask me any questions you might have about your music or recording. What would you like to know?
            </div>
        </li>
    `;

    // Reply
    const inputWrapper = document.createElement('div');
    inputWrapper.className = "chat-reply-container";
    inputWrapper.innerHTML = `
        <div id="chat-message-counter">${maxUserTurns} messages left</div>
        <input type="text" placeholder="Reply" id="chat-userreply"/>
        <button id="chat-sendmessage-button">
            <svg xmlns="http://www.w3.org/2000/svg"
                 fill="currentColor"
                 viewBox="0 0 24 24">
                <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
            </svg>
        </button>
    `;
    chatContainer.append(header, messages, inputWrapper);

    // Blur content
    document.body.appendChild(chatContainer)
    blurContent()

    // add event listeners now
    const replyButton = document.getElementById("chat-sendmessage-button")
    const userReply = document.getElementById("chat-userreply")
    replyButton.addEventListener("click", () => {
        sendUserMessage(userReply.value)
        userReply.value = ""
    });

    return chatContainer;
}

function addTimeSignaturePill(response = null) {
    timeSignatureContainer = response["out"]

    // skip over creating pill if it exists
    let svgId = "plugin-timesignature"
    if (document.getElementById(svgId)) {
        return
    }

    // create the pill
    let key = response["out"]
    let svgPath = "M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 1 1 1.591 1.59l-1.83 1.83h2.16M2.99 15.745h1.125a1.125 1.125 0 0 1 0 2.25H3.74m0-.002h.375a1.125 1.125 0 0 1 0 2.25H2.99"
    let pillDiv = addPill(svgPath, svgId, key)

    // add to the container
    const container = document.getElementById("plugins-interface");
    container.appendChild(pillDiv)
}

function addEraPill(response = null) {
    eraContainer = response["out"]

    // skip over creating pill if it exists
    let svgId = "plugin-era"
    if (document.getElementById(svgId)) {
        return
    }

    // create the pill
    let key = response["out"]
    let svgPath = "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
    let pillDiv = addPill(svgPath, svgId, key)

    // add to the container
    const container = document.getElementById("plugins-interface");
    container.appendChild(pillDiv)
}


function routeFrontendResponse(actionName) {
    if (actionName === "Beat Tracking") {
        return addBeatMarkers
    } else if (actionName === "Genre Identification") {
        return addGenrePills
    } else if (actionName === "Mood Identification") {
        return addMoodPills
    } else if (actionName === "Instrument Identification") {
        return addInstrumentPills
    } else if (actionName === "Key Estimation") {
        return addKeyPill
    } else if (actionName === "Chord Transcription") {
        return addChordPills
    } else if (actionName === "Lyrics Transcription") {
        return addLyricPills
    } else if (actionName === "Chat") {
        return startChat
    } else if (actionName === "Time Signature Detection") {
        return addTimeSignaturePill
    } else if (actionName === "Musical Era Identification") {
        return addEraPill
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

            // blur content and display a spinner while waiting for backend response
            let popup = createPopup()
            popup.innerHTML = `
                <h2>${action}</h2>
            `;
            let spinner = createSpinner()
            popup.appendChild(spinner)
            finalisePopup(popup, false);

            fetch('/trigger_action', {
                method: 'POST', headers: {
                    'Content-Type': 'application/json'
                }, body: JSON.stringify({action: action, audio_url: window.audio_url})
            })
                .then(async response => {
                    if (response.status === 429) {
                        alert(`You've performed too many actions recently. Please try again later.`);
                        return null;
                    }

                    if (!response.ok) {
                        let responseText = await response.text()
                        let responseJSON = JSON.parse(responseText)
                        alert(`Encountered an error in ${action}. Please try again later.\n\nError message: ${responseJSON["error"]}`)
                        throw new Error('Backend response was not ok' + responseText);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Backend response:', data);
                    let funcToCall = routeFrontendResponse(action)
                    funcToCall(data)
                })
                .catch(error => {
                    console.error('Error:', error);
                })
                // we've received the response from the backend or errored (e.g. timed out)
                .finally(() => {
                    // remove the popup and unblur the screen
                    //  keep blur for chat window, however
                    if (action !== "Chat") {
                        closePopup(popup.id, true)
                    } else {
                        closePopup(popup.id, false)
                    }
                });
        });
    });
}

function clearAllPills() {
    [removeBeatMarkers, removeChordMarkers, removeLyricsMarkers].forEach(func => {
        try {
            func()
        } catch {
        }
    })

    const pills = document.querySelectorAll('.explorer-plugin-pill');
    pills.forEach(pill => {
        pill.remove()
    })
}


function manageClearPluginsButton() {
    const clearButton = document.getElementById('clear-plugins-button');

    function updateButtonVisibility() {
        const pills = document.querySelectorAll('.explorer-plugin-pill');
        if (pills.length > 0) {
            clearButton.style.display = 'block';
        } else {
            clearButton.style.display = 'none';
        }
    }

    updateButtonVisibility();

    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                updateButtonVisibility();
            }
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // remove all plugins when added
    clearButton.addEventListener("click", () => {
        clearAllPills()
    })

}

function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}


function updateSidebarTrackMetadata() {
    const parts = window.audio_url.split('/');
    const filenameWithExt = parts.pop();
    const [filename, _] = filenameWithExt.split('.');

    let els = ["track", "artist", "album", "year"]
    let idx = 0
    filename.split('_').slice(1, 5).forEach(el => {
        let elFmt = el.replaceAll("-", " ")
        if (elFmt.length > 50) {
            elFmt = elFmt.slice(0, 50) + "..."
        }

        let elType = els[idx]
        let sidebarElId = `explorer-${els[idx]}-metadata-sidebar`
        let sidebarEl = document.getElementById(sidebarElId)

        if (sidebarEl) {
            sidebarEl.innerText = toTitleCase(`${elType}: `) + elFmt
        }

        idx ++
    })
}


globalThis.createWave = createWave;
window.colourChanged = colourChanged;


document.addEventListener('DOMContentLoaded', () => {
    // sidebar open/close button
    // const toggleBtn = document.getElementById("toggleSidebar");
    // toggleBtn.addEventListener("click", () => toggleSidebar());

    document.querySelectorAll(".explorer-dropdown-button").forEach((btn) => {
        btn.addEventListener("click", () => {
            const parent = btn.closest("li");
            const menu = parent.querySelector(".explorer-sidebar-dropdown");
            const chevron = btn.querySelector(".explorer-dropdown-chevron");

            menu.classList.toggle("open");
            chevron.classList.toggle("rotate-180");
        });
    });

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

    // listen out for key pressers
    document.addEventListener('keydown', function (e) {
        // left key press: scrub back two seconds
        if (e.key === "ArrowLeft") {
            const wasPlaying = wavesurfer.isPlaying();
            wavesurfer.skip(-2);
            wasPlaying && wavesurfer.play();
        }

        // right keypress: scrub forward two seconds
        if (e.key === "ArrowRight") {
            const wasPlaying = wavesurfer.isPlaying();
            wavesurfer.skip(2);
            if (
                wasPlaying &&
                wavesurfer.getCurrentTime() < wavesurfer.getDuration()
            ) {
                wavesurfer.play();
            }
        }

        // enter button: play/pause audio in normal view, send message in chat
        const sendReplyBtn = document.getElementById("chat-sendmessage-button")
        if (e.key === "Enter") {
            if (!sendReplyBtn) {
                playBtn.click()
            } else {
                sendReplyBtn.click()
            }
        }

        // space button: play pause audio in normal view, nothing in chat
        if (e.key === " ") {
            if (!sendReplyBtn) {
                playBtn.click()
            }
        }
    })

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
    const elements__ = document.querySelectorAll('.explorer-sidebar-labels-nointeract');
    elements__.forEach(hoverElement => addHoverStyle(hoverElement));
    const elements_ = document.querySelectorAll('.explorer-sidebar-parent-label');
    elements_.forEach(hoverElement => addHoverStyle(hoverElement));

    // gridlines: watch on resize of container
    const waveformContainer = document.querySelector('.waveform-container');
    const observer = new ResizeObserver(() => {
        addGrid();
    });
    observer.observe(waveformContainer);

    // start with a waveform by default
    if (window.audio_url) {
        updateSidebarTrackMetadata()
        createWave(window.audio_url);
    }

    // observe spectrogram labels, change font size
    modifySpectLabels();

    // add backend functionality to siderbar links
    addFuncsToSidebarLinks()

    // manage clear plugins button: show when plugins added, hide otherwise
    manageClearPluginsButton()
});
