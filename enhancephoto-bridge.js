(() => {
  const PENDING_PREFIX = 'ep_pending_';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('ep_ext');
  if (!token) return;

  const storageKey = `${PENDING_PREFIX}${token}`;

  function dataUrlToFile(item) {
    const [header, b64] = item.dataUrl.split(',');
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mime = item.type || (mimeMatch ? mimeMatch[1] : 'image/png');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], item.name || 'photo.png', { type: mime });
  }

  async function run() {
    const data = await chrome.storage.local.get(storageKey);
    const payload = data?.[storageKey];
    if (!payload?.files?.length) return;
    await chrome.storage.local.remove(storageKey);

    try {
      params.delete('ep_ext');
      const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', clean);
    } catch {}

    const started = Date.now();
    const timer = setInterval(() => {
      const input =
        document.querySelector('[data-testid="photo-workspace-file-input"]') ||
        document.querySelector('input[type="file"][accept*="image"]');
      if (input && !input.disabled) {
        clearInterval(timer);
        const dt = new DataTransfer();
        for (const f of payload.files) dt.items.add(dataUrlToFile(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (Date.now() - started > 15000) {
        clearInterval(timer);
      }
    }, 300);
  }

  run().catch(() => {});
})();
