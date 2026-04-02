/**
 * geoService.js — Haversine distance & voting range helpers
 */

const toRadians = (degree) => degree * (Math.PI / 180);

exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // metres
};

exports.isWithinVotingRange = (userLat, userLon, reportLat, reportLon) => {
  const distance = exports.calculateDistance(userLat, userLon, reportLat, reportLon);
  return { isWithinRange: distance <= 1000, distanceInMeters: distance };
};
