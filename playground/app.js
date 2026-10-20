import { createSingularity, DEFAULTS, normalizeOptions, hexToRgb } from "../singularity.js";

const CDN = "https://appkade.github.io/singularity/singularity.js";

const PRESETS = {
  Emerald: {},
  Solar: { primary: "#ff9a3c", secondary: "#8c3a12" },
  Nebula: { primary: "#b06bff", secondary: "#4a2a8c" },
  Ice: { primary: "#5cc8ff", secondary: "#2a5f8c" },
  Mono: { primary: "#e8eef0", secondary: "#6b777c" },
};

const CONTROLS = [
  { group: "Shape" },
  { key: "size", label: "Size", min: 40, max: 400, step: 1, unit: "px" },
  { key: "rotation", label: "Rotation", min: -180, max: 180, step: 1, unit: "°" },
  { key: "x", label: "Horizontal position", min: 0, max: 1, step: 0.01 },
  { key: "y", label: "Vertical position", min: 0, max: 1, step: 0.01 },
  { group: "Motion" },
  { key: "speed", label: "Speed", min: 0, max: 3, step: 0.05 },
  { key: "turbulence", label: "Turbulence", min: 0, max: 2, step: 0.05 },
  { group: "Look" },
  { key: "brightness", label: "Brightness", min: 0.2, max: 2.5, step: 0.05 },
  { key: "primary", label: "Primary colour", type: "color" },
  { key: "secondary", label: "Secondary colour", type: "color" },
  { key: "fade", label: "Edge fade", min: 0, max: 1, step: 0.05 },
  { key: "quality", label: "Render quality", min: 0.25, max: 1.5, step: 0.05 },
];

// Options that the code snippets always spell out; the rest appear only when changed.
const VISUAL = ["size", "x", "y", "rotation", "speed", "turbulence", "brightness", "primary", "secondary", "fade"];

const canvas = document.getElementById("preview");
const form = document.getElementById("controls");
const snippet = document.querySelector("#snippet code");
const copyButton = document.getElementById("copy");
const shared = readHash();
// Without a size in the link, fit the default to the preview on small screens.
let settings = normalizeOptions({ size: Math.round(Math.min(DEFAULTS.size, canvas.clientWidth * 0.27)), ...shared });
let format = "html";
let source = "";
let effect;

try {
  effect = createSingularity(canvas, settings);
} catch {
  document.getElementById("fallback").hidden = false;
}

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const options = {};
  for (const [key, value] of params) {
    if (!Object.hasOwn(DEFAULTS, key)) continue;
    if (typeof DEFAULTS[key] === "number") options[key] = Number(value);
    else if (typeof DEFAULTS[key] === "boolean") {
      if (value === "true" || value === "false") options[key] = value === "true";
    } else {
      const color = value.startsWith("#") ? value : `#${value}`;
      try { hexToRgb(color); options[key] = color; } catch { /* Ignore malformed shared colours. */ }
    }
  }
  return options;
}

function writeHash() {
  const params = new URLSearchParams();
  for (const key of [...VISUAL, "quality"])
    if (settings[key] !== DEFAULTS[key]) params.set(key, String(settings[key]).replace(/^#/, ""));
  history.replaceState(null, "", params.size ? `#${params}` : location.pathname);
}

function format3(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function optionsLiteral(indent) {
  const keys = [...VISUAL, ...(settings.quality !== DEFAULTS.quality ? ["quality"] : [])];
  const lines = keys.map((key) => {
    const value = settings[key];
    return `${indent}  ${key}: ${typeof value === "number" ? format3(value) : JSON.stringify(value)},`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
}

const SNIPPETS = {
  html: {
    label: "HTML",
    code: () => `<canvas id="singularity" style="width: 100%; height: 480px"></canvas>

<script type="module">
  // Shader adapted from "Singularity" by XorDev, CC BY-NC-SA 3.0 (non-commercial use only).
  import { createSingularity } from "${CDN}";

  createSingularity(document.getElementById("singularity"), ${optionsLiteral("  ")});
</script>`,
  },
  react: {
    label: "React",
    code: () => `// Save singularity.js next to this file (download it from the playground).
// Shader adapted from "Singularity" by XorDev, CC BY-NC-SA 3.0 (non-commercial use only).
import { useEffect, useRef } from "react";
import { createSingularity } from "./singularity.js";

const OPTIONS = ${optionsLiteral("")};

export function Singularity({ style, ...props }) {
  const canvas = useRef(null);

  useEffect(() => {
    const effect = createSingularity(canvas.current, OPTIONS);
    return () => effect.destroy();
  }, []);

  return <canvas ref={canvas} style={{ width: "100%", height: 480, ...style }} {...props} />;
}`,
  },
  standalone: {
    label: "Self-contained",
    code: () => `<canvas id="singularity" style="width: 100%; height: 480px"></canvas>

<script type="module">
${(source || "// Loading singularity.js…").trim()}

createSingularity(document.getElementById("singularity"), ${optionsLiteral("")});
</script>`,
  },
  agent: {
    label: "Agent prompt",
    copy: "Copy prompt",
    code: () => `Add an animated WebGL black hole background ("Singularity") to this project.

Source: ${CDN}
Docs: https://github.com/AppKade/singularity
It is a single, dependency-free ES module that exports createSingularity(canvas, options), which returns { set, pause, play, destroy }.

Do this:
1. Put it behind the hero (top section) of the main landing page unless I say otherwise, and tell me which file you chose.
2. Download singularity.js into the project's source (for example src/lib/singularity.js, or wherever this stack keeps client utilities) instead of hot-linking it. Keep its license header intact.
3. Add a <canvas> absolutely positioned behind the section's content: position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; and a z-index below the content. Size it with CSS only; the module sizes its drawing buffer itself. The canvas is transparent, so the section's background shows through.
4. Start it once the canvas is mounted, with exactly these options:
${optionsLiteral("")}
   - React or Next.js: a client component ("use client") with useRef and useEffect; call destroy() in the effect cleanup.
   - Vue, Svelte, Astro or plain HTML: start it on mount and call destroy() on unmount where the framework has one.
   - Never run it during server-side rendering; it needs window and WebGL.
5. createSingularity throws when WebGL is unavailable. Wrap it in try/catch and keep the section's existing background as the fallback.
6. Keep the text over it readable (preserve the current contrast; add a subtle gradient scrim only if needed) and make sure the layout doesn't shift.
7. Keep the attribution: the shader is adapted from "Singularity" by XorDev (https://www.shadertoy.com/view/3csSWB), and singularity.js is licensed CC BY-NC-SA 3.0, which does not allow commercial use. If this project looks commercial, stop and ask me before adding it.
8. Don't add any npm dependencies. Afterwards, run the project's lint, type-check and build, and tell me the results.`,
  },
};

function renderSnippet() {
  snippet.textContent = SNIPPETS[format].code();
  snippet.parentElement.classList.toggle("prose", format === "agent");
  copyButton.textContent = SNIPPETS[format].copy ?? "Copy code";
}

function buildTabs() {
  const tabs = document.getElementById("tabs");
  for (const [id, { label }] of Object.entries(SNIPPETS)) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.role = "tab";
    tab.textContent = label;
    tab.setAttribute("aria-selected", String(id === format));
    tab.addEventListener("click", () => {
      format = id;
      for (const other of tabs.children) other.setAttribute("aria-selected", String(other === tab));
      renderSnippet();
    });
    tabs.append(tab);
  }
}

function buildControls() {
  let group;
  for (const control of CONTROLS) {
    if (control.group) {
      group = document.createElement("fieldset");
      group.innerHTML = `<legend>${control.group}</legend>`;
      form.append(group);
      continue;
    }
    const id = `opt-${control.key}`;
    const row = document.createElement("div");
    row.className = control.type === "color" ? "field color" : "field";
    if (control.type === "color") {
      row.innerHTML = `<label for="${id}">${control.label}</label><input id="${id}" name="${control.key}" type="color" />`;
    } else {
      row.innerHTML = `<label for="${id}">${control.label}<output for="${id}"></output></label><input id="${id}" name="${control.key}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" />`;
    }
    group.append(row);
  }
  form.addEventListener("input", (event) => {
    const input = event.target;
    const value = input.type === "range" ? Number(input.value) : input.value;
    update({ [input.name]: value }, false);
  });
}

function syncControls() {
  for (const control of CONTROLS) {
    if (!control.key) continue;
    const input = form.elements[control.key];
    input.value = settings[control.key];
    const output = input.parentElement.querySelector("output");
    if (output) output.textContent = `${format3(settings[control.key])}${control.unit ?? ""}`;
  }
}

function buildPresets() {
  const list = document.getElementById("presets");
  for (const [name, preset] of Object.entries(PRESETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    const colors = { ...DEFAULTS, ...preset };
    button.style.setProperty("--swatch", `radial-gradient(circle at 50% 50%, #000 34%, ${colors.primary} 40%, ${colors.secondary} 66%, transparent 72%)`);
    button.innerHTML = `<span class="swatch" aria-hidden="true"></span>${name}`;
    button.addEventListener("click", () => update({ ...pick(DEFAULTS, ["primary", "secondary"]), ...preset }));
    list.append(button);
  }
}

function pick(object, keys) {
  return Object.fromEntries(keys.map((key) => [key, object[key]]));
}

function update(next, refreshControls = true) {
  settings = normalizeOptions({ ...settings, ...next });
  effect?.set(settings);
  if (refreshControls) syncControls();
  else {
    const [key] = Object.keys(next);
    const control = CONTROLS.find((c) => c.key === key);
    const output = form.elements[key]?.parentElement.querySelector("output");
    if (output) output.textContent = `${format3(settings[key])}${control.unit ?? ""}`;
  }
  writeHash();
  renderSnippet();
}

const toast = Object.assign(document.createElement("div"), { className: "glass toast", role: "status" });
document.body.append(toast);
let toastTimer;
function notify(message) {
  // An open modal sits in the top layer, so the toast has to live inside it.
  const host = document.getElementById("code").open ? document.getElementById("code") : document.body;
  if (toast.parentElement !== host) host.append(toast);
  toast.textContent = message;
  toast.dataset.visible = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => delete toast.dataset.visible, 1800);
}

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    notify(done);
    return true;
  } catch {
    notify("Copy failed: select the text and press Ctrl+C");
    return false;
  }
}

copyButton.addEventListener("click", async () => {
  if (!(await copy(snippet.textContent, format === "agent" ? "Prompt copied" : "Code copied"))) getSelection().selectAllChildren(snippet);
});
document.getElementById("share").addEventListener("click", () => copy(location.href, "Link to these settings copied"));
document.getElementById("reset").addEventListener("click", () => update({ ...DEFAULTS }));
document.getElementById("toggle").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const paused = button.dataset.paused === "true";
  paused ? effect?.play() : effect?.pause();
  button.dataset.paused = String(!paused);
  button.setAttribute("aria-label", paused ? "Pause animation" : "Play animation");
});

// Code lives in a modal so the canvas view never scrolls.
const dialog = document.getElementById("code");
document.getElementById("open-code").addEventListener("click", () => dialog.showModal());
document.getElementById("close-code").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

// The settings panel starts closed on small screens, where it covers the view.
const panel = document.getElementById("panel");
const panelToggle = document.getElementById("toggle-panel");
function showPanel(visible) {
  panel.toggleAttribute("data-hidden", !visible);
  panel.inert = !visible;
  panelToggle.setAttribute("aria-expanded", String(visible));
}
panelToggle.addEventListener("click", () => showPanel(panel.hasAttribute("data-hidden")));
showPanel(!matchMedia("(max-width: 760px)").matches);

buildPresets();
buildControls();
buildTabs();
syncControls();
renderSnippet();

fetch(new URL("../singularity.js", import.meta.url))
  .then((response) => response.text())
  .then((text) => {
    source = text;
    renderSnippet();
  })
  .catch(() => {});
