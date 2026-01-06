import {finalisePopup, createPopup} from "./explorerShared.jsx";

function getState() {
    let currentShown = document.getElementById("explorer-current-shown-label").textContent
    if (String(currentShown.toLowerCase()).includes("wave")) {
        return "wave"
    } else {
        return "spect"
    }
}


function showInfoPopup() {
    // todo: this should be more of a tutorial, with multiple steps
    // we can use a moving div that "unblurs" particular elements to advance to the next stage
    const infoPopup = createPopup()
    infoPopup.innerHTML = `
                <h2>AI Music Explorer</h2>
                <p>
                    Use the buttons along the sidebar to learn more about your recording.
                </p>
            `;
    finalisePopup(infoPopup)
}

function showCurrentViewPopup() {
    const viewPopup = createPopup()

    if (getState() === "wave") {
        viewPopup.innerHTML = `
    <h2>Waveform</h2>
    <p>
        A waveform shows us the <strong>shape of a sound</strong> as it moves over time.
    </p>
    <p>
        It captures how <em>loud</em> or <em>soft</em> the sound is at each moment and how it changes. 
        The <strong>peaks</strong> are the loud parts, and the <strong>valleys</strong> are the quiet parts.
    </p>
    <p>
        By looking at the waveform on the screen, you can see the sound's <strong>rhythm</strong> and <strong>patterns</strong>, almost like a picture of the music or noise.
    </p>
`;
    } else {
        viewPopup.innerHTML = `
    <h2>Spectrogram</h2>
    <p>
        A spectrogram is like a <strong>picture of sound</strong> that shows how it changes over time.
    </p>
    <p>
        It tells us which <em>pitches</em> (high or low sounds) happen at each moment and how <em>loud</em> they are. 
        Bright colors or tall lines usually mean <strong>louder</strong> sounds, and darker or shorter areas mean <strong>quieter</strong> sounds.
    </p>
    <p>
        By looking at a spectrogram, you can see <strong>patterns</strong> in music, voices, or other noises, almost like reading a <em>map of sound</em>!
    </p>
`;

    }
    finalisePopup(viewPopup)
}

function showYAxisPopup() {
    const viewPopup = createPopup()

    if (getState() === "wave") {
        viewPopup.innerHTML = `
    <h2>Amplitude</h2>
    <p>
        We use a <em>microphone</em> to record sound.
    </p>
    <p>
        Inside a microphone is a thin sheet of metal called a <em>membrane</em>. 
        When sound moves through the air, it makes the membrane move.
    </p>
    <p>
        The size of this movement is called the <strong>amplitude</strong>, and it shows how <strong>loud</strong> the sound is.
        What you see on the screen is the amplitude of the sound the microphone recorded.
    </p>
    `;
    } else {
        viewPopup.innerHTML = `
    <h2>Frequency (Hz)</h2>
    <p>
        <strong>Frequency</strong> helps us measure the <em>pitch</em> of a sound: whether it is high or low.
    </p>
    <p>
        We measure frequency in <em>Hertz</em> (Hz), which counts how many times a sound vibrates in one second. 
        Sounds with a high frequency are <strong>high-pitched</strong> (like a whistle or squeak), and sounds with a low frequency are <strong>low-pitched</strong> (like a drum or explosion).
    </p>
    <p>
        What you see on the screen can show the frequency of the sound the microphone recorded.
    </p>
    `;
    }

    finalisePopup(viewPopup)

}


function showXAxisPopup() {
    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Time</h2>
    <p>
        Audio signals change and evolve <em>over time</em>.
    </p>
    <p>
        We can use a microphone to record these changes as the sound happens.
        The <strong>sampling rate</strong> tells us how many times each second the microphone <em>checks the sound.</em>
    </p>
    <p>
        On the screen, you can see how the sound changes as time moves forward.
    </p>
    `;
    finalisePopup(viewPopup)
}


function showBeatsPopup() {
    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Beats</h2>
    <p>
        Many types of music feature a regular pulse called a <strong>beat</strong>.
    </p>
    <p>
        The <strong>beat</strong> is like the heartbeat of the music. It keeps the rhythm steady so you can tap your foot or clap along.
    </p>
    <p>
        Musicians often count the beats in a measure to make sure everyone plays together. For example, in most pop songs, you will hear four beats in each measure.
    </p>
    <p>
        You can feel the beat in almost every type of music, from rock and jazz to hip hop and classical. Try tapping your hand or foot along with the music—you’re following the beat!
    </p>
    `;
    finalisePopup(viewPopup)
}


function handleNewPlugin(pill) {
    if (pill.id === "plugin-beats") {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showBeatsPopup()
        });
    }
}


// items that are always present
document.addEventListener('DOMContentLoaded', () => {
    // about link
    const aboutBtn = document.getElementById("explorer-show-info-popup");
    aboutBtn.onclick = showInfoPopup;

    // waveform/spec
    const viewLabel = document.getElementById("explorer-current-shown-label");
    viewLabel.onclick = showCurrentViewPopup;

    // amplitude/frequency
    const yAxisLabel = document.getElementById("explorer-yaxis-text")
    yAxisLabel.onclick = showYAxisPopup;

    // time
    const xAxisLabel = document.getElementById("explorer-xaxis-text")
    xAxisLabel.onclick = showXAxisPopup;

    // Immediately show the about button
    aboutBtn.click()
})

// plugin pills that may not be added initially: need to wait for them to appear
const container = document.getElementById('plugins-interface');
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    handleNewPlugin(node);
                }
            });
        }
    }
});
observer.observe(container, {childList: true});
