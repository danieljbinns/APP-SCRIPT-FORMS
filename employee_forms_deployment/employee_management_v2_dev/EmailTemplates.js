/**
 * Email Templates — Workflow-Specific Context Block Builders
 *
 * Each exported function returns an HTML string (sections only) for
 * injection into createEmailTemplateV2() via createContextBlockV2()
 * in EmailUtils.js.
 *
 * Styling: all inline, using ES.* tokens + es*() helpers from EmailUtils.js.
 * No external CSS — Gmail strips <style> blocks.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  buildNewHireContextBlock(context, opts)     — COMPLETE      │
 * │  buildTerminationContextBlock(context, opts) — PLACEHOLDER   │
 * │  buildStatusChangeContextBlock(context, opts)— PLACEHOLDER   │
 * └──────────────────────────────────────────────────────────────┘
 *
 * opts: {
 *   showPasswords: boolean  — show credential passwords (manager/requester only)
 * }
 *
 * To add a new workflow: create buildXyzContextBlock(), register in
 * createContextBlockV2() router in EmailUtils.js.
 */


// ================================================================
// CONSTANTS
// ================================================================

/**
 * Systems that route to specialist action-item handlers (not IT-provisioned).
 * Checked case-insensitively via _isSpecialist().
 */
var SPECIALIST_SYSTEMS = [
  'Credit Card',
  'Business Cards',
  'Fleetio',
  'JONAS',
  'Jonas',
  '30-60-90',
  '30/60/90'
];

function _isSpecialist(sys) {
  return SPECIALIST_SYSTEMS.some(function(k) {
    return String(sys).toLowerCase().indexOf(k.toLowerCase()) !== -1;
  });
}


// ================================================================
// NEW HIRE
// ================================================================

/**
 * Builds the full progressive context block for New Hire emails.
 *
 * Five sections — each shows current completion state from context:
 *   1. Request Details  — always Complete
 *   2. ID Setup         — Complete / Active / Queued
 *   3. HR Verification  — Complete / Active / Queued
 *   4. IT Setup         — Complete / Active / Queued / N/A
 *   5. Specialists      — Active (in progress) / Queued  [no individual completion yet]
 *
 * @param {Object} context  — from getWorkflowContext()
 * @param {Object} [opts]   — { showPasswords: boolean }
 */
function buildNewHireContextBlock(context, opts) {
  opts = opts || {};
  var showPw = opts.showPasswords === true;

  // ── Step completion flags ─────────────────────────────────
  var hasId   = !!(context.internalEmployeeId);
  var hasHr   = !!(context.adpAssociateId);
  var hasIt   = !!(context.assignedEmail);
  // Hourly employees with no system access skip IT entirely
  var needsIt = !(context.employmentType === 'Hourly' && String(context.systemAccess || '') === 'No');

  // ── Step statuses ─────────────────────────────────────────
  var idSt  = hasId ? 'complete' : 'active';
  var hrSt  = hasHr ? 'complete' : (hasId  ? 'active' : 'queued');
  var itSt  = !needsIt ? 'na'   : (hasIt  ? 'complete' : (hasHr ? 'active' : 'queued'));

  // Specialists unlock after HR (hourly) or IT (salary)
  var specReady  = needsIt ? hasIt : hasHr;
  var specSt     = specReady ? 'active' : 'queued';

  // ── Systems: IT vs Specialists ────────────────────────────
  var systems     = Array.isArray(context.systems) ? context.systems : [];
  var itSystems   = systems.filter(function(s) { return !_isSpecialist(s); });
  var specialists = systems.filter(function(s) { return  _isSpecialist(s); });

  // ── Hire date — human-readable ────────────────────────────
  var hireDisplay = '';
  if (context.hireDate) {
    try {
      var hd = context.hireDate instanceof Date
        ? context.hireDate
        : new Date(String(context.hireDate).replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T12:00:00'));
      hireDisplay = !isNaN(hd.getTime())
        ? Utilities.formatDate(hd, Session.getScriptTimeZone(), 'MMM d, yyyy')
        : String(context.hireDate).substring(0, 10);
    } catch (e) {
      hireDisplay = String(context.hireDate).substring(0, 10);
    }
  }

  // ── Local helpers ─────────────────────────────────────────
  function pRow(label, text) {
    return esRow(label, esVal(text || ('Pending ' + label), 'pending'));
  }
  function qRow(label) {
    return esRow(label, esVal('— Queued', 'queued'));
  }

  // ============================================================
  // SECTION 1 — Request Details
  // Always complete — the request was submitted to start the workflow.
  // ============================================================

  var empName = (context.firstName && context.lastName)
    ? (context.firstName + ' ' + context.lastName)
    : (context.employeeName || '');
  if (context.preferredName) empName += ' (' + context.preferredName + ')';

  var reqRows = ''
    + esRow('Employee',    esVal(empName.trim()))
    + (context.employmentType
        ? esRow('Type', esVal(context.employmentType + (context.employeeType ? ' · ' + context.employeeType : '')))
        : '')
    + (context.jobTitle    ? esRow('Job Title',    esVal(context.jobTitle))    : '')
    + (context.siteName    ? esRow('Site',         esVal(context.siteName))    : '')
    + (context.department  ? esRow('Department',   esVal(context.department))  : '')
    + (hireDisplay         ? esRow('Start Date',   esVal(hireDisplay))         : '')
    + esDivider()
    + (context.managerName
        ? esRow('Manager', esVal(context.managerName + (context.managerEmail ? ' · ' + context.managerEmail : '')))
        : '')
    + (context.requesterEmail ? esRow('Requested By', esVal(context.requesterEmail)) : '');

  var reqSection = esSection(
    'Request Details', 'complete', '✓ Submitted',
    context.requestDate ? 'Submitted · ' + context.requestDate : '',
    reqRows
  );

  // ============================================================
  // SECTION 2 — ID Setup
  // ============================================================

  var idRows = '';
  if (hasId) {
    // Show all available ID credential fields whenever data exists
    idRows = ''
      + (context.internalEmployeeId ? esRow('Internal ID',   esVal(context.internalEmployeeId, 'mono')) : '')
      + (context.siteDocsWorkerId   ? esRow('Worker ID',     esVal(context.siteDocsWorkerId,   'mono')) : '')
      + (context.siteDocsJobCode    ? esRow('Job Code',      esVal(context.siteDocsJobCode,    'mono')) : '')
      + esDivider()
      + (context.siteDocsUsername   ? esRow('SiteDocs Login',  esVal(context.siteDocsUsername, 'mono')) : '')
      + (context.siteDocsPassword   ? esRow('SiteDocs Pwd',    esVal(context.siteDocsPassword,  'mono')) : '')
      + (context.dssUsername        ? esRow('DSS Login',       esVal(context.dssUsername,        'mono')) : '')
      + (context.dssPassword        ? esRow('DSS Pwd',         esVal(context.dssPassword,        'mono')) : '')
      + (context.bossWisCreated     ? esRow('BOSS WIS',        esVal(context.bossWisCreated))            : '');
  } else if (idSt === 'active') {
    idRows = pRow('ID Setup', 'In progress — awaiting ID Setup team');
  } else {
    idRows = qRow('ID Setup');
  }

  var idActor = idSt === 'complete' && context.idSubmittedBy
    ? 'Completed by ' + context.idSubmittedBy + (context.idTimestamp ? ' · ' + context.idTimestamp : '')
    : (idSt === 'active' ? 'Assigned to ID Setup team' : '');
  var idBadge = idSt === 'complete' ? '✓ Complete' : (idSt === 'active' ? '⏳ In Progress' : '— Queued');

  var idSection = esSection('ID Setup', idSt, idBadge, idActor, idRows);

  // ============================================================
  // SECTION 3 — HR Verification
  // ============================================================

  var hrRows = '';
  if (hasHr) {
    // Show all available HR fields whenever data exists
    hrRows = ''
      + (context.adpAssociateId ? esRow('ADP Associate ID', esVal(context.adpAssociateId, 'mono')) : '')
      + (context.jobTitle        ? esRow('HR Job Title',    esVal(context.jobTitle))               : '')
      + (context.jrTitle         ? esRow('JR Title',        esVal(context.jrTitle))                : '');
  } else if (hrSt === 'active') {
    hrRows = pRow('HR Verification', 'Awaiting HR — form link above');
  } else {
    hrRows = qRow('HR Verification');
  }

  var hrActor = hrSt === 'complete' && context.hrSubmittedBy
    ? 'Completed by ' + context.hrSubmittedBy + (context.hrTimestamp ? ' · ' + context.hrTimestamp : '')
    : (hrSt === 'active' ? 'Assigned to HR team' : '');
  var hrBadge = hrSt === 'complete' ? '✓ Complete' : (hrSt === 'active' ? '⏳ Awaiting HR' : '— Queued');

  var hrSection = esSection('HR Verification', hrSt, hrBadge, hrActor, hrRows);

  // ============================================================
  // SECTION 4 — IT Setup
  // ============================================================

  var itSection = '';
  if (itSt === 'na') {
    itSection = esSection('IT Setup', 'na', '— N/A', 'Hourly · no system access required', '');
  } else {
    var itRows = '';
    if (hasIt) {
      // ── Google Account ──────────────────────────────────────────
      itRows += context.assignedEmail ? esRow('Assigned Email', esVal(context.assignedEmail, 'mono')) : '';
      itRows += context.emailTempPassword
        ? esRow('Temp Password', showPw ? esVal(context.emailTempPassword, 'mono') : esVal('●●●●●●●●', 'masked'))
        : '';

      // ── Computer ───────────────────────────────────────────────
      if (context.computerAssigned === 'Yes') {
        itRows += esDivider();
        var compDesc = [context.computerType, context.computerModel].filter(Boolean).join(' · ');
        if (compDesc) itRows += esRow('Computer', esVal(compDesc));
        if (context.computerSerial) itRows += esRow('Serial #', esVal(context.computerSerial, 'mono'));
      }

      // ── Phone ──────────────────────────────────────────────────
      if (context.phoneAssigned === 'Yes') {
        itRows += esDivider();
        var phoneDesc = [context.phoneCarrier, context.phoneModel].filter(Boolean).join(' · ');
        if (phoneDesc) itRows += esRow('Phone', esVal(phoneDesc));
        if (context.phoneNumber)      itRows += esRow('Number',       esVal(context.phoneNumber,    'mono'));
        if (context.phoneVMPassword)  itRows += esRow('VM PIN',        esVal(context.phoneVMPassword, 'mono'));
      }

      // ── System Access ──────────────────────────────────────────
      var sysRows = '';
      if (context.bossAccess         === 'Yes') sysRows += esRow('BOSS',            esVal('✓ Granted'));
      if (context.incidentsAccess    === 'Yes') sysRows += esRow('Incidents',       esVal('✓ Granted'));
      if (context.caaAccess          === 'Yes') sysRows += esRow('CAA',             esVal('✓ Granted'));
      if (context.deliveryAppAccess  === 'Yes') sysRows += esRow('Delivery App',    esVal('✓ Granted'));
      if (context.netPromoterAccess  === 'Yes') sysRows += esRow('Net Promoter',    esVal('✓ Granted'));
      // Software/system list from the original request
      if (itSystems.length > 0) {
        sysRows += itSystems.map(function(s) { return esRow(s, esVal('✓ Provisioned')); }).join('');
      }
      if (sysRows) { itRows += esDivider(); itRows += sysRows; }

      // ── Notes ──────────────────────────────────────────────────
      if (context.itNotes) {
        itRows += esDivider();
        itRows += esRow('Notes', esVal(context.itNotes));
      }

      // Password notice for Google temp password when masked
      if (!showPw && context.emailTempPassword) {
        itRows += '<tr><td colspan="2" style="padding:6px 0 0;">'
          + '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;'
          + 'padding:5px 10px;font-size:11px;color:#92400e;">'
          + '🔒 Google temp password visible only to Manager and Requester</div></td></tr>';
      }

    } else if (itSt === 'active') {
      itRows += pRow('IT Setup', 'Awaiting IT — form link above');
      if (itSystems.length > 0) {
        itRows += esDivider();
        itRows += itSystems.map(function(s) {
          return esRow(s, esVal('Pending provisioning', 'pending'));
        }).join('');
      }
    } else {
      itRows = qRow('IT Setup');
    }

    var itActor = itSt === 'complete' && context.itSubmittedBy
      ? 'Completed by ' + context.itSubmittedBy + (context.itTimestamp ? ' · ' + context.itTimestamp : '')
      : (itSt === 'active' ? 'Assigned to IT team' : '');
    var itBadge = itSt === 'complete' ? '✓ Complete' : (itSt === 'active' ? '⏳ Awaiting IT' : '— Queued');

    itSection = esSection('IT Setup', itSt, itBadge, itActor, itRows);
  }

  // ============================================================
  // SECTION 5 — Specialists (only rendered if any were requested)
  // Individual completion tracking requires Action Items data —
  // for now shows In Progress / Queued at the section level.
  // ============================================================

  var specSection = '';
  if (specialists.length > 0) {
    var specRows = specialists.map(function(s) {
      return esRow(s, specReady ? esVal('In Progress', 'pending') : esVal('— Queued', 'queued'));
    }).join('');

    var specBadge = specReady ? '⏳ In Progress' : '— Queued';
    specSection = esSection(
      'Specialists', specSt, specBadge,
      'Parallel notifications sent · individual completion tracked separately',
      specRows
    );
  }

  return reqSection + idSection + hrSection + itSection + specSection;
}


// ================================================================
// EQUIPMENT REQUEST
// ================================================================

/**
 * Context block for System & Equipment Access Request emails.
 *
 * Three sections (mirrors New Hire but without ID Setup / HR Verification):
 *   1. Request Details  — always Complete
 *   2. IT Setup         — Google Account + hardware + IT software
 *   3. Specialists      — Credit Card, Business Cards, Vehicle, Jonas, ADP (if requested)
 *
 * @param {Object} context  — from getWorkflowContext() for EQUIP_REQ_* workflows
 * @param {Object} [opts]   — { showPasswords: boolean }
 */
function buildEquipmentContextBlock(context, opts) {
  opts = opts || {};
  var showPw = opts.showPasswords === true;

  var systemsList = Array.isArray(context.systems)   ? context.systems   : [];
  var equipList   = Array.isArray(context.equipment) ? context.equipment
    : (context.equipmentRaw
        ? context.equipmentRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean)
        : []);

  // ── Categorise systems ───────────────────────────────────────
  var SPECIALIST_SYS_KEYS = ['credit card', 'business card', 'fleetio', 'vehicle', 'jonas', 'adp', 'payroll', '30-60-90', '30/60/90'];

  var googleSystems = systemsList.filter(function(s) {
    var sl = s.toLowerCase();
    return sl.indexOf('google') !== -1 || sl.indexOf('email') !== -1;
  });
  var otherSystems = systemsList.filter(function(s) {
    var sl = s.toLowerCase();
    return sl.indexOf('google') === -1 && sl.indexOf('email') === -1;
  });
  var itSoftware = otherSystems.filter(function(s) {
    var sl = s.toLowerCase();
    return !SPECIALIST_SYS_KEYS.some(function(k) { return sl.indexOf(k) !== -1; });
  });
  var specialistSystems = otherSystems.filter(function(s) {
    var sl = s.toLowerCase();
    return SPECIALIST_SYS_KEYS.some(function(k) { return sl.indexOf(k) !== -1; });
  });

  // ── Categorise equipment ─────────────────────────────────────
  var itHardware = equipList.filter(function(eq) {
    var eql = eq.toLowerCase();
    return eql.indexOf('credit card') === -1
        && eql.indexOf('business card') === -1
        && eql.indexOf('vehicle') === -1;
  });
  var specialistEquip = equipList.filter(function(eq) {
    var eql = eq.toLowerCase();
    return eql.indexOf('credit card') !== -1
        || eql.indexOf('business card') !== -1
        || eql.indexOf('vehicle') !== -1;
  });

  var allItItems     = googleSystems.concat(itHardware).concat(itSoftware);
  var allSpecialists = specialistSystems.concat(specialistEquip);

  // ── Completion flags ─────────────────────────────────────────
  // assignedEmail is present once Google Account / IT Setup is done
  var hasIt = !!(context.assignedEmail);
  var itSt  = hasIt ? 'complete' : 'active';

  // ── Employee name ────────────────────────────────────────────
  var empName = (context.firstName && context.lastName)
    ? (context.firstName + ' ' + context.lastName)
    : (context.employeeName || '');

  // ============================================================
  // SECTION 1 — Request Details  (always complete)
  // ============================================================
  var reqRows = ''
    + esRow('Employee', esVal(empName.trim()))
    + (context.jobTitle  ? esRow('Position', esVal(context.jobTitle))  : '')
    + (context.siteName  ? esRow('Site',     esVal(context.siteName))  : '')
    + (context.managerName
        ? esRow('Manager', esVal(context.managerName
            + (context.managerEmail ? ' · ' + context.managerEmail : '')))
        : '')
    + esDivider()
    + (context.requesterEmail
        ? esRow('Requested By', esVal(context.requesterName
            ? context.requesterName + ' · ' + context.requesterEmail
            : context.requesterEmail))
        : '')
    + (context.requestDate ? esRow('Request Date', esVal(context.requestDate)) : '');

  var reqSection = esSection(
    'Request Details', 'complete', '✓ Submitted',
    context.requestDate ? 'Submitted · ' + context.requestDate : '',
    reqRows
  );

  // ============================================================
  // SECTION 2 — IT Setup  (Google Account + hardware + IT software)
  // ============================================================
  var itSection = '';
  if (allItItems.length > 0) {
    var itRows = '';

    if (hasIt) {
      // ── Setup complete — show results ──────────────────────
      if (context.assignedEmail) {
        itRows += esRow('Assigned Email', esVal(context.assignedEmail, 'mono'));
      }
      if (context.emailTempPassword) {
        itRows += esRow('Temp Password',
          showPw ? esVal(context.emailTempPassword, 'mono') : esVal('●●●●●●●●', 'masked'));
      }
      if (itHardware.length > 0) {
        itRows += esDivider();
        itRows += itHardware.map(function(e) { return esRow(e, esVal('✓ Provisioned')); }).join('');
      }
      if (itSoftware.length > 0) {
        itRows += esDivider();
        itRows += itSoftware.map(function(s) { return esRow(s, esVal('✓ Provisioned')); }).join('');
      }
      if (!showPw && context.emailTempPassword) {
        itRows += '<tr><td colspan="2" style="padding:6px 0 0;">'
          + '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;'
          + 'padding:5px 10px;font-size:11px;color:#92400e;">'
          + '🔒 Google temp password visible only to Manager and Requester</div></td></tr>';
      }
    } else {
      // ── Pending — show what will be provisioned ────────────
      if (googleSystems.length > 0) {
        itRows += googleSystems.map(function(s) {
          return esRow(s, esVal('Pending setup', 'pending'));
        }).join('');
      }
      if (itHardware.length > 0) {
        if (itRows) itRows += esDivider();
        itRows += itHardware.map(function(e) {
          return esRow(e, esVal('Pending provisioning', 'pending'));
        }).join('');
      }
      if (itSoftware.length > 0) {
        if (itRows) itRows += esDivider();
        itRows += itSoftware.map(function(s) {
          return esRow(s, esVal('Pending provisioning', 'pending'));
        }).join('');
      }
    }

    var itBadge = hasIt ? '✓ Complete' : '⏳ In Progress';
    var itActor = hasIt && context.itSubmittedBy
      ? 'Completed by ' + context.itSubmittedBy + (context.itTimestamp ? ' · ' + context.itTimestamp : '')
      : 'Assigned to IT team';

    itSection = esSection('IT Setup', itSt, itBadge, itActor, itRows);
  }

  // ============================================================
  // SECTION 3 — Specialists  (Credit Card, Business Cards, Vehicle, Jonas, ADP…)
  // ============================================================
  var specSection = '';
  if (allSpecialists.length > 0) {
    var specRows = allSpecialists.map(function(s) {
      return esRow(s, esVal('In Progress', 'pending'));
    }).join('');

    specSection = esSection(
      'Specialists', 'active', '⏳ In Progress',
      'Parallel notifications sent · individual completion tracked separately',
      specRows
    );
  }

  // ============================================================
  // SECTION 4 — Comments  (if provided)
  // ============================================================
  var commentsSection = '';
  if (context.comments) {
    commentsSection = esSection(
      'Notes', 'complete', '',
      '',
      esRow('Comments', esVal(context.comments))
    );
  }

  return reqSection + itSection + specSection + commentsSection;
}


// ================================================================
// TERMINATION — PLACEHOLDER
// ================================================================

/**
 * TODO: Implement termination email sections.
 * Expected sections: Employee Info, Systems to Revoke, Equipment Return, Final Steps.
 * @param {Object} context
 * @param {Object} [opts]
 */
function buildTerminationContextBlock(context, opts) {
  opts = opts || {};

  var empName = context.employeeName || '';
  var termDate = '';
  if (context.hireDate) {
    try {
      var td = context.hireDate instanceof Date ? context.hireDate
        : new Date(String(context.hireDate).replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T12:00:00'));
      termDate = !isNaN(td.getTime())
        ? Utilities.formatDate(td, Session.getScriptTimeZone(), 'MMM d, yyyy')
        : String(context.hireDate).substring(0, 10);
    } catch(e) { termDate = String(context.hireDate).substring(0, 10); }
  }

  // ── Section 1: Employee & EOE Details ────────────────────────
  var empRows = ''
    + esRow('Employee',    esVal(empName.trim()))
    + (context.siteName   ? esRow('Site',       esVal(context.siteName))  : '')
    + (termDate           ? esRow('EOE Date',   esVal(termDate))          : '')
    + (context.reason     ? esRow('Reason',     esVal(context.reason))    : '')
    + esDivider()
    + (context.managerName
        ? esRow('Manager', esVal(context.managerName
            + (context.managerEmail ? ' · ' + context.managerEmail : '')))
        : '')
    + (context.requesterEmail
        ? esRow('Requested By', esVal(context.requesterEmail)) : '');

  var empSection = esSection('Employee — End of Employment', 'complete', '✓ Submitted',
    context.requestDate ? 'Submitted · ' + context.requestDate : '', empRows);

  // ── Section 2: Equipment to Return ────────────────────────────
  var eqSection = '';
  var eqRaw = context.equipmentRaw || '';
  var eqList = eqRaw ? String(eqRaw).split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
  if (eqList.length > 0) {
    var eqRows = eqList.map(function(item) {
      return esRow(item, esVal('Pending Return', 'pending'));
    }).join('');
    eqSection = esSection('Equipment to Return', 'active', '⏳ Pending', '', eqRows);
  }

  // ── Section 3: Systems to Revoke ──────────────────────────────
  var sysSection = '';
  var systems = Array.isArray(context.systems) ? context.systems : [];
  if (systems.length > 0) {
    var sysRows = systems.map(function(s) {
      return esRow(s, esVal('Pending Revocation', 'pending'));
    }).join('');
    sysSection = esSection('System Access — Revoke', 'active', '⏳ Pending', '', sysRows);
  }

  return empSection + eqSection + sysSection;
}


// ================================================================
// STATUS CHANGE — PLACEHOLDER
// ================================================================

/**
 * TODO: Implement status change email sections.
 * Expected sections: Current Status, Requested Changes, Effective Date, Approvals.
 * @param {Object} context
 * @param {Object} [opts]
 */
function buildStatusChangeContextBlock(context, opts) {
  opts = opts || {};

  var empName = context.employeeName || '';
  var effDate = '';
  if (context.hireDate) {
    try {
      var ed = context.hireDate instanceof Date ? context.hireDate
        : new Date(String(context.hireDate).replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T12:00:00'));
      effDate = !isNaN(ed.getTime())
        ? Utilities.formatDate(ed, Session.getScriptTimeZone(), 'MMM d, yyyy')
        : String(context.hireDate).substring(0, 10);
    } catch(e) { effDate = String(context.hireDate).substring(0, 10); }
  }

  // ── Section 1: Employee Info ──────────────────────────────────
  var empRows = ''
    + esRow('Employee',    esVal(empName.trim()))
    + (context.siteName         ? esRow('Site',            esVal(context.siteName))         : '')
    + (context.currentTitle     ? esRow('Current Title',   esVal(context.currentTitle))     : '')
    + (context.employmentType   ? esRow('Classification',  esVal(context.employmentType))   : '')
    + esDivider()
    + (context.currentManagerName
        ? esRow('Current Manager', esVal(context.currentManagerName
            + (context.currentManagerEmail ? ' · ' + context.currentManagerEmail : '')))
        : '')
    + (context.requesterEmail   ? esRow('Requested By',    esVal(context.requesterEmail))   : '');

  var empSection = esSection('Employee', 'complete', '✓ Submitted',
    context.requestDate ? 'Submitted · ' + context.requestDate : '', empRows);

  // ── Section 2: Requested Changes ─────────────────────────────
  var changeRows = ''
    + (effDate             ? esRow('Effective Date', esVal(effDate))          : '')
    + (context.changeTypes ? esRow('Change Types',  esVal(context.changeTypes)) : '')
    + (context.titleChange
        ? esRow('Title Change',      esVal(context.titleChange))              : '')
    + (context.siteTransfer
        ? esRow('Site Transfer',     esVal(context.siteTransfer))             : '')
    + (context.classChange
        ? esRow('Classification',    esVal(context.classChange))              : '')
    + (context.managerChange
        ? esRow('Manager Change',    esVal(context.managerChange))            : '')
    + (context.jobTitle && context.jobTitle !== context.currentTitle
        ? esRow('New Title',         esVal(context.jobTitle))                 : '')
    + (context.managerName && context.managerName !== context.currentManagerName
        ? esRow('New Manager',       esVal(context.managerName
            + (context.managerEmail ? ' · ' + context.managerEmail : '')))   : '');

  var changeSection = esSection('Requested Changes', 'active', '⏳ In Progress',
    '', changeRows);

  // ── Section 3: Systems/Equipment (if any) ────────────────────
  var sysSection = '';
  var systems = Array.isArray(context.systems) ? context.systems : [];
  var eqRaw   = context.equipmentRaw || '';
  var eqList  = eqRaw ? String(eqRaw).split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
  var allItems = systems.concat(eqList);
  if (allItems.length > 0) {
    var sysRows = allItems.map(function(s) {
      return esRow(s, esVal('In Progress', 'pending'));
    }).join('');
    sysSection = esSection('Access & Equipment Changes', 'active', '⏳ In Progress', '', sysRows);
  }

  return empSection + changeSection + sysSection;
}
