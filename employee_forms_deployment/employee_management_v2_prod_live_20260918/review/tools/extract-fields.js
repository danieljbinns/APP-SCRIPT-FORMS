#!/usr/bin/env node
/**
 * extract-fields.js — build the field inventory for a form template.
 *
 * READ-ONLY. Reads a .html template from the snapshot root and writes JSON to review/fields/.
 * It never modifies anything outside review/.
 *
 * Usage:   node review/tools/extract-fields.js InitialRequest.html FORM_NEW_HIRE
 *          node review/tools/extract-fields.js --all
 *
 * Why a script: line numbers and markup drift with every snapshot. Re-running this against a
 * newer pull regenerates the mechanical facts (control name, type, required, section, classes,
 * conditional wrapper, line) so a diff shows real change instead of reformatting noise.
 * The human-authored columns (purpose, effect, downstream) live in review/fields/*.notes.json
 * and are merged in by merge-fields.js — they are never overwritten by this script.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'review', 'fields');

/**
 * FORMS — one entry per *form as a user meets it*, i.e. per template mode.
 *
 * Three of these share InitialRequest.html. That sharing is deliberate: one template, one set of
 * field definitions, so a field only has to be changed once. It is NOT three copies of a form.
 * They are listed separately here because each mode is a distinct form in use, with its own route,
 * its own audience and its own visible/required field set — which is exactly what this inventory
 * has to capture. `sharesTemplateWith` records the relationship so an edit to a shared field is
 * known to land on every mode at once.
 */
const FORMS = [
  {
    key: 'FORM_NEW_HIRE', file: 'InitialRequest.html', mode: 'new_hire', baseMode: 'new_hire',
    label: 'New Employee Request', route: 'ROUTE_INITIAL_REQUEST',
    sharesTemplateWith: ['FORM_EQUIPMENT', 'FORM_IT_CONFIRMATION'],
  },
  {
    key: 'FORM_EQUIPMENT', file: 'InitialRequest.html', mode: 'equipment', baseMode: 'equipment',
    label: 'Equipment and Systems Request', route: 'ROUTE_EQUIPMENT_REQUEST',
    sharesTemplateWith: ['FORM_NEW_HIRE', 'FORM_IT_CONFIRMATION'],
  },
  {
    key: 'FORM_IT_CONFIRMATION', file: 'InitialRequest.html', mode: 'it_confirmation', baseMode: 'new_hire',
    label: 'IT Confirmation', route: 'ROUTE_IT_CONFIRMATION',
    sharesTemplateWith: ['FORM_NEW_HIRE', 'FORM_EQUIPMENT'],
    variantNote: 'baseMode is set from the workflow: new_hire for NEW_EMP_, equipment for EQUIP_REQ_. When baseMode is equipment the new-hire-only fields are hidden here too. A CHANGE_ workflow uses PositionSiteChangeRequest.html instead — see FORM_IT_CONFIRMATION_CHANGE.',
  },
  {
    key: 'FORM_TERMINATION', file: 'TerminationRequest.html', mode: 'default', baseMode: null,
    label: 'End of Employment Request', route: 'ROUTE_TERMINATION', sharesTemplateWith: [],
  },
  {
    key: 'FORM_POSITION_CHANGE', file: 'PositionSiteChangeRequest.html', mode: 'default', baseMode: null,
    label: 'Position / Site Change', route: 'ROUTE_POSITION_CHANGE',
    sharesTemplateWith: ['FORM_IT_CONFIRMATION_CHANGE'],
  },
  {
    key: 'FORM_IT_CONFIRMATION_CHANGE', file: 'PositionSiteChangeRequest.html', mode: 'it_confirmation', baseMode: null,
    label: 'IT Confirmation — Status Change', route: 'ROUTE_IT_CONFIRMATION',
    sharesTemplateWith: ['FORM_POSITION_CHANGE'],
  },
];

/**
 * How each template gates fields per mode. Transcribed from the template's own mode CSS block and
 * the DOMContentLoaded mode handling — kept here as data so the rules are auditable in one place.
 */
const MODE_RULES = {
  'InitialRequest.html': {
    hiddenWhen: {
      'new-hire-only': f => f.mode === 'equipment' || f.baseMode === 'equipment',
      'systems-only':  f => f.mode === 'equipment' || f.baseMode === 'equipment',
    },
    hiddenWrappers: {
      gatekeeperSection: f => f.mode !== 'new_hire',
    },
    // equipment mode also disables the hidden controls so browser validation skips them
    disabledWhen: {
      'new-hire-only': f => f.mode === 'equipment' || f.baseMode === 'equipment',
    },
    perControl: {
      jobSiteNumber: {
        note: 'explicitly disabled, un-required and its wrapper hidden in equipment mode',
        hidden: f => f.mode === 'equipment' || f.baseMode === 'equipment',
        disabled: f => f.mode === 'equipment' || f.baseMode === 'equipment',
      },
    },
  },
};

/** Tags we treat as data-carrying controls. */
const CONTROL_RE = /<(input|select|textarea)\b([^>]*)>/gi;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/g;

function attrs(raw) {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
  }
  // valueless attributes (required, disabled, checked, multiple)
  raw.split(/\s+/).forEach(tok => {
    const t = tok.replace(/[/>]+$/, '').toLowerCase();
    if (['required', 'disabled', 'checked', 'multiple', 'readonly'].includes(t) && !(t in out)) out[t] = '';
  });
  return out;
}

/** Nearest preceding section heading, so each field lands under the block the user sees. */
function buildSectionIndex(lines) {
  const HEAD_RE = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>|class="[^"]*\bsection-title\b[^"]*"[^>]*>([^<]{2,80})/i;
  const idx = [];
  lines.forEach((line, i) => {
    const m = line.match(HEAD_RE);
    if (m) {
      const text = (m[2] || m[3] || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
      if (text && text.length < 90) idx.push({ line: i + 1, text });
    }
  });
  return idx;
}

function sectionFor(idx, line) {
  let cur = null;
  for (const s of idx) { if (s.line <= line) cur = s; else break; }
  return cur ? cur.text : null;
}

/** Label text: the <label for=...> anywhere in the file, else the nearest preceding label. */
function buildLabelIndex(src, lines) {
  const byFor = {};
  const LBL_RE = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
  let m;
  while ((m = LBL_RE.exec(src)) !== null) {
    const a = attrs(m[1]);
    const text = m[2].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
    const line = src.slice(0, m.index).split('\n').length;
    if (a.for) byFor[a.for] = text;
    (byFor.__seq || (byFor.__seq = [])).push({ line, text });
  }
  return byFor;
}

function nearestLabel(labelIdx, line) {
  const seq = labelIdx.__seq || [];
  let best = null;
  for (const l of seq) { if (l.line <= line && line - l.line <= 6) best = l; }
  return best ? best.text : null;
}

/**
 * Mode-gating classes. These sit on WRAPPER elements, not on the controls themselves, so
 * resolving them needs real ancestry — see scanWithAncestry().
 */
const MODE_CLASSES = ['new-hire-only', 'systems-only', 'equipment-only', 'gated-form'];

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/**
 * Walk the template maintaining an open-element stack, so every control knows its real ancestors.
 *
 * Needed because both facts this inventory depends on live on ancestors, not on the control:
 *   - `.new-hire-only` / `.systems-only` are applied to wrapper divs
 *   - the div the page script shows/hides is an ancestor, not merely the nearest preceding id
 * Calls back with (tagName, attrs, line, ancestors) for each input/select/textarea.
 */
function scanWithAncestry(src, onControl) {
  const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g;
  const stack = [];
  let m;
  while ((m = TAG_RE.exec(src)) !== null) {
    const [, closing, rawTag, rawAttrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    const line = src.slice(0, m.index).split('\n').length;

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }

    const a = attrs(rawAttrs);
    if (['input', 'select', 'textarea'].includes(tag)) {
      onControl(tag, a, line, stack.slice());
      if (tag === 'input' || selfClose) continue;
    }
    if (VOID_TAGS.has(tag) || selfClose) continue;
    if (['script', 'style'].includes(tag)) {
      const end = src.indexOf(`</${tag}`, TAG_RE.lastIndex);
      if (end !== -1) TAG_RE.lastIndex = end;
      continue;
    }
    stack.push({ tag, id: a.id || null, classes: (a.class || '').split(/\s+/).filter(Boolean), line });
  }
}

/** Resolve gating from the control's own classes plus every ancestor. */
function conditionalFor(ancestors, classList, toggled) {
  const chain = [{ id: null, classes: classList }, ...ancestors.slice().reverse()];

  let modeClass = null, modeSource = null;
  for (const node of chain) {
    const hit = node.classes.find(c => MODE_CLASSES.includes(c));
    if (hit) { modeClass = hit; modeSource = node.id ? `#${node.id}` : `.${node.classes.join('.')}`; break; }
  }

  // Every show/hide ancestor, innermost first. The outermost is usually #mainForm (the gatekeeper
  // reveal), which gates the whole page rather than this field — so a field whose only gate is
  // #mainForm is "always shown" in practice.
  const gateChain = chain.filter(n => n.id && toggled[n.id]).map(n => n.id);

  return {
    modeClass,
    modeSource,
    gateChain,
    wrapper: gateChain.find(id => id !== 'mainForm') || null,
    pageGate: gateChain.includes('mainForm') ? 'mainForm' : null,
    ancestorIds: ancestors.map(n => n.id).filter(Boolean),
  };
}

/**
 * Element ids that the page script shows/hides, with the rule that drives each one.
 *
 * Handles both shapes used by these templates:
 *   document.getElementById('x').style.display = ...
 *   const foo = document.getElementById('x');  ...  foo.style.display = cond ? 'block' : 'none';
 * The second is the common one here, so variable names are resolved back to their element id.
 */
function buildToggleIndex(src) {
  const lines = src.split('\n');
  const varToId = {};
  const VAR_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = VAR_RE.exec(src)) !== null) varToId[m[1]] = m[2];

  const toggles = {};
  const record = (id, line, rule) => {
    if (!id) return;
    (toggles[id] || (toggles[id] = { id, rules: [] })).rules.push({ line, rule });
  };

  lines.forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trim();

    let d = text.match(/document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\s*\.style\.display\s*=\s*(.+?);?$/);
    if (d) return record(d[1], line, d[2].trim());

    let v = text.match(/^([A-Za-z_$][\w$]*)\s*\.style\.display\s*=\s*(.+?);?$/);
    if (v && varToId[v[1]]) return record(varToId[v[1]], line, v[2].trim());

    let c = text.match(/(?:document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)|^([A-Za-z_$][\w$]*))\s*\.classList\.(?:add|remove|toggle)\(\s*['"]([^'"]+)['"]/);
    if (c) {
      const id = c[1] || varToId[c[2]];
      if (id) return record(id, line, `classList ${c[3]}`);
    }
  });

  return toggles;
}

/**
 * Controls that do not exist in the markup because the page builds them at load time.
 *
 * buildDualList('<containerId>', <source>, '<fieldName>', ...) renders a checkbox group from
 * reference data. A markup-only scan misses these entirely, and three of them
 * (adpSites, purchasingSites, jonasJobNumbers) drive downstream task creation — so they are
 * picked up here and merged into the inventory with origin 'dynamic'.
 */
function buildDynamicFields(src) {
  const out = {};
  const DUAL_RE = /buildDualList\(\s*['"]([^'"]+)['"]\s*,\s*([^,]+?)\s*,\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = DUAL_RE.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    const [, container, source, field] = m;
    if (!out[field]) out[field] = { control: field, container, source: source.trim(), type: 'checkbox', builtBy: 'buildDualList', snapshotLines: [] };
    out[field].snapshotLines.push(line);
  }
  return out;
}

/**
 * The submit payload — the authoritative list of what is actually posted to the handler.
 *
 * Parsed from the `key: formData.get/getAll('control')` object literal in the submit handler.
 * Cross-referencing this against the markup catches both directions: a control that is never
 * submitted, and a payload key with no control behind it.
 */
function buildPayloadIndex(src) {
  const out = {};
  const RE = /([A-Za-z_$][\w$]*)\s*:\s*(?:[^,\n]*?)formData\.(get|getAll)\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = RE.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    out[m[1]] = { payloadKey: m[1], readsControl: m[3], multi: m[2] === 'getAll', snapshotLine: line };
  }
  return out;
}

/**
 * How the page turns the form into the object it posts. The two templates differ, and the
 * difference decides whether an un-listed control reaches the server.
 *
 *   'explicit-map'  — a hand-written `{ key: formData.get('control'), … }` literal.
 *                     A control missing from that literal is NOT submitted.
 *   'passthrough'   — `new FormData(form)` iterated into a plain object (or Object.fromEntries).
 *                     EVERY named control is submitted under its own name; multi-values joined.
 */
function detectSubmitStyle(src, payloadCount) {
  // FormData(form) iterated into an object
  if (/new FormData\([^)]*\)[\s\S]{0,400}?\.forEach\(\s*function\s*\([^)]*\)\s*\{[\s\S]{0,400}?\[\s*key\s*\]\s*=/.test(src)) return 'passthrough';
  if (/Object\.fromEntries\(\s*new FormData/.test(src)) return 'passthrough';
  // DOM sweep: querySelectorAll over inputs/selects/checkboxes writing obj[el.name] = el.value
  if (/if\s*\(\s*(?:el|input|r|cb)\.name\s*\)\s*[A-Za-z_$][\w$]*\s*\[\s*(?:el|input|r|cb)\.name\s*\]\s*=/.test(src)) return 'passthrough-dom';
  if (payloadCount > 0) return 'explicit-map';
  return 'unknown';
}

const PASSTHROUGH_STYLES = new Set(['passthrough', 'passthrough-dom']);

/** Enclosing function name for a line, so a rule can be attributed to its handler. */
function enclosingFunction(lines, line) {
  for (let i = line - 1; i >= 0; i--) {
    const m = lines[i].match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) return m[1];
  }
  return null;
}

function extract(formDef, forms) {
  const abs = path.join(ROOT, formDef.file);
  const src = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const sectionIdx = buildSectionIndex(lines);
  const labelIdx = buildLabelIndex(src, lines);
  const toggled = buildToggleIndex(src);

  const tplSlug = path.basename(formDef.file, '.html').replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  const fields = {};

  scanWithAncestry(src, (tag, a, line, ancestors) => {
    const type = tag === 'input' ? (a.type || 'text').toLowerCase() : tag;
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) return;
    if (a.list && type === 'text' && !a.name && !a.id) return;

    const name = a.name || a.id;
    if (!name) return;

    const classList = (a.class || '').split(/\s+/).filter(Boolean);
    const cond = conditionalFor(ancestors, classList, toggled);
    // Field keys are per TEMPLATE, not per mode — the same control in new_hire and equipment mode
    // is one field, defined once. `availability` records how it behaves in each mode.
    const key = `FIELD_${tplSlug}_${name}`;

    // Checkbox/radio groups share one name: collect options instead of duplicating the field.
    if (fields[key] && ['checkbox', 'radio'].includes(type)) {
      fields[key].options.push({ value: a.value || '', line });
      return;
    }

    fields[key] = {
      key,
      control: name,
      id: a.id || null,
      label: (a.id && labelIdx[a.id]) || nearestLabel(labelIdx, line) || null,
      type,
      required: 'required' in a,
      multiple: 'multiple' in a,
      disabledInMarkup: 'disabled' in a,
      datalist: a.list || null,
      section: sectionFor(sectionIdx, line),
      classes: classList,
      modeGate: cond.modeClass,
      modeGateSource: cond.modeSource,
      // Nearest ANCESTOR the page script shows/hides, excluding the whole-page gatekeeper reveal.
      // Null means the field is always shown once the page is open.
      wrapper: cond.wrapper,
      gateChain: cond.gateChain,
      pageGate: cond.pageGate,
      ancestorIds: cond.ancestorIds,
      showHideRules: cond.wrapper
        ? toggled[cond.wrapper].rules.map(r => ({
            rule: r.rule,
            handler: enclosingFunction(lines, r.line),
            snapshotLine: r.line,
          }))
        : null,
      options: ['checkbox', 'radio'].includes(type) ? [{ value: a.value || '', line }] : [],
      snapshotLine: line,
      sourceTemplate: formDef.file,
      availability: {},
    };
  });

  // ── Dynamic controls: built at load time, absent from the markup ────────────────────────
  const dynamic = buildDynamicFields(src);
  Object.values(dynamic).forEach(d => {
    const key = `FIELD_${tplSlug}_${d.control}`;
    if (fields[key]) { fields[key].origin = 'markup+dynamic'; return; }
    fields[key] = {
      key, control: d.control, id: null,
      label: null, type: d.type, required: false, multiple: true,
      disabledInMarkup: false, datalist: null, section: null, classes: [],
      modeGate: null, modeGateSource: null, wrapper: d.container, gateChain: [], pageGate: null,
      ancestorIds: [], showHideRules: null, options: [],
      snapshotLine: d.snapshotLines[0], sourceTemplate: formDef.file,
      origin: 'dynamic',
      builtBy: d.builtBy,
      builtFrom: d.source,
      availability: {},
    };
  });
  Object.values(fields).forEach(f => { if (!f.origin) f.origin = 'markup'; });

  // ── Submit payload cross-reference ──────────────────────────────────────────────────────
  const payload = buildPayloadIndex(src);
  const submitStyle = detectSubmitStyle(src, Object.keys(payload).length);
  const controlToPayload = {};
  Object.values(payload).forEach(p => (controlToPayload[p.readsControl] || (controlToPayload[p.readsControl] = [])).push(p.payloadKey));
  Object.values(fields).forEach(f => {
    f.payloadKeys = controlToPayload[f.control] || [];
    // passthrough: every named control is posted under its own name, so there is no whitelist
    // to be absent from. explicit-map: only the listed controls reach the server.
    f.submitted = PASSTHROUGH_STYLES.has(submitStyle) ? true : f.payloadKeys.length > 0;
    if (PASSTHROUGH_STYLES.has(submitStyle) && !f.payloadKeys.length) f.payloadKeys = [f.control];
  });
  const orphanPayloadKeys = Object.values(payload)
    .filter(p => !fields[`FIELD_${tplSlug}_${p.readsControl}`])
    .map(p => ({ payloadKey: p.payloadKey, readsControl: p.readsControl, snapshotLine: p.snapshotLine }));

  // Per-mode availability: for each form served from this template, is the field shown, is it
  // disabled, and is it effectively required once the mode rules have been applied?
  const rules = MODE_RULES[formDef.file] || {};
  forms.forEach(form => {
    Object.values(fields).forEach(fld => {
      let hidden = false, disabled = fld.disabledInMarkup, why = [];

      // Match on the RESOLVED gate (modeGate), which may come from an ancestor wrapper, not from
      // the control's own class list — .new-hire-only and .systems-only are always on wrappers.
      const hasGate = cls => fld.modeGate === cls || fld.classes.includes(cls);

      for (const [cls, test] of Object.entries(rules.hiddenWhen || {})) {
        if (hasGate(cls) && test(form)) { hidden = true; why.push(`.${cls} is hidden in ${form.mode} mode${fld.modeGateSource ? ` (via ${fld.modeGateSource})` : ''}`); }
      }
      for (const [wrap, test] of Object.entries(rules.hiddenWrappers || {})) {
        if ((fld.wrapper === wrap || (fld.gateChain || []).includes(wrap) || (fld.ancestorIds || []).includes(wrap)) && test(form)) {
          hidden = true; why.push(`#${wrap} is hidden in ${form.mode} mode`);
        }
      }
      for (const [cls, test] of Object.entries(rules.disabledWhen || {})) {
        if (hasGate(cls) && test(form)) { disabled = true; why.push(`.${cls} controls are disabled in ${form.mode} mode`); }
      }
      const pc = (rules.perControl || {})[fld.control];
      if (pc) {
        if (pc.hidden && pc.hidden(form)) { hidden = true; why.push(pc.note); }
        if (pc.disabled && pc.disabled(form)) { disabled = true; }
      }

      fld.availability[form.key] = {
        visible: !hidden,
        disabled,
        requiredEffective: fld.required && !hidden && !disabled,
        reason: why.length ? why : null,
      };
    });
  });

  return {
    $comment: 'Mechanical extraction — regenerate with review/tools/extract-fields.js. Human-authored notes live in the matching .notes.json and are merged by merge-fields.js; this file is safe to overwrite. snapshotLine is valid for this snapshot only — use `control` as the durable identifier.',
    template: formDef.file,
    servesForms: forms.map(f => ({ key: f.key, label: f.label, mode: f.mode, baseMode: f.baseMode, route: f.route, variantNote: f.variantNote || null })),
    sharedTemplate: forms.length > 1,
    sharedTemplateNote: forms.length > 1
      ? 'One template, one definition per field, deliberately shared so a field is only edited once. Each mode is a distinct form in use — see servesForms and each field\'s availability map. An edit to a shared field changes every mode listed here.'
      : null,
    extractedAt: new Date().toISOString().slice(0, 10),
    fieldCount: Object.keys(fields).length,
    counts: {
      markup: Object.values(fields).filter(f => f.origin === 'markup').length,
      dynamic: Object.values(fields).filter(f => f.origin === 'dynamic').length,
      notSubmitted: Object.values(fields).filter(f => !f.submitted).length,
    },
    submitStyle,
    payloadKeys: Object.keys(payload).length,
    orphanPayloadKeys,
    fields,
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);

  // Group forms by template — fields are defined once per template.
  const byTemplate = {};
  FORMS.forEach(f => (byTemplate[f.file] || (byTemplate[f.file] = [])).push(f));

  let templates = Object.keys(byTemplate);
  if (args[0] && args[0] !== '--all') {
    templates = templates.filter(t => t === args[0] || byTemplate[t].some(f => f.key === args[0]));
  }
  if (!templates.length) {
    console.error('No match. Templates:', Object.keys(byTemplate).join(', '), '| Forms:', FORMS.map(f => f.key).join(', '));
    process.exit(1);
  }

  templates.forEach(t => {
    const forms = byTemplate[t];
    const data = extract(forms[0], forms);
    const base = path.basename(t, '.html');
    const out = path.join(OUT_DIR, `${base}.extracted.json`);
    fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
    const counts = forms.map(f => {
      const n = Object.values(data.fields).filter(x => x.availability[f.key].visible).length;
      const r = Object.values(data.fields).filter(x => x.availability[f.key].requiredEffective).length;
      return `${f.key} ${n} visible/${r} required`;
    }).join(', ');
    console.log(`${base}: ${data.fieldCount} defined -> ${counts}`);
  });
}

main();
