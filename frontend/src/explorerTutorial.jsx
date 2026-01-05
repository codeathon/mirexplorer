function getState() {
    let currentShown = document.getElementById("explorer-current-shown-label").textContent
    if (String(currentShown.toLowerCase()).includes("wave")) {
        return "wave"
    }
    else {
        return "spect"
    }
}


function createPopup() {
    const infoPopup = document.createElement('div');
    infoPopup.classList.add('info-popup');
    infoPopup.id = ".info-popup"
    return infoPopup
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


function finalisePopup(popup) {
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "×";
    closeBtn.addEventListener("click", () => {
        closePopup(popup.id)
    });

    popup.appendChild(closeBtn)
    document.body.appendChild(popup);

    popup.style.display = 'block';
    document.getElementById('explorer-overlay').style.display = 'block';

    // disable all buttons, add blur
    let content = document.getElementById('explorer-content')
    content.classList.add('blurred');
    Array.from(content.getElementsByTagName("button")).forEach(button => {
        button.disabled = true;
    })
}


function closePopup(popupID) {
    const popup = document.querySelector(popupID);
    if (popup) {
        popup.style.display = 'none';
        document.body.removeChild(popup);
    }
    document.getElementById('explorer-overlay').style.display = 'none';

    // enable all buttons, remove blur
    let content = document.getElementById('explorer-content')
    content.classList.remove('blurred');
    Array.from(content.getElementsByTagName("button")).forEach(button => {
        button.disabled = false;
    })

}


function showCurrentViewPopup() {
    const viewPopup = createPopup()

    if (getState() === "wave") {
        viewPopup.innerHTML = `
        <h2>Waveform</h2>
        <p>
            A waveform does some stuff
        </p>
    `;
    } else {
        viewPopup.innerHTML = `
        <h2>Spectrogram</h2>
        <p>
            A spectrogram does some stuff
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
            The size of this movement is called the <em>amplitude</em>, and it shows how loud the sound is.
            What you see on the screen is the amplitude of the sound the microphone recorded.
        </p>
    `;
    } else {
        viewPopup.innerHTML = `
        <h2>Frequency (Hz)</h2>
        <p>
            Frequency helps us measure the pitch of a sound: whether it is high or low.
        </p>
        <p>
            We measure frequency in <em>Hertz</em> (Hz), which captures the number of terms a sound vibrates in one second.
            Sounds with a high frequency are high-pitched (like a whistle or squeak), and sounds with a low frequency are low-pitched (like a drum or explosion).
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
        The <em>sampling rate</em> tells us how many times each second the microphone checks the sound.
    </p>
    <p>
        On the screen, you can see how the sound changes as time moves forward.
    </p>
    `;
    finalisePopup(viewPopup)
}

// time: microphone membrane moves over time and we read the membrane a large number of times every second


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