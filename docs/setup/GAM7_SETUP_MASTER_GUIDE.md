# GAM7 Complete Setup Guide
## Role-Based Architecture for Robinson Solutions

**Created:** December 2, 2025
**For:** Dan Binns (dbinns@robinsonsolutions.com)
**Architecture:** Role-based OAuth with least-privilege access

---

## Overview

This guide will walk you through setting up GAM7 with a role-based security architecture. Instead of one set of credentials with all permissions, you'll have 7 specialized roles for different tasks.

**Final Structure:**
```
C:\GAM7\                                    # GAM executable
P:\Projects\Personal\binns-computer\
  └── GAM7_ROLES\                           # Config/credentials
      ├── client_secrets.json               # OAuth client (master copy)
      ├── role-read\                        # Read-only auditor
      ├── role-write\                       # General admin (default)
      ├── role-vault\                       # Legal/eDiscovery
      ├── role-user-mgmt\                   # User lifecycle
      ├── role-group-mgmt\                  # Group management
      ├── role-ou-mgmt\                     # OU structure
      └── role-device-mgmt\                 # Device inventory
D:\GAM7_WORK\                               # Working directory
```

---

## Prerequisites

- ✅ Admin access to Windows
- ✅ Super Admin access to robinsonsolutions.com Google Workspace
- ✅ Access to Google Cloud Console
- ✅ PowerShell 5.1 or later

---

## Step-by-Step Setup

### Phase 1: Install GAM7 (5 minutes)

1. **Run the installer**
   - Double-click: `P:\Projects\Company\WMAR_v2\gam-7.29.02-windows-x86_64.msi`
   - Install location: `C:\GAM7`
   - Click through the installer

2. **Verify installation**
   ```powershell
   # Open PowerShell
   Test-Path "C:\GAM7\gam.exe"
   # Should return: True
   ```

---

### Phase 2: Create Google Cloud Project & Get client_secrets.json (15 minutes)

**Follow the detailed guide:** `CLIENT_SECRETS_GUIDE.md`

**Summary:**
1. Create Google Cloud Project: `GAM7-RobinsonSolutions`
2. Enable required APIs (Admin SDK, Drive, Gmail, etc.)
3. Configure OAuth consent screen (Internal, robinsonsolutions.com)
4. Create OAuth Desktop Client credentials
5. Download and rename to `client_secrets.json`

**Result:** You should have `client_secrets.json` file ready

---

### Phase 3: Run PowerShell Setup Script (2 minutes)

1. **Open PowerShell as Administrator**
   - Right-click PowerShell icon
   - Select "Run as Administrator"

2. **Navigate to WMAR_v2 folder**
   ```powershell
   cd "P:\Projects\Company\WMAR_v2"
   ```

3. **Run the setup script**
   ```powershell
   .\Setup-GAM-Roles-MODIFIED.ps1
   ```

4. **What it does:**
   - Creates `P:\Projects\Personal\binns-computer\GAM7_ROLES\`
   - Creates 7 role subfolders
   - Creates `D:\GAM7_WORK\` working directory
   - Generates documentation in each role folder
   - Copies `client_secrets.json` to each role (if it exists)

5. **Copy client_secrets.json if you haven't already**
   ```powershell
   # If you got client_secrets.json after running the script:
   Copy-Item "path\to\your\client_secrets.json" "P:\Projects\Personal\binns-computer\GAM7_ROLES\"

   # Then re-run the script to distribute it to role folders
   .\Setup-GAM-Roles-MODIFIED.ps1
   ```

---

### Phase 4: Configure Environment Variables (5 minutes)

**Follow the detailed guide:** `ENVIRONMENT_SETUP_GUIDE.md`

**Quick steps:**

1. **Add GAM7 to PATH**
   - System Properties > Environment Variables
   - Edit System Path
   - Add: `C:\GAM7`

2. **Create GAMCFGDIR variable**
   - New System Variable
   - Name: `GAMCFGDIR`
   - Value: `P:\Projects\Personal\binns-computer\GAM7_ROLES\role-write`

3. **Verify (close and reopen PowerShell)**
   ```powershell
   gam version
   $env:GAMCFGDIR
   ```

---

### Phase 5: Authorize OAuth for role-write (10 minutes)

**Start with role-write (general admin) - you can authorize other roles later**

1. **Set the role**
   ```powershell
   $env:GAMCFGDIR="P:\Projects\Personal\binns-computer\GAM7_ROLES\role-write"
   ```

2. **View the role definition**
   ```powershell
   notepad "P:\Projects\Personal\binns-computer\GAM7_ROLES\role-write\00_Role_Definition.md"
   ```

3. **Copy the scope selection string**
   ```
   0r, 1, 4, 5r, 6, 7, 8, 9, 10, 11r, 12r, 13, 14, 15, 16, 17, 18r, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29r, 31
   ```

4. **Run OAuth authorization**
   ```powershell
   gam oauth create
   ```

5. **Follow prompts:**
   - When asked to select scopes, paste the string above
   - Press Enter
   - When asked for admin email: `dbinns@robinsonsolutions.com`
   - Browser will open - sign in and authorize

6. **Test it works**
   ```powershell
   gam info domain
   ```

   You should see your domain information!

---

### Phase 6: Optional - Set Up PowerShell Profile (5 minutes)

**Follow the detailed guide:** `ENVIRONMENT_SETUP_GUIDE.md` (PowerShell Profile section)

This adds convenient functions like:
- `gam-write` - Use general admin role
- `gam-read` - Use read-only role
- `gam-user` - Use user management role
- `gam-role` - Show current role

**Quick setup:**
```powershell
# Create profile if it doesn't exist
if (!(Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force
}

# Edit profile
notepad $PROFILE
```

Copy the PowerShell functions from `ENVIRONMENT_SETUP_GUIDE.md` into the profile, save, and restart PowerShell.

---

## Verification Checklist

After completing all steps, verify everything works:

```powershell
# 1. GAM is installed and in PATH
gam version
# Expected: GAM 7.29.02 - https://github.com/taers232c/GAMADV-XTD3

# 2. GAMCFGDIR is set
$env:GAMCFGDIR
# Expected: P:\Projects\Personal\binns-computer\GAM7_ROLES\role-write

# 3. OAuth is authorized
gam info domain
# Expected: Shows robinsonsolutions.com domain info

# 4. Can create users (test with dry-run)
gam create user test@robinsonsolutions.com firstname Test lastname User password TempPass123! --dry-run
# Expected: Shows what would be created (doesn't actually create)

# 5. Role folders exist
Test-Path "P:\Projects\Personal\binns-computer\GAM7_ROLES\role-write\oauth2.txt"
# Expected: True (oauth2.txt was created during authorization)

# 6. Working directory exists
Test-Path "D:\GAM7_WORK"
# Expected: True
```

---

## What to Do Next

### Authorize Additional Roles (As Needed)

You only need to authorize roles you'll actually use. Start with `role-write` and add others later.

**To authorize another role (e.g., role-read):**
```powershell
# Set the role
$env:GAMCFGDIR="P:\Projects\Personal\binns-computer\GAM7_ROLES\role-read"

# View the definition
notepad "P:\Projects\Personal\binns-computer\GAM7_ROLES\role-read\00_Role_Definition.md"

# Copy the scope string and run:
gam oauth create

# Follow the same authorization process
```

### Common GAM Tasks

```powershell
# Get domain info
gam info domain

# List all users
gam print users > users.csv

# Create a user
gam create user jsmith@robinsonsolutions.com firstname John lastname Smith password TempPass123!

# Update user
gam update user jsmith@robinsonsolutions.com suspended true

# Get user info
gam info user jsmith@robinsonsolutions.com

# Create a group
gam create group it-team@robinsonsolutions.com name "IT Team"

# Add member to group
gam update group it-team@robinsonsolutions.com add member jsmith@robinsonsolutions.com

# List group members
gam print group-members group it-team@robinsonsolutions.com
```

### Use Role-Specific Functions (if PowerShell profile is set up)

```powershell
# Read-only reporting
gam-read print users > all_users.csv

# User management
gam-user create user newuser@robinsonsolutions.com firstname New lastname User password Temp123!

# Group management
gam-group update group sales@robinsonsolutions.com add member jsmith@robinsonsolutions.com

# Check current role
gam-role
```

---

## File Locations Reference

| File/Folder | Location | Purpose |
|-------------|----------|---------|
| GAM Executable | `C:\GAM7\gam.exe` | GAM program |
| Config Root | `P:\Projects\Personal\binns-computer\GAM7_ROLES\` | All roles & credentials |
| Default Role | `P:\Projects\Personal\binns-computer\GAM7_ROLES\role-write\` | General admin (default) |
| Working Dir | `D:\GAM7_WORK\` | Run commands, store outputs |
| PowerShell Profile | `$PROFILE` (run this in PS to see path) | Role-switching functions |
| Master Secrets | `P:\Projects\Personal\binns-computer\GAM7_ROLES\client_secrets.json` | OAuth client credentials |
| Role Secrets | `P:\Projects\Personal\binns-computer\GAM7_ROLES\role-*/client_secrets.json` | Copies in each role |
| OAuth Tokens | `P:\Projects\Personal\binns-computer\GAM7_ROLES\role-*/oauth2.txt` | Created after authorization |

---

## Security Best Practices

1. **Keep credentials secure**
   - Never commit `client_secrets.json` or `oauth2.txt` to git
   - These files contain sensitive authentication data

2. **Use appropriate roles**
   - Use `role-read` for reporting (no write access)
   - Use `role-write` for general admin tasks
   - Use specialized roles (`role-user-mgmt`, `role-group-mgmt`) for specific tasks

3. **Audit trail**
   - All GAM actions are logged in Google Workspace Admin Console
   - Use `role-read` to audit activities

4. **Least privilege**
   - Only authorize roles you actually need
   - If you only need user management, just authorize `role-user-mgmt`

---

## Troubleshooting

### "gam: command not found" or "not recognized"
- PATH not set correctly
- Close and reopen PowerShell after setting environment variables
- Verify: `Test-Path "C:\GAM7\gam.exe"` returns `True`

### "Cannot determine customer ID"
- GAMCFGDIR not set or pointing to wrong folder
- OAuth not authorized for that role
- Check: `Test-Path "$env:GAMCFGDIR\oauth2.txt"` should return `True`

### "Invalid client secrets file"
- `client_secrets.json` is missing or corrupt
- Verify it exists in the role folder
- Re-download from Google Cloud Console

### "Access Denied" during OAuth
- Not signed in with Super Admin account
- OAuth consent screen not configured correctly
- Required APIs not enabled in Google Cloud Project

### Role functions not working
- PowerShell profile not loaded
- Close and reopen PowerShell
- Check profile exists: `Test-Path $PROFILE`

---

## Support & Documentation

**GAM7 Official Documentation:**
- https://github.com/taers232c/GAMADV-XTD3/wiki

**Local Documentation:**
- `CLIENT_SECRETS_GUIDE.md` - How to create Google Cloud Project & get client_secrets.json
- `ENVIRONMENT_SETUP_GUIDE.md` - Environment variables & PowerShell profile setup
- `gam_roles_overview.md` - Role architecture overview (in GAM7_ROLES folder)
- `gam_action_items.md` - Implementation checklist (in GAM7_ROLES folder)
- Each role folder has: `00_Role_Definition.md` - Scope strings & authorization instructions

**Contact:**
- Dan Binns: dbinns@robinsonsolutions.com

---

## Quick Start Summary

**For future reference, here's the minimal steps to get going:**

1. Install GAM7 to `C:\GAM7`
2. Create Google Cloud Project and download `client_secrets.json`
3. Run `Setup-GAM-Roles-MODIFIED.ps1`
4. Set environment variables (PATH + GAMCFGDIR)
5. Authorize role-write: `gam oauth create`
6. Test: `gam info domain`

**You're done!** GAM7 is ready to use.

Authorize additional roles as needed using the same `gam oauth create` process with different `GAMCFGDIR` values.
