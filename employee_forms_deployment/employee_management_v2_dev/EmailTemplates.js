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
/**
 * Unified context block for New Hire and Equipment Request emails.
 *
 * Both workflows share identical IT Setup rendering, BOSS details, specialists logic,
 * and allComplete handling. The isEquipment flag controls three structural differences:
 *
 *   WHERE THEY DIFFER (isEquipment):
 *   ┌─────────────────────┬──────────────────────────┬──────────────────────────┐
 *   │ Section             │ New Hire                 │ Equipment Request        │
 *   ├─────────────────────┼──────────────────────────┼──────────────────────────┤
 *   │ ID Setup            │ Shown (internalEmployeeId│ SKIPPED — no step exists │
 *   │ HR Verification     │ Shown (adpAssociateId)   │ SKIPPED — no step exists │
 *   │ IT step gate        │ Requires hasHr first     │ Unlocks directly         │
 *   │ Request Details     │ Type + Start Date        │ Position + Request Date  │
 *   │ Specialists         │ + Safety Onboarding      │ + SiteDocs Account Setup │
 *   └─────────────────────┴──────────────────────────┴──────────────────────────┘
 *
 *   WHERE THEY ARE IDENTICAL (shared code below):
 *   - IT Setup section: assigned email, temp password, computer, phone,
 *     BOSS ✓ Granted, BOSS details (committee/cost sheet/trip/grievances),
 *     Incidents/CAA/Delivery App/NPS, itSystems provisioned, notes
 *   - Specialists list: systems filter, equipment, credit card, jonas, 30/60/90
 *   - allComplete: opts.allComplete=true flips all specialists to ✓ Complete
 */
function buildNewHireContextBlock(context, opts) {
  opts = opts || {};
  var showPw      = opts.showPasswords === true;
  var isEquipment = context.workflowType === 'Equipment Request';

  // ── DIFFERS: completion flags ─────────────────────────────
  // NH: ID Setup done when internalEmployeeId exists (full ID Setup form)
  // Equipment: ID Setup equivalent done when siteDocsUsername exists (WIS User AI credential capture)
  var hasId = isEquipment ? !!(context.siteDocsUsername) : !!(context.internalEmployeeId);
  var hasHr = !isEquipment && !!(context.adpAssociateId); // Equipment has no HR Verification step
  // SHARED: IT complete when itTimestamp exists (written on every submitITSetup call)
  var hasIt = !!(context.itTimestamp || context.assignedEmail);
  // SHARED: NH Hourly/no-access skips IT; not applicable to Equipment (needsIt always true)
  var needsIt = !(context.employmentType === 'Hourly' && String(context.systemAccess || '') === 'No');

  // ── DIFFERS: step statuses ────────────────────────────────
  var idSt = hasId ? 'complete' : 'active';
  var hrSt = hasHr ? 'complete' : (hasId ? 'active' : 'queued');
  // NH: IT queued until HR done. Equipment: IT unlocks directly (no HR gate).
  var itSt = !needsIt ? 'na' : (hasIt ? 'complete' : (isEquipment || hasHr ? 'active' : 'queued'));

  // ── SHARED: specialists unlock after IT (or after HR for hourly NH) ───
  var specReady = needsIt ? hasIt : hasHr;
  var specSt    = specReady ? 'active' : 'queued';

  // ── SHARED: systems split — IT-provisioned vs specialist-routed ───────
  var systems   = Array.isArray(context.systems) ? context.systems : [];
  // SiteDocs excluded from itSystems (it's a specialist task for Equipment, ID Setup for NH)
  var itSystems = systems.filter(function(s) { return !_isSpecialist(s) && s.toLowerCase() !== 'sitedocs'; });

  // ── SHARED: build specialist list from all context fields ─────────────
  var specialists = [];
  systems.forEach(function(s) { if (_isSpecialist(s)) specialists.push(s); });
  // DIFFERS: SiteDocs handling
  //   Equipment → WIS User action item sent to ID Setup team (no ID Setup step in workflow)
  //   New Hire  → SiteDocs credentials recorded in ID Setup section (not a separate specialist)
  if (isEquipment && systems.some(function(s) { return s.toLowerCase() === 'sitedocs'; })) {
    specialists.push('SiteDocs Account Setup');
  }
  var equipStr = String(context.equipmentRaw || '').toLowerCase();
  if (equipStr.indexOf('business card') !== -1) specialists.push('Business Cards');
  if (equipStr.indexOf('vehicle') !== -1) specialists.push('Vehicle');
  if (context.creditCardUSA === 'Yes' || context.creditCardCanada === 'Yes' || context.creditCardHomeDepot === 'Yes') specialists.push('Credit Card');
  if (context.jonasJobNumbers && String(context.jonasJobNumbers).trim()) specialists.push('Central Purchasing/Jonas');
  if (context.plan306090 === 'Yes') specialists.push('30/60/90 Review');
  // DIFFERS: Safety Onboarding — NH onboarding only; Equipment doesn't trigger Safety
  if (!isEquipment && needsIt) specialists.push('Safety Onboarding');

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
  // SECTION 1 — Request Details          ★ DIFFERS by workflow type ★
  //   NH:   Employee | Type | Job Title | Site | Dept | Start Date | Manager | Requested By
  //   EQUIP: Employee |       Position  | Site | Dept | Request Date | Manager | Requested By
  // ============================================================

  var empName = (context.firstName && context.lastName)
    ? (context.firstName + ' ' + context.lastName)
    : (context.employeeName || '');
  if (context.preferredName) empName += ' (' + context.preferredName + ')';

  var reqRows = ''
    + esRow('Employee', esVal(empName.trim()))
    // Type only for New Hire (Employment Type · Employee Type)
    + (!isEquipment && context.employmentType
        ? esRow('Type', esVal(context.employmentType + (context.employeeType ? ' · ' + context.employeeType : '')))
        : '')
    + (context.jobTitle   ? esRow(isEquipment ? 'Position' : 'Job Title', esVal(context.jobTitle)) : '')
    + (context.siteName   ? esRow('Site',       esVal(context.siteName))   : '')
    + (context.department ? esRow('Department', esVal(context.department)) : '')
    // New Hire: Start Date from hireDate. Equipment: Request Date from requestDate.
    + (!isEquipment && hireDisplay       ? esRow('Start Date',    esVal(hireDisplay))           : '')
    + (isEquipment && context.requestDate ? esRow('Request Date', esVal(context.requestDate))   : '')
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
  // SECTION 2 — ID Setup / SiteDocs Setup ★ DIFFERS by workflow ★
  //   NH:        Full ID Setup — internalEmployeeId, Worker ID, Job Code,
  //              SiteDocs/DSS credentials, BOSS WIS (gated on internalEmployeeId)
  //   Equipment: SiteDocs/DSS credentials only — captured when ID Setup team
  //              completes the WIS User action item (gated on siteDocsUsername)
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
      + (context.bossWisCreated        ? esRow('BOSS WIS',             esVal(context.bossWisCreated))           : '')
      + (context.siteDocsBadgeCreated  ? esRow('SiteDocs Badge Link',  esVal(context.siteDocsBadgeCreated))    : '');
  } else if (idSt === 'active') {
    idRows = isEquipment
      ? pRow('SiteDocs Setup', 'In progress — awaiting ID Setup team')
      : pRow('ID Setup', 'In progress — awaiting ID Setup team');
  } else {
    idRows = isEquipment ? qRow('SiteDocs Setup') : qRow('ID Setup');
  }

  var idActor = idSt === 'complete' && context.idSubmittedBy
    ? 'Completed by ' + context.idSubmittedBy + (context.idTimestamp ? ' · ' + context.idTimestamp : '')
    : (idSt === 'active' ? 'Assigned to ID Setup team' : '');
  var idBadge = idSt === 'complete' ? '✓ Complete' : (idSt === 'active' ? '⏳ In Progress' : '— Queued');

  // Section title: Equipment shows "SiteDocs Setup", NH shows "ID Setup"
  var idSectionTitle = isEquipment ? 'SiteDocs Setup' : 'ID Setup';
  var idSection = esSection(idSectionTitle, idSt, idBadge, idActor, idRows);

  // ============================================================
  // SECTION 3 — HR Verification           ★ NEW HIRE ONLY ★
  //   Equipment: hrSection = '' (no HR Verification step in workflow)
  //   NH:        adpAssociateId, HR job title, JR title
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

  var hrSection = isEquipment ? '' : esSection('HR Verification', hrSt, hrBadge, hrActor, hrRows);

  // ============================================================
  // SECTION 4 — IT Setup                 ★ SHARED (NH + Equipment) ★
  //   Complete state (hasIt=true): assigned email, temp password, computer,
  //   phone, BOSS ✓ + BOSS details (committee/cost sheet/trip/grievances),
  //   Incidents/CAA/Delivery App/NPS access, itSystems provisioned, notes
  //   Pending state: lists requested items as "Pending provisioning"
  //   N/A state: Hourly NH with no system access (not applicable to Equipment)
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
      // BOSS detail confirmations — committees, cost sheets, trip reports, grievances
      if (context.bossDetails) {
        var bd = context.bossDetails;
        if (Array.isArray(bd.committees) && bd.committees.length > 0) {
          bd.committees.forEach(function(site) { sysRows += esRow('Committee', esVal('✓ ' + site)); });
        }
        if (Array.isArray(bd.costSheets) && bd.costSheets.length > 0) {
          bd.costSheets.forEach(function(job) { sysRows += esRow('Cost Sheet', esVal('✓ ' + job)); });
        }
        if (bd.tripReports === 'Yes') sysRows += esRow('Trip Reports', esVal('✓ Granted'));
        if (bd.grievances  === 'Yes') sysRows += esRow('Grievances',   esVal('✓ Granted'));
      }
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
  // SECTION 5 — Specialists              ★ SHARED (NH + Equipment) ★
  //   Both: Fleetio, Business Cards, Vehicle, Credit Card, Jonas, 30/60/90
  //   NH only:   Safety Onboarding
  //   EQUIP only: SiteDocs Account Setup (ID Setup team, WIS User action item)
  //   opts.allComplete=true → each row shows ✓ Complete (Workflow Completed email)
  // ============================================================

  var specSection = '';
  if (specialists.length > 0) {
    var allComplete = opts.allComplete === true;
    var specRows = specialists.map(function(s) {
      if (allComplete) return esRow(s, esVal('✓ Complete', 'complete'));
      return esRow(s, specReady ? esVal('In Progress', 'pending') : esVal('— Queued', 'queued'));
    }).join('');

    var specBadge = allComplete ? '✓ All Complete' : (specReady ? '⏳ In Progress' : '— Queued');
    var specFinalSt = allComplete ? 'complete' : specSt;
    specSection = esSection(
      'Specialists', specFinalSt, specBadge,
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
  // SiteDocs Account Setup — specialist task for Equipment (routed to ID Setup team via WIS User AI)
  if (systemsList.some(function(s) { return s.toLowerCase() === 'sitedocs'; })) {
    allSpecialists.push('SiteDocs Account Setup');
  }

  // ── Completion flags ─────────────────────────────────────────
  // itTimestamp written whenever IT submits the form, even when no Google email created
  var hasIt = !!(context.itTimestamp || context.assignedEmail);
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
      // BOSS access + detail confirmations
      if (context.bossAccess === 'Yes') {
        itRows += esDivider();
        itRows += esRow('BOSS', esVal('✓ Granted'));
        if (context.bossDetails) {
          var bd = context.bossDetails;
          if (Array.isArray(bd.committees) && bd.committees.length > 0) {
            bd.committees.forEach(function(site) { itRows += esRow('Committee', esVal('✓ ' + site)); });
          }
          if (Array.isArray(bd.costSheets) && bd.costSheets.length > 0) {
            bd.costSheets.forEach(function(job) { itRows += esRow('Cost Sheet', esVal('✓ ' + job)); });
          }
          if (bd.tripReports === 'Yes') itRows += esRow('Trip Reports', esVal('✓ Granted'));
          if (bd.grievances  === 'Yes') itRows += esRow('Grievances',   esVal('✓ Granted'));
        }
        if (context.incidentsAccess   === 'Yes') itRows += esRow('Incidents',    esVal('✓ Granted'));
        if (context.caaAccess         === 'Yes') itRows += esRow('CAA',          esVal('✓ Granted'));
        if (context.deliveryAppAccess === 'Yes') itRows += esRow('Delivery App', esVal('✓ Granted'));
        if (context.netPromoterAccess === 'Yes') itRows += esRow('Net Promoter', esVal('✓ Granted'));
      }
      if (itSoftware.length > 0) {
        itRows += esDivider();
        itRows += itSoftware.map(function(s) { return esRow(s, esVal('✓ Provisioned')); }).join('');
      }
      if (context.itNotes) { itRows += esDivider(); itRows += esRow('Notes', esVal(context.itNotes)); }
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
    var allComplete = opts.allComplete === true;
    var specRows = allSpecialists.map(function(s) {
      if (allComplete) return esRow(s, esVal('✓ Complete', 'complete'));
      return esRow(s, esVal('In Progress', 'pending'));
    }).join('');

    var specBadge = allComplete ? '✓ All Complete' : '⏳ In Progress';
    var specSt    = allComplete ? 'complete' : 'active';
    specSection = esSection(
      'Specialists', specSt, specBadge,
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
// TERMINATION
// ================================================================

/**
 * Full progressive context block for Termination (EOE) emails.
 *
 * Six sections — state driven by context.hrDecision:
 *   1. Employee — End of Employment  always Complete
 *   2. HR Approval                   Awaiting / Approved / Rejected
 *   3. Google Account Offboarding    only when Google Account in systems; Queued → In Progress
 *   4. System Deactivations          selected systems + mandatory (SiteDocs, DSS, BOSS WIS)
 *   5. Equipment to Return           Queued → Pending Collection
 *   6. Direct Reports                only when hasReports === 'Yes'
 *
 * Handler sets context.hrDecision = 'Approved' on all post-approval emails so
 * sections 3–6 flip from Queued to In Progress.
 *
 * @param {Object} context   — from getWorkflowContext() / handler-built object
 * @param {Object} [opts]
 */
function buildTerminationContextBlock(context, opts) {
  opts = opts || {};

  var empName = context.employeeName || '';

  // ── Date display helper ──────────────────────────────────────
  function _fmtDisp(val) {
    if (!val) return '';
    var s = String(val).trim();
    // Already M/D/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    try {
      var d = new Date(s.replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T12:00:00'));
      if (!isNaN(d.getTime()))
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM d, yyyy');
    } catch(e) { /* fall through */ }
    return s.substring(0, 10);
  }

  // hireDate in Termination context is always the term date (set by handler)
  var termDateDisp     = _fmtDisp(context.hireDate);
  var lastDayDisp      = _fmtDisp(context.lastDayWorked);

  // ── HR decision flags ─────────────────────────────────────────
  var hrDecision = context.hrDecision || '';
  var hrApproved = hrDecision === 'Approved';
  var hrRejected = hrDecision === 'Rejected';

  // ── Systems (normalise to array) ──────────────────────────────
  var systems = Array.isArray(context.systems)
    ? context.systems
    : (context.systems
        ? String(context.systems).split(',').map(function(s){ return s.trim(); }).filter(Boolean)
        : []);

  var hasGoogleAccount = systems.some(function(s) {
    return s === 'Google Account';
  });

  // ── Equipment (normalise to array) ───────────────────────────
  var eqList = context.equipmentRaw
    ? String(context.equipmentRaw).split(',')
        .map(function(s){ return s.trim(); })
        .filter(function(s){ return s && s !== 'N/A'; })
    : [];

  // ── Google offboarding details ────────────────────────────────
  // Populated from termData.googleOffboarding spread into context by handler
  var g          = context.googleOffboarding || {};
  var gForward   = g.forward   || context.google_forward   || '';
  var gFiles     = g.files     || context.google_files     || '';
  var gDelegate  = g.delegate  || context.google_delegate  || '';
  var gDuration  = g.duration  || context.google_duration  || '';
  var gVacation  = g.vacation  || context.google_vacation  || '';

  // ============================================================
  // SECTION 1 — Employee — End of Employment  (always complete)
  // ============================================================
  var reqRows = ''
    + esRow('Employee',        esVal(empName.trim()))
    + (context.employmentType  ? esRow('Type',             esVal(context.employmentType))                                           : '')
    + (context.siteName        ? esRow('Site',             esVal(context.siteName))                                                 : '')
    + esDivider()
    + (termDateDisp            ? esRow('Termination Date', esVal(termDateDisp))                                                     : '')
    + (lastDayDisp             ? esRow('Last Day Worked',  esVal(lastDayDisp))                                                      : '')
    + (context.reason          ? esRow('Reason',           esVal(context.reason))                                                   : '')
    + esDivider()
    + (context.managerName
        ? esRow('Manager', esVal(context.managerName + (context.managerEmail ? ' · ' + context.managerEmail : '')))
        : '')
    + (context.requesterEmail  ? esRow('Requested By',     esVal(context.requesterEmail))                                           : '');

  var reqSection = esSection(
    'Employee — End of Employment', 'complete', '✓ Submitted',
    context.requestDate ? 'Submitted · ' + context.requestDate : '',
    reqRows
  );

  // ============================================================
  // SECTION 2 — HR Approval
  // ============================================================
  var hrRows, hrStatus, hrBadge, hrActor;

  if (hrApproved) {
    hrStatus = 'complete';
    hrBadge  = '✓ Approved';
    hrActor  = context.hrSubmittedBy
      ? 'Approved by ' + context.hrSubmittedBy + (context.hrTimestamp ? ' · ' + context.hrTimestamp : '')
      : 'Approved by HR';
    hrRows = esRow('Decision', esVal('Approved'))
           + (context.hrNotes ? esRow('Notes', esVal(context.hrNotes)) : '');
  } else if (hrRejected) {
    hrStatus = 'active';
    hrBadge  = '✗ Rejected';
    hrActor  = context.hrSubmittedBy
      ? 'Rejected by ' + context.hrSubmittedBy + (context.hrTimestamp ? ' · ' + context.hrTimestamp : '')
      : 'Rejected by HR';
    hrRows = esRow('Decision', esVal('Rejected', 'pending'))
           + (context.hrNotes ? esRow('Notes', esVal(context.hrNotes)) : '');
  } else {
    hrStatus = 'active';
    hrBadge  = '⏳ Awaiting HR';
    hrActor  = 'Assigned to HR team';
    hrRows   = esRow('Decision', esVal('Pending review', 'pending'));
  }

  var hrSection = esSection('HR Approval', hrStatus, hrBadge, hrActor, hrRows);

  // ============================================================
  // SECTION 3 — Google Account Offboarding  (only when selected)
  // ============================================================
  var googleSection = '';
  if (hasGoogleAccount) {
    var gStatus = hrApproved ? 'active' : 'queued';
    var gBadge  = hrApproved ? '⏳ In Progress' : '— Queued';

    var gRows = '';
    if (gForward  && gForward  !== 'N/A') gRows += esRow('Email Forwarding',   esVal(gForward));
    if (gFiles    && gFiles    !== 'N/A') gRows += esRow('Drive File Transfer', esVal(gFiles));
    if (gDelegate && gDelegate !== 'N/A') gRows += esRow('Delegated Access',    esVal(gDelegate));
    if (gVacation && gVacation !== 'N/A') {
      gRows += esDivider();
      gRows += esRow('Vacation Responder', esVal(gVacation));
    }
    if (gDuration && gDuration !== 'N/A') {
      if (!gRows) gRows += '';
      else gRows += esDivider();
      gRows += esRow('Account Deletion', esVal('After ' + gDuration + ' — IT will schedule calendar event'));
    }
    if (!gRows) {
      gRows = esRow('Google Account', hrApproved
        ? esVal('Deactivation in progress', 'pending')
        : esVal('— Queued', 'queued'));
    }

    googleSection = esSection(
      'Google Account Offboarding', gStatus, gBadge,
      hrApproved ? 'IT notified via action item' : '',
      gRows
    );
  }

  // ============================================================
  // SECTION 4 — System Deactivations
  // Selected systems (excl. Google Account, handled above) +
  // always-required: SiteDocs · DSS · BOSS WIS
  // ============================================================
  var selectedSys  = systems.filter(function(s) { return s !== 'Google Account'; });
  var mandatorySys = ['SiteDocs', 'DSS', 'BOSS WIS'];
  var allDeact     = selectedSys.concat(mandatorySys.filter(function(m) {
    return selectedSys.indexOf(m) === -1;
  }));

  var sysStatus = hrApproved ? 'active' : 'queued';
  var sysBadge  = hrApproved ? '⏳ In Progress' : '— Queued';
  var sysActor  = hrApproved ? 'Notifications sent to respective teams' : '';
  var sysRows   = allDeact.map(function(s) {
    var isMandatory = mandatorySys.indexOf(s) !== -1 && selectedSys.indexOf(s) === -1;
    var label = s + (isMandatory ? ' ✦' : '');
    return esRow(label, hrApproved
      ? esVal('Deactivation in progress', 'pending')
      : esVal('— Queued', 'queued'));
  }).join('');
  if (hrApproved) {
    sysRows += esDivider()
      + '<tr><td colspan="2" style="padding:4px 0 0;font-size:10px;color:#888;">✦ Always required — handled by ID Setup team</td></tr>';
  }

  var sysSection = esSection('System Deactivations', sysStatus, sysBadge, sysActor, sysRows);

  // ============================================================
  // SECTION 5 — Equipment to Return
  // ============================================================
  var eqSection = '';
  if (eqList.length > 0) {
    var eqStatus = hrApproved ? 'active' : 'queued';
    var eqBadge  = hrApproved ? '⏳ Pending Collection' : '— Queued';
    var eqRows   = eqList.map(function(item) {
      return esRow(item, hrApproved
        ? esVal('Pending Return', 'pending')
        : esVal('— Queued', 'queued'));
    }).join('');
    eqSection = esSection(
      'Equipment to Return', eqStatus, eqBadge,
      hrApproved ? 'Asset collection checklist sent to manager/requester' : '',
      eqRows
    );
  }

  // ============================================================
  // SECTION 6 — Direct Reports  (only when applicable)
  // ============================================================
  var reportsSection = '';
  if (context.hasReports === 'Yes') {
    var rrRows = esRow('Has Direct Reports', esVal('Yes'));
    if (context.reportsToNew && context.reportsToNew !== 'N/A') {
      rrRows += esRow('Reassigned To', esVal(context.reportsToNew, 'mono'));
    } else {
      rrRows += esRow('Reassignment', esVal('Confirm with HR', 'pending'));
    }
    var rrStatus = hrApproved ? 'active' : 'queued';
    var rrBadge  = hrApproved ? '⏳ Action Required' : '— Queued';
    reportsSection = esSection('Direct Reports', rrStatus, rrBadge, '', rrRows);
  }

  return reqSection + hrSection + googleSection + sysSection + eqSection + reportsSection;
}


// ================================================================
// STATUS CHANGE
// ================================================================

/**
 * Full progressive context block for Status Change emails.
 *
 * Six sections — state driven by context.hrDecision:
 *   1. Employee                 always Complete (current state snapshot)
 *   2. Requested Changes        always Complete (captures the full change request)
 *   3. HR Review                Awaiting / Approved / Rejected
 *   4. HR Confirmed Details     only post-approval (confirmed title, JR title, new manager)
 *   5. Access & Equipment       Queued → In Progress (systems + equipment being provisioned)
 *   6. Action Items Assigned    only post-approval (teams notified)
 *
 * Handler sets context.hrDecision = 'Approved' + confirmedTitle/confirmedJrTitle/
 * confirmedNewManager + actionTeams[] on all post-approval emails.
 *
 * @param {Object} context   — from getWorkflowContext() / handler-built object
 * @param {Object} [opts]
 */
function buildStatusChangeContextBlock(context, opts) {
  opts = opts || {};

  var empName = context.employeeName || '';

  // ── Date display helper ──────────────────────────────────────
  function _fmtDisp(val) {
    if (!val) return '';
    var s = String(val).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    try {
      var d = new Date(s.replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T12:00:00'));
      if (!isNaN(d.getTime()))
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM d, yyyy');
    } catch(e) { /* fall through */ }
    return s.substring(0, 10);
  }

  // hireDate in Status Change context is always the effective date (set by handler)
  var effDateDisp = _fmtDisp(context.hireDate);

  // ── HR decision flags ─────────────────────────────────────────
  var hrDecision = context.hrDecision || '';
  var hrApproved = hrDecision === 'Approved';
  var hrRejected = hrDecision === 'Rejected';

  // ── Systems & Equipment (normalise to arrays) ─────────────────
  var systems = Array.isArray(context.systems)
    ? context.systems
    : (context.systems
        ? String(context.systems).split(',').map(function(s){ return s.trim(); }).filter(Boolean)
        : []);
  var eqList = context.equipmentRaw
    ? String(context.equipmentRaw).split(',')
        .map(function(s){ return s.trim(); })
        .filter(function(s){ return s && s !== 'N/A'; })
    : [];
  var allItems = systems.concat(eqList);

  // ── Change display helper — hide identical / N/A -> N/A ──────
  function _showChange(val) {
    if (!val) return null;
    var v = String(val).trim();
    if (!v || v === 'N/A -> N/A' || v === 'N/A (N/A) -> N/A (N/A)') return null;
    var idx = v.indexOf(' -> ');
    if (idx !== -1 && v.substring(0, idx).trim() === v.substring(idx + 4).trim()) return null;
    return v;
  }

  var stChange = _showChange(context.siteTransfer);
  var tcChange = _showChange(context.titleChange);
  var ccChange = _showChange(context.classChange);
  var mcChange = _showChange(context.managerChange);

  // ============================================================
  // SECTION 1 — Employee  (always complete — current state snapshot)
  // ============================================================
  var empRows = ''
    + esRow('Employee',        esVal(empName.trim()))
    + (context.employmentType  ? esRow('Classification',  esVal(context.employmentType))                                    : '')
    + (context.siteName        ? esRow('Site',            esVal(context.siteName))                                          : '')
    + (context.currentTitle    ? esRow('Current Title',   esVal(context.currentTitle))                                      : '')
    + esDivider()
    + (context.currentManagerName
        ? esRow('Current Manager', esVal(context.currentManagerName
            + (context.currentManagerEmail ? ' · ' + context.currentManagerEmail : '')))
        : '')
    + (context.requesterEmail  ? esRow('Requested By',    esVal(context.requesterEmail))                                    : '');

  var empSection = esSection('Employee', 'complete', '✓ Submitted',
    context.requestDate ? 'Submitted · ' + context.requestDate : '', empRows);

  // ============================================================
  // SECTION 2 — Requested Changes  (always complete)
  // ============================================================
  var changeRows = '';
  if (effDateDisp) changeRows += esRow('Effective Date', esVal(effDateDisp));
  if (context.changeTypes) {
    changeRows += esDivider();
    changeRows += esRow('Change Types', esVal(context.changeTypes));
  }
  if (stChange) changeRows += esRow('Site Transfer',    esVal(stChange));
  if (tcChange) changeRows += esRow('Title Change',     esVal(tcChange));
  if (ccChange) changeRows += esRow('Classification',   esVal(ccChange));
  if (mcChange) changeRows += esRow('Manager Change',   esVal(mcChange));
  if (allItems.length > 0) {
    changeRows += esDivider();
    allItems.forEach(function(s) { changeRows += esRow(s, esVal('Requested')); });
  }
  if (context.department) {
    changeRows += esDivider();
    changeRows += esRow('Department', esVal(context.department));
  }
  if (context.purchasingSites && context.purchasingSites !== 'N/A') {
    changeRows += esRow('Purchasing Sites', esVal(context.purchasingSites));
  }
  if (context.comments) {
    changeRows += esDivider();
    changeRows += esRow('Comments', esVal(context.comments));
  }

  var changeSection = esSection('Requested Changes', 'complete', '✓ Submitted', '', changeRows);

  // ============================================================
  // SECTION 3 — HR Review
  // ============================================================
  var hrRows, hrStatus, hrBadge, hrActor;

  if (hrApproved) {
    hrStatus = 'complete';
    hrBadge  = '✓ Approved';
    hrActor  = context.hrSubmittedBy
      ? 'Approved by ' + context.hrSubmittedBy + (context.hrTimestamp ? ' · ' + context.hrTimestamp : '')
      : 'Approved by HR';
    hrRows = esRow('Decision', esVal('Approved'))
           + (context.hrNotes ? esRow('Notes', esVal(context.hrNotes)) : '');
  } else if (hrRejected) {
    hrStatus = 'active';
    hrBadge  = '✗ Rejected';
    hrActor  = context.hrSubmittedBy
      ? 'Rejected by ' + context.hrSubmittedBy + (context.hrTimestamp ? ' · ' + context.hrTimestamp : '')
      : 'Rejected by HR';
    hrRows = esRow('Decision', esVal('Rejected', 'pending'))
           + (context.hrNotes ? esRow('Notes', esVal(context.hrNotes)) : '');
  } else {
    hrStatus = 'active';
    hrBadge  = '⏳ Awaiting HR';
    hrActor  = 'Assigned to HR team';
    hrRows   = esRow('Decision', esVal('Pending review', 'pending'));
  }

  var hrSection = esSection('HR Review', hrStatus, hrBadge, hrActor, hrRows);

  // ============================================================
  // SECTION 4 — HR Confirmed Details  (post-approval only)
  // ============================================================
  var confirmedSection = '';
  if (hrApproved) {
    var confRows = '';
    if (context.confirmedTitle)      confRows += esRow('Confirmed Title',    esVal(context.confirmedTitle));
    if (context.confirmedJrTitle)    confRows += esRow('Confirmed JR Title', esVal(context.confirmedJrTitle, 'mono'));
    if (context.confirmedNewManager) confRows += esRow('New Manager Email',  esVal(context.confirmedNewManager, 'mono'));
    else if (context.managerEmail)   confRows += esRow('New Manager Email',  esVal(context.managerEmail, 'mono'));
    if (confRows) {
      confirmedSection = esSection(
        'HR Confirmed Details', 'complete', '✓ Confirmed',
        'Confirmed by HR at time of approval', confRows
      );
    }
  }

  // ============================================================
  // SECTION 5 — Access & Equipment Changes  (Queued → In Progress)
  // ============================================================
  var accessSection = '';
  if (allItems.length > 0) {
    var acStatus = hrApproved ? 'active' : 'queued';
    var acBadge  = hrApproved ? '⏳ In Progress' : '— Queued';
    var acActor  = hrApproved ? 'Notifications sent to respective teams' : '';
    var acRows   = allItems.map(function(s) {
      return esRow(s, hrApproved
        ? esVal('In Progress', 'pending')
        : esVal('— Queued', 'queued'));
    }).join('');
    accessSection = esSection('Access & Equipment Changes', acStatus, acBadge, acActor, acRows);
  }

  // ============================================================
  // SECTION 6 — Action Items Assigned  (post-approval summary)
  // context.actionTeams = array of team names e.g. ['IT', 'Safety', 'ID Setup', ...]
  // ============================================================
  var actionSection = '';
  if (hrApproved && context.actionTeams && context.actionTeams.length > 0) {
    var atRows = context.actionTeams.map(function(team) {
      return esRow(team, esVal('Action item assigned & emailed', 'pending'));
    }).join('');
    actionSection = esSection(
      'Action Items Assigned', 'active', '⏳ In Progress',
      'Each team received a checklist link via email', atRows
    );
  }

  return empSection + changeSection + hrSection + confirmedSection + accessSection + actionSection;
}
