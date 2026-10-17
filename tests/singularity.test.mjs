import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, hexToRgb, normalizeOptions } from "../singularity.js";

test("hexToRgb reads short and long hex colours", () => {
  assert.deepEqual(hexToRgb("#fff"), [1, 1, 1]);
  assert.deepEqual(hexToRgb("000000"), [0, 0, 0]);
  assert.deepEqual(hexToRgb("#35d48e").map((v) => Math.round(v * 255)), [0x35, 0xd4, 0x8e]);
  assert.throws(() => hexToRgb("teal"), /Invalid colour/);
});

test("normalizeOptions fills defaults and clamps out-of-range values", () => {
  assert.deepEqual(normalizeOptions(), { ...DEFAULTS });
  const o = normalizeOptions({ size: 99999, tilt: -1, speed: "fast", brightness: 0, rotation: 720 });
  assert.equal(o.size, 2000);
  assert.equal(o.tilt, 0);
  assert.equal(o.speed, DEFAULTS.speed, "non-numeric values fall back to the default");
  assert.equal(o.brightness, 0.1);
  assert.equal(o.rotation, 180);
});

test("normalizeOptions keeps colours and unknown flags", () => {
  const o = normalizeOptions({ core: "#abc", respectReducedMotion: false });
  assert.equal(o.core, "#abc");
  assert.equal(o.respectReducedMotion, false);
});
