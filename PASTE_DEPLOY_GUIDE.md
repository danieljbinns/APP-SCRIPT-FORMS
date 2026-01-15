# Final Deployment Sequence

Follow these steps in order to activate the premium gated workflow and dashboards.

## 1. Specialist Placeholder

**Project Name**: `specialist_placeholder`

1. Copy [Code.gs](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/specialist_placeholder/Code.gs) and [Config.gs](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/specialist_placeholder/Config.gs).
2. Copy the new [Placeholder.html](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/specialist_placeholder/Placeholder.html).
3. **Deploy** > **New Deployment** > **Web App**.
4. **Copy the "Web App URL"**.

## 2. IT Setup (The Trigger)

**Project Name**: `it_setup`

1. Update [Config.gs](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/it_setup/Config.gs) with the URL from Step 1 (`SPECIALIST_PLACEHOLDER_URL`).
2. Update [Code.gs](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/it_setup/Code.gs) and [ITSetup.html](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/it_setup/ITSetup.html).
3. **Deploy** > **New Version**.

## 3. Employee Request Dashboard

**Project Name**: `employee_request_dashboard` (or your existing dashboard project)

1. Update [Code.gs](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/admin_dashboard/Code.gs) and [Config.gs](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/admin_dashboard/Config.gs).
2. Update [Dashboard.html](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/admin_dashboard/Dashboard.html).
3. **[NEW]** Create a file named `Details.html` and paste [the content](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/admin_dashboard/Details.html).
4. **Deploy** > **New Deployment**. This is your main URL for tracking.

## 4. HR ID Setup (Gatekeeper)

**Project Name**: `employee_id_setup`

1. Ensure `Config.gs` has the correct `IT_FORM_URL`.
2. Update [Code.gs](file:///P:/Repos/github/danieljbinns/APP%20SCRIPT%20FORMS/employee_forms_deployment/employee_id_setup/Code.gs) (the version that only triggers the IT email).
3. **Deploy** > **New Version**.
