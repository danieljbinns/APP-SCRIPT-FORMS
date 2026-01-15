/**
 * ASSIGNMENT MANAGEMENT SYSTEM
 * Intelligent task assignment with escalation, load balancing, and skill-based routing
 * Manages team capacity, prevents burnout, and automates escalation procedures
 */

/**
 * Creates or updates an assignment
 * @param {Object} assignmentConfig - Assignment configuration
 * @returns {Object} Assignment result with ID and tracking
 */
function createAssignment(assignmentConfig) {
  const assignmentId = 'ASSIGN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

  const assignment = {
    assignmentId: assignmentId,
    taskId: assignmentConfig.taskId,
    workflowId: assignmentConfig.workflowId,
    assignedTo: assignmentConfig.assignedTo,
    assignedBy: assignmentConfig.assignedBy || 'SYSTEM',
    createdAt: new Date().toISOString(),
    dueDate: assignmentConfig.dueDate,
    priority: assignmentConfig.priority || 'NORMAL',
    skillsRequired: assignmentConfig.skillsRequired || [],
    status: 'ASSIGNED',
    escalations: [],
    notifications: [],
    history: [
      {
        timestamp: new Date().toISOString(),
        event: 'CREATED',
        assignedTo: assignmentConfig.assignedTo,
        notes: 'Assignment created'
      }
    ]
  };

  // Send assignment notification
  sendAssignmentNotification(assignment);

  // Create escalation watchers
  setupEscalationWatchers(assignment);

  // Log audit event
  logAuditEvent('ASSIGNMENT_CREATED', {assignmentId, workflowId: assignmentConfig.workflowId});

  return {
    success: true,
    assignmentId: assignmentId,
    assignment: assignment,
    message: 'Assignment created successfully'
  };
}

/**
 * Reassigns a task to a different team member
 * @param {string} assignmentId - Assignment ID
 * @param {string} newAssignee - New assignee email
 * @param {Object} options - Reassignment options
 * @returns {Object} Reassignment result
 */
function reassignTask(assignmentId, newAssignee, options = {}) {
  const reason = options.reason || 'Manual reassignment';
  const notify = options.notify !== false;
  const clearEscalations = options.clearEscalations !== false;

  // Validate new assignee
  if (!validateUserEmail(newAssignee)) {
    return {
      success: false,
      error: 'Invalid assignee email'
    };
  }

  // Check team capacity
  const capacity = getTeamMemberCapacity(newAssignee);
  if (capacity.remaining <= 0) {
    return {
      success: false,
      error: 'Team member has reached capacity',
      capacity: capacity
    };
  }

  // Update assignment record
  const result = {
    assignmentId: assignmentId,
    previousAssignee: 'unknown', // Would be fetched from database
    newAssignee: newAssignee,
    reassignedAt: new Date().toISOString(),
    reason: reason,
    status: 'REASSIGNED'
  };

  // Clear escalation flags if requested
  if (clearEscalations) {
    result.escalationsCleared = true;
  }

  // Send notifications
  if (notify) {
    sendReassignmentNotification(assignmentId, newAssignee, reason);
  }

  // Log audit event
  logAuditEvent('TASK_REASSIGNED', {
    assignmentId,
    previousAssignee: result.previousAssignee,
    newAssignee: newAssignee,
    reason: reason
  });

  return {
    success: true,
    result: result,
    message: 'Task reassigned successfully'
  };
}

/**
 * Intelligently assigns a task based on availability, skills, and load
 * @param {Object} taskConfig - Task configuration
 * @returns {Object} Intelligent assignment result
 */
function intelligentAssign(taskConfig) {
  // Get available team members
  const availableMembers = getAvailableTeamMembers();

  // Filter by required skills
  let candidates = availableMembers;
  if (taskConfig.skillsRequired && taskConfig.skillsRequired.length > 0) {
    candidates = candidates.filter(member =>
      taskConfig.skillsRequired.every(skill => member.skills.includes(skill))
    );
  }

  if (candidates.length === 0) {
    return {
      success: false,
      error: 'No team members available with required skills',
      skillsRequired: taskConfig.skillsRequired
    };
  }

  // Score candidates based on multiple factors
  const scoredCandidates = candidates.map(member => ({
    member,
    score: calculateAssignmentScore(member, taskConfig)
  }));

  // Sort by score and select best candidate
  scoredCandidates.sort((a, b) => b.score - a.score);
  const selectedMember = scoredCandidates[0].member;

  // Create assignment
  return createAssignment({
    taskId: taskConfig.taskId,
    workflowId: taskConfig.workflowId,
    assignedTo: selectedMember.email,
    assignedBy: 'INTELLIGENT_ASSIGNMENT',
    dueDate: taskConfig.dueDate,
    priority: taskConfig.priority,
    skillsRequired: taskConfig.skillsRequired
  });
}

/**
 * Calculates score for assignment candidate
 * @param {Object} member - Team member object
 * @param {Object} taskConfig - Task configuration
 * @returns {number} Assignment score (0-100)
 */
function calculateAssignmentScore(member, taskConfig) {
  let score = 50; // Base score

  // Workload factor (lighter workload = higher score)
  const workloadFactor = (100 - member.currentWorkload) / 100;
  score += workloadFactor * 20;

  // Skill match factor
  let skillMatch = 0;
  if (taskConfig.skillsRequired && taskConfig.skillsRequired.length > 0) {
    const matchedSkills = taskConfig.skillsRequired.filter(skill =>
      member.skills.includes(skill)
    ).length;
    skillMatch = (matchedSkills / taskConfig.skillsRequired.length) * 20;
  } else {
    skillMatch = 20; // Full score if no specific skills required
  }
  score += skillMatch;

  // Experience factor (more experience = higher score)
  const experienceFactor = Math.min(member.yearsOfExperience / 10, 1) * 15;
  score += experienceFactor;

  // Performance rating factor
  const performanceFactor = (member.performanceRating / 5) * 10;
  score += performanceFactor;

  // Specialization in this type of task
  if (member.specialization === taskConfig.type) {
    score += 10;
  }

  // Availability factor
  if (member.isAvailable) {
    score += 5;
  } else {
    score -= 10;
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Sets up escalation watchers for an assignment
 * @param {Object} assignment - Assignment object
 */
function setupEscalationWatchers(assignment) {
  const config = WORKFLOW_CONFIG.escalation;

  // Create triggers for each escalation level
  config.levels.forEach((level, index) => {
    const escalationTime = calculateEscalationTime(assignment.dueDate, level.hoursBeforeDue);

    addScheduledJob({
      type: 'ESCALATION_CHECK',
      assignmentId: assignment.assignmentId,
      escalationLevel: level.level,
      scheduledTime: escalationTime,
      actions: level.actions
    });
  });
}

/**
 * Calculates when escalation should trigger
 * @param {string} dueDate - Due date ISO string
 * @param {number} hoursBeforeDue - Hours before due date
 * @returns {Date} Escalation trigger time
 */
function calculateEscalationTime(dueDate, hoursBeforeDue) {
  const due = new Date(dueDate);
  const escalationTime = new Date(due.getTime() - (hoursBeforeDue * 60 * 60 * 1000));
  return escalationTime;
}

/**
 * Checks and executes escalations for overdue assignments
 * @returns {Array} Escalated assignments
 */
function checkEscalations() {
  const escalationConfig = WORKFLOW_CONFIG.escalation;
  const now = new Date();
  const escalated = [];

  // Get all active assignments
  const assignments = getAllActiveAssignments();

  assignments.forEach(assignment => {
    const dueDate = new Date(assignment.dueDate);
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

    // Check if assignment needs escalation
    escalationConfig.levels.forEach(level => {
      if (hoursUntilDue <= level.hoursBeforeDue && !assignment.escalations.includes(level.level)) {
        // Execute escalation
        executeEscalation(assignment, level);
        escalated.push(assignment.assignmentId);
      }
    });
  });

  Logger.log(`Escalation check complete. Escalated ${escalated.length} assignments.`);

  return escalated;
}

/**
 * Executes an escalation for an assignment
 * @param {Object} assignment - Assignment object
 * @param {Object} escalationLevel - Escalation level configuration
 */
function executeEscalation(assignment, escalationLevel) {
  // Update escalation status
  assignment.escalations.push(escalationLevel.level);

  // Execute configured actions
  escalationLevel.actions.forEach(action => {
    if (action === 'notify_manager') {
      sendEscalationNotification(assignment, 'manager');
    } else if (action === 'notify_director') {
      sendEscalationNotification(assignment, 'director');
    } else if (action === 'reassign') {
      findAndReassignToHigherCapacity(assignment);
    } else if (action === 'create_alert') {
      createSystemAlert(assignment, escalationLevel.level);
    } else if (action === 'adjust_priority') {
      increasePriority(assignment);
    }
  });

  // Log escalation event
  logAuditEvent('ESCALATION_TRIGGERED', {
    assignmentId: assignment.assignmentId,
    escalationLevel: escalationLevel.level,
    actions: escalationLevel.actions
  });
}

/**
 * Finds a team member with higher capacity and reassigns task
 * @param {Object} assignment - Assignment to reassign
 */
function findAndReassignToHigherCapacity(assignment) {
  const availableMembers = getAvailableTeamMembers();

  // Sort by remaining capacity
  availableMembers.sort((a, b) => {
    const capacityA = getTeamMemberCapacity(a.email).remaining;
    const capacityB = getTeamMemberCapacity(b.email).remaining;
    return capacityB - capacityA;
  });

  if (availableMembers.length > 0 && availableMembers[0].email !== assignment.assignedTo) {
    reassignTask(assignment.assignmentId, availableMembers[0].email, {
      reason: 'Escalation - reassigning to team member with higher capacity',
      notify: true,
      clearEscalations: true
    });
  }
}

/**
 * Sends assignment notification to assignee
 * @param {Object} assignment - Assignment object
 */
function sendAssignmentNotification(assignment) {
  const emailTemplate = WORKFLOW_CONFIG.emailTemplates.task_assigned;

  const emailData = {
    action: assignment.priority === 'HIGH' ? '🔴 URGENT ASSIGNMENT' : 'TASK ASSIGNMENT',
    taskName: assignment.taskId,
    employeeName: 'New Employee',
    assignedToName: assignment.assignedTo,
    dueDate: new Date(assignment.dueDate).toLocaleDateString(),
    priority: assignment.priority,
    workflowLink: '#'
  };

  const renderedEmail = renderEmailTemplate('task_assigned', emailData);

  // Send email
  sendEmail(assignment.assignedTo, renderedEmail.subject, renderedEmail.body);

  // Log notification
  assignment.notifications.push({
    timestamp: new Date().toISOString(),
    type: 'ASSIGNMENT_EMAIL',
    recipient: assignment.assignedTo,
    status: 'SENT'
  });
}

/**
 * Sends reassignment notification
 * @param {string} assignmentId - Assignment ID
 * @param {string} newAssignee - New assignee email
 * @param {string} reason - Reassignment reason
 */
function sendReassignmentNotification(assignmentId, newAssignee, reason) {
  const emailSubject = `Task Reassigned: ${assignmentId}`;
  const emailBody = `
    <p>Your task has been reassigned.</p>
    <p><strong>Assignment ID:</strong> ${assignmentId}</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>Please log in to the dashboard to view the details.</p>
  `;

  sendEmail(newAssignee, emailSubject, emailBody);
}

/**
 * Sends escalation notification
 * @param {Object} assignment - Assignment object
 * @param {string} escalationType - 'manager' or 'director'
 */
function sendEscalationNotification(assignment, escalationType) {
  let recipient;
  let subject = `ESCALATION: Task ${assignment.assignmentId} is at risk`;

  if (escalationType === 'manager') {
    // Send to manager of the assigned person
    recipient = getManagerEmail(assignment.assignedTo);
  } else if (escalationType === 'director') {
    // Send to director of the department
    recipient = getDirectorEmail(assignment.assignedTo);
  }

  if (recipient) {
    sendEmail(recipient, subject, generateEscalationEmail(assignment, escalationType));
  }
}

/**
 * Generates escalation email HTML
 * @param {Object} assignment - Assignment object
 * @param {string} escalationType - Type of escalation
 * @returns {string} Email HTML
 */
function generateEscalationEmail(assignment, escalationType) {
  const hoursRemaining = Math.round((new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60));

  return `
    <h2 style="color: #ef4444;">⚠️ Task Escalation Alert</h2>
    <p>A task has been escalated due to approaching deadline.</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f3f4f6;">
        <td style="padding: 10px; font-weight: bold;">Assignment ID</td>
        <td style="padding: 10px;">${assignment.assignmentId}</td>
      </tr>
      <tr>
        <td style="padding: 10px; font-weight: bold;">Assigned To</td>
        <td style="padding: 10px;">${assignment.assignedTo}</td>
      </tr>
      <tr style="background: #f3f4f6;">
        <td style="padding: 10px; font-weight: bold;">Due Date</td>
        <td style="padding: 10px;">${new Date(assignment.dueDate).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 10px; font-weight: bold;">Hours Remaining</td>
        <td style="padding: 10px; color: #ef4444; font-weight: bold;">${hoursRemaining} hours</td>
      </tr>
      <tr style="background: #f3f4f6;">
        <td style="padding: 10px; font-weight: bold;">Priority</td>
        <td style="padding: 10px;">${assignment.priority}</td>
      </tr>
    </table>
    <p style="margin-top: 20px;">
      <a href="#" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Assignment</a>
    </p>
  `;
}

/**
 * Gets team member capacity (workload analysis)
 * @param {string} email - Team member email
 * @returns {Object} Capacity metrics
 */
function getTeamMemberCapacity(email) {
  // Get assignments for team member
  const assignments = getAssignmentsForUser(email);

  const config = WORKFLOW_CONFIG.teamManagement;
  const maxCapacity = config.maxTasksPerMember;

  // Calculate weighted workload
  let weightedWorkload = 0;
  assignments.forEach(assignment => {
    const priorityWeight = {
      HIGH: 2,
      NORMAL: 1,
      LOW: 0.5
    };
    const estimatedHours = 40; // Default estimation
    weightedWorkload += estimatedHours * (priorityWeight[assignment.priority] || 1);
  });

  const workloadPercentage = Math.min((assignments.length / maxCapacity) * 100, 100);

  return {
    assignmentCount: assignments.length,
    maxCapacity: maxCapacity,
    remaining: maxCapacity - assignments.length,
    workloadPercentage: workloadPercentage,
    weightedWorkload: weightedWorkload,
    isAvailable: assignments.length < maxCapacity,
    isOverloaded: workloadPercentage > 80
  };
}

/**
 * Gets available team members (with remaining capacity)
 * @returns {Array} Available team members with metrics
 */
function getAvailableTeamMembers() {
  const config = WORKFLOW_CONFIG.teamManagement;
  const members = config.teamMembers || [];

  return members.map(member => ({
    ...member,
    capacity: getTeamMemberCapacity(member.email),
    isAvailable: getTeamMemberCapacity(member.email).remaining > 0
  })).filter(m => m.isAvailable);
}

/**
 * Creates a system alert for critical escalations
 * @param {Object} assignment - Assignment object
 * @param {string} escalationLevel - Escalation level
 */
function createSystemAlert(assignment, escalationLevel) {
  const alert = {
    alertId: 'ALERT-' + Date.now(),
    type: 'ESCALATION',
    severity: escalationLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    assignmentId: assignment.assignmentId,
    message: `Task ${assignment.assignmentId} escalated to ${escalationLevel} level`,
    createdAt: new Date().toISOString(),
    acknowledged: false
  };

  // Store alert in system
  Logger.log(`SYSTEM ALERT: ${alert.message}`);

  return alert;
}

/**
 * Increases priority of an assignment
 * @param {Object} assignment - Assignment object
 */
function increasePriority(assignment) {
  const priorityMap = {LOW: 'NORMAL', NORMAL: 'HIGH', HIGH: 'CRITICAL'};
  assignment.priority = priorityMap[assignment.priority] || assignment.priority;
}

/**
 * Gets all active assignments
 * @returns {Array} Active assignments
 */
function getAllActiveAssignments() {
  // This would query the database for active assignments
  // Returning empty for now - would be populated from spreadsheet data
  return [];
}

/**
 * Gets assignments for a specific user
 * @param {string} email - User email
 * @returns {Array} User's assignments
 */
function getAssignmentsForUser(email) {
  // Query assignments where assignedTo = email and status != 'COMPLETED'
  return [];
}

/**
 * Validates user email format
 * @param {string} email - Email to validate
 * @returns {boolean} Valid or not
 */
function validateUserEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Gets manager email for a team member (placeholder)
 * @param {string} email - Team member email
 * @returns {string} Manager email
 */
function getManagerEmail(email) {
  // Would look up in directory/database
  return 'manager@company.com';
}

/**
 * Gets director email for a team member (placeholder)
 * @param {string} email - Team member email
 * @returns {string} Director email
 */
function getDirectorEmail(email) {
  // Would look up in directory/database
  return 'director@company.com';
}

/**
 * Logs audit event for tracking
 * @param {string} eventType - Type of event
 * @param {Object} data - Event data
 */
function logAuditEvent(eventType, data) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    eventType: eventType,
    data: data,
    user: Session.getActiveUser().getEmail()
  };

  Logger.log(`AUDIT: ${JSON.stringify(auditLog)}`);
}

/**
 * Sends email (uses Apps Script mail service)
 * @param {string} recipient - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlBody - Email body (HTML)
 */
function sendEmail(recipient, subject, htmlBody) {
  try {
    MailApp.sendEmail(recipient, subject, '', {
      htmlBody: htmlBody,
      name: 'Workflow System'
    });
  } catch (error) {
    Logger.log(`Email send failed: ${error.message}`);
  }
}

/**
 * Renders email template with variable substitution
 * @param {string} templateName - Template name
 * @param {Object} data - Template variables
 * @returns {Object} Rendered email with subject and body
 */
function renderEmailTemplate(templateName, data) {
  const template = WORKFLOW_CONFIG.emailTemplates[templateName];

  if (!template) {
    return {subject: 'Notification', body: 'No template found'};
  }

  let subject = template.subject;
  let body = template.body;

  // Replace variables
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  });

  return {subject, body};
}

/**
 * Adds a scheduled job for escalation checking
 * @param {Object} jobConfig - Job configuration
 */
function addScheduledJob(jobConfig) {
  // Would schedule via Apps Script triggers
  Logger.log(`Scheduled job: ${jobConfig.type} for ${jobConfig.assignmentId}`);
}

/**
 * Generates assignment report for team
 * @param {string} teamName - Team name
 * @param {Object} options - Report options
 * @returns {string} HTML report
 */
function generateAssignmentReport(teamName, options = {}) {
  const config = WORKFLOW_CONFIG.teamManagement;
  const team = config.teamMembers.filter(m => m.team === teamName);

  let report = `
    <h2>Assignment Report - ${teamName}</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Team Member</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Assignments</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Capacity %</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  team.forEach(member => {
    const capacity = getTeamMemberCapacity(member.email);
    const statusColor = capacity.workloadPercentage > 80 ? '#ef4444' : capacity.workloadPercentage > 50 ? '#f59e0b' : '#10b981';

    report += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${member.name}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${capacity.assignmentCount}/${capacity.maxCapacity}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">
          <div style="width: 100%; height: 24px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
            <div style="width: ${capacity.workloadPercentage}%; height: 100%; background: ${statusColor};"></div>
          </div>
          ${Math.round(capacity.workloadPercentage)}%
        </td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">
          <span style="color: ${statusColor}; font-weight: bold;">
            ${capacity.isOverloaded ? '⚠️ OVERLOADED' : capacity.isAvailable ? '✓ Available' : '○ At Capacity'}
          </span>
        </td>
      </tr>
    `;
  });

  report += `
      </tbody>
    </table>
  `;

  return report;
}
