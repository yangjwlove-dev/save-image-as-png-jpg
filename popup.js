const qualityRange = document.getElementById('qualityRange');
const qualityLabel = document.getElementById('qualityLabel');
const saveAsCheck = document.getElementById('saveAsCheck');
const localFile = document.getElementById('localFile');
const pickPng = document.getElementById('pickPng');
const pickJpg = document.getElementById('pickJpg');
const dropBox = document.getElementById('dropBox');
const statusEl = document.getElementById('status');
const countText = document.getElementById('countText');
const lastTitle = document.getElementById('lastTitle');
const lastDesc = document.getElementById('lastDesc');
const lowResTag = document.getElementById('lowResTag');

let targetFormat = 'png';
let settings = { jpgQuality: 0.92, showSaveAsDialog: false, savedCount: 0 };

async function loadState() {
  const res = await chrome.storage.local.get(['saver_settings', 'saver_last_image']);
  settings = { ...settings, ...(res?.saver_settings || {}) };
  const pct = Math.round((settings.jpgQuality || 0.92) * 100);
  qualityRange.value = String(pct);
  qualityLabel.textContent = `${pct}%`;
  saveAsCheck.checked = Boolean(settings.showSaveAsDialog);
  countText.textContent = `${settings.savedCount || 0} images converted locally`;

  const last = res?.saver_last_image;
  if (last && last.lowRes) {
    lastTitle.textContent = `Last saved image is low-res (${last.width}×${last.height})`;
    lastDesc.textContent = `Want a sharp 2K/4K version of ${last.filename}? Right-click it and choose “AI Upscale to 4K”.`;
    lowResTag.textContent = 'Low-Res Detected';
  }
}

async function saveSettings() {
  settings.jpgQuality = Number(qualityRange.value) / 100;
  settings.showSaveAsDialog = saveAsCheck.checked;
  qualityLabel.textContent = `${qualityRange.value}%`;
  await chrome.storage.local.set({ saver_settings: settings });
}

qualityRange.addEventListener('input', () => saveSettings());
saveAsCheck.addEventListener('change', () => saveSettings());

async function convertLocalFile(file, format) {
  if (!file || !file.type.startsWith('image/')) {
    statusEl.textContent = 'Please select a valid image file.';
    return;
  }
  statusEl.textContent = `Converting to ${format.toUpperCase()} locally...`;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const dataUrl = format === 'jpg' ? canvas.toDataURL(mime, settings.jpgQuality) : canvas.toDataURL(mime);
  const base = (file.name || 'image').replace(/\.[^.]+$/, '');
  const a = document.createElement('a');
  a.download = `${base}.${format}`;
  a.href = dataUrl;
  a.click();

  settings.savedCount = (settings.savedCount || 0) + 1;
  await chrome.storage.local.set({ saver_settings: settings });
  countText.textContent = `${settings.savedCount} images converted locally`;
  statusEl.textContent = `Saved ${base}.${format} (${canvas.width}×${canvas.height}).`;
}

pickPng.addEventListener('click', () => {
  targetFormat = 'png';
  localFile.click();
});
pickJpg.addEventListener('click', () => {
  targetFormat = 'jpg';
  localFile.click();
});
localFile.addEventListener('change', () => {
  if (localFile.files?.[0]) convertLocalFile(localFile.files[0], targetFormat);
  localFile.value = '';
});

dropBox.addEventListener('dragover', (e) => e.preventDefault());
dropBox.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files?.[0]) convertLocalFile(e.dataTransfer.files[0], targetFormat);
});

loadState();
