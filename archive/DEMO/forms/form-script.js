function initForm(taskType, taskName, successMsg) {
  const workflowId = sessionStorage.getItem('demoWorkflowId') || 'WF-REQ-20251204-DEMO';
  const formDataStr = sessionStorage.getItem('demoFormData');
  const formData = formDataStr ? JSON.parse(formDataStr) : {
    firstName: 'John',
    lastName: 'Smith',
    position: 'Project Manager',
    hireDate: '2025-12-15'
  };

  // Populate employee info
  if (document.getElementById('employeeName')) {
    document.getElementById('employeeName').textContent = `${formData.firstName} ${formData.lastName}`;
  }
  if (document.getElementById('position')) {
    document.getElementById('position').textContent = formData.position || 'N/A';
  }
  if (document.getElementById('hireDate')) {
    document.getElementById('hireDate').textContent = formData.hireDate || 'N/A';
  }
  if (document.getElementById('workflowId')) {
    document.getElementById('workflowId').textContent = workflowId;
  }

  // Set today's date for completion/setup date fields
  const today = new Date().toISOString().split('T')[0];
  const dateFields = ['completionDate', 'setupDate', 'processDate', 'assignmentDate'];
  dateFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) field.value = today;
  });

  // Handle form submission
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const taskId = `TASK-${taskType}-` + new Date().getTime().toString(36).toUpperCase();
      const empName = document.getElementById('employeeName') ? document.getElementById('employeeName').textContent : 'Employee';

      document.getElementById('form-container').innerHTML = `
        <div class="success-message">
          <h2>✓ ${taskName} Completed</h2>
          <p><strong>Task ID:</strong> ${taskId}</p>
          <p><strong>Employee:</strong> ${empName}</p>
          <p>${successMsg}</p>
          <p style="margin-top: 30px;">
            <button onclick="window.location.href='../dashboard.html'">Return to Dashboard</button>
          </p>
        </div>
      `;
    });
  }
}
