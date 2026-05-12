/**
 * Directory Service - Google Workspace User Lookups
 */

/**
 * Search the Google Workspace directory for users matching a query
 * @param {string} query - The search query (name or email prefix)
 * @returns {Array} List of {name, email} objects
 */
function searchDirectoryUsers(query) {
  if (!query || query.length < 2) return [];
  
  try {
    // Search the domain directory using People API
    // This relies on Contact Sharing being enabled for the domain
    const response = People.People.searchDirectoryPeople({
      query: query,
      readMask: 'names,emailAddresses',
      sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE']
    });
    
    if (!response || !response.people) return [];
    
    // Map the people array to our standard format
    return response.people.map(person => {
      let name = '';
      if (person.names && person.names.length > 0) {
        name = person.names[0].displayName || '';
      }
      
      let email = '';
      if (person.emailAddresses && person.emailAddresses.length > 0) {
        email = person.emailAddresses[0].value || '';
      }
      
      return { name: name, email: email };
    }).filter(p => p.email); // Ensure we only return users that have an email
    
  } catch (e) {
    console.error('Directory search error (People API): ' + e.toString());
    return [];
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
    
    return {
      email: email,
      name: name
    };
  } catch (error) {
    Logger.log('Error getting current user details: ' + error.toString());
    return { email: Session.getActiveUser().getEmail(), name: '' };
  }
}
