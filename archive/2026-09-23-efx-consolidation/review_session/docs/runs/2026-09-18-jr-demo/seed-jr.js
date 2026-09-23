'use strict';
// Seeds ONE EFX test hire on the TEST tier and drives it to an OPEN jr_title task,
// so DEMO JR 3 has something real to close. Read/write on the TEST sheet only.
const fs = require('fs');
const MIG = 'P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_efx/migration/node_modules';
const { google } = require(MIG + '/googleapis');
const KEY = 'D:/Credentials/google/efx/efx-router-test.json';
const SCRIPT_ID = '1yD_Me_Y_zVZBoejOozy1CGVEFh2_dzw289SbVohVpWt2LEKXYMx_OYIn';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.send_mail',
  'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  'https://www.googleapis.com/auth/directory.readonly', 'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/script.projects'];
const ACTOR = { id: 'n8n:jr-demo-seed', email: 'efx-bot@team-group.com', display: 'JR demo seed' };
const SUF = Math.floor(Math.random() * 900000 + 100000);

let token;
async function call(fn, params) {
  const r = await fetch('https://script.googleapis.com/v1/scripts/' + SCRIPT_ID + ':run', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: fn, parameters: params || [], devMode: false })
  });
  const j = await r.json();
  if (j.error) throw new Error('scripts.run: ' + JSON.stringify(j.error).slice(0, 300));
  return j.response.result;
}
const show = (label, env) => {
  const ok = env && env.ok;
  console.log('  ' + (ok ? 'OK   ' : 'FAIL ') + label + (ok ? '' : '  -> ' + JSON.stringify(env && env.error).slice(0, 260)));
  if (!ok) process.exitCode = 1;
  return env;
};

(async () => {
  const key = JSON.parse(fs.readFileSync(KEY, 'utf8'));
  const jwt = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES, subject: 'efx-bot@team-group.com' });
  token = (await jwt.authorize()).access_token;
  console.log('# as efx-bot@team-group.com, TEST tier\n');

  const hire = {
    firstName: 'EfxJr', lastName: 'Demo' + SUF, hireDate: '2026-10-06',
    requesterEmail: 'dbinns@team-group.com', requesterName: 'David Binns',
    reportingManagerName: 'David Binns', reportingManagerEmail: 'dbinns@team-group.com',
    positionTitle: 'Supervisor', siteName: 'Ottawa Main', jobSiteNumber: '100',
    employmentType: 'Salary', employeeType: 'Direct Hire', newHireOrRehire: 'New Hire',
    systemAccess: 'Yes',                 // required for the IT Setup path
    jrRequired: 'Yes', plan306090: 'Yes' // plan306090=Yes is what creates the jr_title task
  };
  const c = show('createInitialRequest', await call('n8n_createInitialRequest', [ACTOR, hire]));
  if (!c.ok) return;
  const wf = c.result.workflowId;
  console.log('       workflowId       = ' + wf);
  console.log('       internalEmployeeId = ' + c.result.internalEmployeeId);

  show('submitIdSetup', await call('n8n_submitIdSetup', [ACTOR, {
    workflowId: wf, siteDocsWorkerId: 'W' + SUF, siteDocsJobCode: 'Salary 1',
    dssUsername: 'efxjr' + SUF, dssPassword: 'NotARealPassword!' + SUF
  }]));

  show('submitItSetup', await call('n8n_submitItSetup', [ACTOR, {
    workflowId: wf, Email_Created: 'Yes', Computer_Assigned: 'Yes', Phone_Assigned: 'No', BOSS_Access: 'Yes'
  }]));

  const tasks = await call('n8n_listTasks', [ACTOR, { workflowId: wf }]);
  const list = (tasks.result && (tasks.result.tasks || tasks.result)) || [];
  const arr = Array.isArray(list) ? list : [];
  console.log('\n  tasks on ' + wf + ':');
  arr.forEach(t => console.log('    - ' + (t.formType || t.type || '?') + '  ' + (t.taskId || t.id || '') + '  ' + (t.status || '') + '  "' + (t.taskName || t.name || '') + '"'));
  const jr = arr.find(t => (t.formType || t.type) === 'jr_title');

  console.log('\n' + '='.repeat(66));
  if (jr) {
    console.log('  OPEN jr_title TASK READY');
    console.log('    PORTAL_TICKET (paste into DEMO JR 1 "Parse Email Data") = ' + wf);
    console.log('    task id                                                = ' + (jr.taskId || jr.id));
    console.log('    employee name (paste as EMPLOYEE_NAME)                 = EfxJr Demo' + SUF);
    fs.writeFileSync('jr-seed.json', JSON.stringify({ workflowId: wf, taskId: jr.taskId || jr.id, employeeName: 'EfxJr Demo' + SUF, internalEmployeeId: c.result.internalEmployeeId }, null, 2));
    console.log('    (also written to jr-seed.json)');
  } else {
    console.log('  NO jr_title TASK CREATED - check plan306090 handling in ITSetupHandler.js');
  }
  console.log('='.repeat(66));
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
