document.addEventListener('DOMContentLoaded', () => {
  const cb = document.getElementById('ixlEnabled');
  const dbg = document.getElementById('ixlDebug');

  function updateUI(items) {
    cb.checked = items.ixlAutoEnabled !== false;
  }

  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ ixlAutoEnabled: true, ixlDebug: false }, (items) => {
      updateUI(items);
      if (dbg) dbg.checked = !!items.ixlDebug;
    });

    cb.addEventListener('change', () => {
      chrome.storage.sync.set({ ixlAutoEnabled: cb.checked });
    });

    if (dbg) {
      dbg.addEventListener('change', () => {
        chrome.storage.sync.set({ ixlDebug: dbg.checked });
      });
    }
  } else {
    // no chrome storage available (debug), default to checked
    cb.checked = true;
    if (dbg) dbg.checked = false;
    cb.addEventListener('change', () => {});
  }
});
