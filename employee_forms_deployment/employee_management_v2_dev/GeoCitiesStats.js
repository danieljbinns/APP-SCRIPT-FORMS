/**
 * GeoCitiesStats.js
 * Server-side stats for the GeoCities easter egg mode.
 * Called via google.script.run.getGeoCitiesStats() from GeoCities.html.
 */

function getGeoCitiesStats() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    var totals = {
      total: 0, newHire: 0, eoe: 0, change: 0, equip: 0,
      completed: 0, inProgress: 0, pending: 0, cancelled: 0,
      thisMonth: 0, actionItems: 0, allTimeRecord: 0
    };

    var requesterCounts = {};
    var managerCounts   = {};
    var siteCounts      = {};
    var monthCounts     = {};

    var now          = new Date();
    var thisMonthKey = now.getFullYear() + '-' + (now.getMonth() + 1);

    // ── Dashboard_View is the flat materialized table -- fastest read ──
    var dvSheet = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD_VIEW);
    if (dvSheet && dvSheet.getLastRow() > 1) {
      var dvData = dvSheet.getRange(2, 1, dvSheet.getLastRow() - 1, 14).getValues();

      for (var i = 0; i < dvData.length; i++) {
        var row       = dvData[i];
        var wfId      = String(row[0]  || '').trim();
        if (!wfId) continue;

        var status    = String(row[2]  || '').trim();
        var requester = String(row[4]  || '').trim();
        var manager   = String(row[9]  || '').trim();
        var dateVal   = row[7];
        var site      = String(row[12] || '').trim();

        totals.total++;

        if      (wfId.indexOf('NEW_EMP_')  === 0) totals.newHire++;
        else if (wfId.indexOf('TERM_')     === 0) totals.eoe++;
        else if (wfId.indexOf('CHANGE_')   === 0) totals.change++;
        else if (wfId.indexOf('EQUIP_REQ_')  === 0) totals.equip++;

        if      (status === 'Completed')   totals.completed++;
        else if (status === 'In Progress') totals.inProgress++;
        else if (status === 'Pending')     totals.pending++;
        else if (status === 'Cancelled')   totals.cancelled++;

        if (requester) requesterCounts[requester] = (requesterCounts[requester] || 0) + 1;
        if (manager && manager !== requester) managerCounts[manager] = (managerCounts[manager] || 0) + 1;
        if (site)      siteCounts[site]           = (siteCounts[site]           || 0) + 1;

        // Month tracking
        var d = null;
        if (dateVal instanceof Date) {
          d = dateVal;
        } else if (typeof dateVal === 'string' && dateVal) {
          var parsed = new Date(dateVal.replace(/-/g, '/'));
          if (!isNaN(parsed.getTime())) d = parsed;
        }
        if (d) {
          var mk = d.getFullYear() + '-' + (d.getMonth() + 1);
          monthCounts[mk] = (monthCounts[mk] || 0) + 1;
          if (mk === thisMonthKey) totals.thisMonth++;
        }
      }
    }

    // ── Action Items total ──
    var aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet && aiSheet.getLastRow() > 1) {
      totals.actionItems = aiSheet.getLastRow() - 1;
    }

    // ── Best month ──
    var bestMonth = null;
    var bestCount = 0;
    var MONTH_NAMES = ['','January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
    var mkKeys = Object.keys(monthCounts);
    for (var m = 0; m < mkKeys.length; m++) {
      var cnt = monthCounts[mkKeys[m]];
      if (cnt > bestCount) {
        bestCount = cnt;
        var parts = mkKeys[m].split('-');
        bestMonth = {
          label: MONTH_NAMES[parseInt(parts[1], 10)] + ' ' + parts[0],
          count: cnt
        };
      }
    }
    totals.allTimeRecord = bestCount;

    // ── Top N helper ──
    function topN(obj, n) {
      return Object.keys(obj)
        .map(function(k) { return { name: k, count: obj[k] }; })
        .sort(function(a, b) { return b.count - a.count; })
        .slice(0, n);
    }

    return JSON.parse(JSON.stringify({
      totals:        totals,
      topRequesters: topN(requesterCounts, 5),
      topManagers:   topN(managerCounts,   5),
      topSites:      topN(siteCounts,      6),
      bestMonth:     bestMonth,
      lastUpdated:   new Date().toISOString()
    }));

  } catch (e) {
    Logger.log('getGeoCitiesStats error: ' + e.message);
    return JSON.parse(JSON.stringify({ error: e.message }));
  }
}
