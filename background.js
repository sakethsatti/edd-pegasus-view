/* Pegasus View - Background Service Worker */
/* This is the "always on" part of the extension - it quietly runs in the
   background even when you're not looking at the popup. Its only job right
   now is to open the welcome page the very first time someone installs it.
   After that it just sits there and does nothing, which is fine. */
'use strict';

// Chrome fires this event when the extension is installed, updated, or
// when Chrome itself updates. We only care about brand new installs
// (reason === 'install') - we don't want to pop open the welcome page
// every time we ship an update, that would drive people mad.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});
