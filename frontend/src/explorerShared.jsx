export function blurContent() {
    // disable all buttons, add blur
    let content = document.getElementById('explorer-content')
    content.classList.add('blurred');
    Array.from(content.getElementsByTagName("button")).forEach(button => {
        button.disabled = true;
    })
}

export function unblurContent(enableButtons = true) {
    // enable all buttons, remove blur
    let content = document.getElementById('explorer-content')
    content.classList.remove('blurred');
    if (enableButtons) {
        Array.from(content.getElementsByTagName("button")).forEach(button => {
            button.disabled = false;
        })
    }
}

export function componentToHex(c) {
    let hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

export function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)
    } : null;
}

export function generateCmap(r, g, b) {
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

export function createPopup(popupClass = "info-popup") {
    const infoPopup = document.createElement('div');
    infoPopup.classList.add(popupClass);
    infoPopup.id = `.${popupClass}`
    return infoPopup
}

export function createSpinner() {
    const spinner = document.createElement('div');
    spinner.classList.add('popup-spinner');
    spinner.id = ".popup-spinner"
    return spinner
}

export function finalisePopup(popup, allowClose = true) {
    if (allowClose) {
        const closeBtn = document.createElement("button");
        closeBtn.innerText = "×";
        closeBtn.className = "close-button"
        closeBtn.addEventListener("click", () => {
            closePopup(popup.id)
        });
        popup.appendChild(closeBtn)
    }

    document.body.appendChild(popup);

    popup.style.display = 'block';
    document.getElementById('explorer-overlay').style.display = 'block';

    // disable all buttons, add blur
    blurContent()
}


export function closePopup(popupID, unblur = true) {
    const popup = document.querySelector(popupID);
    if (popup) {
        popup.style.display = 'none';
        document.body.removeChild(popup);
    }
    document.getElementById('explorer-overlay').style.display = 'none';

    // unblur content, enable buttons
    if (unblur) {
        unblurContent()
    }

}
