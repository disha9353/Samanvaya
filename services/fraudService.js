const crypto = require('crypto');
const fs = require('fs');
const Report = require('../models/Report');
const { calculateDistance } = require('./geoService');

/**
 * Helpers
 */
const generateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
};

/**
 * 1. Duplicate detection
 * Analyzes exact file matches (hash comparison) and flags if near an existing hot zone.
 */
exports.detectDuplicateReport = async (filePath, latitude, longitude) => {
  let imageHash = null;

  // Compare image hash for identical file re-upload
  if (filePath && fs.existsSync(filePath)) {
    imageHash = await generateFileHash(filePath);
    const exactDuplicate = await Report.findOne({ imageHash });
    
    if (exactDuplicate) {
      return { 
        isDuplicate: true, 
        reason: 'This exact image has already been reported previously.', 
        imageHash 
      };
    }
  }

  // Check nearby location reports (Within 50 meters, in the last 48 hours bounds to prevent immense DB scanning)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentReports = await Report.find({ createdAt: { $gte: twoDaysAgo } }).select('latitude longitude');
  
  for (const report of recentReports) {
    const distanceMeters = calculateDistance(latitude, longitude, report.latitude, report.longitude);
    if (distanceMeters <= 50) { 
      return { 
        isDuplicate: true, 
        reason: `A highly similar issue was already reported at this exact location (${Math.round(distanceMeters)}m away) recently.`, 
        imageHash 
      };
    }
  }

  return { isDuplicate: false, imageHash };
};

/**
 * 2. Prevent multiple votes
 * Validating the voters array against user intention.
 */
exports.hasUserAlreadyVoted = (report, userId) => {
  if (!report.voters) return false;
  return report.voters.some(v => v.toString() === userId.toString());
};

/**
 * 3. Rate limiting and 4. GPS validation
 * Blocks report spammers inside a 24-hour cycle and tracks spoofed high-speed jump distances.
 */
exports.validateUserActivity = async (userId, currentLat, currentLon) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentUserReports = await Report.find({ 
    reporterId: userId,
    createdAt: { $gte: oneDayAgo }
  }).sort({ createdAt: -1 });

  // 3. Rate limiting: Limit reports per user/day (max 10 allowed)
  if (recentUserReports.length >= 10) {
    return { 
      isFraudulent: true, 
      reason: 'Rate limit exceeded: You have reached your daily limit of 10 reports. Please try again tomorrow to maintain platform integrity.' 
    };
  }

  // 4. GPS validation: Reject unrealistic location jumps
  if (recentUserReports.length > 0) {
    const lastReport = recentUserReports[0]; 
    const distanceMeters = calculateDistance(lastReport.latitude, lastReport.longitude, currentLat, currentLon);
    
    // Calculate Speed in km/h based on distance vs elapsed time
    const timeDiffHours = (Date.now() - lastReport.createdAt) / (1000 * 60 * 60);
    const effectiveTimeDiff = Math.max(timeDiffHours, 0.01); // Prevent Division by zero if reports are seconds apart
    
    const distanceKm = distanceMeters / 1000;
    const speedKmh = distanceKm / effectiveTimeDiff;

    // Reject if theoretical travel speed structurally exceeds airplane cruising speed (~1000 km/h) bridging remote reports
    if (speedKmh > 1000) {
      return {
        isFraudulent: true,
        reason: 'Suspicious activity detected: Unrealistic geographical location jump. Please ensure you are not using a GPS spoofer or VPN.'
      };
    }
  }

  return { isFraudulent: false };
};
