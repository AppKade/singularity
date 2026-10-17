/*!
 * Singularity: an animated WebGL black hole for the web.
 * https://github.com/AppKade/singularity · MIT License · © AppKade
 */

export const DEFAULTS = Object.freeze({
  size: 160, // radius of the event horizon's lensed ring, in CSS pixels
  x: 0.5, // centre of the hole, as a fraction of the canvas width
  y: 0.5, // centre of the hole, as a fraction of the canvas height (from the top)
  tilt: 0.28, // disc inclination: 0 is edge-on, 1 is face-on
  rotation: -12, // disc rotation in degrees
  speed: 1, // swirl speed multiplier; 0 freezes the motion
  turbulence: 1, // how stormy the accretion disc looks
  brightness: 1, // overall exposure
  core: "#eafff3", // hottest, innermost colour
  disc: "#35d48e", // main disc colour
  outer: "#0b4f43", // cool outer edge colour
  quality: 0.75, // render scale relative to device pixels (lower is faster)
  respectReducedMotion: true, // render a still frame for prefers-reduced-motion
});

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform vec2 center;
uniform float radius;
uniform float time;
uniform float tilt;
uniform float rotation;
uniform float turbulence;
uniform float brightness;
uniform vec3 coreColor;
uniform vec3 discColor;
uniform vec3 outerColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    amplitude *= 0.5;
  }
  return value;
}

// Gas orbiting at radius r: inner rings spin faster (roughly Keplerian),
// sampled on a circle so the angle never shows a seam.
float gas(float angle, float r, float seed) {
  float swirl = angle + time * 0.9 / pow(max(r, 0.6), 1.5) + log(r) * 2.2;
  vec2 ring = vec2(cos(swirl), sin(swirl)) * (2.2 + r * 0.6);
  float streaks = fbm(ring * (1.0 + turbulence * 0.8) + vec2(seed, r * 3.0));
  return mix(0.55, 0.25 + streaks * 1.5, clamp(turbulence, 0.0, 2.0) * 0.5);
}

vec3 palette(float heat) {
  vec3 warm = mix(outerColor, discColor, smoothstep(0.0, 0.55, heat));
  return mix(warm, coreColor, smoothstep(0.55, 1.0, heat));
}

void main() {
  vec2 p = (gl_FragCoord.xy - center) / radius;
  float c = cos(rotation), s = sin(rotation);
  p = mat2(c, -s, s, c) * p;
  float r = length(p);
  float t = max(tilt, 0.04);

  // The disc plane, squashed by the viewing angle.
  vec2 d = vec2(p.x, p.y / t);
  float dr = length(d);
  float da = atan(d.y, d.x);
  float band = smoothstep(1.1, 1.5, dr) * (1.0 - smoothstep(1.9, 3.6, dr));
  float heat = clamp(1.05 - (dr - 1.2) / 2.0, 0.0, 1.0);
  // The side rotating towards us is brighter (relativistic beaming).
  float beam = 0.55 + 0.45 * cos(da + 2.4);
  float discLight = band * gas(da, dr, 0.0) * (0.3 + beam) * 0.8;
  vec3 disc = palette(heat) * discLight;

  // Light from behind the hole bends over and under it into a halo.
  float halo = exp(-pow((r - 1.16) / (0.12 + 0.06 * turbulence), 2.0));
  halo *= gas(atan(p.y, p.x), r * 1.4, 7.0) * (0.35 + 0.65 * smoothstep(-0.6, 0.9, p.y));
  vec3 lensed = palette(0.7) * halo * 0.75;

  // A thin photon ring hugs the shadow.
  float ring = exp(-pow((r - 1.025) / 0.018, 2.0)) * 0.55;
  vec3 photon = coreColor * ring;

  float shadow = smoothstep(0.96, 1.02, r);
  // The near half of the disc passes in front of the shadow; the far half hides behind it.
  float front = step(d.y, 0.0);
  vec3 color = (lensed + photon) * shadow + disc * mix(shadow, 1.0, front);
  color += discColor * exp(-r * 0.9) * 0.08 * shadow;

  color = 1.0 - exp(-color * 1.15 * brightness);
  float alpha = clamp(max(max(color.r, color.g), color.b) * 1.15, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
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
    tilt: clamp(o.tilt, 0, 1, DEFAULTS.tilt),
    rotation: clamp(o.rotation, -180, 180, DEFAULTS.rotation),
    speed: clamp(o.speed, 0, 5, DEFAULTS.speed),
    turbulence: clamp(o.turbulence, 0, 2, DEFAULTS.turbulence),
    brightness: clamp(o.brightness, 0.1, 3, DEFAULTS.brightness),
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
  for (const name of ["resolution", "center", "radius", "time", "tilt", "rotation", "turbulence", "brightness", "coreColor", "discColor", "outerColor"])
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
    gl.uniform2f(uniform.resolution, width, height);
    gl.uniform2f(uniform.center, settings.x * width, (1 - settings.y) * height);
    gl.uniform1f(uniform.radius, settings.size * scale);
    gl.uniform1f(uniform.time, elapsed);
    gl.uniform1f(uniform.tilt, settings.tilt);
    gl.uniform1f(uniform.rotation, (settings.rotation * Math.PI) / 180);
    gl.uniform1f(uniform.turbulence, settings.turbulence);
    gl.uniform1f(uniform.brightness, settings.brightness);
    gl.uniform3fv(uniform.coreColor, hexToRgb(settings.core));
    gl.uniform3fv(uniform.discColor, hexToRgb(settings.disc));
    gl.uniform3fv(uniform.outerColor, hexToRgb(settings.outer));
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
