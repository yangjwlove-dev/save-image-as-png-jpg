const ENHANCEPHOTO_UPSCALER_URL = 'https://enhancephoto.org/image-upscaler';
const PENDING_PREFIX = 'ep_pending_';
const DEFAULT_SETTINGS = { jpgQuality: 0.92, showSaveAsDialog: false, savedCount: 0 };

function msg(key, fallback) {
  return chrome.i18n?.getMessage(key) || fallback;
}

function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-root',
      title: msg('menuRoot', 'Save Image As (PNG / JPG / HD)'),
      contexts: ['image']
    });
    chrome.contextMenus.create({
      id: 'save-png',
      parentId: 'save-root',
      title: msg('menuPng', 'Save as PNG (Lossless)'),
      contexts: ['image']
    });
    chrome.contextMenus.create({
      id: 'save-jpg',
      parentId: 'save-root',
      title: msg('menuJpg', 'Save as JPG'),
      contexts: ['image']
    });
    chrome.contextMenus.create({
      id: 'save-webp',
      parentId: 'save-root',
      title: msg('menuWebp', 'Save as WebP'),
      contexts: ['image']
    });
    chrome.contextMenus.create({
      id: 'save-sep',
      parentId: 'save-root',
      type: 'separator',
      contexts: ['image']
    });
    chrome.contextMenus.create({
      id: 'save-upscale',
      parentId: 'save-root',
      title: msg('menuUpscale', 'AI Upscale to 4K (EnhancePhoto)'),
      contexts: ['image']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupMenus();
});
chrome.runtime.onStartup.addListener(() => {
  setupMenus();
});

async function getSettings() {
  const res = await chrome.storage.local.get('saver_settings');
  return { ...DEFAULT_SETTINGS, ...(res?.saver_settings || {}) };
}

function deriveFilename(srcUrl, ext) {
  let base = 'image';
  try {
    const u = new URL(srcUrl);
    const seg = u.pathname.split('/').pop() || '';
    const cleaned = seg.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 56);
    if (cleaned) base = cleaned;
  } catch {}
  return `${base}.${ext}`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function convertBlob(blob, format, jpgQuality) {
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const mime =
    format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';

  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const outBlob =
    format === 'png'
      ? await canvas.convertToBlob({ type: mime })
      : await canvas.convertToBlob({ type: mime, quality: jpgQuality });

  const buf = await outBlob.arrayBuffer();
  return {
    mime,
    width,
    height,
    size: outBlob.size,
    dataUrl: `data:${mime};base64,${arrayBufferToBase64(buf)}`
  };
}

async function convertAndDownload(srcUrl, format) {
  const settings = await getSettings();
  const resp = await fetch(srcUrl, { credentials: 'omit' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const converted = await convertBlob(blob, format, settings.jpgQuality);
  const filename = deriveFilename(srcUrl, format);

  await chrome.downloads.download({
    url: converted.dataUrl,
    filename,
    saveAs: Boolean(settings.showSaveAsDialog)
  });

  await chrome.storage.local.set({
    saver_settings: { ...settings, savedCount: (settings.savedCount || 0) + 1 },
    saver_last_image: {
      filename,
      width: converted.width,
      height: converted.height,
      format,
      lowRes: Math.min(converted.width, converted.height) < 800,
      savedAt: Date.now()
    }
  });
}

async function sendToUpscaler(srcUrl) {
  const resp = await fetch(srcUrl, { credentials: 'omit' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const converted = await convertBlob(blob, 'png', 0.92);
  const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.local.set({
    [`${PENDING_PREFIX}${token}`]: {
      files: [{ name: deriveFilename(srcUrl, 'png'), type: 'image/png', dataUrl: converted.dataUrl }],
      createdAt: Date.now()
    }
  });
  await chrome.tabs.create({
    url: `${ENHANCEPHOTO_UPSCALER_URL}?ep_ext=${encodeURIComponent(token)}&utm_source=save_png_ext&utm_medium=context_menu`
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.srcUrl) return;
  try {
    if (info.menuItemId === 'save-png') await convertAndDownload(info.srcUrl, 'png');
    else if (info.menuItemId === 'save-jpg') await convertAndDownload(info.srcUrl, 'jpg');
    else if (info.menuItemId === 'save-webp') await convertAndDownload(info.srcUrl, 'webp');
    else if (info.menuItemId === 'save-upscale') await sendToUpscaler(info.srcUrl);
  } catch (err) {
    console.warn('Save Image As error:', err);
    if (info.menuItemId === 'save-upscale') {
      await chrome.tabs.create({ url: `${ENHANCEPHOTO_UPSCALER_URL}?utm_source=save_png_ext&utm_medium=fallback` });
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SAVER_SEND_TO_UPSCALER') {
    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    chrome.storage.local
      .set({
        [`${PENDING_PREFIX}${token}`]: {
          files: message.files || [],
          createdAt: Date.now()
        }
      })
      .then(() =>
        chrome.tabs.create({
          url: `${ENHANCEPHOTO_UPSCALER_URL}?ep_ext=${encodeURIComponent(token)}&utm_source=save_png_ext&utm_medium=popup`
        })
      )
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});
