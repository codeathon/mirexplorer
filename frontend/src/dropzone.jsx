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
                form.submit();
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
                form.submit();
            }
        });

        // Submit on file selection
        dropzone.addEventListener("change", () => {
            if (dropzone.files.length > 0) {
                form.submit();
            }
        });
    }
});
