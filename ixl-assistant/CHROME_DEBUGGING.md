# Chrome DevTools Debugging Guide

## Inspecting the Popup

1. Right-click the extension icon in the toolbar
2. Select "Inspect popup"
3. The DevTools will open with the popup's HTML/CSS/JS

## Inspecting the Background Service Worker

1. Go to `chrome://extensions`
2. Find "IXL Assistant"
3. Click "Inspect views" → "service_worker"

## Inspecting Content Scripts

1. Go to the webpage where the content script runs (ixl.com, chat.openai.com, etc.)
2. Open DevTools (F12)
3. Check the Console for any errors or messages
4. Content scripts appear under the "Sources" tab

## Debugging Tips

### Logging from Service Worker
```javascript
console.log('Service Worker message');
// View in chrome://extensions → Inspect views → service_worker
```

### Logging from Content Script
```javascript
console.log('Content script message');
// View in webpage DevTools
```

### Communication Between Scripts
Use `chrome.runtime.sendMessage()` to send messages between:
- Popup ↔ Service Worker
- Content Script ↔ Service Worker
- Popup ↔ Content Script (through Service Worker)

Example:
```javascript
// Send message
chrome.runtime.sendMessage({ action: 'test' }, (response) => {
  console.log('Response:', response);
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'test') {
    sendResponse({ status: 'success' });
  }
});
```

### Storage Debugging
```javascript
// View stored data
chrome.storage.local.get(null, (data) => {
  console.log('Storage:', data);
});

// Set data
chrome.storage.local.set({ key: 'value' });

// Clear data
chrome.storage.local.clear();
```

## Performance Profiling

1. Open DevTools
2. Go to "Performance" tab
3. Click record
4. Interact with the extension
5. Click stop to see the timeline

## Extension Errors

Check `chrome://extensions` and look for:
- Red error messages under the extension name
- Runtime errors in the service worker logs
- Permission errors in the DevTools console
