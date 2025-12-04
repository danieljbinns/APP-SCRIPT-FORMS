# **Project Handover: New Hire Request Form (Google Apps Script)**

### **1\. Project Overview**

This is a **Google Apps Script Web App** designed to manage the end-to-end onboarding workflow for new employees. It functions as a state machine, moving a request through sequential stages (Requester \-\> HR \-\> IT \-\> Final Approval) and parallel departmental tasks (Fleetio, Credit Card, etc.).

* **Backend:** Google Apps Script (Code.gs)  
* **Database:** Google Sheets (Master Sheet)  
* **Schema Source:** Google Forms (Used primarily to define the question structure for the UI)  
* **Frontend:** HTML/CSS/JavaScript (Vanilla JS \+ Tailwind via CDN for smaller pages)

### **2\. Architecture & Logic Flow**

A. The "State Machine" (Spreadsheet Based)  
The application relies on a Master Google Sheet to store data. The column Workflow Status determines the lifecycle of a request.

* **States:** Pending HR Setup \-\> Pending IT Setup \-\> Pending Final HR Approval \-\> Completed (or Denied).

B. The Router (doGet)  
The app is a Single Page Application (SPA) served via doGet(e). It routes users based on URL parameters:

* ?id=...: Edit mode (if status allows).  
* ?view=hr\&id=...: HR Setup Form.  
* ?view=it\&id=...: IT Setup Form.  
* ?view=\[task\]\&id=...: Parallel tasks (Fleetio, Credit Cards).  
* ?action=approve: Final Approval interface.

C. The Asynchronous Queue (Critical)  
To prevent script timeouts during form submission, heavy tasks (PDF generation, Emailing) are decoupled:

1. User submits form \-\> Data saved to Sheet \-\> Post-Processing Status set to "Pending..." \-\> Success message returned immediately.  
2. A time-based trigger calls processQueue() after \~60 seconds.  
3. processQueue() scans the sheet, generates PDFs, sends emails, and updates status.

D. Dynamic Form Generation  
The main Index.html is not hardcoded.

1. Client calls getRequesterInitialData().  
2. Server reads the linked **Google Form** structure (FormApp).  
3. JavaScript.html dynamically builds the DOM elements based on that structure.

### **3\. File Manifest & Responsibilities**

* **Code.gs**: Server-side logic. Handles routing, DB reads/writes, PDF generation (html \-\> blob), and email triggers.  
* **Index.html**: The main container for the Requester Form.  
* **JavaScript.html**: The brain of Index.html. Handles dynamic DOM creation, conditional logic (showing/hiding sections), and validation.  
* **CSS.html**: Shared styling.  
* **HR.html**: Form for HR to input DSS Username, SiteDocs credentials, etc.  
* **ITSetup.html**: Form for IT to confirm hardware/software provisioning.  
* **ParallelTaskForm.html**: Generic template for simple departmental checkboxes.  
* **FleetioForm.html, CreditCardForm.html, JR306090Form.html**: Specialized forms for specific parallel tasks.  
* **Approval.html / Denial.html / SendBack.html**: Final stage actions.

### **4\. Key Configuration Constants (Code.gs)**

* FORM\_ID: The Google Form template ID.  
* SPREADSHEET\_ID: The Master Database Sheet ID.  
* JOB\_CODES\_SHEET\_ID: Source for "Site Name" and "Job Number" dropdowns.  
* HR\_SETUP\_EMAIL / IT\_SETUP\_EMAIL: Workflow notification targets.

### **5\. Current Status & Optimization Goals**

The project code is functionally complete regarding logic, but requires final polish and deployment preparation.

**Known Logic to Preserve:**

1. **Sanitization:** Dates must be stringified (sanitizeDataForClient) before passing to client-side.  
2. **PDF Generation:** Uses Utilities.newBlob(htmlString).getAs('application/pdf'). Images must be base64 encoded.  
3. **Gatekeeper:** The "Recruiting Requirements" question must act as a hard gate before showing the form.  
4. **Parallel Tasks:** checkForCompletion() checks the getParallelTaskMap() array to see if *all* required sub-tasks are done before triggering Final Approval.

**Next Steps for the AI:**

1. Review code for edge cases (e.g., null handling in getJobCodeData).  
2. Ensure the processQueue trigger logic prevents duplicate executions.  
3. Verify that checkForCompletion correctly distinguishes between "Salary" (Manual Approval) and "Hourly" (Auto-Complete).

**Instructions for the new Chat:**

* "I am providing the complete source code for a Google Apps Script Onboarding Application. Please ingest the files and the summary above. I need your help to \[Insert your specific goal, e.g., 'debug a specific error', 'add a new feature', or 'audit the security'\]." \*