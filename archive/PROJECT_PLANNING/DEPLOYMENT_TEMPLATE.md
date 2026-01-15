# REQUEST_FORMS - Deployment Template

This template allows you to deploy Apps Script form projects quickly and consistently using GAM + clasp.

## Prerequisites

- ✅ GAM installed and authenticated
- ✅ Clasp installed and authenticated (`clasp login`)
- ✅ Target shared drive ID known

## Deployment Script

### 1. Create Google Resources with GAM

```bash
# Set variables
SHARED_DRIVE_ID="0AOOOWlqzpUNVUk9PVA"
PROJECT_NAME="REQUEST_FORMS"
USER_EMAIL="dbinns@robinsonsolutions.com"

# Create spreadsheet in shared drive
gam user $USER_EMAIL create spreadsheet \
  name "$PROJECT_NAME - Employee Requests" \
  teamdriveparentid $SHARED_DRIVE_ID \
  returnidonly

# Capture the spreadsheet ID (will be output)
# Save this as SPREADSHEET_ID

# Create main folder in shared drive
gam user $USER_EMAIL create teamdrivefile \
  teamdriveparentid $SHARED_DRIVE_ID \
  name "$PROJECT_NAME" \
  mimetype folder \
  returnidonly

# Capture the folder ID (will be output)
# Save this as MAIN_FOLDER_ID
```

### 2. Update Config.gs

Replace these lines in `Config.gs`:
```javascript
SPREADSHEET_ID: 'PASTE_ID_HERE',
MAIN_FOLDER_ID: 'PASTE_ID_HERE',
```

### 3. Create Apps Script Project

```bash
cd "P:/Repos/github/danieljbinns/APP SCRIPT FORMS/$PROJECT_NAME"

# Create new Apps Script project
clasp create --title "$PROJECT_NAME" --type standalone

# Push all files
clasp push

# Create deployment
clasp deploy --description "Initial deployment"
```

### 4. Configure Web App Deployment

```bash
# Get deployment info
clasp deployments

# Or deploy as web app via UI:
# 1. Open: clasp open (or use script URL)
# 2. Deploy > New deployment
# 3. Type: Web app
# 4. Execute as: User accessing the web app
# 5. Who has access: Anyone at robinsonsolutions.com
# 6. Deploy
# 7. Copy web app URL
```

### 5. Initialize Spreadsheet (via Apps Script UI)

Since we created the spreadsheet with GAM, we need to add headers:

```bash
# Open the Apps Script editor
# Run function: setupSpreadsheetHeaders()
# This will add column headers from CONFIG.FORM_FIELDS
```

Or add this function to Setup.gs:

```javascript
function setupSpreadsheetHeaders() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);

  // Add headers
  sheet.getRange(1, 1, 1, CONFIG.FORM_FIELDS.length)
    .setValues([CONFIG.FORM_FIELDS])
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(1);

  Logger.log('Headers added to: ' + ss.getUrl());
}
```

## Alternative: Full Automation Script

Create `deploy.sh`:

```bash
#!/bin/bash

# Configuration
SHARED_DRIVE_ID="0AOOOWlqzpUNVUk9PVA"
PROJECT_NAME="REQUEST_FORMS"
USER_EMAIL="dbinns@robinsonsolutions.com"
PROJECT_PATH="P:/Repos/github/danieljbinns/APP SCRIPT FORMS/$PROJECT_NAME"

echo "🚀 Deploying $PROJECT_NAME..."

# 1. Create spreadsheet
echo "📊 Creating spreadsheet..."
SPREADSHEET_ID=$(gam user $USER_EMAIL create spreadsheet \
  name "$PROJECT_NAME - Employee Requests" \
  teamdriveparentid $SHARED_DRIVE_ID \
  returnidonly | grep -oP '(?<=Created )[a-zA-Z0-9_-]+')

echo "✓ Spreadsheet ID: $SPREADSHEET_ID"

# 2. Create folder
echo "📁 Creating folder..."
MAIN_FOLDER_ID=$(gam user $USER_EMAIL create teamdrivefile \
  teamdriveparentid $SHARED_DRIVE_ID \
  name "$PROJECT_NAME" \
  mimetype folder \
  returnidonly | grep -oP '(?<=Created )[a-zA-Z0-9_-]+')

echo "✓ Folder ID: $MAIN_FOLDER_ID"

# 3. Update Config.gs
echo "📝 Updating Config.gs..."
cd "$PROJECT_PATH"

# Backup original
cp Config.gs Config.gs.backup

# Update IDs (cross-platform compatible)
sed -i "s/SPREADSHEET_ID: '',/SPREADSHEET_ID: '$SPREADSHEET_ID',/" Config.gs
sed -i "s/MAIN_FOLDER_ID: '',/MAIN_FOLDER_ID: '$MAIN_FOLDER_ID',/" Config.gs

echo "✓ Config updated"

# 4. Push to Apps Script
echo "☁️  Pushing to Apps Script..."
clasp push

# 5. Deploy
echo "🚀 Creating deployment..."
DEPLOYMENT_ID=$(clasp deploy --description "Auto-deploy $(date +%Y-%m-%d)" | grep -oP 'AKfyc[a-zA-Z0-9_-]+')

echo "✓ Deployment ID: $DEPLOYMENT_ID"

# 6. Output summary
echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "Spreadsheet ID: $SPREADSHEET_ID"
echo "Folder ID: $MAIN_FOLDER_ID"
echo "Deployment ID: $DEPLOYMENT_ID"
echo ""
echo "Next steps:"
echo "1. Run setupSpreadsheetHeaders() in Apps Script"
echo "2. Deploy as web app via UI"
echo "3. Copy web app URL"
echo ""
echo "=========================================="
```

## Template Structure

For future projects, keep this structure:

```
/APP SCRIPT FORMS/
├── PROJECT_NAME/
│   ├── Config.gs           # Always has SPREADSHEET_ID and MAIN_FOLDER_ID placeholders
│   ├── Setup.gs            # Has setupSpreadsheetHeaders() function
│   ├── Code.gs             # Main logic
│   ├── *.html              # Form files
│   ├── appsscript.json
│   ├── .claspignore
│   └── deploy.sh           # Project-specific deployment script
│
└── /Projects/Company/PROJECT_NAME_DOCS/
    ├── DEPLOYMENT_TEMPLATE.md
    ├── ARCHITECTURE.md
    └── README.md
```

## Reusable Components

### .claspignore (standard)
```
**/.git/**
**/node_modules/**
OLD_DEPLOYMENT/**
*.md
.clasp.json
.claspignore
.gitignore
deploy.sh
```

### Config.gs template
```javascript
const CONFIG = {
  SHARED_DRIVE_ID: 'XXX',
  SPREADSHEET_ID: '',  // ← Populated by deploy.sh
  MAIN_FOLDER_ID: '',  // ← Populated by deploy.sh
  SHEET_NAME: 'Main Data',
  FORM_FIELDS: [/* field list */],
  // ... rest of config
};
```

## Web App Deployment Settings (Standard)

Always use:
- **Execute as**: User accessing the web app
- **Access**: Anyone at robinsonsolutions.com
- **Type**: Web app

## Testing Checklist

After deployment:
- [ ] Spreadsheet created in shared drive
- [ ] Folder created in shared drive
- [ ] Config.gs updated with IDs
- [ ] Files pushed to Apps Script
- [ ] Headers added to spreadsheet
- [ ] Web app deployed
- [ ] Test form submission
- [ ] Verify data in spreadsheet

---

**Last Updated**: 2025-01-28
**Version**: 1.0
