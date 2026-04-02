/**
 * fraudService.js — Duplicate detection, rate limiting & GPS validation
 */

const crypto = require('crypto');
const fs     = require('fs');
const OceanReport = require('../models/OceanReport');
const { calculateDistance } = require('./geoService');

const generateFileHash = (filePath) =>
  new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end',  ()     => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });

exports.detectDuplicateReport = async (filePath, latitude, longitude) => {
  let imageHash = null;

  if (filePath && fs.existsSync(filePath)) {
    imageHash = await generateFileHash(filePath);
    const exactDuplicate = await OceanReport.findOne({ imageHash });
    if (exactDuplicate) {
      return { isDuplicate: true, reason: 'This exact image has already been reported previously.', imageHash };
    }
  }

  const twoDaysAgo   = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentReports = await OceanReport.find({ createdAt: { $gte: twoDaysAgo } }).select('latitude longitude');

  for (const report of recentReports) {
    const dist = calculateDistance(latitude, longitude, report.latitude, report.longitude);
    if (dist <= 5) {
      return {
        isDuplicate: true,
        reason: `A similar issue was already reported at this location (${Math.round(dist)}m away) recently.`,
        imageHash
      };
    }
  }

  return { isDuplicate: false, imageHash };
};

exports.hasUserAlreadyVoted = (report, userId) => {
  if (!report.voters) return false;
  return report.voters.some((v) => v.toString() === userId.toString());
};

exports.validateUserActivity = async (userId, currentLat, currentLon) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentReports = await OceanReport.find({
    reporterId: userId,
    createdAt: { $gte: oneDayAgo }
  }).sort({ createdAt: -1 });

  if (recentReports.length >= 10) {
    return {
      isFraudulent: true,
      reason: 'Rate limit exceeded: You have reached your daily limit of 10 reports. Please try again tomorrow.'
    };
  }

  if (recentReports.length > 0) {
    const last = recentReports[0];
    const dist = calculateDistance(last.latitude, last.longitude, currentLat, currentLon);
    const timeDiffHours = (Date.now() - last.createdAt) / (1000 * 60 * 60);
    const speedKmh = (dist / 1000) / Math.max(timeDiffHours, 0.01);
    if (speedKmh > 1000) {
      return {
        isFraudulent: true,
        reason: 'Suspicious activity: Unrealistic location jump detected. Please do not use GPS spoofers or VPNs.'
      };
    }
  }

  return { isFraudulent: false };
};
