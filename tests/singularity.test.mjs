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
  const o = normalizeOptions({ size: 99999, fade: -1, speed: "fast", brightness: 0, rotation: 720 });
  assert.equal(o.size, 2000);
  assert.equal(o.fade, 0);
  assert.equal(o.speed, DEFAULTS.speed, "non-numeric values fall back to the default");
  assert.equal(o.brightness, 0.1);
  assert.equal(o.rotation, 180);
});

test("normalizeOptions keeps colours and unknown flags", () => {
  const o = normalizeOptions({ primary: "#abc", respectReducedMotion: false });
  assert.equal(o.primary, "#abc");
  assert.equal(o.respectReducedMotion, false);
});

test('lifecycle freezes speed zero and cannot restart after destruction', async () => {
  const { createSingularity } = await import('../singularity.js');
  const originals = new Map();
  const install = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, {value, configurable:true, writable:true}); };
  const frames = new Map(), events = new Map();
  let sequence = 0, draws = 0, losses = 0, disconnects = 0;
  const gl = new Proxy({}, { get: (_, name) => {
    if (name === 'getShaderParameter') return () => true;
    if (name === 'getExtension') return () => ({loseContext:() => losses++});
    if (name === 'drawArrays') return () => draws++;
    return () => ({});
  }});
  let resizeCallback, intersectCallback;
  install('requestAnimationFrame', fn => { frames.set(++sequence, fn); return sequence; });
  install('cancelAnimationFrame', id => frames.delete(id));
  install('devicePixelRatio', 1);
  install('document', {hidden:false, addEventListener:(name, fn) => events.set(name,fn), removeEventListener:name => events.delete(name)});
  install('matchMedia', () => ({matches:false, addEventListener(){}, removeEventListener(){}}));
  install('ResizeObserver', class { constructor(fn){ resizeCallback=fn; } observe(){} disconnect(){ disconnects++; } });
  install('IntersectionObserver', class { constructor(fn){ intersectCallback=fn; } observe(){} disconnect(){ disconnects++; } });
  try {
    const canvas = {getContext:() => gl, clientWidth:400, clientHeight:300};
    const effect = createSingularity(canvas, {speed:0});
    assert.equal(frames.size, 0, 'frozen effects must not consume animation frames');
    effect.set({speed:1});
    assert.equal(frames.size, 1);
    effect.pause(); assert.equal(frames.size, 0);
    effect.play(); assert.equal(frames.size, 1);
    intersectCallback([{isIntersecting:false}]); assert.equal(frames.size, 0);
    intersectCallback([{isIntersecting:true}]); assert.equal(frames.size, 1);
    const before = effect.options;
    assert.throws(() => effect.set({primary:'invalid'}), /colour/);
    assert.deepEqual(effect.options, before, 'invalid updates must leave the effect usable');
    const queued = [...frames.values()][0];
    effect.destroy();
    const stoppedAt = draws;
    effect.destroy(); effect.play(); effect.pause(); effect.set({quality:1});
    resizeCallback(); intersectCallback([{isIntersecting:true}]); queued(100);
    assert.equal(draws, stoppedAt);
    assert.equal(frames.size, 0);
    assert.equal(losses, 1);
    assert.equal(disconnects, 2);
    assert.equal(events.size, 0);
    assert.throws(() => createSingularity({getContext:() => {throw Error('GPU acquired');}}, {primary:'invalid'}), /colour/);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('shared playground links ignore malformed colors and parse boolean flags', async () => {
  const {readFileSync}=await import('node:fs');
  const {runInNewContext}=await import('node:vm');
  const source=readFileSync(new URL('../playground/app.js',import.meta.url),'utf8');
  const functionSource=source.slice(source.indexOf('function readHash()'),source.indexOf('function writeHash()'));
  const parsed=runInNewContext(functionSource+'; readHash()',{
    DEFAULTS,hexToRgb,URLSearchParams,location:{hash:'#primary=garbage&secondary=abc&respectReducedMotion=false&speed=0&toString=bad'}
  });
  assert.equal(parsed.primary,undefined);
  assert.equal(parsed.secondary,'#abc');
  assert.equal(parsed.respectReducedMotion,false);
  assert.equal(parsed.speed,0);
  assert.equal(Object.hasOwn(parsed,'toString'),false);
});
