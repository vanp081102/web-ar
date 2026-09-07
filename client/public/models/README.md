# /public/models

Place your product `.glb` files here, e.g. `product-001.glb`.

- Prefer `.glb` (binary, single-file) over `.gltf`.
- MVP target: **under 5 MB, under 50k triangles, textures ≤ 2048×2048**.
- Export with Draco compression when possible — `ModelManager.ts` already
  wires a Draco decoder.

This repo ships Khronos' public-domain **Duck** sample as `product-001.glb`
for local smoke-tests. Replace it with your real product model for production.
