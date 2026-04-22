/* Pegasus View — Content Script */
'use strict';

const DE_STYLE_ID    = 'pegasus-view-styles';
const DE_FONTS_ID    = 'pegasus-view-fonts';
const DE_RULER_ID    = 'pegasus-view-ruler';

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

/* ─── Font injection ─────────────────────────────────────────────────────── */

function injectFonts() {
  if (document.getElementById(DE_FONTS_ID)) return;

  // Google Fonts: Atkinson Hyperlegible, Lexend, Comic Neue
  const gfLink = document.createElement('link');
  gfLink.id   = DE_FONTS_ID;
  gfLink.rel  = 'stylesheet';
  gfLink.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@300;400;500;600&family=Comic+Neue:wght@400;700&display=swap';
  document.head.appendChild(gfLink);

  // OpenDyslexic via cdnfonts
  const odStyle = document.createElement('style');
  odStyle.id = DE_FONTS_ID + '-od';
  odStyle.textContent = `
    @import url('https://fonts.cdnfonts.com/css/opendyslexic');
  `;
  document.head.appendChild(odStyle);
}

/* ─── CSS builder ────────────────────────────────────────────────────────── */

const TEXT_SELECTORS = [
  'p', 'li', 'td', 'th', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'figcaption', 'caption',
  'article', 'section', 'aside',
  'label', 'span', 'a', 'button',
  'input[type="text"]', 'input[type="search"]',
  'textarea', 'pre', 'code',
].join(', ');

function buildCSS(s) {
  const ff = s.fontFamily === 'inherit' ? 'inherit' : `'${s.fontFamily}', sans-serif`;

  let css = `
/* ── Pegasus View active styles ── */

${TEXT_SELECTORS} {
  font-family: ${ff} !important;
  font-size:   ${s.fontSize}px !important;
  color:       ${s.fontColor} !important;
  line-height: ${s.lineSpacing} !important;
  letter-spacing: ${s.letterSpacing}px !important;
  word-spacing:   ${s.wordSpacing}px !important;
  ${s.leftAlign ? 'text-align: left !important;' : ''}
}
`;

  if (s.bgColor && s.bgColor !== 'transparent') {
    css += `
html { background-color: ${s.bgColor} !important; }
body { background-color: ${s.bgColor} !important; }
`;
  }

  if (s.reduceAnimations) {
    css += `
*, *::before, *::after {
  animation-duration:        0.01ms !important;
  animation-iteration-count: 1      !important;
  transition-duration:        0.01ms !important;
  scroll-behavior:            auto   !important;
}
`;
  }

  if (s.limitWidth) {
    css += `
body > * { max-width: 800px !important; margin-left: auto !important; margin-right: auto !important; }
article, main, [role="main"], .content, .post, .entry { max-width: 70ch !important; margin-left: auto !important; margin-right: auto !important; }
`;
  }

  return css;
}

/* ─── Style element management ───────────────────────────────────────────── */

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

/* ─── Reading ruler ──────────────────────────────────────────────────────── */

let rulerEl = null;

function onMouseMove(e) {
  if (!rulerEl) return;
  const h = rulerEl.offsetHeight;
  rulerEl.style.top = (e.clientY - h / 2) + 'px';
}

function enableRuler() {
  if (rulerEl) return;
  rulerEl = document.createElement('div');
  rulerEl.id = DE_RULER_ID;
  Object.assign(rulerEl.style, {
    position:       'fixed',
    left:           '0',
    top:            '0',
    width:          '100%',
    height:         '2.4em',
    background:     'rgba(78, 205, 196, 0.13)',
    borderTop:      '2px solid rgba(78, 205, 196, 0.45)',
    borderBottom:   '2px solid rgba(78, 205, 196, 0.45)',
    pointerEvents:  'none',
    zIndex:         '2147483647',
    transition:     'top 60ms linear',
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

/* ─── Apply full settings object ─────────────────────────────────────────── */

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

/* ─── Message listener (from popup) ─────────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'apply') {
    applySettings(msg.settings);
  }
});

/* ─── Load on page init ──────────────────────────────────────────────────── */

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  applySettings(settings);
});
