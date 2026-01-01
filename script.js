const canvas = document.getElementById("ditherCanvas");
const ctx = canvas.getContext("2d");

const loadBtn = document.getElementById("loadImage");
const fileInput = document.getElementById("fileInput");

/* =========================
   GLOBAL STATE
========================= */

const state = {
    mode: "bayer",
    direction: 1.0,   // 0 = left, 1 = right
    falloff: 1.5,
    strength: 1.8,
    invert: false,
    shiftX: 0,
    shiftY: 0,
    ascii: false,
};

let img = null;

/* =========================
   BAYER MATRIX
========================= */

const bayer4 = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
];

/* =========================
   IMAGE LOADING
========================= */

loadBtn.onclick = () => fileInput.click();

fileInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => loadImage(reader.result);
    reader.readAsDataURL(file);
};

function loadImage(src) {
    img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        loadBtn.style.display = "none";
        canvas.style.display = "block";

        applyDither();
    };
    img.src = src;
}

/* =========================
   UI HOOKS
========================= */

document.querySelectorAll("[data-mode]").forEach(el => {
    el.onclick = () => {
        state.mode = el.dataset.mode;
        applyDither();
    };
});

document.getElementById("invert").onclick = () => {
    state.invert = !state.invert;
    applyDither();
};

document.getElementById("shift").onclick = () => {
    state.shiftX = (state.shiftX + 1) % 4;
    state.shiftY = (state.shiftY + 2) % 4;
    applyDither();
};

document.getElementById("direction").oninput = e => {
    state.direction = parseFloat(e.target.value);
    applyDither();
};

document.getElementById("falloff").oninput = e => {
    state.falloff = parseFloat(e.target.value);
    applyDither();
};

/* ASCII toggle (li text = ASCII) */
document.querySelectorAll(".menu li").forEach(li => {
    if (li.textContent.trim() === "ASCII") {
        li.onclick = () => {
            state.ascii = !state.ascii;
            applyDither();
        };
    }
});

/* =========================
   DITHER HELPERS
========================= */

function thresholdBayer(x, y) {
    const bx = (x + state.shiftX) & 3;
    const by = (y + state.shiftY) & 3;
    return bayer4[by * 4 + bx] / 16;
}

function thresholdRandom() {
    return Math.random();
}

/* =========================
   DITHER CORE
========================= */

function applyDither() {
    if (!img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const a = d[i + 3];
            if (a === 0) continue;

            const lum =
                (0.299 * d[i] +
                 0.587 * d[i + 1] +
                 0.114 * d[i + 2]) / 255;

            const dir = 1 - Math.abs(state.direction - x / canvas.width);
            const fall = Math.pow(dir, state.falloff);

            let threshold = 0;

            switch (state.mode) {
                case "bayer":
                    threshold = thresholdBayer(x, y);
                    break;
                case "random":
                    threshold = thresholdRandom();
                    break;
                case "atkinson":
                case "floyd":
                    threshold = lum;
                    break;
            }

            const ink = state.invert
                ? lum > threshold * fall * state.strength
                : lum < threshold * fall * state.strength;

            d[i] = 0;
            d[i + 1] = 0;
            d[i + 2] = 0;
            d[i + 3] = ink ? 255 : 0;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    if (state.ascii) renderASCII(imgData);
}

/* =========================
   ASCII RENDER
========================= */

function renderASCII(imgData) {
    const chars = " .:-=+*#%@";
    const stepX = 6;
    const stepY = 8;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0c0c0c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#faf9f6";
    // ctx.font = "10px JetBrains Mono";

    for (let y = 0; y < canvas.height; y += stepY) {
        for (let x = 0; x < canvas.width; x += stepX) {
            const i = (y * canvas.width + x) * 4;
            const lum = imgData.data[i] / 255;
            const c = chars[Math.floor(lum * (chars.length - 1))];
            ctx.fillText(c, x, y);
        }
    }
}