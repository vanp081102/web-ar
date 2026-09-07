# /public/targets

Each product needs **two** files here:

1. `product-001.jpg` / `.png` — the raw reference image (same image printed on the
   package). Used for fallback/preview; not tracked directly.
2. `product-001.mind` — the **compiled** target file MindAR tracks against.
   Generate it with MindAR's browser compiler (no install, free):

   https://hiukim.github.io/mind-ar-js-doc/tools/compile

This repo ships a **demo** target (`product-001.mind` + `product-001.png`) from
MindAR's public card example so you can smoke-test tracking before preparing
your own packaging artwork. Replace both files with your real product assets
for production.
