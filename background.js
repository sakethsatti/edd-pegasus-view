/* Pegasus View - Background Service Worker */
/* Opens the welcome/setup page the first time the extension is installed. */
'use strict';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});
