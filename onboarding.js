/* Pegasus View — Onboarding Script */
'use strict';

const DEFAULTS = {
  enabled:          true,
  fontFamily:       'Atkinson Hyperlegible',
  fontSize:         19,
  fontColor:        '#1a1a2e',
  bgColor:          '#fffde7',
  lineSpacing:      1.9,
  letterSpacing:    0.25,
  wordSpacing:      4,
  leftAlign:        true,
  readingRuler:     false,
  reduceAnimations: false,
  limitWidth:       false,
};

function $(id) { return document.getElementById(id); }
function round2(n) { return Math.round(n * 100) / 100; }
function hexOrFallback(v, fallback) { return (v && v !== 'transparent') ? v : fallback; }

let s = { ...DEFAULTS };

/* ── Apply settings to main content text ────────────────────── */

function applyToPage() {
  const content = $('content');
  const ff = s.fontFamily === 'inherit' ? 'inherit' : `'${s.fontFamily}', sans-serif`;

  content.style.fontFamily    = ff;
  content.style.fontSize      = s.fontSize + 'px';
  content.style.color         = s.fontColor;
  content.style.lineHeight    = s.lineSpacing;
  content.style.letterSpacing = s.letterSpacing + 'px';
  content.style.wordSpacing   = s.wordSpacing + 'px';
  content.style.textAlign     = s.leftAlign ? 'left' : '';

  document.body.style.backgroundColor = (s.bgColor && s.bgColor !== 'transparent')
    ? s.bgColor : '';
}

/* ── Update display values ───────────────────────────────────── */

function updateDisplays() {
  $('fontSize-display').textContent      = s.fontSize + 'px';
  $('lineSpacing-display').textContent   = s.lineSpacing + '×';
  $('letterSpacing-display').textContent = s.letterSpacing + 'px';

  $('fontColor-btn').style.background = hexOrFallback(s.fontColor, '#1a1a2e');
  $('bgColor-btn').style.background   = hexOrFallback(s.bgColor,   '#fffde7');
}

/* ── Stepper factory ─────────────────────────────────────────── */

function wireStepper(upId, downId, key, step, min, max) {
  $(upId).addEventListener('click', () => {
    s[key] = Math.min(max, round2(s[key] + step));
    updateDisplays();
    applyToPage();
  });
  $(downId).addEventListener('click', () => {
    s[key] = Math.max(min, round2(s[key] - step));
    updateDisplays();
    applyToPage();
  });
}

/* ── Init ────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  // Load any settings already saved (e.g. user reinstalling)
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    s = { ...DEFAULTS, ...stored };
    $('fontFamily').value  = s.fontFamily;
    $('fontColor').value   = hexOrFallback(s.fontColor, '#1a1a2e');
    $('bgColor').value     = hexOrFallback(s.bgColor,   '#fffde7');
    updateDisplays();
    applyToPage();
  });

  $('fontFamily').addEventListener('change', (e) => {
    s.fontFamily = e.target.value;
    applyToPage();
  });

  $('fontColor').addEventListener('input', (e) => {
    s.fontColor = e.target.value;
    updateDisplays();
    applyToPage();
  });

  $('bgColor').addEventListener('input', (e) => {
    s.bgColor = e.target.value;
    updateDisplays();
    applyToPage();
  });

  wireStepper('size-up',    'size-down',    'fontSize',     2,    12, 32);
  wireStepper('line-up',    'line-down',    'lineSpacing',  0.25, 1.0, 3.0);
  wireStepper('letter-up',  'letter-down',  'letterSpacing',0.25, 0,  10);

  $('save').addEventListener('click', () => {
    chrome.storage.sync.set(s, () => {
      $('save').textContent = 'Saved!';
      $('save').style.background = '#16a34a';
      setTimeout(() => window.close(), 900);
    });
  });
});
