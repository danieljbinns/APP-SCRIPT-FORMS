/**
 * New Employee Request - ONE-TIME SETUP
 * Run setupExistingSpreadsheet() once to add headers to your spreadsheet
 */

/**
 * Add headers to existing spreadsheet
 * Run this ONCE before first form submission
 */
function setupExistingSpreadsheet() {
  Logger.log('Adding headers to spreadsheet...');
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Get or create the sheet
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      // Delete default "Sheet1" if it exists
      const defaultSheet = ss.getSheetByName('Sheet1');
      if (defaultSheet && defaultSheet.getSheetId() !== sheet.getSheetId()) {
        ss.deleteSheet(defaultSheet);
      }
    }
    
    // Add headers from CONFIG
    sheet.getRange(1, 1, 1, CONFIG.FORM_FIELDS.length)
      .setValues([CONFIG.FORM_FIELDS])
      .setFontWeight('bold')
      .setBackground('#EB1C2D')  // Team Group red
      .setFontColor('#ffffff');
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= CONFIG.FORM_FIELDS.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    Logger.log('='.repeat(60));
    Logger.log('✓ SETUP COMPLETE!');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('✓ Spreadsheet: ' + ss.getName());
    Logger.log('✓ URL: ' + ss.getUrl());
    Logger.log('✓ Sheet: ' + sheet.getName());
    Logger.log('✓ Headers: ' + CONFIG.FORM_FIELDS.length + ' columns');
    Logger.log('');
    Logger.log('NEXT STEPS:');
    Logger.log('1. Update appsscript.json with trigger scope (if not done)');
    Logger.log('2. Re-deploy web app');
    Logger.log('3. Run installTrigger() function');
    Logger.log('4. Test form submission');
    Logger.log('='.repeat(60));
    
    return true;
    
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
    Logger.log('');
    Logger.log('Make sure:');
    Logger.log('- Spreadsheet ID is correct in Config.gs');
    Logger.log('- You have access to the spreadsheet');
    Logger.log('- Spreadsheet is in Shared Drive');
    return false;
  }
}
