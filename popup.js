/* Pegasus View — Popup Script */
'use strict';

const DEFAULT_SETTINGS = {
  enabled:          false,
  fontFamily:       'OpenDyslexic',
  fontSize:         18,
  fontColor:        '#1a1a1a',
  bgColor:          'transparent',
  lineSpacing:      1.75,
  letterSpacing:    0,
  wordSpacing:      4,
  leftAlign:        true,
  readingRuler:     false,
  reduceAnimations: false,
  limitWidth:       false,
};

function $(id) { return document.getElementById(id); }

function hexOrWhite(v) { return (v === 'transparent' || !v) ? '#ffffff' : v; }

function round2(n) { return Math.round(n * 100) / 100; }

/* -- Preview --------------------------------------------------- */

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

function updateColorBtnVisuals(s) {
  const fontIsDefault = !s.fontColor || s.fontColor === 'inherit';
  const bgIsDefault   = !s.bgColor   || s.bgColor   === 'transparent';

  $('fontColor-btn').classList.toggle('is-default', fontIsDefault);
  $('bgColor-btn').classList.toggle('is-default',   bgIsDefault);
  $('fontColor-default').classList.toggle('active',  fontIsDefault);
  $('bgColor-default').classList.toggle('active',    bgIsDefault);

  if (!fontIsDefault) $('fontColor-btn').style.background = s.fontColor;
  if (!bgIsDefault)   $('bgColor-btn').style.background   = s.bgColor;
  if (bgIsDefault)    $('bgColor-btn').style.background   = 'repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 0 0/8px 8px';
}

function updateDisplays(s) {
  $('fontSize-display').textContent      = s.fontSize + 'px';
  $('lineSpacing-display').textContent   = s.lineSpacing + '×';
  $('letterSpacing-display').textContent = s.letterSpacing + 'px';

  // Icon visuals reflect live values
  const sizeIcon = $('icon-size');
  if (sizeIcon) {
    const px = 10 + (s.fontSize - 12) / (32 - 12) * 9; // scales 10px-19px
    sizeIcon.style.fontSize = px + 'px';
  }
  const letterIcon = $('icon-letter');
  if (letterIcon) {
    letterIcon.style.letterSpacing = Math.min(s.letterSpacing * 0.5, 4) + 'px';
  }
}

/* -- Apply to tab ---------------------------------------------- */

async function applyToTab(settings) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { action: 'apply', settings });
  } catch { /* chrome:// pages have no content script */ }
}

/* -- Save + apply ---------------------------------------------- */

let currentSettings = { ...DEFAULT_SETTINGS };

async function saveAndApply(patch) {
  currentSettings = { ...currentSettings, ...patch };
  chrome.storage.sync.set(currentSettings);
  updatePreview(currentSettings);
  updateDisplays(currentSettings);
  updateColorBtnVisuals(currentSettings);
  await applyToTab(currentSettings);
}

/* -- Load UI from settings ------------------------------------- */

function loadUI(s) {
  $('enabled').checked    = s.enabled;
  $('fontFamily').value   = s.fontFamily;
  $('fontColor').value    = hexOrWhite(s.fontColor);
  $('bgColor').value      = hexOrWhite(s.bgColor);

  updateDisplays(s);
  updateColorBtnVisuals(s);
  updatePreview(s);
}

/* -- Stepper factory ------------------------------------------- */

function wireStepper(upId, downId, key, step, min, max) {
  $(`${upId}`).addEventListener('click', () => {
    const v = Math.min(max, round2(currentSettings[key] + step));
    saveAndApply({ [key]: v });
  });
  $(`${downId}`).addEventListener('click', () => {
    const v = Math.max(min, round2(currentSettings[key] - step));
    saveAndApply({ [key]: v });
  });
}

/* -- Init ------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    currentSettings = { ...DEFAULT_SETTINGS, ...stored };
    loadUI(currentSettings);
  });

  $('enabled').addEventListener('change', e => saveAndApply({ enabled: e.target.checked }));

  $('fontFamily').addEventListener('change', e => saveAndApply({ fontFamily: e.target.value }));

  $('fontColor').addEventListener('input', e => saveAndApply({ fontColor: e.target.value }));
  $('bgColor').addEventListener('input',   e => saveAndApply({ bgColor:   e.target.value }));

  $('fontColor-default').addEventListener('click', () => {
    const isNowDefault = currentSettings.fontColor !== 'inherit';
    saveAndApply({ fontColor: isNowDefault ? 'inherit' : ($('fontColor').value || '#1a1a1a') });
  });

  $('bgColor-default').addEventListener('click', () => {
    const isNowDefault = currentSettings.bgColor !== 'transparent';
    saveAndApply({ bgColor: isNowDefault ? 'transparent' : ($('bgColor').value || '#ffffff') });
  });

  // Font size: 2pt increments, 12-32
  wireStepper('size-up',     'size-down',    'fontSize',     2,    12, 32);
  // Line spacing: 0.25× increments, 1.0-3.0
  wireStepper('line-up',     'line-down',    'lineSpacing',  0.25, 1.0, 3.0);
  // Letter spacing: 0.25px increments, 0-10
  wireStepper('letter-up',   'letter-down',  'letterSpacing',0.25, 0,  10);

  $('reset').addEventListener('click', () => {
    currentSettings = { ...DEFAULT_SETTINGS };
    chrome.storage.sync.set(currentSettings);
    applyToTab(currentSettings);
    loadUI(currentSettings);
  });
});
