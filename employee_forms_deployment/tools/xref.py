#!/usr/bin/env python3
"""
xref.py  —  GAS function cross-reference
Usage: python tools/xref.py ./employee_management_v2_dev > tools/xref-report.txt
"""

import re, sys, os
from pathlib import Path
from collections import defaultdict

# ── suppress well-known GAS / JS runtime names from "missing" list ────────────
SUPPRESS = {
    'SpreadsheetApp','MailApp','GmailApp','DriveApp','HtmlService','ScriptApp',
    'Session','Logger','Utilities','CacheService','LockService','PropertiesService',
    'UrlFetchApp','CalendarApp','AdminDirectory','GroupsApp',
    'Array','Object','String','Number','Boolean','Date','Math','JSON','RegExp',
    'Set','Map','Promise','Error','parseInt','parseFloat','isNaN','isFinite',
    'encodeURIComponent','decodeURIComponent','console','setTimeout','clearTimeout',
    'if','for','while','switch','catch','function','return','typeof','instanceof',
    'new','delete','void','throw','case','else','do','in','of','class','extends',
    'super','import','export','yield','async','await','describe','it','expect',
}

def walk(directory):
    for p in sorted(Path(directory).resolve().rglob('*.js')):
        if any(part.startswith('.') for part in p.parts): continue
        if 'node_modules' in p.parts: continue
        yield p

def strip_comments(src):
    src = re.sub(r'/\*.*?\*/', ' ', src, flags=re.DOTALL)
    src = re.sub(r'//[^\n]*', ' ', src)
    return src

def main():
    if len(sys.argv) < 2:
        print('Usage: python xref.py <project-dir> [output-file]')
        sys.exit(1)

    target   = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    base     = Path(target).resolve()

    js_files = list(walk(base))

    # ── Pass 1: collect definitions ──────────────────────────────────────────
    # catches:  function name(   async function name(   and  name = function(
    DEFINE_RE = re.compile(r'(?<!\.)(?:async\s+)?function\s+(\w+)\s*\(')
    VARDEF_RE  = re.compile(r'(?:var|let|const)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(')

    defined   = defaultdict(list)   # name -> [file, ...]
    file_srcs = {}                  # relpath -> comment-stripped source

    for f in js_files:
        src = f.read_text(encoding='utf-8', errors='replace')
        rel = str(f.relative_to(base))
        file_srcs[rel] = strip_comments(src)
        for m in DEFINE_RE.finditer(src):
            defined[m.group(1)].append(rel)
        for m in VARDEF_RE.finditer(src):
            name = m.group(1)
            if rel not in defined[name]:
                defined[name].append(rel)

    defined_names = set(defined)

    # ── Pass 2: collect calls ─────────────────────────────────────────────────
    # only bare calls (not  obj.method() ) — negative lookbehind for '.'
    CALL_RE = re.compile(r'(?<!\.)(?<![a-zA-Z0-9_])([A-Za-z_]\w*)\s*\(')
    KEYWORDS = {'if','for','while','switch','catch','function','return','typeof',
                'instanceof','new','delete','void','throw','case','else','do',
                'in','of','class','extends','super','import','export','yield',
                'async','await'}

    callers  = defaultdict(set)   # defined fn -> set of files that call it
    missing  = defaultdict(set)   # unknown fn -> set of files that call it

    for rel, src in file_srcs.items():
        for m in CALL_RE.finditer(src):
            name = m.group(1)
            if name in KEYWORDS: continue
            if name in SUPPRESS:  continue
            if name in defined_names:
                callers[name].add(rel)
            else:
                missing[name].add(rel)

    # ── Build report ──────────────────────────────────────────────────────────
    lines = []
    def w(s=''): lines.append(s)

    dead  = sorted(n for n in defined_names if not callers.get(n))
    dupes = sorted(n for n, fs in defined.items() if len(fs) > 1)

    w('=' * 72)
    w('  GAS CROSS-REFERENCE REPORT')
    w(f'  Target  : {base}')
    w(f'  JS files: {len(js_files)}')
    w(f'  Defined : {len(defined_names)}')
    w(f'  Dead    : {len(dead)}   (defined but never called)')
    w(f'  Dupes   : {len(dupes)}   (same name in multiple files)')
    w(f'  Missing : {len(missing)}   (called but never defined)')
    w('=' * 72)

    # ── Section A: all defined functions + caller count ───────────────────────
    w()
    w('-' * 72)
    w('A. ALL DEFINED FUNCTIONS')
    w('-' * 72)
    w(f'  {"Function":<42} {"File":<38} Callers')
    w(f'  {"-"*40}  {"-"*36}  -------')
    for name in sorted(defined_names, key=str.lower):
        files = defined[name]
        n_callers = len(callers.get(name, set()))
        tags = (' [DUPE]' if len(files) > 1 else '') + (' [DEAD]' if n_callers == 0 else '')
        w(f'  {name:<42} {files[0]:<38} {n_callers}{tags}')
        for f in files[1:]:
            w(f'  {"":42} {f}')

    # ── Section B: callers per function ──────────────────────────────────────
    w()
    w('-' * 72)
    w('B. CALLER LIST  (who calls each function)')
    w('-' * 72)
    for name in sorted(defined_names, key=str.lower):
        call_files = sorted(callers.get(name, set()))
        if not call_files: continue
        w(f'\n  {name}  ({len(call_files)})')
        for f in call_files:
            w(f'    <- {f}')

    # ── Section C: dead functions ─────────────────────────────────────────────
    w()
    w('-' * 72)
    w(f'C. DEAD — defined but never called  ({len(dead)})')
    w('-' * 72)
    if dead:
        for name in dead:
            w(f'  [DEAD]  {name:<42} {defined[name][0]}')
    else:
        w('  (none)')

    # ── Section D: missing functions ──────────────────────────────────────────
    w()
    w('-' * 72)
    w(f'D. MISSING — called but never defined  ({len(missing)})')
    w('   (GAS builtins and JS keywords suppressed)')
    w('-' * 72)
    if missing:
        for name in sorted(missing, key=str.lower):
            files = sorted(missing[name])
            w(f'\n  [MISSING]  {name}')
            for f in files:
                w(f'    -> {f}')
    else:
        w('  (none — all calls resolve)')

    w()
    w('=' * 72)
    w('END OF REPORT')
    w('=' * 72)

    report = '\n'.join(lines)

    if out_path:
        Path(out_path).write_text(report, encoding='utf-8')
        print(f'Report written to: {out_path}')
        print(f'  Defined: {len(defined_names)}  Dead: {len(dead)}  Dupes: {len(dupes)}  Missing: {len(missing)}')
    else:
        print(report)

if __name__ == '__main__':
    main()
