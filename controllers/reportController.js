const Report = require('../models/Report');
const User = require('../backend/src/models/User');
const Transaction = require('../backend/src/models/Transaction');
const { uploadReportMedia } = require('../services/mediaService');
const { validateReportImage } = require('../services/validationService');
const { isWithinVotingRange, calculateDistance } = require('../services/geoService');
const { detectDuplicateReport, validateUserActivity, hasUserAlreadyVoted } = require('../services/fraudService');

/**
 * Create API: POST /api/reports
 */
exports.createReport = async (req, res) => {
  try {
    const { latitude, longitude, category, description } = req.body;

    if (!latitude || !longitude || !category) {
      return res.status(400).json({ success: false, message: 'Latitude, longitude, and category are required' });
    }

    // Store reporterId internally from auth middleware
    const reporterId = req.user._id;

    // Fraud Validation: Rate limiting & GPS jumps
    const activityCheck = await validateUserActivity(reporterId, parseFloat(latitude), parseFloat(longitude));
    if (activityCheck.isFraudulent) {
      return res.status(403).json({ success: false, message: activityCheck.reason });
    }

    // Fraud Validation: Duplicate image block or duplicate nearby zone block
    let mainMediaFilePath = null;
    if (req.files && req.files.mainMedia && req.files.mainMedia.length > 0) {
      mainMediaFilePath = req.files.mainMedia[0].path;
    } else if (req.file) { // fallback
      mainMediaFilePath = req.file.path;
    }

    const duplicateCheck = await detectDuplicateReport(mainMediaFilePath, parseFloat(latitude), parseFloat(longitude));
    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({ success: false, message: duplicateCheck.reason });
    }

    let mainMediaUrl = '';
    let additionalMediaUrls = [];

    // Use Media Upload Service for Cloudinary integration
    if (req.files && req.files.mainMedia) {
      try {
        const uploadedMedia = await uploadReportMedia(req.files);
        mainMediaUrl = uploadedMedia.mainMediaUrl;
        additionalMediaUrls = uploadedMedia.additionalMediaUrls;
      } catch (uploadError) {
        return res.status(400).json({ success: false, message: uploadError.message });
      }
    } 
    // Scenario: Media URLs are passed directly in body (e.g., pre-uploaded)
    else if (req.body.mainMediaUrl) {
      mainMediaUrl = req.body.mainMediaUrl;
      additionalMediaUrls = req.body.additionalMediaUrls || [];
    } 
    else {
      return res.status(400).json({ success: false, message: 'Main media is required' });
    }

    // AI Pre-validation
    const aiAnalysis = await validateReportImage(mainMediaUrl);
    
    if (!aiAnalysis.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Report rejected: Uploaded image does not depict valid environmental issues.',
        details: aiAnalysis.details
      });
    }

    // Save report with status = PENDING
    const newReport = new Report({
      reporterId,
      mainMediaUrl,
      additionalMediaUrls,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      category,
      description,
      status: 'PENDING',
      isSuspicious: aiAnalysis.isSuspicious,
      aiValidationDetails: aiAnalysis.details,
      imageHash: duplicateCheck.imageHash
    });

    await newReport.save();

    // Re-fetch the saved report to apply the schema's 'select: false' for reporterId
    const reportResponse = await Report.findById(newReport._id);

    // Sanitize and generate optional anonymousId for UI display
    const reportResponseObj = reportResponse.toObject();
    delete reportResponseObj.voters;
    delete reportResponseObj.reporterId; // Redundant safety
    reportResponseObj.anonymousId = `Anon-${reportResponseObj._id.toString().substring(18, 24).toUpperCase()}`;

    // Return response, confirming reporterId is NOT included
    res.status(201).json({
      success: true,
      report: reportResponseObj
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ success: false, message: 'Server error during report creation' });
  }
};

/**
 * Vote API: POST /api/reports/:id/vote
 * One button action to confirm vote on a report.
 */
exports.voteReport = async (req, res) => {
  try {
    const reportId = req.params.id;
    // Store userId internally from auth middleware
    const userId = req.user._id;

    // Get the user's current GPS location from the request body
    const { latitude: userLat, longitude: userLon } = req.body;

    if (userLat === undefined || userLon === undefined) {
      return res.status(400).json({ success: false, message: 'Your current location (latitude and longitude) is required to vote on reports' });
    }

    const report = await Report.findById(reportId).select('+reporterId');
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Calculate distance between user and report using Haversine formula
    const geoValidation = isWithinVotingRange(parseFloat(userLat), parseFloat(userLon), report.latitude, report.longitude);
    
    // Only allow vote if within 500m-1km range
    if (!geoValidation.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: 'Vote rejected: You must be within 1km of the reported issue to vote. You are approx ' + Math.round(geoValidation.distanceInMeters) + ' meters away.'
      });
    }

    // Check if user already voted
    if (report.voters.includes(userId)) {
      return res.status(400).json({ success: false, message: 'You have already voted on this report' });
    }

    // Add userId to voters array
    report.voters.push(userId);
    // Increment voteCount
    report.voteCount += 1;

    // Credit logic and Status validation
    const VOTE_THRESHOLD = 5;
    let creditsToAward = 0;
    let creditReason = '';

    if (report.status === 'PENDING' && report.voteCount >= VOTE_THRESHOLD) {
      report.status = 'VALIDATED';
      
      const BASE_CREDITS = 50;
      creditsToAward += BASE_CREDITS;
      creditReason = 'Report Validated';

      // Check for first report in area (e.g. 5km radius)
      const nearbyValidated = await Report.find({ status: 'VALIDATED' }).select('latitude longitude');
      let isFirstInArea = true;
      for (const r of nearbyValidated) {
        if (r._id.toString() !== report._id.toString()) {
          const dist = calculateDistance(report.latitude, report.longitude, r.latitude, r.longitude);
          if (dist <= 5000) {
            isFirstInArea = false;
            break;
          }
        }
      }

      if (isFirstInArea) {
        creditsToAward += 30; // Bonus for first report in area
        creditReason = 'First Report in Area Bonus';
      }
    } else if (report.status === 'VALIDATED') {
      // Bonus for high votes (extra credits for significant community validation)
      creditsToAward += 5; // Bonus for high votes
      creditReason = 'High Votes Bonus';
    }

    // Award credits & Impact Tracking to reporter using existing wallet system
    if (creditsToAward > 0 && report.reporterId) {
      // Bonus 15 Impact Points internally appended toward ecoScore when validated/highly-voted.
      await User.updateOne({ _id: report.reporterId }, { $inc: { credits: creditsToAward, ecoScore: 15 } });
      
      await Transaction.create({
        seller: report.reporterId, // 'seller' field acts as payee in existing wallet transactions
        credits: creditsToAward,
        type: 'report_reward',
        meta: { reportId: report._id, reason: creditReason, impactPoints: 15 }
      });
    }

    // Save final report snapshot and execute Real-time Event Sourcing hooks securely across live map peers.
    await report.save();
    
    // Scale live severity score manually from memory to match the API read mapping
    const severityScore = Math.min(10, Math.floor(1 + (report.voteCount / 1.5)));

    if (req.app?.locals?.io) {
       req.app.locals.io.emit('report:vote_update', {
         reportId: report._id,
         voteCount: report.voteCount,
         status: report.status,
         severityScore
       });
    }

    res.status(200).json({
      success: true,
      message: 'Vote confirmed',
      voteCount: report.voteCount
    });
  } catch (error) {
    console.error('Error handling vote:', error);
    res.status(500).json({ success: false, message: 'Server error during voting' });
  }
};

/**
 * Fetch Nearby Reports API: GET /api/reports/nearby
 * Features: Fetch near user's location, filter by radius, exclude reporterId, return media/category/vote/location.
 */
exports.getNearbyReports = async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const searchRadius = radius ? parseFloat(radius) : 5000; // Default 5km radius
    const userId = req.user ? req.user._id.toString() : null;

    // Optional Expiry Enhancement: Auto-purge obsolete unverified requests older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch active reports and strictly select required fields (reporterId is excluded automatically & by projection)
    const reports = await Report.find({ 
      status: { $ne: 'REJECTED' },
      $or: [
        { status: 'VALIDATED' },
        { status: 'PENDING', createdAt: { $gte: sevenDaysAgo } }
      ]
    })
      .select('mainMediaUrl additionalMediaUrls category voteCount latitude longitude status createdAt voters')
      .lean();

    const nearbyReports = reports
      .map(report => {
        const distance = calculateDistance(userLat, userLon, report.latitude, report.longitude);
        const hasVoted = userId && report.voters ? report.voters.some(v => v.toString() === userId) : false;
        
        // Optional Enhancement: Calculate structural Severity Score mapping [1-10] factoring vote momentum.
        const severityScore = Math.min(10, Math.floor(1 + (report.voteCount / 1.5)));

        const reportObj = {
          ...report,
          distanceInMeters: Math.round(distance),
          hasVoted,
          severityScore,
          anonymousId: `Anon-${report._id.toString().substring(18, 24).toUpperCase()}`
        };
        
        // Ensure complete sanitization of objects
        delete reportObj.voters;
        delete reportObj.reporterId;
        
        return reportObj;
      })
      .filter(report => report.distanceInMeters <= searchRadius)
      .sort((a, b) => a.distanceInMeters - b.distanceInMeters);

    res.status(200).json({
      success: true,
      count: nearbyReports.length,
      reports: nearbyReports
    });
  } catch (error) {
    console.error('Error fetching nearby reports:', error);
    res.status(500).json({ success: false, message: 'Server error fetching nearby reports' });
  }
};
