// READ-ONLY. What does Konami.html's CSS define, and does anything else depend on it?
const fs = require('fs'), path = require('path');
const SRC = 'P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment/employee_management_v2';

const htmlFiles = fs.readdirSync(SRC).filter(f => f.endsWith('.html'));
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const TARGETS = ['Konami.html', 'EasterEggMaps.html', 'FieldIndex.html'];

function styleBlocks(src) {
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out.join('\n');
}

// ── what Konami's CSS defines ────────────────────────────────────────────────
const konCss = styleBlocks(read('Konami.html'));
const defClasses = new Set();
const defVars = new Set();
konCss.replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_, c) => { defClasses.add(c); return ''; });
konCss.replace(/(--[\w-]+)\s*:/g, (_, v) => { defVars.add(v); return ''; });

// ── what every OTHER html file uses ──────────────────────────────────────────
const usedClasses = {}, usedVars = {};
for (const f of htmlFiles) {
  if (TARGETS.includes(f)) continue;
  const src = read(f);
  // class attributes + classList/className strings
  src.replace(/class\s*=\s*["']([^"']+)["']/g, (_, v) => {
    v.split(/\s+/).filter(Boolean).forEach(c => { (usedClasses[c] = usedClasses[c] || new Set()).add(f); });
    return '';
  });
  src.replace(/classList\.(?:add|remove|toggle|contains)\(\s*['"]([^'"]+)['"]/g, (_, c) => {
    (usedClasses[c] = usedClasses[c] || new Set()).add(f); return '';
  });
  src.replace(/var\(\s*(--[\w-]+)/g, (_, v) => { (usedVars[v] = usedVars[v] || new Set()).add(f); return ''; });
}

const sharedClasses = [...defClasses].filter(c => usedClasses[c]).sort();
const sharedVars = [...defVars].filter(v => usedVars[v]).sort();

console.log('=== Konami.html CSS surface ===');
console.log('  css lines          : ' + konCss.split('\n').length);
console.log('  class selectors    : ' + defClasses.size);
console.log('  custom properties  : ' + defVars.size);

console.log('\n=== Classes Konami defines THAT OTHER FILES USE (breakage risk) ===');
if (!sharedClasses.length) console.log('  none');
else for (const c of sharedClasses) console.log('  .' + c.padEnd(28) + ' used by ' + [...usedClasses[c]].slice(0, 6).join(', ') + ([...usedClasses[c]].length > 6 ? ' +more' : ''));

console.log('\n=== Custom properties Konami defines THAT OTHER FILES USE ===');
if (!sharedVars.length) console.log('  none');
else for (const v of sharedVars) console.log('  ' + v.padEnd(30) + ' used by ' + [...usedVars[v]].slice(0, 6).join(', ') + ([...usedVars[v]].length > 6 ? ' +more' : ''));

// ── where do theme / a11y rules actually live? ───────────────────────────────
const PATTERNS = {
  'prefers-color-scheme': /prefers-color-scheme/g,
  'data-theme':           /data-theme/g,
  'prefers-reduced-motion': /prefers-reduced-motion/g,
  ':focus-visible':       /:focus-visible/g,
  'sr-only / visually-hidden': /\.(?:sr-only|visually-hidden)\b/g,
  'aria-':                /aria-[\w-]+/g,
  'role=':                /role\s*=\s*["']/g,
  '@media':               /@media/g,
};
console.log('\n=== THEME / ACCESSIBILITY RULES BY FILE ===');
console.log('file'.padEnd(34) + Object.keys(PATTERNS).map(k => k.slice(0, 9).padStart(11)).join(''));
const rows = [];
for (const f of htmlFiles) {
  const src = read(f);
  const counts = Object.values(PATTERNS).map(re => (src.match(re) || []).length);
  if (counts.some(n => n > 0)) rows.push({ f, counts, total: counts.reduce((a, b) => a + b, 0) });
}
rows.sort((a, b) => b.total - a.total);
for (const r of rows.slice(0, 20)) {
  console.log((TARGETS.includes(r.f) ? '* ' : '  ') + r.f.padEnd(32) + r.counts.map(n => String(n || '-').padStart(11)).join(''));
}
console.log('  (* = file proposed for archiving)');

// ── shared style partials ────────────────────────────────────────────────────
console.log('\n=== FILES THAT ARE PURE STYLE/SHARED PARTIALS ===');
for (const f of htmlFiles) {
  const src = read(f);
  const css = styleBlocks(src).length;
  const frac = css / src.length;
  if (frac > 0.6 && src.length > 1000) console.log('  ' + f.padEnd(32) + (frac * 100).toFixed(0) + '% css, ' + (src.length / 1024).toFixed(1) + 'kb');
}
