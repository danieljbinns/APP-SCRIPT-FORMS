/**
 * Directory Service - Google Workspace User Lookups
 */

/**
 * Search the Google Workspace directory for users matching a query.
 * Uses customer:'my_customer' to search across ALL domains in the org
 * (team-group.com, robinsonsolutions.com, industrialappliedtech.com, etc.)
 *
 * @param {string} query - The search query (name or email prefix)
 * @returns {Array} List of {name, email} objects
 */
function searchDirectoryUsers(query) {
  if (!query || query.length < 2) return [];

  function fetchUsers(q) {
    try {
      const r = AdminDirectory.Users.list({ customer: 'my_customer', query: q, maxResults: 15, orderBy: 'givenName', projection: 'basic' });
      return (r && r.users) ? r.users : [];
    } catch (e) {
      console.error('Directory search error (' + q + '): ' + e.toString());
      return [];
    }
  }

  // Run explicit first-name, last-name, and email queries and merge.
  // Using givenName:/familyName: instead of name: because the Admin SDK's
  // name: query anchors to the start of fullName (often "First Last"), so
  // typing a last name prefix like "roberts" hits name: by luck but a first
  // name prefix like "russell" can miss if fullName ordering differs.
  // Explicit field queries are reliable regardless of how fullName is stored.
  const byFirst = fetchUsers('givenName:'  + query);
  const byLast  = fetchUsers('familyName:' + query);
  const byEmail = fetchUsers('email:'      + query);
  const seen = {};
  const merged = [];
  byFirst.concat(byLast).concat(byEmail).forEach(function(u) {
    const email = u.primaryEmail || '';
    if (email && !seen[email]) {
      seen[email] = true;
      merged.push({
        name:  (u.name && u.name.fullName) ? u.name.fullName : email,
        email: email
      });
    }
  });
  return merged;
}

/**
 * Get details for the current active user
 * @returns {Object} {email, name}
 */
function getCurrentUserDetails() {
  try {
    const email = Session.getActiveUser().getEmail();
    let name = '';
    
    // Try to get name from Directory API
    try {
      const user = AdminDirectory.Users.get(email);
      name = user.name.fullName;
    } catch (e) {
      // Fallback if Directory API fails or user not found
      Logger.log('Could not fetch user name from directory: ' + e.toString());
    }
    
    return {
      email: email,
      name: name
    };
  } catch (error) {
    Logger.log('Error getting current user details: ' + error.toString());
    return { email: Session.getActiveUser().getEmail(), name: '' };
  }
}
