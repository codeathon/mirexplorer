import "./styles.css";

document.addEventListener('DOMContentLoaded', () => {
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
