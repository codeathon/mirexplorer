function showInfoPopup() {
    // todo: this should be more of a tutorial, with multiple steps
    // we can use a moving div that "unblurs" particular elements to advance to the next stage
    const infoPopup = document.createElement('div');
    infoPopup.classList.add('info-popup');
    infoPopup.id = ".info-popup"
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
    const viewPopup = document.createElement('div');
    viewPopup.classList.add('info-popup');
    viewPopup.id = ".info-popup"

    if (state.currentShown === "wave") {
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

// amplitude: movement of the microphone membrane due to air pressure: capturing the movement of the membrane as the amplitude of the signal that you see here
// time: microphone membrane moves over time and we read the membrane a large number of times every second


document.addEventListener('DOMContentLoaded', () => {
    // about link
    const aboutBtn = document.getElementById("explorer-show-info-popup");
    aboutBtn.onclick = showInfoPopup;

    // waveform/spec
    const viewLabel = document.getElementById("explorer-current-shown-label");
    viewLabel.onclick = showCurrentViewPopup;

    // Immediately show the about button
    aboutBtn.click()
})