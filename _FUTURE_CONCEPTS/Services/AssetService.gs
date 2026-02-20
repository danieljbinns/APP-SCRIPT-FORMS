/**
 * AssetService.gs
 * 
 * Manages company assets (Hardware) and Licenses (Software).
 * Serves as the backend for the check-in/check-out system.
 */

var AssetService = (function() {

  // START KEY CONCEPT: ASSET DB
  // This could be a new Sheet "Assets" or an external SQL table.
  
  /**
   * Registers a new asset in the system.
   * @param {Object} asset - { type: 'LAPTOP', serial: '123', model: 'Dell XPS' }
   */
  function addAsset(asset) {
    if (!asset.serial) throw new Error("Serial number required");
    console.log("AssetService: Adding " + asset.model + " (" + asset.serial + ")");
    // SheetUtils.appendRow('Assets', [asset.type, asset.serial, asset.model, 'IN_STOCK', '']);
    return { success: true, id: asset.serial };
  }

  /**
   * Assigns an asset to an employee.
   * @param {string} serial 
   * @param {string} employeeId 
   */
  function checkoutAsset(serial, employeeId) {
    console.log("AssetService: Checking out " + serial + " to " + employeeId);
    // Logic: Find row by Serial, Update Status to 'ASSIGNED', Set Owner to employeeId
    // Logs history: AssetHistoryService.log(serial, employeeId, 'CHECKOUT');
    return { success: true, message: "Asset assigned." };
  }

  /**
   * Returns an asset to stock.
   * @param {string} serial 
   * @param {string} condition - 'GOOD', 'DAMAGED'
   */
  function checkinAsset(serial, condition) {
    console.log("AssetService: Checking in " + serial + ". Condition: " + condition);
    return { success: true, message: "Asset returned." };
  }

  /**
   * Gets all assets currently assigned to a user.
   * Useful for Offboarding checklist.
   */
  function getUserAssets(employeeId) {
    // Mock return
    return [
      { type: 'LAPTOP', model: 'MacBook Pro 16', serial: 'C02...', dateAssigned: '2025-01-01' },
      { type: 'MONITOR', model: 'Dell U27', serial: 'CN-0...', dateAssigned: '2025-01-01' }
    ];
  }

  // KEY CONCEPT: LICENSE MANAGEMENT
  function checkLicenseCapacity() {
    var licenses = [
      { name: 'SiteDocs', total: 100, used: 95, warning: true },
      { name: 'Fleetio', total: 50, used: 30, warning: false },
      { name: 'Adobe CC', total: 10, used: 10, warning: true }
    ];
    // Alert logic if used > 90%
    return licenses;
  }

  return {
    addAsset: addAsset,
    checkoutAsset: checkoutAsset,
    checkinAsset: checkinAsset,
    getUserAssets: getUserAssets,
    checkLicenseCapacity: checkLicenseCapacity
  };

})();
