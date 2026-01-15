/**
 * MASTER TRACKER DASHBOARD
 * Enterprise-level dashboard aggregating all workflows, tasks, and KPIs
 * Provides real-time status, SLA tracking, team performance, and escalation management
 */

/**
 * Generates master tracker dashboard with all active workflows
 * @param {Object} config - Dashboard configuration
 * @returns {Object} Master dashboard definition
 */
function generateMasterTrackerDashboard(config = {}) {
  const dashboardId = 'MASTER-TRACKER-' + Date.now();

  return {
    dashboardId: dashboardId,
    title: config.title || 'Master Workflow Tracker',
    type: 'master',
    createdAt: new Date().toISOString(),
    refreshRate: config.refreshRate || 30000, // 30 seconds
    widgets: [
      generateOverviewWidget(),
      generateStatusBreakdownWidget(),
      generateSLAWidget(),
      generateTeamPerformanceWidget(),
      generateEscalationsWidget(),
      generateUpcomingDueWidget(),
      generateWorkflowTrendWidget()
    ],
    sections: {
      summary: generateMasterSummarySection(),
      workflows: generateMasterWorkflowsSection(),
      analytics: generateAnalyticsSection(),
      escalations: generateEscalationsSection()
    }
  };
}

/**
 * Generates overview statistics widget
 * @returns {Object} Overview widget configuration
 */
function generateOverviewWidget() {
  return {
    widgetId: 'widget-overview',
    type: 'overview-stats',
    title: 'Overview',
    layout: 'grid-4',
    stats: [
      {
        label: 'Total Active Workflows',
        value: 0,
        icon: 'workflow',
        color: 'primary',
        formula: 'COUNT(WHERE status IN ("ACTIVE", "PENDING"))'
      },
      {
        label: 'On Track',
        value: 0,
        icon: 'check-circle',
        color: 'success',
        formula: 'COUNT(WHERE status = "ON_TRACK")'
      },
      {
        label: 'At Risk',
        value: 0,
        icon: 'alert-circle',
        color: 'warning',
        formula: 'COUNT(WHERE status = "AT_RISK")'
      },
      {
        label: 'Critical',
        value: 0,
        icon: 'alert-triangle',
        color: 'danger',
        formula: 'COUNT(WHERE status = "CRITICAL")'
      },
      {
        label: 'Completed Today',
        value: 0,
        icon: 'completed',
        color: 'success',
        formula: 'COUNT(WHERE completedDate = TODAY)'
      },
      {
        label: 'Avg. Days to Complete',
        value: 0,
        icon: 'clock',
        color: 'info',
        formula: 'AVERAGE(completionTime)'
      },
      {
        label: 'Team Members',
        value: 0,
        icon: 'users',
        color: 'primary',
        formula: 'COUNT(DISTINCT assignedTo)'
      },
      {
        label: 'SLA Compliance',
        value: '0%',
        icon: 'trending-up',
        color: 'success',
        formula: 'PERCENTAGE(WHERE slaStatus = "MET")'
      }
    ]
  };
}

/**
 * Generates status breakdown widget with donut chart
 * @returns {Object} Status breakdown widget
 */
function generateStatusBreakdownWidget() {
  return {
    widgetId: 'widget-status-breakdown',
    type: 'donut-chart',
    title: 'Workflow Status Distribution',
    dataSource: 'workflows',
    groupBy: 'status',
    chartConfig: {
      colors: {
        COMPLETED: '#10B981',
        ACTIVE: '#3B82F6',
        PENDING: '#F59E0B',
        PAUSED: '#8B5CF6',
        FAILED: '#EF4444',
        CANCELLED: '#6B7280'
      },
      showLegend: true,
      showTooltip: true,
      animationDuration: 500
    }
  };
}

/**
 * Generates SLA tracking widget
 * @returns {Object} SLA widget
 */
function generateSLAWidget() {
  return {
    widgetId: 'widget-sla',
    type: 'progress-bars',
    title: 'SLA Performance',
    metrics: [
      {
        label: 'On-Time Completion',
        target: 95,
        current: 0,
        color: 'success',
        formula: 'PERCENTAGE(WHERE completedDate <= dueDate)'
      },
      {
        label: 'First Response Time',
        target: 2,
        current: 0,
        unit: 'hours',
        color: 'info',
        formula: 'AVERAGE(responseTime)'
      },
      {
        label: 'Resolution Time',
        target: 24,
        current: 0,
        unit: 'hours',
        color: 'warning',
        formula: 'AVERAGE(resolutionTime)'
      },
      {
        label: 'Customer Satisfaction',
        target: 90,
        current: 0,
        unit: '%',
        color: 'primary',
        formula: 'AVERAGE(satisfactionScore)'
      }
    ]
  };
}

/**
 * Generates team performance widget
 * @returns {Object} Team performance widget
 */
function generateTeamPerformanceWidget() {
  return {
    widgetId: 'widget-team-performance',
    type: 'bar-chart',
    title: 'Team Performance',
    dataSource: 'assignments',
    groupBy: 'assignedTo',
    metrics: [
      {
        label: 'Completed',
        dataKey: 'completedCount',
        color: '#10B981'
      },
      {
        label: 'In Progress',
        dataKey: 'inProgressCount',
        color: '#3B82F6'
      },
      {
        label: 'Overdue',
        dataKey: 'overdueCount',
        color: '#EF4444'
      }
    ],
    sortBy: 'completedCount',
    sortOrder: 'desc',
    limit: 10
  };
}

/**
 * Generates escalations widget
 * @returns {Object} Escalations widget
 */
function generateEscalationsWidget() {
  return {
    widgetId: 'widget-escalations',
    type: 'escalation-list',
    title: 'Escalations',
    filters: [
      {
        status: 'CRITICAL'
      },
      {
        daysOverdue: {$gte: 0}
      }
    ],
    sortBy: 'daysOverdue',
    sortOrder: 'desc',
    limit: 5,
    columns: [
      {key: 'reference', label: 'Reference'},
      {key: 'workflowName', label: 'Workflow'},
      {key: 'assignedTo', label: 'Assigned To'},
      {key: 'dueDate', label: 'Due Date'},
      {key: 'daysOverdue', label: 'Overdue (Days)'},
      {key: 'actions', label: 'Actions', type: 'actions'}
    ]
  };
}

/**
 * Generates upcoming due dates widget
 * @returns {Object} Upcoming due widget
 */
function generateUpcomingDueWidget() {
  return {
    widgetId: 'widget-upcoming-due',
    type: 'timeline',
    title: 'Upcoming Due This Week',
    filters: [
      {
        dueDate: {
          $gte: 'TODAY',
          $lte: 'TODAY+7'
        }
      },
      {
        status: {$ne: 'COMPLETED'}
      }
    ],
    sortBy: 'dueDate',
    sortOrder: 'asc',
    limit: 10,
    columns: [
      {key: 'reference', label: 'Reference', type: 'link'},
      {key: 'workflowName', label: 'Workflow'},
      {key: 'assignedTo', label: 'Owner'},
      {key: 'dueDate', label: 'Due'},
      {key: 'daysDue', label: 'In', type: 'badge'},
      {key: 'priority', label: 'Priority', type: 'badge'}
    ]
  };
}

/**
 * Generates workflow trend widget (line chart)
 * @returns {Object} Trend widget
 */
function generateWorkflowTrendWidget() {
  return {
    widgetId: 'widget-trend',
    type: 'line-chart',
    title: '30-Day Workflow Completion Trend',
    dataSource: 'workflows',
    groupBy: 'completedDate',
    aggregation: 'COUNT',
    timeRange: 'LAST_30_DAYS',
    granularity: 'daily',
    chartConfig: {
      colors: ['#3B82F6'],
      showGrid: true,
      showLegend: true,
      animationDuration: 500
    }
  };
}

/**
 * Generates master summary section HTML
 * @returns {string} HTML content
 */
function generateMasterSummarySection() {
  return `
    <div class="master-summary">
      <div class="summary-card">
        <div class="card elevated">
          <div class="card-header">
            <h3>Dashboard Overview</h3>
            <span class="badge-info" id="last-update">Last updated: now</span>
          </div>
          <div class="card-body">
            <div class="grid grid-4">
              <div class="stat-card">
                <div class="stat-value" id="stat-total">0</div>
                <div class="stat-label">Total Workflows</div>
              </div>
              <div class="stat-card">
                <div class="stat-value success" id="stat-completed">0</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-value info" id="stat-active">0</div>
                <div class="stat-label">Active</div>
              </div>
              <div class="stat-card">
                <div class="stat-value danger" id="stat-issues">0</div>
                <div class="stat-label">Issues</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates master workflows section with interactive table
 * @returns {string} HTML content
 */
function generateMasterWorkflowsSection() {
  return `
    <div class="master-workflows">
      <div class="card elevated">
        <div class="card-header">
          <h3>All Workflows</h3>
          <div class="flex gap">
            <input type="search" class="filter-input" placeholder="Search workflows..." id="search-workflows">
            <select id="filter-status" class="form-control">
              <option value="">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="PAUSED">Paused</option>
              <option value="FAILED">Failed</option>
            </select>
            <select id="filter-team" class="form-control">
              <option value="">All Teams</option>
              <option value="hr">HR</option>
              <option value="it">IT</option>
              <option value="finance">Finance</option>
              <option value="operations">Operations</option>
            </select>
            <button class="btn btn-primary btn-sm" id="btn-export">Export CSV</button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="workflows-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Workflow Name</th>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Assigned To</th>
                  <th>Due Date</th>
                  <th>SLA Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="workflows-tbody">
                <tr>
                  <td colspan="9" class="text-center">Loading workflows...</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination" id="workflows-pagination">
            <span>Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates analytics section with charts
 * @returns {string} HTML content
 */
function generateAnalyticsSection() {
  return `
    <div class="master-analytics">
      <div class="grid grid-2">
        <div class="card elevated">
          <div class="card-header">
            <h3>Status Distribution</h3>
          </div>
          <div class="card-body">
            <canvas id="chart-status-distribution" height="300"></canvas>
          </div>
        </div>
        <div class="card elevated">
          <div class="card-header">
            <h3>Completion Trend</h3>
          </div>
          <div class="card-body">
            <canvas id="chart-completion-trend" height="300"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card elevated">
          <div class="card-header">
            <h3>Team Performance</h3>
          </div>
          <div class="card-body">
            <canvas id="chart-team-performance" height="300"></canvas>
          </div>
        </div>
        <div class="card elevated">
          <div class="card-header">
            <h3>SLA Performance</h3>
          </div>
          <div class="card-body">
            <div id="sla-metrics">
              <div class="sla-metric">
                <div class="metric-label">On-Time Completion</div>
                <div class="progress-bar">
                  <div class="progress-fill" id="sla-ontime" style="width: 0%"></div>
                </div>
                <div class="metric-value" id="sla-ontime-val">0%</div>
              </div>
              <div class="sla-metric">
                <div class="metric-label">First Response</div>
                <div class="progress-bar">
                  <div class="progress-fill" id="sla-response" style="width: 0%"></div>
                </div>
                <div class="metric-value" id="sla-response-val">0h</div>
              </div>
              <div class="sla-metric">
                <div class="metric-label">Resolution Time</div>
                <div class="progress-bar">
                  <div class="progress-fill" id="sla-resolution" style="width: 0%"></div>
                </div>
                <div class="metric-value" id="sla-resolution-val">0h</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates escalations management section
 * @returns {string} HTML content
 */
function generateEscalationsSection() {
  return `
    <div class="master-escalations">
      <div class="card elevated">
        <div class="card-header">
          <h3>Escalations & Critical Items</h3>
          <span class="badge badge-danger" id="escalation-count">0</span>
        </div>
        <div class="card-body">
          <div id="escalations-list">
            <p class="text-center text-light">No escalations at this time</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders complete master tracker dashboard as HTML
 * @param {Object} dashboardDef - Dashboard definition
 * @param {Array} workflowData - Array of workflow data
 * @returns {string} Complete HTML dashboard
 */
function renderMasterTrackerHTML(dashboardDef, workflowData = []) {
  const css = generateMasterTrackerCSS();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${dashboardDef.title}</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="master-tracker-container">
    <header class="dashboard-header">
      <div class="header-content">
        <h1>${dashboardDef.title}</h1>
        <div class="header-controls">
          <div class="refresh-control">
            <label>Auto Refresh:</label>
            <select id="refresh-interval">
              <option value="10000">10s</option>
              <option value="30000" selected>30s</option>
              <option value="60000">1m</option>
              <option value="0">Off</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-refresh">Refresh Now</button>
          <button class="btn btn-secondary btn-sm" id="btn-settings">Settings</button>
        </div>
      </div>
    </header>

    <main class="dashboard-main">
      <div class="container-fluid">
        ${dashboardDef.sections.summary}

        <section class="dashboard-section">
          <h2>Workflow Management</h2>
          ${dashboardDef.sections.workflows}
        </section>

        <section class="dashboard-section">
          <h2>Analytics & Insights</h2>
          ${dashboardDef.sections.analytics}
        </section>

        <section class="dashboard-section">
          <h2>Escalations & Issues</h2>
          ${dashboardDef.sections.escalations}
        </section>
      </div>
    </main>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
  <script>
    // Global dashboard state
    const dashboardState = {
      refreshInterval: 30000,
      searchQuery: '',
      filters: {
        status: '',
        team: ''
      },
      currentPage: 1,
      pageSize: 20,
      workflowData: ${JSON.stringify(workflowData)},
      charts: {}
    };

    // Initialize dashboard
    function initDashboard() {
      attachEventListeners();
      loadDashboardData();
      startAutoRefresh();
    }

    // Attach event listeners
    function attachEventListeners() {
      document.getElementById('btn-refresh').addEventListener('click', () => {
        loadDashboardData();
      });

      document.getElementById('refresh-interval').addEventListener('change', (e) => {
        dashboardState.refreshInterval = parseInt(e.target.value);
        stopAutoRefresh();
        if (dashboardState.refreshInterval > 0) {
          startAutoRefresh();
        }
      });

      document.getElementById('search-workflows').addEventListener('input', (e) => {
        dashboardState.searchQuery = e.target.value;
        updateWorkflowsTable();
      });

      document.getElementById('filter-status').addEventListener('change', (e) => {
        dashboardState.filters.status = e.target.value;
        updateWorkflowsTable();
      });

      document.getElementById('filter-team').addEventListener('change', (e) => {
        dashboardState.filters.team = e.target.value;
        updateWorkflowsTable();
      });

      document.getElementById('btn-export').addEventListener('click', () => {
        exportToCSV();
      });
    }

    // Load dashboard data
    function loadDashboardData() {
      // Simulate loading data - in production this would fetch from backend
      updateOverviewStats();
      updateWorkflowsTable();
      updateCharts();
      updateEscalations();

      document.getElementById('last-update').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }

    // Update overview statistics
    function updateOverviewStats() {
      const data = dashboardState.workflowData;

      const total = data.length;
      const completed = data.filter(w => w.status === 'COMPLETED').length;
      const active = data.filter(w => w.status === 'ACTIVE').length;
      const issues = data.filter(w => w.status === 'FAILED' || w.slaStatus === 'AT_RISK').length;

      document.getElementById('stat-total').textContent = total;
      document.getElementById('stat-completed').textContent = completed;
      document.getElementById('stat-active').textContent = active;
      document.getElementById('stat-issues').textContent = issues;
    }

    // Update workflows table
    function updateWorkflowsTable() {
      let filtered = dashboardState.workflowData;

      if (dashboardState.searchQuery) {
        filtered = filtered.filter(w =>
          w.reference.toLowerCase().includes(dashboardState.searchQuery.toLowerCase()) ||
          w.workflowName.toLowerCase().includes(dashboardState.searchQuery.toLowerCase())
        );
      }

      if (dashboardState.filters.status) {
        filtered = filtered.filter(w => w.status === dashboardState.filters.status);
      }

      if (dashboardState.filters.team) {
        filtered = filtered.filter(w => w.team === dashboardState.filters.team);
      }

      const totalPages = Math.ceil(filtered.length / dashboardState.pageSize);
      const startIndex = (dashboardState.currentPage - 1) * dashboardState.pageSize;
      const pageData = filtered.slice(startIndex, startIndex + dashboardState.pageSize);

      const tbody = document.getElementById('workflows-tbody');
      tbody.innerHTML = pageData.map(w => \`
        <tr>
          <td><strong>\${w.reference}</strong></td>
          <td>\${w.workflowName}</td>
          <td>\${w.employeeName}</td>
          <td><span class="badge badge-\${getStatusColor(w.status)}">\${w.status}</span></td>
          <td>
            <div class="progress-mini">
              <div class="progress-fill" style="width: \${w.progress || 0}%"></div>
            </div>
          </td>
          <td>\${w.assignedTo}</td>
          <td>\${new Date(w.dueDate).toLocaleDateString()}</td>
          <td><span class="badge badge-\${w.slaStatus === 'MET' ? 'success' : 'danger'}">\${w.slaStatus}</span></td>
          <td>
            <button class="btn btn-sm btn-ghost" onclick="viewWorkflow('\${w.reference}')">View</button>
          </td>
        </tr>
      \`).join('');

      document.getElementById('current-page').textContent = dashboardState.currentPage;
      document.getElementById('total-pages').textContent = totalPages;
    }

    // Update charts
    function updateCharts() {
      if (document.getElementById('chart-status-distribution')) {
        updateStatusChart();
      }
      if (document.getElementById('chart-completion-trend')) {
        updateTrendChart();
      }
      if (document.getElementById('chart-team-performance')) {
        updateTeamChart();
      }
    }

    // Update escalations
    function updateEscalations() {
      const escalated = dashboardState.workflowData.filter(w =>
        w.status === 'FAILED' || w.slaStatus === 'AT_RISK' || w.isOverdue
      ).slice(0, 5);

      document.getElementById('escalation-count').textContent = escalated.length;

      const list = document.getElementById('escalations-list');
      if (escalated.length === 0) {
        list.innerHTML = '<p class="text-center text-light">No escalations at this time</p>';
        return;
      }

      list.innerHTML = escalated.map(e => \`
        <div class="escalation-item">
          <div class="escalation-header">
            <span class="escalation-ref">\${e.reference}</span>
            <span class="badge badge-danger">\${e.status}</span>
          </div>
          <p class="escalation-desc">\${e.workflowName}</p>
          <p class="escalation-assignee">Assigned to: \${e.assignedTo}</p>
          <button class="btn btn-sm btn-warning" onclick="resolveEscalation('\${e.reference}')">Take Action</button>
        </div>
      \`).join('');
    }

    // Export to CSV
    function exportToCSV() {
      let csv = 'Reference,Workflow,Employee,Status,Progress,Assigned To,Due Date,SLA\\n';

      dashboardState.workflowData.forEach(w => {
        csv += \`"\${w.reference}","\${w.workflowName}","\${w.employeeName}","\${w.status}",\${w.progress},"\${w.assignedTo}","\${w.dueDate}","\${w.slaStatus}"\\n\`;
      });

      const blob = new Blob([csv], {type: 'text/csv'});
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workflows-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    }

    // Placeholder functions
    function getStatusColor(status) {
      const colors = {
        COMPLETED: 'success',
        ACTIVE: 'info',
        PENDING: 'warning',
        PAUSED: 'info',
        FAILED: 'danger'
      };
      return colors[status] || 'info';
    }

    function updateStatusChart() {
      // Placeholder for Chart.js implementation
      console.log('Updating status chart');
    }

    function updateTrendChart() {
      // Placeholder for Chart.js implementation
      console.log('Updating trend chart');
    }

    function updateTeamChart() {
      // Placeholder for Chart.js implementation
      console.log('Updating team chart');
    }

    function viewWorkflow(ref) {
      console.log('View workflow:', ref);
    }

    function resolveEscalation(ref) {
      console.log('Resolve escalation:', ref);
    }

    let refreshTimer;
    function startAutoRefresh() {
      if (dashboardState.refreshInterval > 0) {
        refreshTimer = setInterval(loadDashboardData, dashboardState.refreshInterval);
      }
    }

    function stopAutoRefresh() {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', initDashboard);
  </script>
</body>
</html>
  `;
}

/**
 * Generates CSS for master tracker dashboard
 * @returns {string} CSS stylesheet
 */
function generateMasterTrackerCSS() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f0f2f5;
      color: #333;
      line-height: 1.6;
    }

    .master-tracker-container {
      min-height: 100vh;
    }

    .dashboard-header {
      background: white;
      border-bottom: 2px solid #e5e7eb;
      padding: 20px 0;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .header-content h1 {
      font-size: 28px;
      color: #1f2937;
      flex: 1;
      margin: 0;
    }

    .header-controls {
      display: flex;
      gap: 15px;
      align-items: center;
    }

    .refresh-control {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .refresh-control label {
      font-size: 14px;
      font-weight: 500;
    }

    .refresh-control select {
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 13px;
    }

    .dashboard-main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    .dashboard-section {
      margin-bottom: 30px;
    }

    .dashboard-section h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #1f2937;
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .card.elevated {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .card-header {
      padding: 20px;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .card-header h3 {
      margin: 0;
      font-size: 18px;
      color: #1f2937;
    }

    .card-body {
      padding: 20px;
    }

    .master-summary {
      margin-bottom: 30px;
    }

    .grid {
      display: grid;
      gap: 20px;
    }

    .grid-2 {
      grid-template-columns: repeat(2, 1fr);
    }

    .grid-4 {
      grid-template-columns: repeat(4, 1fr);
    }

    .stat-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #e5e7eb;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 8px;
    }

    .stat-value.success {
      color: #10b981;
    }

    .stat-value.info {
      color: #3b82f6;
    }

    .stat-value.danger {
      color: #ef4444;
    }

    .stat-label {
      font-size: 13px;
      color: #6b7280;
      font-weight: 500;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-info {
      background: #dbeafe;
      color: #1e40af;
    }

    .badge-success {
      background: #d1fae5;
      color: #065f46;
    }

    .badge-warning {
      background: #fef3c7;
      color: #92400e;
    }

    .badge-danger {
      background: #fee2e2;
      color: #991b1b;
    }

    .badge-primary {
      background: #dbeafe;
      color: #1e40af;
    }

    .filter-input {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 13px;
    }

    .form-control {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 13px;
      background: white;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #6b7280;
      color: white;
    }

    .btn-secondary:hover {
      background: #4b5563;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn-ghost {
      background: transparent;
      color: #3b82f6;
    }

    .btn-ghost:hover {
      background: #eff6ff;
    }

    .btn-warning {
      background: #f59e0b;
      color: white;
    }

    .btn-warning:hover {
      background: #d97706;
    }

    .table-responsive {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: #f9fafb;
      border-bottom: 2px solid #e5e7eb;
    }

    th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: #374151;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 13px;
    }

    tbody tr:hover {
      background: #f9fafb;
    }

    .progress-mini {
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #1d4ed8);
      border-radius: 3px;
    }

    .pagination {
      padding: 15px;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
    }

    .escalation-item {
      padding: 15px;
      border: 1px solid #f3f4f6;
      border-radius: 6px;
      margin-bottom: 10px;
    }

    .escalation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .escalation-ref {
      font-weight: 600;
      color: #1f2937;
    }

    .escalation-desc {
      font-size: 13px;
      color: #4b5563;
      margin: 5px 0;
    }

    .escalation-assignee {
      font-size: 12px;
      color: #6b7280;
      margin: 5px 0;
    }

    .gap {
      gap: 10px;
    }

    .text-center {
      text-align: center;
    }

    .text-light {
      color: #9ca3af;
    }

    @media (max-width: 768px) {
      .grid-2, .grid-4 {
        grid-template-columns: 1fr;
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-controls {
        flex-wrap: wrap;
      }

      table {
        font-size: 12px;
      }

      th, td {
        padding: 8px 12px;
      }
    }
  `;
}

/**
 * Gets sample workflow data for demo/testing
 * @returns {Array} Sample workflow records
 */
function getSampleWorkflowData() {
  const statuses = ['COMPLETED', 'ACTIVE', 'PENDING', 'PAUSED', 'FAILED'];
  const slaStatuses = ['MET', 'AT_RISK', 'BREACHED'];
  const employees = ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emma Davis', 'Robert Wilson'];
  const assignees = ['manager1@company.com', 'manager2@company.com', 'manager3@company.com'];

  const workflows = [];
  for (let i = 1; i <= 50; i++) {
    workflows.push({
      reference: `WFLOW-${String(i).padStart(5, '0')}`,
      workflowName: ['Employee Onboarding', 'IT Setup', 'Benefits Enrollment', 'Department Orientation', 'Role Training'][Math.floor(Math.random() * 5)],
      employeeName: employees[Math.floor(Math.random() * employees.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      progress: Math.floor(Math.random() * 100),
      assignedTo: assignees[Math.floor(Math.random() * assignees.length)],
      dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      slaStatus: slaStatuses[Math.floor(Math.random() * slaStatuses.length)],
      team: ['hr', 'it', 'finance', 'operations'][Math.floor(Math.random() * 4)]
    });
  }

  return workflows;
}
