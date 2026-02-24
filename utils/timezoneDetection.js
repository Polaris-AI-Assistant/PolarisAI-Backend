/**
 * Timezone Detection Utility
 * 
 * Helps detect user timezone from various sources
 */

const moment = require('moment-timezone');

/**
 * Detect timezone from user location coordinates
 * @param {Object} location - {lat, lng}
 * @returns {string} - Timezone name (e.g., "America/New_York")
 */
function detectTimezoneFromLocation(location) {
  if (!location || !location.lat || !location.lng) {
    return null;
  }

  try {
    // Use moment-timezone to guess timezone from coordinates
    // This is a simple approximation based on longitude
    const lng = parseFloat(location.lng);
    
    // Rough timezone estimation based on longitude
    // Each 15 degrees of longitude ≈ 1 hour time difference
    const offsetHours = Math.round(lng / 15);
    
    // Get all timezones and find the closest one
    const allTimezones = moment.tz.names();
    
    // Try to find a timezone that matches the offset
    for (const tz of allTimezones) {
      const tzOffset = moment.tz(tz).utcOffset() / 60;
      if (Math.abs(tzOffset - offsetHours) < 1) {
        return tz;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[TimezoneDetection] Error detecting timezone from location:', error);
    return null;
  }
}

/**
 * Get timezone from browser timezone string
 * @param {string} browserTimezone - Browser timezone (e.g., "Asia/Kolkata")
 * @returns {string} - Validated timezone name
 */
function validateBrowserTimezone(browserTimezone) {
  if (!browserTimezone) {
    return null;
  }

  try {
    // Check if it's a valid timezone
    const allTimezones = moment.tz.names();
    if (allTimezones.includes(browserTimezone)) {
      return browserTimezone;
    }
    return null;
  } catch (error) {
    console.error('[TimezoneDetection] Error validating browser timezone:', error);
    return null;
  }
}

/**
 * Get user timezone from multiple sources (priority order)
 * @param {Object} options - {browserTimezone, userLocation, defaultTimezone}
 * @returns {string} - Timezone name
 */
function getUserTimezone(options = {}) {
  const { browserTimezone, userLocation, defaultTimezone = 'UTC' } = options;

  // Priority 1: Browser timezone (most accurate)
  const validatedBrowserTz = validateBrowserTimezone(browserTimezone);
  if (validatedBrowserTz) {
    console.log(`[TimezoneDetection] Using browser timezone: ${validatedBrowserTz}`);
    return validatedBrowserTz;
  }

  // Priority 2: Location-based detection
  const locationTz = detectTimezoneFromLocation(userLocation);
  if (locationTz) {
    console.log(`[TimezoneDetection] Using location-based timezone: ${locationTz}`);
    return locationTz;
  }

  // Priority 3: Default timezone
  console.log(`[TimezoneDetection] Using default timezone: ${defaultTimezone}`);
  return defaultTimezone;
}

/**
 * Format timezone for display
 * @param {string} timezone - Timezone name
 * @returns {string} - Formatted timezone (e.g., "EST (UTC-5)")
 */
function formatTimezoneForDisplay(timezone) {
  try {
    const now = moment.tz(timezone);
    const offset = now.format('Z');
    const abbr = now.format('z');
    return `${abbr} (UTC${offset})`;
  } catch (error) {
    return timezone;
  }
}

module.exports = {
  detectTimezoneFromLocation,
  validateBrowserTimezone,
  getUserTimezone,
  formatTimezoneForDisplay
};
