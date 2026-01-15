#!/bin/bash

# REQUEST_FORMS - Automated Deployment Script
# Uses GAM + clasp to deploy Google Apps Script project

set -e  # Exit on error

# Configuration
SHARED_DRIVE_ID="0AOOOWlqzpUNVUk9PVA"
PROJECT_NAME="REQUEST_FORMS"
USER_EMAIL="dbinns@robinsonsolutions.com"

echo "=========================================="
echo "🚀 Deploying $PROJECT_NAME"
echo "=========================================="
echo ""

# 1. Create spreadsheet in shared drive
echo "📊 Creating spreadsheet in shared drive..."
SPREADSHEET_OUTPUT=$(gam user "$USER_EMAIL" create spreadsheet \
  name "$PROJECT_NAME - Employee Requests" \
  teamdriveparentid "$SHARED_DRIVE_ID" \
  returnidonly 2>&1)

SPREADSHEET_ID=$(echo "$SPREADSHEET_OUTPUT" | grep -oP '[a-zA-Z0-9_-]{44}' | head -1)

if [ -z "$SPREADSHEET_ID" ]; then
  echo "❌ Failed to create spreadsheet"
  echo "$SPREADSHEET_OUTPUT"
  exit 1
fi

echo "✓ Spreadsheet created"
echo "  ID: $SPREADSHEET_ID"
echo ""

# 2. Create main folder in shared drive
echo "📁 Creating main folder in shared drive..."
FOLDER_OUTPUT=$(gam user "$USER_EMAIL" create teamdrivefile \
  teamdriveparentid "$SHARED_DRIVE_ID" \
  name "$PROJECT_NAME" \
  mimetype gfolder \
  returnidonly 2>&1)

MAIN_FOLDER_ID=$(echo "$FOLDER_OUTPUT" | grep -oP '[a-zA-Z0-9_-]{33}' | head -1)

if [ -z "$MAIN_FOLDER_ID" ]; then
  echo "❌ Failed to create folder"
  echo "$FOLDER_OUTPUT"
  exit 1
fi

echo "✓ Folder created"
echo "  ID: $MAIN_FOLDER_ID"
echo ""

# 3. Update Config.gs with IDs
echo "📝 Updating Config.gs with resource IDs..."

# Backup original
cp Config.gs Config.gs.backup

# Update SPREADSHEET_ID
sed -i "s/SPREADSHEET_ID: ''/SPREADSHEET_ID: '$SPREADSHEET_ID'/" Config.gs

# Update MAIN_FOLDER_ID
sed -i "s/MAIN_FOLDER_ID: ''/MAIN_FOLDER_ID: '$MAIN_FOLDER_ID'/" Config.gs

echo "✓ Config.gs updated"
echo ""

# 4. Push updated files to Apps Script
echo "☁️  Pushing files to Apps Script..."
clasp push

echo "✓ Files pushed"
echo ""

# 5. Create deployment
echo "🚀 Creating new deployment..."
DEPLOY_OUTPUT=$(clasp deploy --description "Auto-deploy $(date +%Y-%m-%d_%H:%M)" 2>&1)
DEPLOYMENT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'AKfyc[a-zA-Z0-9_-]+' | head -1)

if [ -z "$DEPLOYMENT_ID" ]; then
  echo "⚠️  Deployment may have been created, check manually"
else
  echo "✓ Deployment created"
  echo "  ID: $DEPLOYMENT_ID"
fi
echo ""

# 6. Output summary
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "📊 Spreadsheet ID: $SPREADSHEET_ID"
echo "📁 Folder ID:      $MAIN_FOLDER_ID"
echo "🚀 Deployment ID:  ${DEPLOYMENT_ID:-Check manually}"
echo ""
echo "Spreadsheet URL:"
echo "https://docs.google.com/spreadsheets/d/$SPREADSHEET_ID"
echo ""
echo "Folder URL:"
echo "https://drive.google.com/drive/folders/$MAIN_FOLDER_ID"
echo ""
echo "Apps Script Editor:"
cat .clasp.json | grep scriptId | sed 's/.*"scriptId": "\(.*\)".*/https:\/\/script.google.com\/d\/\1\/edit/'
echo ""
echo "=========================================="
echo "📋 Next Steps:"
echo "=========================================="
echo ""
echo "1. Open Apps Script editor (URL above)"
echo "2. Run function: setupSpreadsheetHeaders()"
echo "   (This adds column headers to the sheet)"
echo ""
echo "3. Deploy as Web App:"
echo "   - Deploy > New deployment"
echo "   - Type: Web app"
echo "   - Execute as: User accessing the web app"
echo "   - Access: Anyone at robinsonsolutions.com"
echo "   - Copy the web app URL"
echo ""
echo "4. Test the form:"
echo "   - Visit web app URL"
echo "   - Submit a test request"
echo "   - Verify data in spreadsheet"
echo ""
echo "=========================================="

# Cleanup backup
rm Config.gs.backup 2>/dev/null || true

echo ""
echo "✅ Script complete!"
