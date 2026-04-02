/**
 * Converts degrees to radians
 * @param {number} degree 
 * @returns {number}
 */
const toRadians = (degree) => degree * (Math.PI / 180);

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * 
 * @param {number} lat1 - Latitude of the first point
 * @param {number} lon1 - Longitude of the first point
 * @param {number} lat2 - Latitude of the second point
 * @param {number} lon2 - Longitude of the second point
 * @returns {number} Distance between the two points in meters
 */
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's mean radius in meters
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceInMeters = R * c;
  return distanceInMeters;
};

/**
 * Validates if the user is within the allowed voting radius of a report.
 * Standardized maximum range is 1 kilometer (1000 meters) to allow vote.
 * 
 * @param {number} userLat 
 * @param {number} userLon 
 * @param {number} reportLat 
 * @param {number} reportLon 
 * @returns {{ isWithinRange: boolean, distanceInMeters: number }}
 */
exports.isWithinVotingRange = (userLat, userLon, reportLat, reportLon) => {
  const distance = exports.calculateDistance(userLat, userLon, reportLat, reportLon);
  return {
    isWithinRange: distance <= 1000, 
    distanceInMeters: distance
  };
};
