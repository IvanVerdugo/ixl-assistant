let ixlTabId = null;
let aiTabId = null;
let aiType = null;
let lastActiveTabId = null;
let processingQuestion = false;
let ixlWindowId = null;
let aiWindowId = null;
let ixlDebug = false;

chrome.tabs.onActivated.addListener((activeInfo) => {
  lastActiveTabId = activeInfo.tabId;
});

function sendMessageWithRetry(tabId, message, maxAttempts = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attemptSend() {
      attempts++;
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            if (ixlDebug) console.warn('IXL background: sendMessage error', chrome.runtime.lastError, 'attempt', attempts, 'message', message);
            if (attempts < maxAttempts) {
              setTimeout(attemptSend, delay);
            } else {
              reject(chrome.runtime.lastError);
            }
          } else {
            if (ixlDebug) console.log('IXL background: sendMessage success', { tabId, message, response });
            resolve(response);
          }
        });
      } catch (err) {
        if (ixlDebug) console.error('IXL background: sendMessage exception', err);
        if (attempts < maxAttempts) {
          setTimeout(attemptSend, delay);
        } else {
          reject(err);
        }
      }
    }

    attemptSend();
  });
}

async function focusTab(tabId) {
  if (!tabId) return false;

  try {
    const tab = await chrome.tabs.get(tabId);

    if (tab.windowId === chrome.windows.WINDOW_ID_CURRENT) {
      await chrome.tabs.update(tabId, { active: true });
      return true;
    }

    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
    return true;
  } catch (error) {
    return false;
  }
}

async function findAndStoreTabs() {
  const ixlTabs = await chrome.tabs.query({ url: "https://www.ixl.com/*" });
  if (ixlTabs.length > 0) {
    ixlTabId = ixlTabs[0].id;
    ixlWindowId = ixlTabs[0].windowId;
  }

  const data = await chrome.storage.sync.get("aiModel");
  const aiModel = data.aiModel || "chatgpt";
  aiType = aiModel;

  if (aiModel === "chatgpt") {
    const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
    if (tabs.length > 0) {
      aiTabId = tabs[0].id;
      aiWindowId = tabs[0].windowId;
    }
  } else if (aiModel === "gemini") {
    const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
    if (tabs.length > 0) {
      aiTabId = tabs[0].id;
      aiWindowId = tabs[0].windowId;
    }
  } else if (aiModel === "deepseek") {
    const tabs = await chrome.tabs.query({ url: "https://chat.deepseek.com/*" });
    if (tabs.length > 0) {
      aiTabId = tabs[0].id;
      aiWindowId = tabs[0].windowId;
    }
  }
}

// load debug flag and listen for changes
if (chrome && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get({ ixlDebug: false }, (items) => {
    ixlDebug = !!items.ixlDebug;
    if (ixlDebug) console.log('IXL background: debug enabled');
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.ixlDebug) {
      ixlDebug = !!changes.ixlDebug.newValue;
      console.log('IXL background: debug changed ->', ixlDebug);
    }
  });
}

async function shouldFocusTabs() {
  await findAndStoreTabs();
  return ixlWindowId === aiWindowId;
}

async function processQuestion(message) {
  if (processingQuestion) return;
  processingQuestion = true;

  try {
    await findAndStoreTabs();

    if (!aiTabId) {
      if (ixlDebug) console.log('IXL background: no aiTabId found when processing question');
      await sendMessageWithRetry(ixlTabId, {
        type: "alertMessage",
        message: `Please open ${aiType} in another tab before using automation.`,
      });
      processingQuestion = false;
      return;
    }

    if (!ixlTabId) {
      ixlTabId = message.sourceTabId;
    }

    const sameWindow = await shouldFocusTabs();

    if (sameWindow) {
      await focusTab(aiTabId);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (ixlDebug) console.log('IXL background: forwarding question to AI tab', { aiTabId, question: message.question });
    await sendMessageWithRetry(aiTabId, {
      type: "receiveQuestion",
      question: message.question,
    });

    if (sameWindow && lastActiveTabId && lastActiveTabId !== aiTabId) {
      setTimeout(async () => {
        await focusTab(lastActiveTabId);
      }, 1000);
    }
  } catch (error) {
    if (ixlDebug) console.error('IXL background: error in processQuestion', error);
    if (ixlTabId) {
      await sendMessageWithRetry(ixlTabId, {
        type: "alertMessage",
        message: `Error communicating with ${aiType}. Please make sure it's open in another tab.`,
      });
    }
  } finally {
    processingQuestion = false;
  }
}

async function processResponse(message) {
  try {
    if (!ixlTabId) {
      const ixlTabs = await chrome.tabs.query({ url: "https://www.ixl.com/*" });
      if (ixlTabs.length > 0) {
        ixlTabId = ixlTabs[0].id;
        ixlWindowId = ixlTabs[0].windowId;
      } else {
        return;
      }
    }

    const sameWindow = await shouldFocusTabs();

    if (sameWindow) {
      await focusTab(ixlTabId);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (ixlDebug) console.log('IXL background: forwarding AI response back to IXL tab', { ixlTabId, response: message.response });
    await sendMessageWithRetry(ixlTabId, {
      type: "processChatGPTResponse",
      response: message.response,
    });
  } catch (error) {
    if (ixlDebug) console.error("Error processing AI response:", error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab) {
    message.sourceTabId = sender.tab.id;

    if (sender.tab.url.includes("ixl.com")) {
      ixlTabId = sender.tab.id;
      ixlWindowId = sender.tab.windowId;
      if (ixlDebug) console.log('IXL background: message from IXL tab', { tabId: ixlTabId, type: message.type });
    } else if (sender.tab.url.includes("chatgpt.com")) {
      aiTabId = sender.tab.id;
      aiWindowId = sender.tab.windowId;
      aiType = "chatgpt";
      if (ixlDebug) console.log('IXL background: message from ChatGPT tab', { tabId: aiTabId, type: message.type });
    } else if (sender.tab.url.includes("gemini.google.com")) {
      aiTabId = sender.tab.id;
      aiWindowId = sender.tab.windowId;
      aiType = "gemini";
      if (ixlDebug) console.log('IXL background: message from Gemini tab', { tabId: aiTabId, type: message.type });
    } else if (sender.tab.url.includes("chat.deepseek.com")) {
      aiTabId = sender.tab.id;
      aiWindowId = sender.tab.windowId;
      aiType = "deepseek";
      if (ixlDebug) console.log('IXL background: message from DeepSeek tab', { tabId: aiTabId, type: message.type });
    }
  }

  if (message.type === "sendQuestionToChatGPT") {
    processQuestion(message);
    sendResponse({ received: true });
    return true;
  }

  if (
    message.type === "chatGPTResponse" ||
    message.type === "geminiResponse" ||
    message.type === "deepseekResponse"
  ) {
    processResponse(message);
    sendResponse({ received: true });
    return true;
  }

  if (message.type === "openSettings") {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup/settings.html"),
      type: "popup",
      width: 500,
      height: 520,
    });
    sendResponse({ received: true });
    return true;
  }

  sendResponse({ received: false });
  return false;
});

findAndStoreTabs();

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === ixlTabId) ixlTabId = null;
  if (tabId === aiTabId) aiTabId = null;
});
