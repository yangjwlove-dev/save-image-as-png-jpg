# Privacy Policy — Save Image as PNG / JPG + HD Upscaler

This extension is built **privacy-first** and is 100% open-source so every line of code can be audited directly.

## What Runs 100% Locally
- Right-click image conversion (**WebP / AVIF / PNG / JPG → PNG / JPG / WebP**) executes entirely inside your browser via `OffscreenCanvas` and `createImageBitmap`.
- Local drag-and-drop conversion inside the popup never makes any network request.
- Your preferences (JPG quality slider, "Ask where to save" toggle, local conversion counter) are stored strictly in `chrome.storage.local`.

## What Never Happens
- No analytics, telemetry, tracking pixels, or remote scripts.
- No browsing history or background page content collection.
- No third-party ad networks or data brokers.

## Optional AI 4K Upscale Action
- Only when you **explicitly click** `"AI Upscale to 4K"` does the extension temporarily pass that single selected image through `chrome.storage.local` to `https://enhancephoto.org/image-upscaler` and immediately delete the temporary buffer once loaded.
- Full web service privacy policy: [https://enhancephoto.org/privacy-policy](https://enhancephoto.org/privacy-policy)
