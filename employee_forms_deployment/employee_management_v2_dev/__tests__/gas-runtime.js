'use strict';
/**
 * gas-runtime.js
 * Complete Google Apps Script API mock runtime for local Node.js testing.
 *
 * Usage: const { makeRuntime } = require('./gas-runtime');
 *        const rt = makeRuntime();
 *        // rt.globals  → inject into vm context
 *        // rt.captures → read emails/logs/writes, seed sheets, reset
 */

// ─── In-memory spreadsheet model ──────────────────────────────────────────────

class CellRange {
  constructor(sheet, row, col, numRows, numCols) {
    this._sheet = sheet;
    this._row   = row;
    this._col   = col;
    this._numR  = numRows || 1;
    this._numC  = numCols || 1;
  }

  getValues() {
    const out = [];
    for (let r = 0; r < this._numR; r++) {
      const cols = [];
      for (let c = 0; c < this._numC; c++) {
        const srcRow = this._sheet._rows[this._row + r - 1];
        cols.push(srcRow ? (srcRow[this._col + c - 1] !== undefined ? srcRow[this._col + c - 1] : '') : '');
      }
      out.push(cols);
    }
    return out;
  }

  setValue(val) {
    this._sheet._ensureRow(this._row);
    this._sheet._ensureCol(this._row, this._col);
    this._sheet._rows[this._row - 1][this._col - 1] = val;
    this._sheet._parent._writes.push({
      op: 'setValue', sheet: this._sheet._name,
      row: this._row, col: this._col, value: val
    });
    return this;
  }

  setValues(vals) {
    for (let r = 0; r < vals.length; r++) {
      const sheetRow = this._row + r;
      this._sheet._ensureRow(sheetRow);
      for (let c = 0; c < vals[r].length; c++) {
        this._sheet._ensureCol(sheetRow, this._col + c);
        this._sheet._rows[sheetRow - 1][this._col + c - 1] = vals[r][c];
      }
    }
    this._sheet._parent._writes.push({
      op: 'setValues', sheet: this._sheet._name,
      row: this._row, col: this._col, values: vals.map(r => [...r])
    });
    return this;
  }

  // no-op formatting
  setFontWeight() { return this; }
  setBackground()  { return this; }
  setFontColor()   { return this; }
  setNumberFormat(){ return this; }
  setHorizontalAlignment() { return this; }
  setWrap()        { return this; }
  setBorder()      { return this; }
}

class SheetMock {
  constructor(name, ss) {
    this._name   = name;
    this._rows   = [];   // 0-indexed array of row arrays
    this._parent = ss;   // back-ref to spreadsheet for write capture
  }

  appendRow(values) {
    const row = values.map(v => (v === undefined ? '' : v));
    this._rows.push(row);
    this._parent._writes.push({
      op: 'appendRow', sheet: this._name,
      rowNum: this._rows.length, values: [...row]
    });
  }

  getDataRange() {
    const nr = Math.max(this._rows.length, 1);
    const nc = this._rows.reduce((m, r) => Math.max(m, r.length), 1);
    return new CellRange(this, 1, 1, nr, nc);
  }

  getRange(row, col, numRows, numCols) {
    return new CellRange(this, row, col, numRows || 1, numCols || 1);
  }

  getLastRow()    { return this._rows.length; }
  getLastColumn() { return this._rows.reduce((m, r) => Math.max(m, r.length), 0); }

  deleteRow(n) {
    if (n >= 1 && n <= this._rows.length) this._rows.splice(n - 1, 1);
  }

  setFrozenRows() { return this; }
  setColumnWidth() { return this; }

  // Test helper: seed a row of data (1-based row index not needed; just push)
  _seedRow(rowArr) {
    this._rows.push(rowArr.map(v => (v === undefined ? '' : v)));
  }

  _ensureRow(row1) {
    while (this._rows.length < row1) this._rows.push([]);
  }
  _ensureCol(row1, col1) {
    const row = this._rows[row1 - 1];
    while (row.length < col1) row.push('');
  }
}

class SpreadsheetMock {
  constructor(id) {
    this._id     = id;
    this._sheets = {};
    this._writes = [];  // shared write log
  }

  getSheetByName(name) {
    return this._sheets[name] || null;
  }

  insertSheet(name) {
    this._sheets[name] = new SheetMock(name, this);
    return this._sheets[name];
  }

  // Used internally: get or create
  _getOrCreate(name) {
    if (!this._sheets[name]) this._sheets[name] = new SheetMock(name, this);
    return this._sheets[name];
  }

  getName() { return 'MockSpreadsheet_' + this._id; }
  flush() { /* synchronous */ }
}

// ─── Runtime factory ─────────────────────────────────────────────────────────

function makeRuntime() {
  // Per-test-run state
  const _spreadsheets = {};
  let _emails        = [];   // raw MailApp.sendEmail calls
  let _emailOptions  = [];   // sendFormEmail() options (richer: includes contextData)
  let _logs          = [];
  let _drives        = [];

  function getOrCreate(id) {
    if (!_spreadsheets[id]) _spreadsheets[id] = new SpreadsheetMock(id);
    return _spreadsheets[id];
  }

  // ── GAS API objects ───────────────────────────────────────────────────────

  const SpreadsheetApp = {
    openById(id)             { return getOrCreate(id); },
    flush()                  { /* no-op */ },
    getActiveSpreadsheet()   { return getOrCreate('active'); }
  };

  const Logger = {
    log(msg) { _logs.push(String(msg)); }
  };

  // Session: return the admin email so auth checks pass
  const Session = {
    getActiveUser()      { return { getEmail() { return 'dbinns@team-group.com'; } }; },
    getScriptTimeZone()  { return 'America/New_York'; }
  };

  const MailApp = {
    sendEmail(opts) {
      _emails.push({
        to:          opts.to || opts.email || '',
        subject:     opts.subject || '',
        htmlBody:    opts.htmlBody || opts.body || '',
        name:        opts.name || '',
        replyTo:     opts.replyTo || '',
        attachments: opts.attachments || []
      });
    }
  };

  const Utilities = {
    formatDate(date, tz, format) {
      if (!(date instanceof Date)) {
        const parsed = new Date(String(date || ''));
        if (isNaN(parsed)) return String(date || '');
        date = parsed;
      }
      const MO   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const y    = String(date.getFullYear());
      const mon  = String(date.getMonth() + 1).padStart(2, '0');
      const d    = String(date.getDate());
      const dd   = d.padStart(2, '0');
      const H    = date.getHours();
      const HH   = String(H).padStart(2, '0');
      const mi   = String(date.getMinutes()).padStart(2, '0');
      const ss   = String(date.getSeconds()).padStart(2, '0');
      const h    = String(H % 12 || 12);
      const ampm = H < 12 ? 'AM' : 'PM';
      // Replace longest tokens first to avoid substring collisions
      return format
        .replace('yyyy', y)
        .replace('MMM',  MO[date.getMonth()])
        .replace('MM',   mon)
        .replace('HH',   HH)
        .replace('dd',   dd)
        .replace('mm',   mi)
        .replace('ss',   ss)
        .replace(/(?<![a-zA-Z])d(?![a-zA-Z])/, d)
        .replace(/(?<![a-zA-Z])h(?![a-zA-Z])/, h)
        .replace(/(?<![a-zA-Z])a(?![a-zA-Z])/, ampm);
    },
    getUuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    },
    base64Decode(str)          { return Buffer.from(str, 'base64'); },
    base64Encode(bytes)        { return Buffer.from(bytes).toString('base64'); },
    base64EncodeWebSafe(bytes) { return Buffer.from(bytes).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'); },
    newBlob(data, type, name)  {
      return {
        getBytes()       { return data; },
        getContentType() { return type || 'application/octet-stream'; },
        getName()        { return name || 'blob'; },
        setContentType(t){ return this; },
        setName(n)       { return this; }
      };
    }
  };

  const LockService = {
    getScriptLock() {
      return {
        waitLock(ms) { /* always succeeds */ },
        releaseLock() { /* no-op */ }
      };
    }
  };

  const _cache = {};
  const CacheService = {
    getScriptCache() {
      return {
        get(key)          { return _cache[key] || null; },
        put(key, val, ttl){ _cache[key] = val; },
        remove(key)       { delete _cache[key]; },
        getAll(keys)      { const r = {}; keys.forEach(k => { if (_cache[k]) r[k] = _cache[k]; }); return r; },
        putAll(pairs, ttl){ Object.assign(_cache, pairs); },
        removeAll(keys)   { keys.forEach(k => delete _cache[k]); }
      };
    }
  };

  const ScriptApp = {
    getService() {
      return { getUrl() { return 'https://script.google.com/macros/s/TEST_DEV_DEPLOY/exec'; } };
    }
  };

  const DriveApp = {
    getFolderById(id) {
      return {
        createFile(name, content, mimeType) {
          const fid = 'mock-file-' + name.replace(/[^a-z0-9]/gi, '_');
          _drives.push({ folderId: id, name, mimeType, id: fid });
          return {
            getId()         { return fid; },
            getUrl()        { return 'https://drive.google.com/file/d/' + fid; },
            setSharing()    { return this; }
          };
        }
      };
    }
  };

  const HtmlService = {
    createTemplateFromFile(name) {
      return {
        workflowId: '', requestData: {}, referenceData: '{}', mode: '', baseMode: '',
        evaluate() {
          return {
            setTitle(t)             { return this; },
            setXFrameOptionsMode(m) { return this; },
            getContent()            { return '<html></html>'; }
          };
        }
      };
    },
    createHtmlOutput(html) {
      return {
        setTitle(t)             { return this; },
        setXFrameOptionsMode(m) { return this; },
        getContent()            { return html || ''; }
      };
    },
    createHtmlOutputFromFile(name) { return this.createHtmlOutput(''); },
    createTemplate(html)           { return this.createTemplateFromFile(html); },
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' }
  };

  const ContentService = {
    createTextOutput(s) {
      return {
        setMimeType(m) { return this; },
        getContent()   { return s || ''; }
      };
    },
    MimeType: { JSON: 'application/json', TEXT: 'text/plain', CSV: 'text/csv' }
  };

  const PropertiesService = {
    getScriptProperties() {
      const _props = {};
      return {
        getProperty(key)          { return _props[key] || null; },
        setProperty(key, val)     { _props[key] = String(val); },
        getProperties()           { return { ..._props }; },
        setProperties(obj)        { Object.assign(_props, obj); },
        deleteProperty(key)       { delete _props[key]; },
        deleteAllProperties()     { Object.keys(_props).forEach(k => delete _props[k]); }
      };
    },
    getUserProperties() { return this.getScriptProperties(); }
  };

  // ConfigurationService: returns test values so Config.js getters resolve correctly
  const ConfigurationService = {
    getSetting(key) {
      const MAP = {
        SPREADSHEET_ID:                  'TEST_SS_ID',
        SHARED_DRIVE_ID:                 'TEST_DRIVE_ID',
        MAIN_FOLDER_ID:                  'TEST_MAIN_FOLDER',
        TERM_ATTACHMENTS_FOLDER_ID:      'TEST_TERM_FOLDER',
        CHANGE_ATTACHMENTS_FOLDER_ID:    'TEST_CHANGE_FOLDER',
        DEPLOYMENT_URL:                  'https://script.google.com/macros/s/TEST_DEV_DEPLOY/exec',
        SUPPRESS_EMAILS_OVERRIDE:        'false',
        MAINTENANCE_MODE:                'false',
        EMAIL_REDIRECT_ALL:              'dbinns@team-group.com',
        EMAIL_HR:                        'grp.forms.hr@team-group.com',
        EMAIL_IT:                        'grp.forms.it@team-group.com',
        EMAIL_IDSETUP:                   'grp.forms.idsetup@team-group.com',
        EMAIL_FLEETIO:                   'grp.forms.fleetio@team-group.com',
        EMAIL_CREDIT_CARD:               'grp.forms.creditcard@team-group.com',
        EMAIL_BUSINESS_CARDS:            'davelangohr@team-group.com',
        EMAIL_REVIEW306090:              'grp.forms.review306090@team-group.com',
        EMAIL_JONAS:                     'grp.forms.jonas@team-group.com',
        EMAIL_SAFETY:                    'grp.forms.safety@team-group.com',
        EMAIL_PAYROLL:                   'payroll@team-group.com',
        EMAIL_IT_CONFIRMATION:           'davelangohr@team-group.com'
      };
      return MAP[key] || null;
    }
  };

  // ── Capture helpers ───────────────────────────────────────────────────────

  const captures = {
    // Call this from wrapped sendFormEmail to capture raw options
    pushEmailOptions(opts) {
      _emailOptions.push({
        to:          opts.to || '',
        subject:     opts.subject || '',
        body:        opts.body || '',
        formUrl:     opts.formUrl || '',
        displayName: opts.displayName || '',
        contextData: opts.contextData ? JSON.parse(JSON.stringify(opts.contextData)) : {}
      });
    },

    getEmails()       { return _emails; },
    getEmailOptions() { return _emailOptions; },
    getLogs()         { return _logs; },
    getDriveFiles()   { return _drives; },

    getSheet(sheetName) {
      const ss = _spreadsheets['TEST_SS_ID'];
      return ss ? ss._sheets[sheetName] : null;
    },

    getAllWrites() {
      const out = [];
      for (const ss of Object.values(_spreadsheets)) {
        out.push(...ss._writes);
      }
      return out;
    },

    getWritesFor(sheetName) {
      const out = [];
      for (const ss of Object.values(_spreadsheets)) {
        out.push(...ss._writes.filter(w => w.sheet === sheetName));
      }
      return out;
    },

    getAppendsFor(sheetName) {
      return this.getWritesFor(sheetName).filter(w => w.op === 'appendRow');
    },

    getUpdatesFor(sheetName) {
      return this.getWritesFor(sheetName).filter(w => w.op === 'setValues' || w.op === 'setValue');
    },

    // Seed a sheet with header + data rows before a test
    seedSheet(sheetName, rows) {
      const ss = getOrCreate('TEST_SS_ID');
      ss._getOrCreate(sheetName);
      rows.forEach(r => ss._sheets[sheetName]._seedRow(r));
    },

    reset() {
      Object.keys(_spreadsheets).forEach(k => delete _spreadsheets[k]);
      _emails.length       = 0;
      _emailOptions.length = 0;
      _logs.length         = 0;
      _drives.length       = 0;
      Object.keys(_cache).forEach(k => delete _cache[k]);
    }
  };

  return {
    globals: {
      SpreadsheetApp,
      Logger,
      Session,
      MailApp,
      Utilities,
      LockService,
      CacheService,
      ScriptApp,
      DriveApp,
      HtmlService,
      ContentService,
      PropertiesService,
      ConfigurationService,
      // GAS-style globals that some files may reference
      console: typeof console !== 'undefined' ? console : { log: () => {} }
    },
    captures
  };
}

module.exports = { makeRuntime };
