/**
 * Employee Management Forms - Validation Utilities Library
 * Shared input validation and sanitization functions
 */

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate hire date is at least N business days away
 * @param {Date|string} hireDate - Hire date
 * @param {Date|string} requestDate - Request submission date
 * @param {number} [minDays] - Minimum business days required (default: 3)
 * @returns {Object} Validation result {valid: boolean, message: string, businessDays: number}
 */
function validateHireDate(hireDate, requestDate, minDays) {
  const requiredDays = minDays || 3;
  
  // Convert to Date objects if strings
  const hire = hireDate instanceof Date ? hireDate : new Date(hireDate);
  const request = requestDate instanceof Date ? requestDate : new Date(requestDate);
  
  if (isNaN(hire.getTime()) || isNaN(request.getTime())) {
    return { valid: false, message: 'Invalid date format', businessDays: 0 };
  }
  
  // Calculate business days between dates
  let businessDays = 0;
  let currentDate = new Date(request);
  
  while (currentDate < hire) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay();
    // Count if not Saturday (6) or Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }
  
  const valid = businessDays >= requiredDays;
  const message = valid 
    ? `${businessDays} business days - OK`
    : `Only ${businessDays} business days (${requiredDays} required)`;
  
  return { valid, message, businessDays };
}

/**
 * Sanitize user input (remove dangerous characters)
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove script tags and dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number
 * @returns {boolean} True if valid format
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Check if 10 or 11 digits (with optional country code)
  const phoneRegex = /^1?\d{10}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate that required fields are filled
 * @param {Object} formData - Form data object
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} Validation result {valid: boolean, missing: Array<string>}
 */
function validateRequiredFields(formData, requiredFields) {
  const missing = [];
  
  requiredFields.forEach(field => {
    if (!formData[field] || formData[field].toString().trim() === '') {
      missing.push(field);
    }
  });
  
  return {
    valid: missing.length === 0,
    missing: missing,
    message: missing.length > 0 ? `Missing required fields: ${missing.join(', ')}` : 'All required fields present'
  };
}

/**
 * Validate date is in the future
 * @param {Date|string} date - Date to validate
 * @returns {boolean} True if date is in the future
 */
function isFutureDate(date) {
  const checkDate = date instanceof Date ? date : new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  
  return checkDate >= today;
}

/**
 * Format and validate name (First/Last)
 * @param {string} name - Name to validate
 * @returns {Object} {valid: boolean, formatted: string, message: string}
 */
function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, formatted: '', message: 'Name is required' };
  }
  
  const sanitized = sanitizeInput(name);
  
  // Check minimum length
  if (sanitized.length < 2) {
    return { valid: false, formatted: sanitized, message: 'Name too short' };
  }
  
  // Check for numbers
  if (/\d/.test(sanitized)) {
    return { valid: false, formatted: sanitized, message: 'Name cannot contain numbers' };
  }
  
  // Capitalize first letter of each word
  const formatted = sanitized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return { valid: true, formatted: formatted, message: 'Valid name' };
}
