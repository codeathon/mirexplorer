import "./styles.css";


// show warning for mobile user
function mobileWarning() {
    const isMobileOrTablet = () => {
        return (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
        );
    };

    if (isMobileOrTablet()) {
        const warning = document.getElementById('mobile-warning');
        const container = document.getElementById("dropzone-container")
        console.log(container)
        if (warning) {
            container.classList.add("blurred")
            warning.classList.remove('hidden');
        }
    }
}

function playExitTransition(callback, delay = 500) {
    const page = document.getElementById("dropzone-container");
    if (!page) {
        callback();
        return;
    }

    page.classList.add("dropzone-page-exit");

    setTimeout(() => {
        callback();
    }, delay);
}


function prepareUpload() {
    const selector = document.getElementById("example-selector")
    selector.disabled = true
    selector.classList.add("bg-black/10")

    const confirmPopup = document.getElementById("copyright-warning")
    confirmPopup.classList.remove("hidden");

    const form = document.getElementById("upload-form");
    const continueButton = document.getElementById("copyright-continue-button")

    const closeButton = document.getElementById("copyright-close-button")
    closeButton.addEventListener("click", () => {
        confirmPopup.classList.add("hidden")
        selector.classList.remove("bg-black/10")
        selector.disabled = false
    })

    continueButton.addEventListener("click", () => {
        form.submit()
    })
}


document.addEventListener('DOMContentLoaded', () => {
    mobileWarning()

    // Dropzone form auto-submit
    const dropzone = document.getElementById("dropzone-file");
    const form = document.getElementById("upload-form");

    if (dropzone && form) {
        // Find the closest label
        const label = dropzone.closest("label");
        if (!label) {
            console.error("Dropzone label not found!");
            return;
        }

        // Submit form when file selected via input
        dropzone.addEventListener("change", () => {
            if (dropzone.files.length > 0) {
                prepareUpload()
            }
        });

        // Highlight on dragover
        label.addEventListener("dragover", (e) => {
            e.preventDefault();
            label.classList.add("dragover");
        });

        label.addEventListener("dragleave", (e) => {
            e.preventDefault();
            label.classList.remove("dragover");
        });

        label.addEventListener("drop", (e) => {
            e.preventDefault();
            label.classList.remove("dragover");

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                dropzone.files = files;
                prepareUpload()
            }
        });
    }

    const page = document.getElementById("dropzone-container");
    document.querySelectorAll("a[href]").forEach(link => {
        // Ignore external links & mailto
        if (
            link.target === "_blank" ||
            link.href.startsWith("mailto:")
            // link.href.startsWith("http")
        ) return;

        link.addEventListener("click", e => {
            e.preventDefault();
            const href = link.getAttribute("href");

            page.classList.add("dropzone-page-exit");

            setTimeout(() => {
                window.location.href = href;
            }, 300); // match Tailwind duration
        });
    });
});
