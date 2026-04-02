const { validationResult } = require('express-validator')
const campaignsService = require('./campaignsService')

function mapValidationErrors(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed')
    err.statusCode = 400
    err.details = errors.array()
    throw err
  }
}

async function list(req, res) {
  mapValidationErrors(req)
  const { q, status } = req.query
  const result = await campaignsService.listCampaigns({ q, status })
  res.json(result)
}

async function create(req, res, next) {
  console.log('--- [API] POST /api/campaigns ---')
  console.log('[API] Processing campaign creation request...')
  
  try {
    const payload = { ...req.body }
    console.log('[API] Request Payload:', JSON.stringify(payload, null, 2))
    
    // Check missing fields
    const requiredFields = ['title', 'description', 'location', 'maxParticipants', 'durationHours'];
    const missing = requiredFields.filter(f => payload[f] === undefined || payload[f] === null || payload[f] === '');
    if (missing.length > 0) {
      console.log(`[API] Validation Error: Missing required fields: ${missing.join(', ')}`);
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    
    // Type validation
    if (typeof payload.durationHours !== 'number') {
      console.log('[API] Validation Error: durationHours must be a number');
      return res.status(400).json({ error: 'durationHours must be a number' });
    }
    if (typeof payload.maxParticipants !== 'number') {
      console.log('[API] Validation Error: maxParticipants must be a number');
      return res.status(400).json({ error: 'maxParticipants must be a number' });
    }

    // Handles Location Data Properly
    if (payload.coordinates) {
      const { lat, lng } = payload.coordinates;
      if (lat === undefined || lng === undefined || typeof lat !== 'number' || typeof lng !== 'number') {
        console.log('[API] Validation Error: Check lat/lng formatting');
        return res.status(400).json({ error: 'Location coordinates must include both lat and lng as numbers.' });
      }
    } else {
      console.log('[API] Validation Error: Location coordinates missing');
      return res.status(400).json({ error: 'Location coordinates are required.' });
    }
    
    // express-validator mapping
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.error('[API] request express-validation failed:', JSON.stringify(errors.array()))
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    // Do NOT allow manual credit input
    delete payload.creditsPerHour
    delete payload.totalCredits

    console.log('[API] Calling campaignsService.createCampaign with payload');
    const campaign = await campaignsService.createCampaign({
      userId: req.user._id,
      payload,
    })
    console.log('[API] Campaign created successfully. ID:', campaign._id)
    return res.status(201).json({ campaign })
  } catch (err) {
    console.error('[API] POST /api/campaigns - CRITICAL ERROR:', err.message, err.stack)
    if (err.statusCode || err.status) {
       return res.status(err.statusCode || err.status).json({ error: err.message, details: err.details });
    }
    if (err.name === 'ValidationError') {
       return res.status(400).json({ error: 'Database Validation Error', details: err.errors });
    }
    return res.status(500).json({ error: 'Internal Server Error during campaign creation', message: err.message });
  }
}

async function getById(req, res) {
  mapValidationErrors(req)
  const { id } = req.params
  const campaign = await campaignsService.getCampaignById(id)
  res.json({ campaign })
}

async function join(req, res) {
  mapValidationErrors(req)
  const { campaignId } = req.body
  const campaign = await campaignsService.joinCampaign({
    campaignId,
    userId: req.user._id,
  })
  res.json({ campaign })
}

async function myVolunteerHistory(req, res) {
  const result = await campaignsService.getMyVolunteerHistory(req.user._id)
  res.json(result)
}

async function generateQR(req, res) {
  mapValidationErrors(req)
  const { id } = req.params
  const result = await campaignsService.generateAttendanceQR({
    campaignId: id,
    organizerId: req.user._id,
  })
  res.json(result)
}

async function verifyAttendance(req, res) {
  mapValidationErrors(req)
  const { qrToken } = req.body
  const result = await campaignsService.verifyAttendance({
    qrToken,
    userId: req.user._id,
  })
  res.json(result)
}

async function markInterested(req, res) {
  mapValidationErrors(req)
  const { id } = req.params
  const campaign = await campaignsService.markInterested({
    campaignId: id,
    userId: req.user._id,
  })
  res.json({ campaign })
}

async function scanQR(req, res) {
  mapValidationErrors(req)
  const { campaignId, qrToken } = req.body
  const result = await campaignsService.scanQR({
    campaignId,
    qrToken,
    userId: req.user._id,
  })
  res.json(result)
}

async function getLeaderboard(req, res) {
  const topParticipants = await campaignsService.getLeaderboard()
  res.json({ leaderboard: topParticipants })
}

module.exports = { list, create, getById, join, myVolunteerHistory, generateQR, verifyAttendance, markInterested, scanQR, getLeaderboard }
