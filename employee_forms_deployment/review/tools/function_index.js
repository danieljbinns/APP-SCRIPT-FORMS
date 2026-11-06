// READ-ONLY. Function index per file + files nothing references.
const fs = require('fs'), path = require('path');
const SRC = 'P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment/employee_management_v2';

function walk(dir, base) {
  base = base || '';
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(p, rel));
    else if (/\.(js|html)$/.test(e.name)) out.push({ rel, src: fs.readFileSync(p, 'utf8') });
  }
  return out;
}

const files = walk(SRC);
const js = files.filter(f => f.rel.endsWith('.js'));
const html = files.filter(f => f.rel.endsWith('.html'));

const DECL = [
  /^function\s+([A-Za-z_$][\w$]*)/gm,
  /^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/gm,
  /^class\s+([A-Za-z_$][\w$]*)/gm,
];

const declOf = {}, owner = {};
for (const f of js) {
  const names = new Set();
  for (const re of DECL) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(f.src))) names.add(m[1]);
  }
  declOf[f.rel] = Array.from(names).sort();
  for (const n of names) { (owner[n] = owner[n] || []).push(f.rel); }
}

// Reference counts outside the declaring file. Built with RegExp from a source
// string assembled at runtime so no escape sequences are hand-written.
const WB = String.fromCharCode(92) + 'b';   // \b
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, c => String.fromCharCode(92) + c);

const allNames = Object.keys(owner);
const refsOutside = {}, refsIn = {};
for (const n of allNames) {
  const re = new RegExp(WB + esc(n) + WB, 'g');
  let total = 0;
  const where = [];
  for (const f of files) {
    if (owner[n].indexOf(f.rel) !== -1) continue;
    const m = f.src.match(re);
    if (m) { total += m.length; where.push(f.rel); }
  }
  refsOutside[n] = total;
  refsIn[n] = where;
}

const htmlRefRe = /(?:include|createTemplateFromFile|createHtmlOutputFromFile)\(\s*['"]([^'"]+)['"]/g;
const referencedHtml = new Set();
for (const f of files) {
  htmlRefRe.lastIndex = 0;
  let m;
  while ((m = htmlRefRe.exec(f.src))) referencedHtml.add(m[1] + '.html');
}

console.log('=== FUNCTION INDEX ===');
console.log('file'.padEnd(36) + 'lines'.padStart(6) + 'globals'.padStart(9) + 'used-elsewhere'.padStart(16) + '  dead-globals');
for (const f of js.slice().sort((a, b) => a.rel.localeCompare(b.rel))) {
  const d = declOf[f.rel];
  const used = d.filter(n => refsOutside[n] > 0);
  const dead = d.filter(n => refsOutside[n] === 0);
  console.log(
    f.rel.padEnd(36) +
    String(f.src.split('\n').length).padStart(6) +
    String(d.length).padStart(9) +
    String(used.length).padStart(16) +
    '  ' + (dead.length ? dead.length + (dead.length <= 4 ? ' (' + dead.join(', ') + ')' : '') : '-')
  );
}

console.log('\n=== JS FILES WHOSE GLOBALS ARE NEVER USED ELSEWHERE ===');
const orphanJs = js.filter(f => declOf[f.rel].length && declOf[f.rel].every(n => refsOutside[n] === 0));
console.log(orphanJs.length ? orphanJs.map(f => '  ' + f.rel + '  (' + declOf[f.rel].length + ' globals)').join('\n') : '  none');

console.log('\n=== DUPLICATE GLOBAL NAMES ===');
const dup = allNames.filter(n => owner[n].length > 1);
console.log(dup.length ? dup.map(n => '  ' + n + ': ' + owner[n].join(', ')).join('\n') : '  none');

console.log('\n=== HTML NEVER include()d OR TEMPLATED ===');
const orphanHtml = html.map(f => f.rel).filter(r => !referencedHtml.has(r.split('/').pop()));
console.log(orphanHtml.length ? orphanHtml.map(r => '  ' + r).join('\n') : '  none');

const totalDead = allNames.filter(n => refsOutside[n] === 0).length;
console.log('\ntotals: ' + js.length + ' JS, ' + html.length + ' HTML, ' + allNames.length +
            ' globals, ' + totalDead + ' never referenced outside their own file');

fs.writeFileSync(path.join(__dirname, 'index.json'),
  JSON.stringify({ declOf, refsOutside, refsIn, orphanHtml, dup }, null, 2));
console.log('full index -> index.json');
