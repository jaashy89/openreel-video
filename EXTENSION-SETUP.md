# Chrome Extension → OpenReel Editor Bridge

## Goal

When a user clicks "Edit in OpenReel" in the extension, the recorded video blob (stored in IndexedDB) is automatically loaded into the OpenReel editor at `https://clipcut.bitbyte24.com/#/editor` — no download/upload needed.

## Architecture

```
Extension Popup          Background SW         Content Script         Editor Page
     │                       │                      │                     │
     │ chrome.runtime        │                      │                     │
     │ .sendMessage()        │                      │                     │
     │ ──────────────────────>│                      │                     │
     │                       │ chrome.tabs.create() │                     │
     │                       │ ──────────────────────────────────────────>│
     │                       │                      │                     │
     │                       │ wait for tab load    │                     │
     │                       │ (status: complete)   │                     │
     │                       │                      │                     │
     │                       │ get blob from IDB    │                     │
     │                       │                      │                     │
     │                       │ chrome.tabs          │                     │
     │                       │ .sendMessage()       │                     │
     │                       │ ────────────────────>│                     │
     │                       │                      │ window.postMessage()│
     │                       │                      │ ───────────────────>│
     │                       │                      │                     │ useExtensionBridge
     │                       │                      │                     │ hook picks it up
```

## Files to create/modify

### 1. `manifest.json` — add permissions

```json
{
  "manifest_version": 3,
  "permissions": ["tabs"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://clipcut.bitbyte24.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_start"
    }
  ]
}
```

### 2. `background.js` — service worker (NEW FILE)

Handles the tab lifecycle and blob transfer. The popup sends a message here, and this script opens the editor tab, waits for it to load, then forwards the blob.

**Important:** Neither Blobs nor ArrayBuffers survive `chrome.tabs.sendMessage`. Convert to a base64 data URL (plain string) instead.

```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'open-in-editor') {
    (async () => {
      try {
        // 1. Open the editor tab
        const editorTab = await chrome.tabs.create({
          url: 'https://clipcut.bitbyte24.com/#/editor',
        });

        // 2. Wait for the tab to finish loading
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === editorTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(undefined);
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });

        // 3. Get the blob from IndexedDB
        const blob = await getClipBlob(message.itemId);
        if (!blob) {
          console.error('[Background] Clip not found for id:', message.itemId);
          return;
        }

        // 4. Convert blob to base64 data URL (strings survive structured clone)
        const dataUrl = await blobToDataUrl(blob);

        // 5. Send the video to the editor tab via content script
        await chrome.tabs.sendMessage(editorTab.id, {
          type: 'openreel-video',
          dataUrl,
          mimeType: blob.type || 'video/webm',
          name: `Clip - ${message.dateStr}.webm`,
        });

        console.log('[Background] Video sent to editor tab');
      } catch (err) {
        console.error('[Background] Failed:', err);
      }
    })();
  }
});

// Helper: convert Blob to base64 data URL
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
```

### 3. `content-script.js` — injected into editor page (NEW FILE)

Bridges `chrome.runtime.onMessage` (background → content script) to `window.postMessage` (content script → editor page).

**Important:** Convert the base64 data URL back to a Blob before posting to the page.

```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'openreel-video') {
    // Convert data URL back to Blob
    fetch(message.dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        window.postMessage(
          {
            type: 'openreel-video',
            blob,
            name: message.name,
          },
          '*'
        );
      });
  }
});
```

### 4. `popup.js` — modify your existing popup

Replace your current `openEditor` function with this:

```js
const openEditor = async (item) => {
  const dateStr = convertUtcTimestampToReadableDate(
    new Date(item.createdAt).toISOString()
  );

  chrome.runtime.sendMessage({
    type: 'open-in-editor',
    itemId: item.id,
    dateStr,
  });
};
```

## What the editor expects

The editor's `useExtensionBridge` hook listens for:

```ts
window.postMessage({
  type: 'openreel-video',
  blob: Blob,       // The video blob
  name: string,     // Optional filename
}, '*');
```

On receipt it:
1. Creates a new project
2. Imports the video into the media library
3. Adds it to a new timeline track

## Debugging

Open the editor tab's DevTools console. You should see:

```
[ExtensionBridge] Listener ACTIVE — waiting for postMessage...
[ExtensionBridge] postMessage received: openreel-video chrome-extension://...
[ExtensionBridge] Received video: Clip - ....webm video/webm 12345
[ExtensionBridge] Creating project and importing...
[ExtensionBridge] Video imported successfully: Clip - ....webm
```

If you see `Listener ACTIVE` but no `postMessage received`, the content script isn't forwarding the message.
