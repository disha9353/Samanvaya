/**
 * reportController.js
 * Self-contained controller for the Ocean Reports feature.
 * All dependencies resolve from within backend/src so that node_modules
 * (mongoose, cloudinary, @google/generative-ai) are found correctly.
 */

const OceanReport      = require('../models/OceanReport');
const User             = require('../models/User');
const Transaction      = require('../models/Transaction');
const { uploadReportMedia }         = require('../services/mediaService');
const { validateReportImage }       = require('../services/validationService');
const { isWithinVotingRange, calculateDistance } = require('../services/geoService');
const { detectDuplicateReport, validateUserActivity } = require('../services/fraudService');

// ── Create Report ─────────────────────────────────────────────────────────────
exports.createReport = async (req, res) => {
  try {
    const { latitude, longitude, category, description } = req.body;

    if (!latitude || !longitude || !category) {
      return res.status(400).json({ success: false, message: 'latitude, longitude and category are required' });
    }

    const reporterId = req.user._id;

    // Fraud: rate limiting & GPS jump check
    const activityCheck = await validateUserActivity(reporterId, parseFloat(latitude), parseFloat(longitude));
    if (activityCheck.isFraudulent) {
      return res.status(403).json({ success: false, message: activityCheck.reason });
    }

    // Gather local file path for hash check
    let mainMediaFilePath = null;
    if (req.files?.mainMedia?.length) {
      mainMediaFilePath = req.files.mainMedia[0].path;
    } else if (req.file) {
      mainMediaFilePath = req.file.path;
    }

    // Fraud: duplicate image or nearby zone
    const duplicateCheck = await detectDuplicateReport(mainMediaFilePath, parseFloat(latitude), parseFloat(longitude));
    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({ success: false, message: duplicateCheck.reason });
    }

    // Upload media
    let mainMediaUrl      = '';
    let additionalMediaUrls = [];

    if (req.files?.mainMedia) {
      const uploaded = await uploadReportMedia(req.files).catch((err) => {
        return res.status(400).json({ success: false, message: err.message });
      });
      if (!uploaded) return; // response already sent
      mainMediaUrl         = uploaded.mainMediaUrl;
      additionalMediaUrls  = uploaded.additionalMediaUrls;
    } else if (req.body.mainMediaUrl) {
      mainMediaUrl         = req.body.mainMediaUrl;
      additionalMediaUrls  = req.body.additionalMediaUrls || [];
    } else {
      return res.status(400).json({ success: false, message: 'Main media is required' });
    }

    // AI pre-validation
    const aiAnalysis = await validateReportImage(mainMediaUrl);
    if (!aiAnalysis.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Report rejected: image does not depict a valid environmental issue.',
        details: aiAnalysis.details
      });
    }

    const newReport = new OceanReport({
      reporterId,
      mainMediaUrl,
      additionalMediaUrls,
      latitude:             parseFloat(latitude),
      longitude:            parseFloat(longitude),
      category,
      description,
      status:               'PENDING',
      isSuspicious:         aiAnalysis.isSuspicious,
      aiValidationDetails:  aiAnalysis.details,
      imageHash:            duplicateCheck.imageHash
    });

    await newReport.save();

    const saved     = await OceanReport.findById(newReport._id);
    const reportObj = saved.toObject();
    delete reportObj.voters;
    delete reportObj.reporterId;
    reportObj.anonymousId = `Anon-${reportObj._id.toString().substring(18, 24).toUpperCase()}`;

    return res.status(201).json({ success: true, report: reportObj });
  } catch (error) {
    console.error('createReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error during report creation' });
  }
};

// ── Vote on a Report ──────────────────────────────────────────────────────────
exports.voteReport = async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId   = req.user._id;
    const { latitude: userLat, longitude: userLon } = req.body;

    if (userLat === undefined || userLon === undefined) {
      return res.status(400).json({ success: false, message: 'Your current location is required to vote' });
    }

    const report = await OceanReport.findById(reportId).select('+reporterId');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    const geo = isWithinVotingRange(parseFloat(userLat), parseFloat(userLon), report.latitude, report.longitude);
    if (!geo.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `Vote rejected: you must be within 1km of the issue. You are ~${Math.round(geo.distanceInMeters)}m away.`
      });
    }

    if (report.voters.includes(userId)) {
      return res.status(400).json({ success: false, message: 'You have already voted on this report' });
    }

    report.voters.push(userId);
    report.voteCount += 1;

    const VOTE_THRESHOLD = 5;
    let creditsToAward = 0;
    let creditReason   = '';

    if (report.status === 'PENDING' && report.voteCount >= VOTE_THRESHOLD) {
      report.status  = 'VALIDATED';
      creditsToAward = 50;
      creditReason   = 'Report Validated';

      // Bonus: first report in 5km area
      const nearby = await OceanReport.find({ status: 'VALIDATED' }).select('latitude longitude');
      const isFirst = !nearby.some(
        (r) => r._id.toString() !== report._id.toString() &&
               calculateDistance(report.latitude, report.longitude, r.latitude, r.longitude) <= 5000
      );
      if (isFirst) { creditsToAward += 30; creditReason = 'First Report in Area Bonus'; }

    } else if (report.status === 'VALIDATED') {
      creditsToAward = 5;
      creditReason   = 'High Votes Bonus';
    }

    if (creditsToAward > 0 && report.reporterId) {
      await User.updateOne({ _id: report.reporterId }, { $inc: { credits: creditsToAward, ecoScore: 15 } });
      await Transaction.create({
        seller:  report.reporterId,
        credits: creditsToAward,
        type:    'report_reward',
        meta:    { reportId: report._id, reason: creditReason, impactPoints: 15 }
      });
    }

    await report.save();

    const severityScore = Math.min(10, Math.floor(1 + report.voteCount / 1.5));
    req.app?.locals?.io?.emit('report:vote_update', {
      reportId:     report._id,
      voteCount:    report.voteCount,
      status:       report.status,
      severityScore
    });

    return res.status(200).json({ success: true, message: 'Vote confirmed', voteCount: report.voteCount });
  } catch (error) {
    console.error('voteReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error during voting' });
  }
};

// ── Get Nearby Reports ────────────────────────────────────────────────────────
exports.getNearbyReports = async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required' });
    }

    const userLat      = parseFloat(latitude);
    const userLon      = parseFloat(longitude);
    const searchRadius = radius ? parseFloat(radius) : 5000;
    const userId       = req.user?._id?.toString() ?? null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const reports = await OceanReport.find({
      status: { $ne: 'REJECTED' },
      $or: [
        { status: 'VALIDATED' },
        { status: 'PENDING', createdAt: { $gte: sevenDaysAgo } }
      ]
    })
      .select('mainMediaUrl additionalMediaUrls category voteCount latitude longitude status createdAt voters')
      .lean();

    const nearbyReports = reports
      .map((report) => {
        const distance      = calculateDistance(userLat, userLon, report.latitude, report.longitude);
        const hasVoted      = userId && report.voters
          ? report.voters.some((v) => v.toString() === userId)
          : false;
        const severityScore = Math.min(10, Math.floor(1 + report.voteCount / 1.5));

        const obj = {
          ...report,
          distanceInMeters: Math.round(distance),
          hasVoted,
          severityScore,
          anonymousId: `Anon-${report._id.toString().substring(18, 24).toUpperCase()}`
        };
        delete obj.voters;
        delete obj.reporterId;
        return obj;
      })
      .filter((r) => r.distanceInMeters <= searchRadius)
      .sort((a, b) => a.distanceInMeters - b.distanceInMeters);

    return res.status(200).json({ success: true, count: nearbyReports.length, reports: nearbyReports });
  } catch (error) {
    console.error('getNearbyReports error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching nearby reports' });
  }
};
