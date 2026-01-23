/**
 * DatabaseService.gs
 * 
 * Handles connections to external MySQL 8 database.
 * 
 * REQUIREMENTS:
 * 1. JDBC Service (builtin).
 * 2. Allowlist Google IPs on the MySQL firewall:
 *    https://developers.google.com/apps-script/guides/jdbc#jdbc-connectivity
 */

var DatabaseService = (function() {

  // Configuration - MOVE TO SCRIPT PROPERTIES IN PRODUCTION
  var DB_CONFIG = {
    url: 'jdbc:mysql://[HOST]:3306/[DATABASE_NAME]', 
    user: '[USER]',
    password: '[PASSWORD]'
  };

  /**
   * Establishes a connection to the database.
   * @returns {JdbcConnection}
   */
  function getConnection() {
    try {
      // Using getCloudSqlConnection if connecting to Cloud SQL, or getConnection for standard IP
      // Assuming standard IP for now based on "internal database mysql 8" description
      return Jdbc.getConnection(DB_CONFIG.url, DB_CONFIG.user, DB_CONFIG.password);
    } catch (e) {
      console.error("JDBC Connection Failed: " + e.message);
      throw new Error("Could not connect to database. Please check IP allowlist and credentials.");
    }
  }

  /**
   * Fetches active job sites.
   * @returns {Array<string>} List of job site names/codes.
   */
  function getJobSites() {
    var conn = null;
    var stmt = null;
    var rs = null;
    var results = [];

    try {
      // Mock return if config is missing (for safety during dev)
      if (DB_CONFIG.url.indexOf('[HOST]') !== -1) {
        console.warn("DatabaseService: Using MOCK data (Config not set)");
        return ["Site A (Mock)", "Site B (Mock)", "Site C (Mock)"];
      }

      conn = getConnection();
      // TODO: Define the actual query structure
      var sql = "SELECT site_name FROM job_sites WHERE active = 1 ORDER BY site_name ASC"; 
      stmt = conn.createStatement();
      rs = stmt.executeQuery(sql);

      while (rs.next()) {
        results.push(rs.getString(1));
      }

    } catch (e) {
      console.error("getJobSites Error: " + e.message);
      // Fallback or rethrow?
      throw e; 
    } finally {
      if (rs) rs.close();
      if (stmt) stmt.close();
      if (conn) conn.close();
    }
    return results;
  }

  /**
   * Fetches job titles.
   * @returns {Array<string>}
   */
  function getJobTitles() {
    var conn = null;
    var stmt = null;
    var rs = null;
    var results = [];

    try {
       // Mock return
      if (DB_CONFIG.url.indexOf('[HOST]') !== -1) {
        return ["Technician (Mock)", "Manager (Mock)", "Supervisor (Mock)"];
      }

      conn = getConnection();
      var sql = "SELECT title FROM job_titles WHERE active = 1 ORDER BY title ASC";
      stmt = conn.createStatement();
      rs = stmt.executeQuery(sql);

      while (rs.next()) {
        results.push(rs.getString(1));
      }
    } catch(e) {
      console.error("getJobTitles Error: " + e.message);
      throw e;
    } finally {
      if (rs) rs.close();
      if (stmt) stmt.close();
      if (conn) conn.close();
    }
    return results;
  }

  return {
    getJobSites: getJobSites,
    getJobTitles: getJobTitles
  };

})();

function testDatabaseConnection() {
  try {
    var sites = DatabaseService.getJobSites();
    console.log("Job Sites: " + JSON.stringify(sites));
  } catch (e) {
    console.error("Test Failed: " + e.message);
  }
}
