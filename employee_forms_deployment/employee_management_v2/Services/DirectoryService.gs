/**
 * DirectoryService.gs
 * 
 * Handles interactions with the Google Workspace Admin SDK.
 * 
 * REQUIREMENTS:
 * 1. The "Admin Directory" service must be enabled in the Apps Script Services.
 * 2. The script project must have a standard GCP project associated if high quotas are needed (optional but recommended).
 * 3. Scope: https://www.googleapis.com/auth/admin.directory.user.readonly
 */

var DirectoryService = (function() {

  /**
   * Checks if an email address is already in use in the domain.
   * @param {string} email - The email address to check.
   * @returns {boolean} - True if exists, False if available.
   */
  function checkEmailAvailability(email) {
    if (!email) throw new Error("Email is required for availability check.");
    
    try {
      // Intentionally using 'users.list' with query to handle aliases as well if needed,
      // or 'users.get' for direct primary address check. 
      // 'get' throws 404 if not found, which is what we want to catch.
      AdminDirectory.Users.get(email);
      return true; // No error means user exists
    } catch (e) {
      if (e.message.indexOf("Resource Not Found") !== -1 || e.details.code === 404) {
        return false; // User not found
      }
      console.error("DirectoryService Check Error: " + e.message);
      throw e; // Rethrow other errors
    }
  }

  /**
   * Fetches a list of users to populate Manager dropdowns.
   * Can be filtered by query (e.g., specific OU or group).
   * @param {string} query - Optional API query string (e.g. "orgUnitPath='/Managers'")
   * @returns {Array<{email: string, name: string}>}
   */
  function getManagers(query) {
    var managers = [];
    var pageToken;
    var q = query || ""; // Default to all if empty, or refine logic here

    do {
      var response = AdminDirectory.Users.list({
        domain: 'robinsonsolutions.com', // explicit domain often required
        orderBy: 'email',
        query: q,
        viewType: 'domain_public',
        pageToken: pageToken
      });

      if (response.users) {
        response.users.forEach(function(user) {
          managers.push({
            email: user.primaryEmail,
            name: user.name.fullName
          });
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    return managers;
  }

  /**
   * Retrieves full details for a specific user.
   * @param {string} email 
   * @returns {Object} User resource
   */
  function getUserDetails(email) {
    try {
      return AdminDirectory.Users.get(email);
    } catch (e) {
      console.warn("User detail fetch failed for: " + email);
      return null;
    }
  }

  /**
   * Fetches all OrgUnits for the domain to populate a selection tree.
   * @returns {Array<Object>} List of OUs
   */
  function getOrgUnits() {
    try {
      var response = AdminDirectory.Orgunits.list('my_customer', {
        type: 'all'
      });
      return response.organizationUnits || [];
    } catch (e) {
      console.error("DirectoryService: Failed to fetch OUs. " + e.message);
      return [];
    }
  }

  /**
   * Searches for groups, optionally showing members to find "Template Users".
   * @param {string} query 
   * @returns {Array<Object>}
   */
  function getGroups(query) {
    var groups = [];
    var pageToken;
    try {
      do {
        var response = AdminDirectory.Groups.list({
          domain: 'robinsonsolutions.com',
          query: query || "",
          pageToken: pageToken
        });
        if (response.groups) {
           groups = groups.concat(response.groups);
        }
        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch(e) {
      console.error("DirectoryService: Failed to fetch groups. " + e.message);
    }
    return groups;
  }

  /**
   * Creates a new user in Google Workspace.
   * Supports copying group memberships from a "Template User".
   * 
   * @param {Object} userData - { primaryEmail, name: {given, family}, password, orgUnitPath }
   * @param {string} [templateUserEmail] - Optional email of user to copy groups from
   * @returns {Object} Created user resource
   */
  function createGoogleUser(userData, templateUserEmail) {
    console.log("DirectoryService: Creating user " + userData.primaryEmail);
    
    // 1. Create the User
    var newUser;
    try {
       // STUB: Real call would be AdminDirectory.Users.insert(userData);
       console.log("STUB: AdminDirectory.Users.insert", userData);
       newUser = { 
         id: "NEW_USER_" + new Date().getTime(),
         primaryEmail: userData.primaryEmail,
         orgUnitPath: userData.orgUnitPath
       };
    } catch (e) {
      throw new Error("Failed to create user: " + e.message);
    }

    // 2. Copy Groups from Template (if provided)
    if (templateUserEmail) {
      try {
        var templateGroups = AdminDirectory.Groups.list({
          userKey: templateUserEmail
        });
        
        if (templateGroups.groups) {
          templateGroups.groups.forEach(function(group) {
             console.log("STUB: Adding " + newUser.primaryEmail + " to group " + group.email);
             // STUB: AdminDirectory.Members.insert({email: newUser.primaryEmail}, group.email);
          });
        }
      } catch (e) {
        console.warn("DirectoryService: Failed to copy groups from " + templateUserEmail);
      }
    }

    return newUser;
  }

  // Public API
  return {
    checkEmailAvailability: checkEmailAvailability,
    getManagers: getManagers,
    getUserDetails: getUserDetails,
    getOrgUnits: getOrgUnits,
    getGroups: getGroups,
    createGoogleUser: createGoogleUser
  };

})();

/**
 * TEST FUNCTION
 * Run this to verify Admin SDK is enabled.
 */
function testDirectoryService() {
  try {
    var email = "test_non_existent_" + new Date().getTime() + "@robinsonsolutions.com";
    var exists = DirectoryService.checkEmailAvailability(email);
    console.log("Email " + email + " exists? " + exists);
    
    // Uncomment to test manager listing if permissions allow
    // var mgrs = DirectoryService.getManagers();
    // console.log("Found " + mgrs.length + " users.");
  } catch (e) {
    console.error("DirectoyService Test Failed: " + e.message);
    console.error("Did you enable 'Admin Directory' in Services?");
  }
}
