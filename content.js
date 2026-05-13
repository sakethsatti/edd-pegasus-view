/* Pegasus View - Content Script */
/* Runs inside every webpage to apply the user's reading settings. */
'use strict';

const DE_STYLE_ID = 'pegasus-view-styles';
const DE_FONTS_ID = 'pegasus-view-fonts';
const DE_RULER_ID = 'pegasus-view-ruler';

const DEFAULT_SETTINGS = {
  enabled:           false,
  fontFamily:        'OpenDyslexic',
  fontSize:          18,
  fontColor:         '#1a1a1a',
  bgColor:           'transparent',
  lineSpacing:       1.75,
  letterSpacing:     1,
  wordSpacing:       4,
  leftAlign:         true,
  readingRuler:      false,
  reduceAnimations:  false,
  limitWidth:        false,
};

/* -- Font loading: fetches dyslexia-friendly fonts from the web -- */

function injectFonts() {
  if (document.getElementById(DE_FONTS_ID)) return;

  const gfLink = document.createElement('link');
  gfLink.id   = DE_FONTS_ID;
  gfLink.rel  = 'stylesheet';
  gfLink.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@300;400;500;600&family=Comic+Neue:wght@400;700&display=swap';
  document.head.appendChild(gfLink);

  const odStyle = document.createElement('style');
  odStyle.id = DE_FONTS_ID + '-od';
  odStyle.textContent = `@import url('https://fonts.cdnfonts.com/css/opendyslexic');`;
  document.head.appendChild(odStyle);
}

/* -- CSS builder: converts settings into CSS rules injected into the page -- */

// All text elements - font, size, and spacing are overridden on these
const TEXT_SELECTORS = [
  'p', 'li', 'td', 'th', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'figcaption', 'caption',
  'article', 'section', 'aside',
  'label', 'span', 'button',
  'input[type="text"]', 'input[type="search"]',
  'textarea', 'pre', 'code',
].join(', ');

// Links get font/spacing changes but NOT a colour override, so they stay
// visually distinct (blue/purple) from regular text
const LINK_SELECTORS = 'a, a:visited, a:hover, a:active';

function buildCSS(s) {
  const ff = s.fontFamily === 'inherit' ? 'inherit' : `'${s.fontFamily}', sans-serif`;

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

  // Only apply text colour if the user chose one ('inherit' = leave page colour alone)
  if (s.fontColor && s.fontColor !== 'inherit') {
    css += `${TEXT_SELECTORS} { color: ${s.fontColor} !important; }\n`;
  }

  // Always underline links so they remain identifiable after colour/font changes
  css += `${LINK_SELECTORS} { text-decoration: underline !important; }\n`;

  // Only change page background if the user chose a colour ('transparent' = leave it alone)
  if (s.bgColor && s.bgColor !== 'transparent') {
    css += `html, body { background-color: ${s.bgColor} !important; }\n`;
  }

  // Near-eliminates all page animations to reduce visual distraction
  if (s.reduceAnimations) {
    css += `*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}\n`;
  }

  // Caps each line to ~70 characters - long lines are harder to track
  if (s.limitWidth) {
    css += `body > * { max-width: 800px !important; margin: auto !important; }
article, main, [role="main"] { max-width: 70ch !important; margin: auto !important; }\n`;
  }

  return css;
}

/* -- Style injection: puts our CSS into the page, or removes it -- */

function applyStyles(css) {
  let el = document.getElementById(DE_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = DE_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function removeStyles() {
  const el = document.getElementById(DE_STYLE_ID);
  if (el) el.remove();
}

/* -- Reading ruler: teal highlight band that follows the mouse cursor -- */

let rulerEl = null;

function onMouseMove(e) {
  if (!rulerEl) return;
  rulerEl.style.top = (e.clientY - rulerEl.offsetHeight / 2) + 'px';
}

function enableRuler() {
  if (rulerEl) return;
  rulerEl = document.createElement('div');
  rulerEl.id = DE_RULER_ID;
  Object.assign(rulerEl.style, {
    position:      'fixed',
    left:          '0',
    top:           '0',
    width:         '100%',
    height:        '2.4em',
    background:    'rgba(78, 205, 196, 0.13)',
    borderTop:     '2px solid rgba(78, 205, 196, 0.45)',
    borderBottom:  '2px solid rgba(78, 205, 196, 0.45)',
    pointerEvents: 'none',       // clicks pass through to the page below
    zIndex:        '2147483647', // always on top of everything
    transition:    'top 60ms linear',
  });
  document.body.appendChild(rulerEl);
  document.addEventListener('mousemove', onMouseMove);
}

function disableRuler() {
  if (!rulerEl) return;
  document.removeEventListener('mousemove', onMouseMove);
  rulerEl.remove();
  rulerEl = null;
}

/* -- Main apply function: turns all features on or off -- */

function applySettings(settings) {
  const s = Object.assign({}, DEFAULT_SETTINGS, settings);

  if (!s.enabled) {
    removeStyles();
    disableRuler();
    return;
  }

  injectFonts();
  applyStyles(buildCSS(s));
  s.readingRuler ? enableRuler() : disableRuler();
}

/* -- Listen for live updates sent from the popup -- */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'apply') applySettings(msg.settings);
});

/* -- Auto-apply saved settings every time a new page loads -- */

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  applySettings(settings);
});
