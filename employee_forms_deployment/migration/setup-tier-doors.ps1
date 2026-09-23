<#
.SYNOPSIS
  Creates the Workspace "doors" an Employee Forms EFX tier needs: bot user, role groups,
  Groups Reader role, and Drive access. Idempotent - safe to re-run.

.DESCRIPTION
  These steps are needed once per tier (TEST, dev, later prod) and an assistant session
  cannot run them: granting an admin role and adding Drive ACLs are refused as privilege
  grants, and an assistant is also barred from editing its own permission policy.
  Running this yourself is the supported path.

  NOT covered, because Google exposes no API for it: domain-wide delegation.
  That stays a manual Admin console step. Use -ShowDwd to print the exact values.

.PARAMETER Tier
  test | dev | prod. Non-prod tiers use the dev.forms.* groups. prod uses the real
  grp.forms.* groups and the script refuses to create or modify them.

.PARAMETER SheetId
  The tier's spreadsheet id. The bot is granted writer on it.

.PARAMETER WhatIf
  Print what would happen, change nothing.

.EXAMPLE
  .\setup-tier-doors.ps1 -Tier test -SheetId 1cjDM9uQy_tejnM0A11lrDLgBzQvncDGX44oTpE9hTvk

.EXAMPLE
  .\setup-tier-doors.ps1 -ShowDwd -SaClientId 111683067952951171262
#>
[CmdletBinding()]
param(
  [ValidateSet('test','dev','prod')] [string] $Tier = 'test',
  [string] $SheetId,
  [string] $Bot = 'efx-bot@team-group.com',
  [string] $Owner = 'dbinns@team-group.com',
  [string] $OwnerPrimary = 'dbinns@robinsonsolutions.com',
  [string[]] $ExtraFolders = @(
    '1vBZVuzXmSatnLGiqhU7QoS0zBK2NGDQE',
    '1yD1j82KTJ2EksLnN_fJ02zQWEUAlSRBW',
    '1gRjQiw34JTvyqwqfnBlJYs6JdmeYjzr1'
  ),
  [switch] $ShowDwd,
  [string] $SaClientId,
  [switch] $WhatIf
)

$ErrorActionPreference = 'Continue'
$env:GAMCFGDIR = 'D:\Credentials\google\gam\role-admin'

$ROLES = @(
  @{ k = 'hr';            n = 'HR' },
  @{ k = 'it';            n = 'IT' },
  @{ k = 'idsetup';       n = 'ID Setup' },
  @{ k = 'safety';        n = 'Safety' },
  @{ k = 'fleetio';       n = 'Fleetio' },
  @{ k = 'creditcard';    n = 'Credit Card' },
  @{ k = 'review306090';  n = '30-60-90 Review' },
  @{ k = 'jrtitle';       n = 'JR Title Review' },
  @{ k = 'jonas';         n = 'Jonas' },
  @{ k = 'payroll';       n = 'Payroll' },
  @{ k = 'businesscards'; n = 'Business Cards' }
)

$SCOPES = @(
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
) -join ','

function Say([string] $m, [string] $c = 'Gray') { Write-Host $m -ForegroundColor $c }

function Run([string] $desc, [scriptblock] $sb) {
  if ($WhatIf) { Say "  WOULD  $desc" 'DarkYellow'; return }
  $out = (& $sb) 2>&1 | Out-String
  $last = ($out.Trim() -split "`n")[-1]
  if ($last -match 'Duplicate|already exists|already a member|Already Exists') {
    Say "  SKIP   $desc  (exists)" 'DarkGray'
  } elseif ($last -match 'ERROR|Not Authorized|Failed|Invalid') {
    Say "  FAIL   $desc" 'Red'
    Say "         $last" 'Red'
  } else {
    Say "  DID    $desc" 'Green'
  }
}

if ($ShowDwd) {
  Say ""
  Say "DOMAIN-WIDE DELEGATION - manual, Admin console only (Google exposes no API)" 'Cyan'
  Say "admin.google.com > Security > Access and data control > API controls"
  Say "  > Manage Domain Wide Delegation > Add new"
  Say ""
  Say "Client ID (21-digit uniqueId, NOT the service account email):" 'Cyan'
  if ($SaClientId) { Say "  $SaClientId" } else { Say "  <pass -SaClientId>" 'Red' }
  Say ""
  Say "Scopes - paste as ONE comma-separated line:" 'Cyan'
  Say "  $SCOPES"
  Say ""
  Say "Expect a row showing the client id and '11 scopes'. Propagation takes a few minutes."
  return
}

if ($Tier -eq 'prod') {
  Say ""
  Say "PROD tier: role groups are the existing grp.forms.* groups." 'Yellow'
  Say "This script will NOT create or modify them. Only bot role + Drive ACLs run." 'Yellow'
  $prefix = 'grp.forms.'
} else {
  $prefix = 'dev.forms.'
}

$sheetLabel = if ($SheetId) { $SheetId } else { '<none given>' }
Say ""
Say "=== EFX tier doors - tier '$Tier' ===" 'Cyan'
if ($WhatIf) { Say "*** WHATIF - nothing will change ***" 'DarkYellow' }
Say "bot=$Bot   groups=${prefix}*   sheet=$sheetLabel"

Say ""
Say "1. bot user" 'Cyan'
$probe = gam info user $Bot fields primaryemail 2>&1 | Out-String
if ($probe -match 'Does not exist|Service not applicable') {
  Run "create $Bot in /Bot Accounts" { gam create user $Bot firstname EFX lastname Bot password random changepassword off org "/Bot Accounts" }
} else {
  Say "  SKIP   $Bot (exists)" 'DarkGray'
}

Say ""
if ($Tier -ne 'prod') {
  Say "2. role groups" 'Cyan'
  foreach ($r in $ROLES) {
    $g = "$prefix$($r.k)@team-group.com"
    $desc = "Non-prod stand-in for grp.forms.$($r.k). Employee Forms dev/TEST only. Never used by prod."
    Run "group $g" { gam create group $g name "DEV Forms - $($r.n)" description $desc }
  }
} else {
  Say "2. role groups - skipped (prod uses the existing groups)" 'DarkGray'
}

Say ""
Say "3. memberships" 'Cyan'
foreach ($r in $ROLES) {
  $g = "$prefix$($r.k)@team-group.com"
  Run "$g += $Bot" { gam update group $g add member user $Bot }
  if ($Tier -ne 'prod') {
    Run "$g += $OwnerPrimary" { gam update group $g add member user $OwnerPrimary }
  }
}

Say ""
Say "4. Groups Reader admin role" 'Cyan'
Say "   (without this, AccessControlService membership checks all silently return false)" 'DarkGray'
Run "$Bot -> _GROUPS_READER_ROLE (customer scope)" { gam create admin $Bot _GROUPS_READER_ROLE customer }

Say ""
Say "5. Drive access (writer)" 'Cyan'
$targets = @()
if ($SheetId) { $targets += $SheetId }
$targets += $ExtraFolders
foreach ($t in $targets) {
  Run "writer on $t" { gam user $Owner add drivefileacl $t user $Bot role writer sendemail false }
}

Say ""
Say "=== VERIFY ===" 'Cyan'
if ($WhatIf) { Say "(skipped under -WhatIf)" 'DarkGray'; return }

$fail = 0

Say ""
Say "  bot account:"
$b = gam info user $Bot fields primaryemail,orgunitpath,suspended 2>&1 | Out-String
if ($b -match '/Bot Accounts') { Say "    OK   OU = /Bot Accounts" 'Green' }
else { Say "    BAD  OU is not /Bot Accounts" 'Red'; $fail++ }

Say ""
Say "  Groups Reader:"
$a = gam print admins user $Bot 2>&1 | Out-String
if ($a -match 'GROUPS_READER') { Say "    OK   role present" 'Green' }
else { Say "    BAD  no Groups Reader - every role check will return false" 'Red'; $fail++ }

Say ""
Say "  group membership:"
foreach ($r in $ROLES) {
  $g = "$prefix$($r.k)@team-group.com"
  $m = gam print group-members group $g 2>&1 | Out-String
  if ($m -match [regex]::Escape($Bot)) { Say "    OK   $g" 'Green' }
  else { Say "    BAD  $g is missing $Bot" 'Red'; $fail++ }
}

if ($SheetId) {
  Say ""
  Say "  sheet ACL:"
  $acl = gam user $Owner show drivefileacl $SheetId 2>&1 | Out-String
  if ($acl -match [regex]::Escape($Bot)) { Say "    OK   $Bot has access to $SheetId" 'Green' }
  else { Say "    BAD  $Bot is not on the sheet" 'Red'; $fail++ }
}

Say ""
if ($fail -eq 0) {
  Say "ALL CHECKS PASSED." 'Green'
  Say "Remaining manual step: domain-wide delegation. Run with -ShowDwd for the values." 'Green'
} else {
  Say "$fail CHECK(S) FAILED - see the BAD lines above." 'Red'
  Say "Do not proceed to the first call through the door until they pass." 'Red'
}
