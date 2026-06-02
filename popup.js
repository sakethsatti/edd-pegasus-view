/* Pegasus View - Popup Script */
/* Controls the small window that appears when you click the extension icon.
   The user can toggle the extension on/off and tweak all their reading
   settings from here. Every change saves automatically and updates the
   current tab in real time - no refresh needed. */
'use strict';

// The starting values used when the user hits "Reset" or has never set anything.
const DEFAULT_SETTINGS = {
  enabled:          false,
  fontFamily:       'OpenDyslexic',
  fontSize:         18,
  fontColor:        '#1a1a1a',
  bgColor:          'transparent', // 'transparent' = don't change the page background
  lineSpacing:      1.75,
  letterSpacing:    0,
  wordSpacing:      4,
  leftAlign:        true,
  readingRuler:     false,
  reduceAnimations: false,
  limitWidth:       false,
};

// Shortcut so we don't have to type document.getElementById() everywhere.
function $(id) { return document.getElementById(id); }

// Colour pickers don't understand "transparent" or "inherit" - they need a real
// hex colour. If the stored value is one of our special strings, return white instead.
function hexOrWhite(v) { return (v === 'transparent' || !v) ? '#ffffff' : v; }

// Floating point numbers can come out weird (e.g. 1.750000001).
// This rounds to 2 decimal places to keep things tidy.
function round2(n) { return Math.round(n * 100) / 100; }

/* ---------------------------------------------------------------
   PREVIEW
   The sample text at the top of the popup that updates live as
   the user adjusts settings, so they can see what it'll look like.
   --------------------------------------------------------------- */

function updatePreview(s) {
  const text = $('preview-text');
  const wrap = $('preview-wrap');
  const ff   = s.fontFamily === 'inherit' ? 'inherit' : `'${s.fontFamily}', sans-serif`;

  text.style.fontFamily    = ff;
  text.style.fontSize      = s.fontSize + 'px';
  text.style.color         = (s.fontColor && s.fontColor !== 'inherit') ? s.fontColor : '';
  text.style.lineHeight    = s.lineSpacing;
  text.style.letterSpacing = s.letterSpacing + 'px';
  text.style.wordSpacing   = s.wordSpacing + 'px';
  text.style.textAlign     = s.leftAlign ? 'left' : '';

  wrap.style.backgroundColor = (s.bgColor && s.bgColor !== 'transparent')
    ? s.bgColor : '';
}

// Updates the colour swatch buttons and "Page default" toggle buttons to
// reflect whether the user has a custom colour active or has left it at default.
function updateColorBtnVisuals(s) {
  const fontIsDefault = !s.fontColor || s.fontColor === 'inherit';
  const bgIsDefault   = !s.bgColor   || s.bgColor   === 'transparent';

  // The colour swatch fades out when the setting is on "page default."
  $('fontColor-btn').classList.toggle('is-default', fontIsDefault);
  $('bgColor-btn').classList.toggle('is-default',   bgIsDefault);

  // The "Page default" button lights up when that mode is active.
  $('fontColor-default').classList.toggle('active',  fontIsDefault);
  $('bgColor-default').classList.toggle('active',    bgIsDefault);

  if (!fontIsDefault) $('fontColor-btn').style.background = s.fontColor;
  if (!bgIsDefault)   $('bgColor-btn').style.background   = s.bgColor;

  // Show a checkerboard pattern to represent "transparent / no background colour."
  if (bgIsDefault) $('bgColor-btn').style.background = 'repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 0 0/8px 8px';
}

// Refreshes the number labels (e.g. "18px", "1.75×") and nudges the little
// icon visuals so they physically reflect the current values at a glance.
function updateDisplays(s) {
  $('fontSize-display').textContent      = s.fontSize + 'px';
  $('lineSpacing-display').textContent   = s.lineSpacing + '×';
  $('letterSpacing-display').textContent = s.letterSpacing + 'px';

  // Scale the "Aa" icon so it visually grows and shrinks with the font size.
  const sizeIcon = $('icon-size');
  if (sizeIcon) {
    const px = 10 + (s.fontSize - 12) / (32 - 12) * 9; // maps 12–32px range onto a 10–19px icon
    sizeIcon.style.fontSize = px + 'px';
  }

  // Spread the letters in the "AB" icon to match the current letter spacing value.
  const letterIcon = $('icon-letter');
  if (letterIcon) {
    letterIcon.style.letterSpacing = Math.min(s.letterSpacing * 0.5, 4) + 'px';
  }
}

/* ---------------------------------------------------------------
   APPLYING SETTINGS TO THE CURRENT TAB
   Sends the settings across to the content script running in the
   tab the user has open, so the page updates without needing a refresh.
   --------------------------------------------------------------- */

async function applyToTab(settings) {
  try {
    // Find whichever tab the user is currently looking at.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Make sure content.js is already running on the page.
    // If it throws because it's already there, we just ignore the error - that's fine.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      .catch(() => {});

    // Tell the content script to apply the new settings right now.
    await chrome.tabs.sendMessage(tab.id, { action: 'apply', settings });
  } catch {
    // Some pages (like chrome://settings) block extensions entirely - just skip them.
  }
}

/* ---------------------------------------------------------------
   SAVE + APPLY
   Every time any setting changes, we merge it in, save to storage,
   refresh all the visuals, and push the update to the open tab.
   --------------------------------------------------------------- */

let currentSettings = { ...DEFAULT_SETTINGS };

async function saveAndApply(patch) {
  currentSettings = { ...currentSettings, ...patch };
  chrome.storage.sync.set(currentSettings); // keeps settings across browser restarts
  updatePreview(currentSettings);
  updateDisplays(currentSettings);
  updateColorBtnVisuals(currentSettings);
  await applyToTab(currentSettings);
}

/* ---------------------------------------------------------------
   LOAD UI FROM SAVED SETTINGS
   Fills in all the controls to match whatever was last saved.
   --------------------------------------------------------------- */

function loadUI(s) {
  $('enabled').checked    = s.enabled;
  $('fontFamily').value   = s.fontFamily;
  $('fontColor').value    = hexOrWhite(s.fontColor); // colour picker needs a proper hex value
  $('bgColor').value      = hexOrWhite(s.bgColor);

  updateDisplays(s);
  updateColorBtnVisuals(s);
  updatePreview(s);
}

/* ---------------------------------------------------------------
   STEPPER FACTORY
   Builds the +/− button behaviour for a given numeric setting.
   We reuse this for font size, line spacing, and letter spacing so
   we don't have to write the same event-listener logic three times.
   --------------------------------------------------------------- */

function wireStepper(upId, downId, key, step, min, max) {
  $(`${upId}`).addEventListener('click', () => {
    // Go up by one step, but don't exceed the maximum allowed value.
    const v = Math.min(max, round2(currentSettings[key] + step));
    saveAndApply({ [key]: v });
  });
  $(`${downId}`).addEventListener('click', () => {
    // Go down by one step, but don't drop below the minimum allowed value.
    const v = Math.max(min, round2(currentSettings[key] - step));
    saveAndApply({ [key]: v });
  });
}

/* ---------------------------------------------------------------
   STARTUP
   Everything kicks off here once the popup's HTML is fully loaded.
   --------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  // Pull the user's saved settings from Chrome's storage and fill in the UI.
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    currentSettings = { ...DEFAULT_SETTINGS, ...stored };
    loadUI(currentSettings);
  });

  // The on/off toggle at the top of the popup.
  $('enabled').addEventListener('change', e => saveAndApply({ enabled: e.target.checked }));

  // Font family dropdown.
  $('fontFamily').addEventListener('change', e => saveAndApply({ fontFamily: e.target.value }));

  // Colour pickers - these fire continuously as the user drags through the colour wheel.
  $('fontColor').addEventListener('input', e => saveAndApply({ fontColor: e.target.value }));
  $('bgColor').addEventListener('input',   e => saveAndApply({ bgColor:   e.target.value }));

  // "Page default" buttons - toggle between a custom colour and no override at all.
  $('fontColor-default').addEventListener('click', () => {
    const isNowDefault = currentSettings.fontColor !== 'inherit';
    saveAndApply({ fontColor: isNowDefault ? 'inherit' : ($('fontColor').value || '#1a1a1a') });
  });

  $('bgColor-default').addEventListener('click', () => {
    const isNowDefault = currentSettings.bgColor !== 'transparent';
    saveAndApply({ bgColor: isNowDefault ? 'transparent' : ($('bgColor').value || '#ffffff') });
  });

  // Wire up the +/− buttons for each numeric setting.
  wireStepper('size-up',     'size-down',    'fontSize',      2,    12,  32);  // 2pt steps, 12–32px
  wireStepper('line-up',     'line-down',    'lineSpacing',   0.25, 1.0, 3.0); // 0.25× steps, 1–3×
  wireStepper('letter-up',   'letter-down',  'letterSpacing', 0.25, 0,   10);  // 0.25px steps, 0–10px

  // Reset button: wipes everything back to factory defaults.
  $('reset').addEventListener('click', () => {
    currentSettings = { ...DEFAULT_SETTINGS };
    chrome.storage.sync.set(currentSettings);
    applyToTab(currentSettings);
    loadUI(currentSettings);
  });
});
