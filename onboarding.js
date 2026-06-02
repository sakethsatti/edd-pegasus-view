/* Pegasus View - Onboarding Script */
/* Drives the welcome page that opens the very first time the extension is installed.
   The user can try out different settings and see them applied live to the text
   on the left side of the page. When they're happy with how it looks, they hit
   "Save and Start" and the page closes. */
'use strict';

// Slightly warmer defaults for the setup page - softer colours and a bit more
// spacing to demonstrate what "comfortable reading" can feel like.
const DEFAULTS = {
  enabled:          true,                    // always on during setup
  fontFamily:       'Atkinson Hyperlegible',
  fontSize:         19,
  fontColor:        '#1a1a2e',
  bgColor:          '#fffde7',               // warm cream - easier on the eyes than white
  lineSpacing:      1.9,
  letterSpacing:    0.25,
  wordSpacing:      4,
  leftAlign:        true,
  readingRuler:     false,
  reduceAnimations: false,
  limitWidth:       false,
};

// Shortcut - saves typing document.getElementById() over and over.
function $(id) { return document.getElementById(id); }

// Floating point numbers can come out weird (e.g. 1.750000001 → 1.75).
// This rounds to 2 decimal places to keep things sensible.
function round2(n) { return Math.round(n * 100) / 100; }

// Colour pickers need a real hex value. If the stored value is one of our
// special non-colour strings ("transparent", "inherit"), return the fallback instead.
function hexOrFallback(v, fallback) { return (v && v !== 'transparent' && v !== 'inherit') ? v : fallback; }

// The current working copy of all the settings - starts from the defaults above.
let s = { ...DEFAULTS };

/* ---------------------------------------------------------------
   LIVE PREVIEW
   Applies the current settings directly to the main content area on the
   left so the user sees the effect in real time as they adjust things.
   --------------------------------------------------------------- */

function applyToPage() {
  const content = $('content');
  const ff = s.fontFamily === 'inherit' ? 'inherit' : `'${s.fontFamily}', sans-serif`;

  content.style.fontFamily    = ff;
  content.style.fontSize      = s.fontSize + 'px';
  content.style.color         = (s.fontColor && s.fontColor !== 'inherit') ? s.fontColor : '';
  content.style.lineHeight    = s.lineSpacing;
  content.style.letterSpacing = s.letterSpacing + 'px';
  content.style.wordSpacing   = s.wordSpacing + 'px';
  content.style.textAlign     = s.leftAlign ? 'left' : '';

  // Background colour applies to the whole page body, not just the content column.
  document.body.style.backgroundColor = (s.bgColor && s.bgColor !== 'transparent')
    ? s.bgColor : '';
}

/* ---------------------------------------------------------------
   DISPLAY LABELS + COLOUR BUTTON STATES
   Keeps the number readouts (e.g. "19px") and colour button visuals
   in sync with whatever the current settings are.
   --------------------------------------------------------------- */

function updateColorVisuals() {
  const fontIsDefault = !s.fontColor || s.fontColor === 'inherit';
  const bgIsDefault   = !s.bgColor   || s.bgColor   === 'transparent';

  // Grey out the colour swatch when no custom colour is active.
  $('fontColor-btn').classList.toggle('is-default', fontIsDefault);
  $('bgColor-btn').classList.toggle('is-default',   bgIsDefault);

  // Highlight the "website default" button when that mode is on.
  $('fontColor-default').classList.toggle('active',  fontIsDefault);
  $('bgColor-default').classList.toggle('active',    bgIsDefault);

  // Set the swatch button's background to the chosen colour, or clear it.
  if (!fontIsDefault) $('fontColor-btn').style.background = s.fontColor;
  else                $('fontColor-btn').style.background = '';
  if (!bgIsDefault)   $('bgColor-btn').style.background   = s.bgColor;
  else                $('bgColor-btn').style.background   = '';
}

function updateDisplays() {
  $('fontSize-display').textContent      = s.fontSize + 'px';
  $('lineSpacing-display').textContent   = s.lineSpacing + '×';
  $('letterSpacing-display').textContent = s.letterSpacing + 'px';
  updateColorVisuals();
}

/* ---------------------------------------------------------------
   STEPPER FACTORY
   Builds the +/− button behaviour for a given setting.
   Reused for font size, line spacing, and letter spacing so we
   don't have to write the same code three separate times.
   --------------------------------------------------------------- */

function wireStepper(upId, downId, key, step, min, max) {
  $(upId).addEventListener('click', () => {
    // Go up by one step without going above the maximum.
    s[key] = Math.min(max, round2(s[key] + step));
    updateDisplays();
    applyToPage();
  });
  $(downId).addEventListener('click', () => {
    // Go down by one step without going below the minimum.
    s[key] = Math.max(min, round2(s[key] - step));
    updateDisplays();
    applyToPage();
  });
}

/* ---------------------------------------------------------------
   STARTUP
   Runs once the page has finished loading. Pulls in any previously
   saved settings, then wires up all the controls.
   --------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {

  // If the user is reinstalling the extension, their old settings will still be
  // in Chrome's sync storage. Load them in so they don't have to start from scratch.
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    s = { ...DEFAULTS, ...stored };
    $('fontFamily').value  = s.fontFamily;
    $('fontColor').value   = hexOrFallback(s.fontColor, '#1a1a2e');
    $('bgColor').value     = hexOrFallback(s.bgColor,   '#fffde7');
    updateDisplays();
    applyToPage();
  });

  // Font family dropdown.
  $('fontFamily').addEventListener('change', (e) => {
    s.fontFamily = e.target.value;
    applyToPage();
  });

  // Text colour picker - fires continuously as the user drags through the colour wheel.
  $('fontColor').addEventListener('input', (e) => {
    s.fontColor = e.target.value;
    updateDisplays();
    applyToPage();
  });

  // Background colour picker.
  $('bgColor').addEventListener('input', (e) => {
    s.bgColor = e.target.value;
    updateDisplays();
    applyToPage();
  });

  // "Website default" buttons - toggle between a custom colour and "don't override."
  $('fontColor-default').addEventListener('click', () => {
    const isNowDefault = s.fontColor !== 'inherit';
    s.fontColor = isNowDefault ? 'inherit' : ($('fontColor').value || '#1a1a2e');
    updateDisplays();
    applyToPage();
  });

  $('bgColor-default').addEventListener('click', () => {
    const isNowDefault = s.bgColor !== 'transparent';
    s.bgColor = isNowDefault ? 'transparent' : ($('bgColor').value || '#fffde7');
    updateDisplays();
    applyToPage();
  });

  // Wire up the +/− buttons for each numeric setting.
  wireStepper('size-up',    'size-down',    'fontSize',      2,    12,  32);  // 2pt steps, 12–32px
  wireStepper('line-up',    'line-down',    'lineSpacing',   0.25, 1.0, 3.0); // 0.25× steps, 1–3×
  wireStepper('letter-up',  'letter-down',  'letterSpacing', 0.25, 0,   10);  // 0.25px steps, 0–10px

  // Save button: writes the current settings to Chrome's storage, then closes the tab.
  $('save').addEventListener('click', () => {
    chrome.storage.sync.set(s, () => {
      // Give the user a moment to see the confirmation before the page closes.
      $('save').textContent = 'Saved!';
      $('save').style.background = '#16a34a';
      setTimeout(() => window.close(), 900);
    });
  });
});
