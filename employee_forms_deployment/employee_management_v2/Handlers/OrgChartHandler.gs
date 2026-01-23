/**
 * OrgChartHandler.gs
 * 
 * Prepares data for the Org Chart visualization.
 * Uses DirectoryService to fetch user-manager relationships.
 */

var OrgChartHandler = (function() {

  /**
   * Fetches the hierarchy data for the Org Chart.
   * @returns {Array<Array<string>>} Data compatible with Google Charts.
   * Format: [{v:'Mike', f:'Mike<div...>'}, 'Jim', 'President']
   */
  function getOrgChartData() {
    // 1. Fetch all users (Mock for prototype, would use DirectoryService.getAllUsers())
    // In production: var users = DirectoryService.getAllUsers();
    
    var users = [
      { email: 'ceo@robinsonsolutions.com', name: 'Alice CEO', title: 'CEO', manager: '' },
      { email: 'cto@robinsonsolutions.com', name: 'Bob CTO', title: 'CTO', manager: 'ceo@robinsonsolutions.com' },
      { email: 'cfo@robinsonsolutions.com', name: 'Charlie CFO', title: 'CFO', manager: 'ceo@robinsonsolutions.com' },
      { email: 'it.manager@robinsonsolutions.com', name: 'Dave IT', title: 'IT Manager', manager: 'cto@robinsonsolutions.com' },
      { email: 'hr.manager@robinsonsolutions.com', name: 'Eve HR', title: 'HR Manager', manager: 'cfo@robinsonsolutions.com' },
      { email: 'dev1@robinsonsolutions.com', name: 'Frank Dev', title: 'Developer', manager: 'it.manager@robinsonsolutions.com' },
      { email: 'dev2@robinsonsolutions.com', name: 'Grace Dev', title: 'Developer', manager: 'it.manager@robinsonsolutions.com' },
      { email: 'ops.vp@robinsonsolutions.com', name: 'Hank Ops', title: 'VP Ops', manager: 'ceo@robinsonsolutions.com' }
    ];

    // 2. Transform to Google Charts format
    var chartRows = users.map(function(u) {
      return [
        { 
          v: u.email, 
          f: '<div style="font-weight:bold">' + u.name + '</div><div style="font-style:italic">' + u.title + '</div>' 
        },
        u.manager, 
        u.title
      ];
    });

    return chartRows;
  }

  return {
    getOrgChartData: getOrgChartData
  };

})();
