import {finalisePopup, createPopup, closePopup, unblurContent, blurContent} from "./explorerShared.jsx";
import {addGenrePills} from "./explorerUI.jsx";

function getState() {
    let currentShown = document.getElementById("explorer-current-shown-label").textContent
    if (String(currentShown.toLowerCase()).includes("wave")) {
        return "wave"
    } else {
        return "spect"
    }
}


function showInfoPopup() {
    const infoPopup = createPopup()
    const tutorialPages = [{
        title: "AI Music Explorer", content: `
            <p>Welcome to the <strong>AI Music Explorer!</strong></p>
            <p>You can use this application to <em>learn more about music</em> using AI.</p>
            <p><strong>Press the arrow button below.</strong></p>
        `
    }, {
        title: "Look at your Recording", content: `
            <p>The graph you are currently looking at <strong>shows your recording</strong>.</p>
            <p>Can you recognise any parts of it?</p>
        `, flasher: "waveform",
    }, {
        title: "Look at your Recording", content: `
            <p>This type of graph is called a <strong>Waveform</strong>.</p>
            <p>If you want to learn more about what a <strong>Waveform</strong> is, you can click this button.</p>
        `, flasher: "explorer-current-shown-label",
    }, {
        title: "Look at your Recording", content: `
            <p>You can also learn more about what the different graph labels mean by <strong>clicking on them</strong>.</p>
        `, flasher: "explorer-yaxis-text",
    }, {
        title: "Changing the View", content: `
            <p>Click the <strong>View As</strong> button to try out <em>different ways</em> of viewing your recording.</p>
            <p>You can always go back to the <strong>Waveform</strong> later.</p>
        `, flasher: "viewAsBtn"
    }, {
        title: "Changing the View", content: `
            <p>You can also change the <strong>colour</strong> of the waveform by clicking on this button.</p>
        `, flasher: "colour-picker-container",
    }, {
        title: "Listen to your Recording", content: `
            <p>These controls allow you to <strong>listen to your recording</strong>.</p>
        `, flasher: "explorer-play-pause-container",
    }, {
        title: "Listen to your Recording", content: `
            <p>Click this button to <strong>Play</strong> and <strong>Pause</strong> your recording.</p>
        `, flasher: "explorer-play-icon",
    }, {
        title: "Rewind your Recording", content: `
            <p>Click this button to <strong>Rewind</strong> your recording back to the start.</p>
        `, flasher: "explorer-rewind-icon",
    }, {
        title: "Loop your Recording", content: `
            <p>Click this button to <strong>Loop</strong> sections of your recording.</p>
        `, flasher: "explorer-loop-icon",
    }, {
        title: "Loop your Recording", content: `
            <p>To control which sections get looped, <strong>click and drag on the waveform</strong>.</p>
            <p><strong>Double click</strong> on the loop to remove it.</p>
        `, flasher: "waveform",
    }, {
        title: "Analysing your Audio", content: `
            <p>You can use any of these buttons to <strong>analyse</strong> your audio with <strong>AI</strong>.</p>
            <p>For instance, <strong>Classification</strong> uses AI to <em>sort your audio</em> into different groups, like musical <strong>genres</strong>.</p>
        `, flasher: "sidebar-analyser"
    }, {
        title: "Analysing your Audio", content: `
            <p>Once you've run some analysis, the results will be shown as <strong>icons</strong>.</p>
            <p>You can click each <strong>icon</strong> to learn more about the results.</p>
        `, flasher: "plugin-genre-Rock", func: addGenrePills, args: {"out": ["Rock"]}
    }, {
        title: "Analysing your Audio", content: `
            <p>To clear all the <strong>icons</strong> from the screen, click <strong>'Clear Plugins'</strong>.</p>
        `, flasher: "clear-plugins-button", func: addGenrePills, args: {"out": ["Rock"]}
    }, {
        title: "Done!", content: `
            <p>That's the end of the tutorial! Click the <strong>×</strong> button to close.</p>
            <p>To go through the tutorial again, click <strong>'Help'</strong>. Or, to analyse a different recording, click <strong>'Exit'</strong>.</p>
        `, flasher: "sidebar-help"
    }];

    let modifyElements = []
    tutorialPages.forEach(elm => {
        if (elm.flasher) {
            modifyElements.push(elm.flasher)
        }
    })

    let currentPage = 0

    function renderPage() {
        const pluginClosers = document.getElementsByClassName("explorer-plugin-pill-close")
        if (pluginClosers) {
            Array.from(pluginClosers).forEach(btn => {
                btn.click()
            })
        }

        const page = tutorialPages[currentPage];

        // in case we need to run some funcs for this tutorial page
        if (page.func) {
            page.func(page.args)
        }

        infoPopup.innerHTML = `
        <h2>${page.title}</h2>
        ${page.content}
    `;

        if (currentPage !== 0) {
            infoPopup.className = "tutorial-popup"
            infoPopup.id = "tutorial-popup"
        } else {
            infoPopup.className = "info-popup"
            Array.from(modifyElements).forEach(elm => {
                let elmer = document.getElementById(elm)
                if (elmer) {
                    elmer.classList.remove("flasher-style", 'animate-border-flash')
                }
            })
        }

        if (page.flasher) {
            const flasher = document.getElementById(page.flasher);
            flasher.classList.add('flasher-style', 'animate-border-flash');
            Array.from(modifyElements).forEach(elm => {
                if (elm !== page.flasher) {
                    const el = document.getElementById(elm);
                    if (el) {
                        el.classList.remove('flasher-style', 'animate-border-flash');
                    }
                }
            });
        }

        // Pagination buttons
        const btnContainer = document.createElement("div");
        btnContainer.className = "pagination-buttons";

        if (currentPage > 0) {
            const prevBtn = document.createElement("button");
            prevBtn.innerText = "←";
            prevBtn.className = "prev-page-button";
            prevBtn.onclick = () => {
                currentPage--;
                renderPage();
            };
            btnContainer.appendChild(prevBtn);
        } else {
            btnContainer.appendChild(document.createElement("div"));
        }

        if (currentPage < tutorialPages.length - 1) {
            const nextBtn = document.createElement("button");
            nextBtn.innerText = "→";
            nextBtn.className = "next-page-button";
            nextBtn.onclick = () => {
                currentPage++;
                renderPage();
            };
            btnContainer.appendChild(nextBtn);
        }

        currentPage > 0 ? unblurContent() : blurContent();

        infoPopup.appendChild(btnContainer);

        // Close button
        const closeBtn = document.createElement("button");
        closeBtn.innerText = "×";
        closeBtn.className = "close-button";
        closeBtn.addEventListener("click", () => {
            infoPopup.style.display = 'none';
            document.body.removeChild(infoPopup);
            Array.from(modifyElements).forEach(elm => {
                let elmer = document.getElementById(elm)
                if (elmer) {
                    elmer.classList.remove("flasher-style", 'animate-border-flash')
                }
            })
        });

        infoPopup.appendChild(closeBtn);
    }

    renderPage()
    finalisePopup(infoPopup, false)
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


function showKeyPopup() {
    const keyPill = document.getElementById("plugin-key")
    const keyText = keyPill.innerText.replace("Key: ", "").replace("×", "").replace(/\s+$/, '')

    let keyTextExtra;

    if (keyText.toLowerCase().includes("minor")) {
        keyTextExtra = "<strong>Minor</strong> keys may feel sad or angry. Can you think of any other songs that might be in a <em>minor</em> key?"
    } else {
        keyTextExtra = "<strong>Major</strong> keys may feel happy or upbeat. Can you think of any other songs that might be in a <em>major</em> key?"
    }

    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Key</h2>
    <p>
        Music is often written using a specific group of notes called a <strong>key</strong>.
    </p>
    <p>
        The <strong>key</strong> is like the home base of the music. It tells you which notes sound most natural and which note feels like the main "home" note.
    </p>
    <p>
        AI has determined that the key of <em>the recording you uploaded</em> is <strong>${keyText}.</strong> ${keyTextExtra}
    </p>
    `
    finalisePopup(viewPopup)
}

function showChordsPopup() {
    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Chords</h2>
    <p>
        Many types of music use groups of notes played together called <strong>chords</strong>.
    </p>
    <p>
       A <strong>chord</strong> is made when multiple notes are played at the same time. Chords help give music its sound and feeling.
    </p>
    <p>
        Musicians often play chords in patterns called chord progressions so the music flows smoothly. For example, many pop songs use just a few repeating chords.
    </p>
    <p>
        You can hear chords in almost every style of music, from rock and jazz to pop and classical. When you hear several notes played at the same time, you’re hearing a chord!
    </p>
    `
    finalisePopup(viewPopup)
}


function showLyricsPopup() {
    const lyricsEl = document.getElementsByClassName("explorer-lyrics-marker")
    let lyricsParsed = []
    Array.from(lyricsEl).forEach(lyrics => {
        lyricsParsed.push(lyrics.innerText)
    })
    let lyricsStr = lyricsParsed.join(" ")

    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Lyrics</h2>
    <p>
        Many types of music use <strong>lyrics</strong>, which are the words sung in a song.
    </p>
    <p>
        <strong>Lyrics</strong> help convey the song’s story, emotion, and meaning. They can be written in English or any other language, like Spanish, French, Japanese, or Hindi.
    </p>
    <p>
        AI has determined the lyrics of <em>the recording you uploaded</em> are: <em>${lyricsStr}</em>
    </p>
    `
    finalisePopup(viewPopup)
}

function showGenrePopup(pillId) {
    console.log(pillId)

    const genrePill = document.getElementById(pillId)
    const pillText = genrePill.innerText.replace("Genre: ", "").replace("×", "").replace(/\s+$/, '')

    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Genre</h2>
    <p>
        Music can be divided into many <strong>genres</strong>.
    </p>
    <p>
        <strong>Genres</strong> help convey the mood, instruments, rhythm, and cultural background of the music. They can include styles like pop, rock, jazz, classical, hip-hop, or electronic.
    </p>
    <p>
        AI has determined the <em>genre of the recording you uploaded</em> is: <em>${pillText}</em>. Can you think of any other songs in the same genre?
    </p>
    `
    finalisePopup(viewPopup)
}

function showInstrumentPopup(pillId) {
    const instrumentPill = document.getElementById(pillId)
    const pillText = instrumentPill.innerText.replace("Instrument: ", "").replace("×", "").replace(/\s+$/, '')

    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Instrument</h2>
    <p>
        Songs often feature many different <strong>musical instruments</strong>.
    </p>
    <p>
        <strong>Instruments</strong> help shape the sound, mood, and style of a song. They can include instruments like guitar, piano, drums, violin, saxophone, or synthesizer.
    </p>
    <p>
        AI has determined that <em>the recording you uploaded</em> contains the following instrument: <em>${pillText}</em>. Can you think of any other songs that also use this instrument?
    </p>
    `
    finalisePopup(viewPopup)
}

function showMoodPopup(pillId) {
    const moodPill = document.getElementById(pillId)
    const pillText = moodPill.innerText.replace("Mood: ", "").replace("×", "").replace(/\s+$/, '')

    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Mood</h2>
    <p>
        Songs can convey many different <strong>moods</strong> through their melodies, rhythm, and harmony.
    </p>
    <p>
        <strong>Moods</strong> help listeners feel emotions like happiness, sadness, excitement, calm, or tension. The choice of instruments, tempo, and key all contribute to the mood of a song.
    </p>
    <p>
        AI has determined that <em>the recording you uploaded</em> might evoke the following mood: <em>${pillText}</em>. Can you think of any other songs that evoke a similar mood?
    </p>
    `
    finalisePopup(viewPopup)
}


function showTimeSignaturePopup(pillId) {
    const tsPill = document.getElementById(pillId)
    const pillText = tsPill.innerText.replace("Time Signature: ", "").replace("×", "").replace(/\s+$/, '')

    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Time Signature</h2>
    <p>
        The <strong>time signature</strong> of a piece of music indicates how beats are grouped in each measure.
    </p>
    <p>
        Time signatures like 4/4, 3/4, or 6/8 can make music feel steady, waltz-like, or swinging. The choice of time signature influences how listeners perceive the rhythm of a piece.
    </p>
    <p>
        AI has determined that <em>the recording you uploaded</em> uses the following time signature: <em>${pillText}</em>.
    </p>
    `
    finalisePopup(viewPopup)
}


function showEraPopup(pillId) {
    const tsPill = document.getElementById(pillId)
    const pillText = tsPill.innerText.replace("Era: ", "").replace("×", "").replace(/\s+$/, '')

    const viewPopup = createPopup();
    viewPopup.innerHTML = `
    <h2>Musical Era</h2>
    <p>
        Every song comes from a <strong>musical era</strong>. Different eras use instruments, melodies, and rhythms in unique ways.
    </p>
    <p>
        For example, songs from the 1980s might have lots of synths and dance beats, 1990s pop could be catchy and fun like, and modern music might mix rap, electronic sounds, and cool effects (like Billie Eilish or BTS).
    </p>
    <p>
        AI thinks that <em>the recording you uploaded</em> comes from the <em>${pillText}</em>. Can you think of any other songs from that time that sound similar?
    </p>
    `
    finalisePopup(viewPopup)
}


function handleNewPlugin(pill) {
    if (pill.id === "plugin-beats") {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showBeatsPopup()
        });
    } else if (pill.id === "plugin-key") {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showKeyPopup()
        });
    } else if (pill.id === "plugin-timesignature") {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showTimeSignaturePopup(pill.id)
        });
    } else if (pill.id === "plugin-era") {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showEraPopup(pill.id)
        });
    } else if (pill.id === "plugin-chords") {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showChordsPopup()
        });
    } else if (pill.id === "plugin-lyrics") {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showLyricsPopup()
        });
    } else if (pill.id.includes("-genre-")) {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showGenrePopup(pill.id)
        });
    } else if (pill.id.includes("-instrument-")) {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showInstrumentPopup(pill.id)
        });
    } else if (pill.id.includes("-mood-")) {
        pill.getElementsByTagName("div")[0].addEventListener("click", () => {
            showMoodPopup(pill.id)
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
