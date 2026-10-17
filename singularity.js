/*!
 * Singularity: an animated WebGL black hole for the web.
 * https://github.com/AppKade/singularity
 * Shader adapted from "Singularity" by XorDev (https://www.shadertoy.com/view/3csSWB).
 * This file is licensed CC BY-NC-SA 3.0: https://creativecommons.org/licenses/by-nc-sa/3.0/
 */

export const DEFAULTS = Object.freeze({
  size: 170, // radius of the bright ring, in CSS pixels
  x: 0.5, // centre, as a fraction of the canvas width
  y: 0.5, // centre, as a fraction of the canvas height (from the top)
  rotation: 0, // rotation of the whole effect, in degrees
  speed: 1, // swirl speed multiplier; 0 freezes the motion
  turbulence: 1, // strength of the swirling waves
  brightness: 1, // overall exposure
  primary: "#38ff8c", // colour of the bright side of the disc
  secondary: "#298c7a", // colour of the dimmer side of the disc
  fade: 1, // soft fade towards the edges: 0 is none, 1 blends into the page
  quality: 0.75, // render scale relative to device pixels (lower is faster)
  respectReducedMotion: true, // render a still frame for prefers-reduced-motion
});

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Adapted from "Singularity" by XorDev (https://www.shadertoy.com/view/3csSWB),
// licensed CC BY-NC-SA 3.0. Changes: WebGL 1 port, parameters for position,
// size, rotation, speed, turbulence and exposure, two-colour tint, edge fade.
const FRAGMENT = `
precision highp float;
uniform vec2 center;
uniform float unit;
uniform float time;
uniform float rotation;
uniform float turbulence;
uniform float brightness;
uniform float fade;
uniform vec3 primary;
uniform vec3 secondary;

void main() {
  float i = 0.2;
  vec2 p = (gl_FragCoord.xy - center) / unit;
  float cr = cos(rotation), sr = sin(rotation);
  p = mat2(cr, -sr, sr, cr) * p;
  vec2 d = vec2(-1.0, 1.0);
  vec2 b = p - i * d;
  // Tilt the disc and bend coordinates around the event horizon.
  vec2 c = p * mat2(1.0, 1.0, d / (0.1 + i / dot(b, b)));
  float a = dot(c, c);
  // Logarithmic spiral coordinates for the swirling accretion flow.
  vec2 v = c * mat2(cos(0.5 * log(a) + time * i + vec4(0.0, 33.0, 11.0, 0.0))) / i;
  vec2 w = vec2(0.0);
  for (int n = 0; n < 8; n++) {
    i += 1.0;
    v += 0.7 * turbulence * sin(v.yx * i + time) / i + 0.5;
    w += 1.0 + sin(v);
  }
  float disc = length(sin(v / 0.3) * 0.4 + c * (3.0 + d));
  vec3 tint = exp(c.x * 0.4) * primary + exp(-c.x * 0.7) * secondary;
  // Mostly shared wave shading, with a little per-channel shimmer, keeps any
  // palette true to its colours.
  vec3 waves = mix(vec3((w.x + w.y) * 0.5), w.xyy, 0.25);
  vec3 color = 1.0 - exp(-tint * brightness
    / waves
    / (2.0 + disc * disc / 4.0 - disc)
    / (0.5 + 1.0 / a)
    / (0.03 + abs(length(p) - 0.7)));
  // Fade the wisps out with distance, measured in ring radii.
  float reach = mix(12.0, 1.3, fade);
  float edge = 1.0 - smoothstep(reach, reach * 2.2, length(p) / 0.7);
  color *= edge;
  gl_FragColor = vec4(color, max(max(color.r, color.g), color.b));
}
`;

/** Parses "#rgb" or "#rrggbb" into linear 0–1 channels. */
export function hexToRgb(hex) {
  let value = String(hex).trim().replace(/^#/, "");
  if (value.length === 3) value = value.replace(/./g, (ch) => ch + ch);
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}

/** Fills in defaults and clamps numbers to safe ranges. */
export function normalizeOptions(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const clamp = (value, min, max, fallback) =>
    Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  return {
    ...o,
    size: clamp(o.size, 10, 2000, DEFAULTS.size),
    x: clamp(o.x, -1, 2, DEFAULTS.x),
    y: clamp(o.y, -1, 2, DEFAULTS.y),
    rotation: clamp(o.rotation, -180, 180, DEFAULTS.rotation),
    speed: clamp(o.speed, 0, 5, DEFAULTS.speed),
    turbulence: clamp(o.turbulence, 0, 2, DEFAULTS.turbulence),
    brightness: clamp(o.brightness, 0.1, 3, DEFAULTS.brightness),
    fade: clamp(o.fade, 0, 1, DEFAULTS.fade),
    quality: clamp(o.quality, 0.25, 2, DEFAULTS.quality),
  };
}

/**
 * Starts a black hole on `canvas`. Size the canvas with CSS; the backing
 * store follows it. Returns controls to update, pause or destroy it.
 */
export function createSingularity(canvas, options = {}) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) throw new Error("Singularity needs WebGL, which this browser has turned off.");

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = {};
  for (const name of ["center", "unit", "time", "rotation", "turbulence", "brightness", "fade", "primary", "secondary"])
    uniform[name] = gl.getUniformLocation(program, name);

  const reduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let settings = normalizeOptions(options);
  let scale = 1;
  let elapsed = 0;
  let previous = 0;
  let frame = 0;
  let playing = true;
  let visible = true;

  function draw() {
    const { width, height } = canvas;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniform.center, settings.x * width, (1 - settings.y) * height);
    // The ring sits at 0.7 shader units from the centre.
    gl.uniform1f(uniform.unit, (settings.size * scale) / 0.7);
    gl.uniform1f(uniform.time, elapsed);
    gl.uniform1f(uniform.rotation, (settings.rotation * Math.PI) / 180);
    gl.uniform1f(uniform.turbulence, settings.turbulence);
    gl.uniform1f(uniform.brightness, settings.brightness);
    gl.uniform1f(uniform.fade, settings.fade);
    gl.uniform3fv(uniform.primary, hexToRgb(settings.primary));
    gl.uniform3fv(uniform.secondary, hexToRgb(settings.secondary));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const still = () => !playing || !visible || document.hidden || (settings.respectReducedMotion && reduced?.matches);
  function tick(now) {
    frame = 0;
    elapsed += previous ? (Math.min(now - previous, 50) / 1000) * settings.speed : 0;
    previous = now;
    draw();
    if (!still()) frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    draw();
    if (!still()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    scale = Math.min(devicePixelRatio || 1, 2) * settings.quality;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    draw();
  }

  const resizer = new ResizeObserver(resize);
  resizer.observe(canvas);
  const watcher = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  watcher.observe(canvas);
  document.addEventListener("visibilitychange", sync);
  reduced?.addEventListener?.("change", sync);
  resize();
  sync();

  return {
    /** Merges new options into the running effect. */
    set(next) {
      const quality = settings.quality;
      settings = normalizeOptions({ ...settings, ...next });
      if (settings.quality !== quality) resize();
      sync();
    },
    get options() {
      return { ...settings };
    },
    play() {
      playing = true;
      sync();
    },
    pause() {
      playing = false;
      sync();
    },
    destroy() {
      cancelAnimationFrame(frame);
      resizer.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced?.removeEventListener?.("change", sync);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
