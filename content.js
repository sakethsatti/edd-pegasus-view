/* Pegasus View - Content Script */
/* This file gets injected into every webpage the user visits.
   It's the part that actually changes how things look on the page -
   swapping fonts, adjusting spacing, throwing a reading ruler on screen, etc.
   Think of it as the worker that does all the visible stuff. */
'use strict';

// Safety net: if this script somehow ends up injected into the same page twice,
// bail out immediately. Two copies fighting each other would cause weird bugs.
if (window.__pegasusViewLoaded) throw new Error('already loaded');
window.__pegasusViewLoaded = true;

// IDs we give to the HTML elements we inject into the page.
// Keeping them named means we can find them again later to update or remove them.
const DE_STYLE_ID = 'pegasus-view-styles';
const DE_FONTS_ID = 'pegasus-view-fonts';
const DE_RULER_ID = 'pegasus-view-ruler';

// What everything looks like before the user has changed a single thing.
// If a setting is missing from storage, we fall back to one of these values.
const DEFAULT_SETTINGS = {
  enabled:           false,         // off by default until the user turns it on
  fontFamily:        'OpenDyslexic',
  fontSize:          18,            // pixels
  fontColor:         '#1a1a1a',
  bgColor:           'transparent', // 'transparent' means "leave the page background alone"
  lineSpacing:       1.75,
  letterSpacing:     1,             // pixels between each letter
  wordSpacing:       4,             // pixels between each word
  leftAlign:         true,          // left-aligned text is easier to track than justified
  readingRuler:      false,
  reduceAnimations:  false,
  limitWidth:        false,
};

/* ---------------------------------------------------------------
   FONTS
   We load dyslexia-friendly fonts from the internet so they're
   available on any website, even sites that don't use them.
   --------------------------------------------------------------- */

function injectFonts() {
  // Only add the font links once - if they're already on the page, skip it.
  if (document.getElementById(DE_FONTS_ID)) return;

  // Google Fonts gives us Atkinson Hyperlegible, Lexend, and Comic Neue.
  const gfLink = document.createElement('link');
  gfLink.id   = DE_FONTS_ID;
  gfLink.rel  = 'stylesheet';
  gfLink.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@300;400;500;600&family=Comic+Neue:wght@400;700&display=swap';
  document.head.appendChild(gfLink);

  // OpenDyslexic isn't on Google Fonts, so we grab it from a separate CDN.
  const odStyle = document.createElement('style');
  odStyle.id = DE_FONTS_ID + '-od';
  odStyle.textContent = `@import url('https://fonts.cdnfonts.com/css/opendyslexic');`;
  document.head.appendChild(odStyle);
}

/* ---------------------------------------------------------------
   CSS BUILDER
   Takes the user's settings object and turns it into a CSS string
   that we can drop straight into the page.
   --------------------------------------------------------------- */

// Every HTML element that holds readable text - we override their font
// and spacing. Listed explicitly so we don't accidentally mess with
// hidden layout elements.
const TEXT_SELECTORS = [
  'p', 'li', 'td', 'th', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'figcaption', 'caption',
  'article', 'section', 'aside',
  'label', 'span', 'button',
  'input[type="text"]', 'input[type="search"]',
  'textarea', 'pre', 'code',
].join(', ');

// Links get the same font and spacing tweaks as everything else, but we
// deliberately skip the colour override so they stay blue/purple and
// still look like links - changing their colour would break that cue.
const LINK_SELECTORS = 'a, a:visited, a:hover, a:active';

function buildCSS(s) {
  // If the user picked "inherit", leave the font as whatever the page uses.
  // Otherwise wrap the name in quotes because some font names have spaces in them.
  const ff = s.fontFamily === 'inherit' ? 'inherit' : `'${s.fontFamily}', sans-serif`;

  // Start with the core font and spacing rules that apply to basically everything.
  let css = `
/* -- Pegasus View active styles -- */

${TEXT_SELECTORS}, ${LINK_SELECTORS} {
  font-family:    ${ff} !important;
  font-size:      ${s.fontSize}px !important;
  line-height:    ${s.lineSpacing} !important;
  letter-spacing: ${s.letterSpacing}px !important;
  word-spacing:   ${s.wordSpacing}px !important;
  ${s.leftAlign ? 'text-align: left !important;' : ''}
}
`;

  // Only swap the text colour if the user actually chose one.
  // 'inherit' means "leave the page's colour alone."
  if (s.fontColor && s.fontColor !== 'inherit') {
    css += `${TEXT_SELECTORS} { color: ${s.fontColor} !important; }\n`;
  }

  // Always keep links underlined so they're still recognisable as links
  // even after we've changed their font or colour.
  css += `${LINK_SELECTORS} { text-decoration: underline !important; }\n`;

  // Only change the page background if the user picked a colour.
  // 'transparent' means "don't touch it."
  if (s.bgColor && s.bgColor !== 'transparent') {
    css += `html, body { background-color: ${s.bgColor} !important; }\n`;
  }

  // Reduce animations: set all durations to basically zero so nothing
  // flashes, fades, or slides around. Useful for people sensitive to motion.
  if (s.reduceAnimations) {
    css += `*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}\n`;
  }

  // Limit line width: very long lines are hard to track across the page.
  // Capping at roughly 70 characters wide keeps things comfortable to read.
  if (s.limitWidth) {
    css += `body > * { max-width: 800px !important; margin: auto !important; }
article, main, [role="main"] { max-width: 70ch !important; margin: auto !important; }\n`;
  }

  return css;
}

/* ---------------------------------------------------------------
   STYLE INJECTION
   Drops our generated CSS into the page, or pulls it back out.
   --------------------------------------------------------------- */

function applyStyles(css) {
  // Look for an existing <style> tag we've already placed, or make a new one.
  let el = document.getElementById(DE_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = DE_STYLE_ID;
    document.head.appendChild(el);
  }
  // Overwrite whatever was there before with the freshly built CSS.
  el.textContent = css;
}

function removeStyles() {
  // Find our <style> tag and delete it - this instantly undoes all our changes.
  const el = document.getElementById(DE_STYLE_ID);
  if (el) el.remove();
}

/* ---------------------------------------------------------------
   READING RULER
   A semi-transparent teal band that follows the mouse cursor.
   Helps readers keep their place on the line they're reading.
   --------------------------------------------------------------- */

let rulerEl = null; // we hold a reference so we can move or remove it later

// Called on every mouse move - just slides the ruler to sit on the cursor.
function onMouseMove(e) {
  if (!rulerEl) return;
  rulerEl.style.top = (e.clientY - rulerEl.offsetHeight / 2) + 'px';
}

function enableRuler() {
  if (rulerEl) return; // already on, nothing to do
  rulerEl = document.createElement('div');
  rulerEl.id = DE_RULER_ID;
  Object.assign(rulerEl.style, {
    position:      'fixed',          // stays in place even when the page scrolls
    left:          '0',
    top:           '0',
    width:         '100%',
    height:        '2.4em',          // roughly one line of text tall
    background:    'rgba(78, 205, 196, 0.13)',
    borderTop:     '2px solid rgba(78, 205, 196, 0.45)',
    borderBottom:  '2px solid rgba(78, 205, 196, 0.45)',
    pointerEvents: 'none',           // mouse clicks pass straight through it to the page
    zIndex:        '2147483647',     // highest possible layer - always on top of everything
    transition:    'top 60ms linear', // smooths out the movement slightly
  });
  document.body.appendChild(rulerEl);
  document.addEventListener('mousemove', onMouseMove);
}

function disableRuler() {
  if (!rulerEl) return; // already off, nothing to do
  document.removeEventListener('mousemove', onMouseMove);
  rulerEl.remove();
  rulerEl = null;
}

/* ---------------------------------------------------------------
   MAIN ENTRY POINT
   Called whenever we need to apply or remove the full set of settings.
   --------------------------------------------------------------- */

function applySettings(settings) {
  // Merge incoming settings on top of the defaults so any missing keys
  // always have a safe fallback value.
  const s = Object.assign({}, DEFAULT_SETTINGS, settings);

  // If the extension is turned off, clean everything up and stop here.
  if (!s.enabled) {
    removeStyles();
    disableRuler();
    return;
  }

  // Otherwise load the fonts, inject the CSS, and handle the reading ruler.
  injectFonts();
  applyStyles(buildCSS(s));
  s.readingRuler ? enableRuler() : disableRuler();
}

/* ---------------------------------------------------------------
   COMMUNICATION
   The popup sends us a message whenever the user changes a setting.
   We listen for it here and apply the update to the page immediately.
   --------------------------------------------------------------- */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'apply') applySettings(msg.settings);
});

/* ---------------------------------------------------------------
   AUTO-APPLY ON PAGE LOAD
   When the user first opens a page, pull their saved settings out
   of Chrome's storage and apply them straight away - no popup needed.
   --------------------------------------------------------------- */

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  applySettings(settings);
});
