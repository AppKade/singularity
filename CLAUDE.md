# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Singularity is a public, zero-dependency WebGL black hole component plus a static playground deployed to GitHub Pages (https://appkade.github.io/singularity/). `singularity.js` adapts XorDev's "Singularity" shader and is licensed CC BY-NC-SA 3.0 (non-commercial, share-alike, attribution); everything else is MIT. See `LICENSE`.

## Commits and pull requests

- Commit under the human contributor's own git identity (the configured `user.name`/`user.email`). Never commit as Claude.
- Do not add `Co-Authored-By: Claude …`, `Claude-Session: …` or any other AI attribution trailers to commit messages, and none to PR descriptions.
- Target `main` and keep each PR focused.

## Commands

```sh
npm start                          # python3 -m http.server 8080, then open http://localhost:8080
npm test                           # node --test tests/*.test.mjs
node --test tests/singularity.test.mjs
```

There is no build step and no runtime dependency; keep it that way. `.github/workflows/pages.yml` runs `npm test` on PRs and deploys `index.html`, `singularity.js` and `playground/` from `main`.

## Architecture

- **`singularity.js` is the product.** One ES module exporting `createSingularity(canvas, options)`, `DEFAULTS`, `normalizeOptions` and `hexToRgb`. Keep its header and shader comment crediting XorDev with the Shadertoy link and license; the license must travel with every copy, including the playground's snippets. People import it straight from GitHub Pages or paste it whole (the playground's "Self-contained" snippet inlines this file verbatim), so it must stay a single self-sufficient browser module with no imports.
- **Shader.** A WebGL 1 / GLSL ES 1.00 port of XorDev's shader (constant loop bounds, `gl_FragColor`). `unit` is pixels per shader unit and the bright ring sits at 0.7 units, so `unit = size / 0.7`. Colour is `primary`/`secondary` blended across the disc; wave shading is mostly shared across channels so any palette stays true. `fade` multiplies colour by a radial falloff measured in ring radii, and alpha is the brightest channel so the canvas composites over any background.
- **Options flow.** Every option goes through `normalizeOptions`, which clamps ranges. Adding an option means updating `DEFAULTS`, `normalizeOptions`, the uniforms in `draw()`, the README options table, and `CONTROLS`/`VISUAL` in `playground/app.js` (which drive the sliders, URL hash and generated snippets).
- **Lifecycle.** The controller pauses for hidden tabs, off-screen canvases and `prefers-reduced-motion`, sizes the backing store from CSS size × device pixels × `quality`, and `destroy()` disconnects observers and loses the context.
- **Playground.** `index.html` + `playground/app.js` + `playground/style.css`, plain DOM. Settings live in the URL hash (only non-default values) so links are shareable. The HTML snippet imports from the Pages URL.
