/**
 * ReportingService.gs
 * 
 * Calculates KPIs (Time to Onboard, SLA Breaches) for dashboard visualization.
 */

var ReportingService = (function() {

  /**
   * Fetches KPI metrics for the dashboard.
   * @returns {Object} JSON object with metrics
   */
  function getKPIMetrics() {
    // 1. Fetch raw data (reusing Dashboard logic or specific query)
    var rows = DashboardVNextHandler.getDashboardDataVNext().rows;
    
    var totalWorkflows = rows.length;
    var completedWorkflows = 0;
    var totalDays = 0;
    var slaBreaches = 0;
    
    // 2. Iterate and Calculate
    rows.forEach(function(row) {
      // SLA logic: "Active" and older than 3 days
      if (row.timeOpenDays > 3 && row.status !== 'Complete') {
        slaBreaches++;
      }
      
      // Time to Onboard logic
      if (row.status === 'Complete') {
        completedWorkflows++;
        totalDays += row.timeOpenDays; // Assuming timeOpenDays stops counting or is fixed on completion
      }
    });

    var avgTime = completedWorkflows > 0 ? (totalDays / completedWorkflows).toFixed(1) : 0;

    return {
      total: totalWorkflows,
      completed: completedWorkflows,
      avgDaysToOnboard: avgTime,
      slaBreaches: slaBreaches
    };
  }

  return {
    getKPIMetrics: getKPIMetrics
  };

})();
