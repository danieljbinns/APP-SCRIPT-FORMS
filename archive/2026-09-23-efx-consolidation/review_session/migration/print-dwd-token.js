#!/usr/bin/env node
/**
 * print-dwd-token.js — mint a domain-wide-delegation access token AS a Workspace user, using a
 * service-account key. Needed for TEST_PLAN T1 because `gcloud auth print-access-token
 * --impersonate-service-account` yields a token for the SA itself, and the Apps Script Execution API
 * does not accept service-account identities — it must be a (DWD-impersonated) user such as
 * efx-bot@team-group.com.
 *
 * USAGE
 *   node print-dwd-token.js --key <sa.json> --subject efx-bot@team-group.com [--scopes <comma,list>]
 *
 * Default scopes = the fork's appsscript.json oauthScopes + script.projects (the DWD grant list).
 * Prints ONLY the access token to stdout (so it can be captured); diagnostics go to stderr.
 * Tokens live ~1 h. Never write one to a file that is committed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.send_mail',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/script.projects'
];

function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; }

(async () => {
  const keyPath = arg('--key'); const subject = arg('--subject');
  if (!keyPath || !subject) { console.error('usage: node print-dwd-token.js --key <sa.json> --subject <user@domain> [--scopes a,b,c]'); process.exit(1); }
  const key = JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf8'));
  const scopes = (arg('--scopes') || '').split(',').map(s => s.trim()).filter(Boolean);
  const jwt = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: scopes.length ? scopes : DEFAULT_SCOPES, subject });
  try {
    const t = await jwt.authorize();
    console.error(`# token for ${subject} via ${key.client_email} (expires ${new Date(t.expiry_date).toISOString()})`);
    process.stdout.write(t.access_token + '\n');
  } catch (e) {
    const d = e.response && e.response.data;
    console.error('DWD token mint failed:', (d && (d.error_description || JSON.stringify(d))) || e.message);
    console.error('  unauthorized_client  → DWD not authorised for this client id / scope list in Admin console');
    console.error('  invalid_grant        → subject user does not exist or is suspended, or clock skew');
    process.exit(1);
  }
})();
