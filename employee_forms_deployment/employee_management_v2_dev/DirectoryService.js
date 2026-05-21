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
  // The Admin SDK requires full word/token match unless a trailing * wildcard
  // is used. Always append * so that partial prefixes like "rus" match "Russell".
  const q = query + '*';
  const byFirst = fetchUsers('givenName:'  + q);
  const byLast  = fetchUsers('familyName:' + q);
  const byEmail = fetchUsers('email:'      + q);
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
 * TEST ONLY — run from GAS Script Editor to diagnose directory search
 * Logs raw results + any errors from AdminDirectory.Users.list()
 */
function testDirectorySearch() {
  const query = 'dbi';
  Logger.log('=== testDirectorySearch: query=' + query + ' ===');
  try {
    const r = AdminDirectory.Users.list({
      customer: 'my_customer',
      query: 'givenName:' + query + '*',
      maxResults: 5,
      orderBy: 'givenName',
      projection: 'basic'
    });
    Logger.log('givenName query result count: ' + (r && r.users ? r.users.length : 0));
    if (r && r.users) r.users.forEach(function(u) { Logger.log('  user: ' + u.primaryEmail + ' name: ' + (u.name && u.name.fullName)); });
  } catch (e) {
    Logger.log('ERROR on givenName query: ' + e.toString());
  }
  try {
    const r2 = AdminDirectory.Users.list({
      customer: 'my_customer',
      query: 'email:' + query + '*',
      maxResults: 5,
      orderBy: 'givenName',
      projection: 'basic'
    });
    Logger.log('email query result count: ' + (r2 && r2.users ? r2.users.length : 0));
    if (r2 && r2.users) r2.users.forEach(function(u) { Logger.log('  user: ' + u.primaryEmail + ' name: ' + (u.name && u.name.fullName)); });
  } catch (e) {
    Logger.log('ERROR on email query: ' + e.toString());
  }
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
    
    // Fall back to email username prefix if directory name not available
    if (!name && email) name = email.split('@')[0];

    return {
      email: email,
      name: name
    };
  } catch (error) {
    Logger.log('Error getting current user details: ' + error.toString());
    const _e = Session.getActiveUser().getEmail();
    return { email: _e, name: _e ? _e.split('@')[0] : '' };
  }
}
