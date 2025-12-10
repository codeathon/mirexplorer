import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import {wavesurfer} from './explorerUI.jsx'


let beatColour = "#000000"


function addBeatMarkers(response) {
    let markers = response.out
    const regions = RegionsPlugin.create()
    wavesurfer.registerPlugin(regions)
    markers.forEach(mark => {
        regions.addRegion({
            start: mark,
            color: beatColour
        })
    })
}


function routeFrontendResponse (actionName) {
    if (actionName === "Pattern Recognition") {
        return addBeatMarkers
    }
    else {
        throw new Error(`Action ${actionName} unknown`)
    }
}



document.addEventListener('DOMContentLoaded', () => {
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
});