const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const QRCode = require('qrcode')

const Campaign = require('../../models/Campaign')
const User = require('../../models/User')
const Transaction = require('../../models/Transaction')
const PlatformSetting = require('../../models/PlatformSetting')
const env = require('../../config/env')
const { getIo } = require('../../socket/index')
const { createNotification } = require('../../services/notificationService')

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeStatus(campaign) {
  const max = Number(campaign.maxParticipants || 0)
  const joined = Array.isArray(campaign.participants) ? campaign.participants.length : 0
  if (campaign.status === 'COMPLETED') return 'COMPLETED'
  if (max > 0 && joined >= max) return 'FULL'
  return 'OPEN'
}

function toPlain(campaignDoc) {
  try {
    const obj = campaignDoc && campaignDoc.toObject ? campaignDoc.toObject() : (campaignDoc || {})

    const totalParticipants = Array.isArray(obj.interestedUsers) ? obj.interestedUsers.length : 0
    const totalAttendees = Array.isArray(obj.attendees) ? obj.attendees.length : 0
    const rewardedCount = Array.isArray(obj.rewardedParticipants) ? obj.rewardedParticipants.length : 0
    const creditsDistributed = rewardedCount * (Number(obj.totalCredits) || 0)

    return {
      ...obj,
      // Ensure all array fields exist even if missing in old DB docs
      participants: Array.isArray(obj.participants) ? obj.participants : [],
      interestedUsers: Array.isArray(obj.interestedUsers) ? obj.interestedUsers : [],
      attendees: Array.isArray(obj.attendees) ? obj.attendees : [],
      rewardedParticipants: Array.isArray(obj.rewardedParticipants) ? obj.rewardedParticipants : [],
      durationHours: obj.durationHours ?? 1,
      creditsPerHour: obj.creditsPerHour ?? 50,
      totalCredits: obj.totalCredits ?? 0,
      status: normalizeStatus(obj),
      dashboardStats: {
        totalParticipants,
        totalAttendees,
        creditsDistributed,
      }
    }
  } catch (e) {
    console.error('[toPlain] Failed to serialize campaign:', e.message)
    return null
  }
}

/** Returns credits per hour from PlatformSetting (default 50). */
async function getCreditsPerHour() {
  const setting = await PlatformSetting.findOne({ key: 'campaign_credits_per_hour' }).lean()
  const value = Number(setting?.value)
  return Number.isFinite(value) && value > 0 ? value : 50
}

/** Calculates total credits: hours × rate. */
function calcTotalCredits(durationHours, creditsPerHour) {
  const hours = Number(durationHours) || 1
  const rate = Number(creditsPerHour) || 50
  return Math.round(hours * rate)
}

/** Award credits to a user and write a transaction record. */
async function awardVolunteerCredits({ userId, campaignId, credits }) {
  if (!Number.isFinite(credits) || credits <= 0) return
  await User.updateOne({ _id: userId }, { $inc: { credits } })
  await Transaction.create({
    buyer: null,
    seller: userId,
    item: null,
    credits,
    type: 'wallet_adjustment',
    meta: { reason: 'campaign_volunteer_reward', campaignId: String(campaignId) },
  })
}

// ── Public service functions ─────────────────────────────────────────────────

async function listCampaigns({ q, status }) {
  const filter = {}
  if (q) {
    filter.$or = [{ title: { $regex: q, $options: 'i' } }, { location: { $regex: q, $options: 'i' } }]
  }
  if (status && ['OPEN', 'FULL', 'COMPLETED'].includes(status)) {
    filter.status = status
  }

  const campaigns = await Campaign.find(filter)
    .sort({ createdAt: -1 })
    .populate('organizer', '_id name profilePic')
    .populate('participants', '_id name profilePic')
    .lean()

  const items = campaigns.map(toPlain).filter(Boolean)
  return { campaigns: items }
}

async function createCampaign({ userId, payload }) {
  console.log('[Service] createCampaign -> Starting process');
  try {
    console.log('[Service] Fetching credits per hour');
    const creditsPerHour = await getCreditsPerHour()
    const durationHours = Number(payload.durationHours) || 1
    const totalCredits = calcTotalCredits(durationHours, creditsPerHour)

    // Ensure we don't pass an already existing _id if any
    delete payload._id
    
    // Clean up empty coordinate strings
    if (payload.coordinates && (payload.coordinates.lat === '' || payload.coordinates.lng === '')) {
      delete payload.coordinates;
    }

    console.log('[Service] Instantiating new Campaign object');
    const campaign = new Campaign({
      ...payload,
      durationHours,
      creditsPerHour,
      totalCredits,
      organizer: userId,
      participants: [new mongoose.Types.ObjectId(userId)],
      rewardedParticipants: [],
      attendees: [],
      status: 'OPEN',
    })

    console.log('[Service] Running validationSync on new campaign');
    const validationError = campaign.validateSync()
    if (validationError) {
       console.error('[Service] Mongoose Schema Validation Failed:', validationError.errors)
       const err = new Error('Database schema validation failed')
       err.statusCode = 400
       err.details = Object.values(validationError.errors).map(e => ({ field: e.path, message: e.message }))
       throw err
    }

    console.log('[Service] Saving campaign to DB');
    await campaign.save()

    console.log('[Service] Populating saved campaign details');
    const populated = await Campaign.findById(campaign._id)
      .populate('organizer', '_id name profilePic')
      .populate('participants', '_id name profilePic')
    
    console.log('[Service] Successfully created campaign!', populated._id);
    return toPlain(populated)
  } catch (err) {
    console.error('[Service] createCampaign Exception Caught:', err.message, err.stack);
    if (err.name === 'ValidationError') {
      err.statusCode = 400
      err.details = Object.values(err.errors || {}).map(e => ({ field: e.path, message: e.message }))
    }
    throw err
  }
}

async function getCampaignById(id) {
  const campaign = await Campaign.findById(id)
    .populate('organizer', '_id name profilePic')
    .populate('participants', '_id name profilePic')
    .populate('interestedUsers', '_id name profilePic')
    .populate('attendees', '_id name profilePic')

  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }

  return toPlain(campaign)
}

async function joinCampaign({ campaignId, userId }) {
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }
  if (campaign.status === 'COMPLETED') {
    const err = new Error('Campaign already completed')
    err.statusCode = 400
    throw err
  }

  const already = campaign.participants.some((p) => p.toString() === userId.toString())
  if (already) {
    const populatedAlready = await Campaign.findById(campaignId)
      .populate('organizer', '_id name profilePic')
      .populate('participants', '_id name profilePic')
    return toPlain(populatedAlready)
  }

  const max = Number(campaign.maxParticipants || 0)
  if (max > 0 && campaign.participants.length >= max) {
    campaign.status = 'FULL'
    await campaign.save()
    const err = new Error('Campaign is full')
    err.statusCode = 400
    throw err
  }

  campaign.participants.push(new mongoose.Types.ObjectId(userId))
  campaign.status = normalizeStatus(campaign)
  await campaign.save()

  const populated = await Campaign.findById(campaignId)
    .populate('organizer', '_id name profilePic')
    .populate('participants', '_id name profilePic')
  return toPlain(populated)
}

/** Organizer generates a one-time JWT QR token for attendance verification. */
async function generateAttendanceQR({ campaignId, organizerId }) {
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }
  if (campaign.organizer.toString() !== organizerId.toString()) {
    const err = new Error('Only the organizer can generate the attendance QR')
    err.statusCode = 403
    throw err
  }
  if (campaign.status === 'COMPLETED') {
    const err = new Error('Campaign is already completed')
    err.statusCode = 400
    throw err
  }

  const token = jwt.sign(
    { campaignId: campaign._id.toString(), type: 'campaign_attendance' },
    env.JWT_QR_SECRET,
    { expiresIn: '15m' }
  )

  const expiryDate = new Date()
  expiryDate.setMinutes(expiryDate.getMinutes() + 15)

  campaign.qrToken = token
  campaign.qrExpiry = expiryDate
  campaign.attendanceQrToken = token // left for backward compatibility
  await campaign.save()

  // Generate QR code image containing the token
  const qrPayload = JSON.stringify({
    campaignId: campaign._id.toString(),
    qrToken: token,
  })
  const qrImage = await QRCode.toDataURL(qrPayload)

  return { qrToken: token, campaignId: campaign._id.toString(), qrExpiry: expiryDate, qrImage }
}

/** Participant scans QR → verified → credits awarded. */
async function verifyAttendance({ qrToken, userId }) {
  if (!env.JWT_QR_SECRET) {
    const err = new Error('QR secret not configured')
    err.statusCode = 500
    throw err
  }

  let payload
  try {
    payload = jwt.verify(qrToken, env.JWT_QR_SECRET)
  } catch {
    const err = new Error('Invalid or expired QR code')
    err.statusCode = 400
    throw err
  }

  if (payload.type !== 'campaign_attendance') {
    const err = new Error('Invalid QR token type')
    err.statusCode = 400
    throw err
  }

  const campaign = await Campaign.findById(payload.campaignId)
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }
  if (campaign.attendanceQrToken !== qrToken) {
    const err = new Error('QR code has been rotated or invalidated')
    err.statusCode = 400
    throw err
  }

  // Check user is a participant
  const isParticipant = campaign.participants.some((p) => p.toString() === userId.toString())
  if (!isParticipant) {
    const err = new Error('You must join the campaign before scanning attendance')
    err.statusCode = 403
    throw err
  }

  // Check already attended
  const alreadyAttended = campaign.attendees.some((p) => p.toString() === userId.toString())
  if (alreadyAttended) {
    return {
      alreadyAttended: true,
      creditsEarned: 0,
      totalCredits: campaign.totalCredits,
      message: 'Attendance already recorded',
    }
  }

  // Check already rewarded
  const alreadyRewarded = campaign.rewardedParticipants.some((p) => p.toString() === userId.toString())

  campaign.attendees.push(new mongoose.Types.ObjectId(userId))
  if (!alreadyRewarded) {
    campaign.rewardedParticipants.push(new mongoose.Types.ObjectId(userId))
  }
  await campaign.save()

  const creditsEarned = campaign.totalCredits || 0
  if (!alreadyRewarded && creditsEarned > 0) {
    await awardVolunteerCredits({ userId, campaignId: campaign._id, credits: creditsEarned })
  }

  return {
    alreadyAttended: false,
    creditsEarned: alreadyRewarded ? 0 : creditsEarned,
    totalCredits: campaign.totalCredits,
    message: alreadyRewarded
      ? 'Attendance recorded (credits already awarded)'
      : `Attendance verified! ${creditsEarned} credits awarded`,
  }
}

async function scanQR({ campaignId, qrToken, userId }) {
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }

  // Logic: Validate token string match
  if (campaign.qrToken !== qrToken) {
    const err = new Error('QR token mismatch')
    err.statusCode = 400
    throw err
  }

  // Logic: Crypto validation (checks signature, embedded campaignId, and JWT expiry)
  try {
    const decoded = jwt.verify(qrToken, env.JWT_QR_SECRET)
    if (decoded.campaignId !== campaignId.toString()) {
      const err = new Error('Token does not match this campaign')
      err.statusCode = 403
      throw err
    }
  } catch (error) {
    const err = new Error('Invalid or expired QR code signature')
    err.statusCode = 400
    throw err
  }

  // Logic: Check DB expiry (as an additional safety net)
  if (campaign.qrExpiry && new Date() > new Date(campaign.qrExpiry)) {
    const err = new Error('QR token has expired')
    err.statusCode = 400
    throw err
  }

  // Process attendance if valid
  const isParticipant = campaign.participants?.some((p) => p.toString() === userId.toString())
  if (!isParticipant) {
    // If they scan without joining, we can automatically add them as a participant
    campaign.participants.push(new mongoose.Types.ObjectId(userId))
  }

  const alreadyAttended = campaign.attendees.some((p) => p.toString() === userId.toString())
  if (alreadyAttended) {
    const err = new Error('User has already scanned')
    err.statusCode = 400
    throw err
  }

  const alreadyRewarded = campaign.rewardedParticipants.some((p) => p.toString() === userId.toString())

  campaign.attendees.push(new mongoose.Types.ObjectId(userId))
  if (!alreadyRewarded) {
    campaign.rewardedParticipants.push(new mongoose.Types.ObjectId(userId))
  }
  await campaign.save()

  const creditsEarned = campaign.totalCredits || 0
  if (!alreadyRewarded && creditsEarned > 0) {
    await awardVolunteerCredits({ userId, campaignId: campaign._id, credits: creditsEarned })
  }

  try {
    const io = getIo()
    if (io) {
      io.emit('campaign_attendance_update', { campaignId: campaign._id.toString() })
    }
    const organizerId = campaign.organizer ? campaign.organizer.toString() : null
    if (organizerId) {
      await createNotification(
        organizerId,
        'ATTENDANCE_VERIFIED',
        `A participant verified attendance for your campaign: ${campaign.title}`,
        { campaignId: campaign._id.toString(), participantId: userId.toString() }
      )
    }
  } catch (err) {
    console.error('Failed to dispatch socket/notification in scanQR', err)
  }

  return {
    success: true,
    alreadyAttended: false,
    creditsEarned: alreadyRewarded ? 0 : creditsEarned,
    totalCredits: campaign.totalCredits,
    message: alreadyRewarded
      ? 'Attendance recorded (credits already awarded)'
      : `Attendance verified! ${creditsEarned} credits awarded`,
  }
}

async function getMyVolunteerHistory(userId) {
  const campaigns = await Campaign.find({
    $or: [{ participants: userId }, { interestedUsers: userId }],
  })
    .sort({ dateTime: -1, createdAt: -1 })
    .populate('organizer', '_id name profilePic')
    .lean()

  const userIdText = String(userId)
  const activities = campaigns.map((c) => {
    const derivedStatus = normalizeStatus(c)
    const isOrganizer = String(c.organizer?._id || c.organizer) === userIdText
    const attended = Array.isArray(c.attendees)
      ? c.attendees.some((p) => p.toString() === userIdText)
      : false
    const rewarded = Array.isArray(c.rewardedParticipants)
      ? c.rewardedParticipants.some((p) => p.toString() === userIdText)
      : false
    const isJoined = Array.isArray(c.participants)
      ? c.participants.some((p) => p.toString() === userIdText)
      : false

    let participationStatus = 'Interested'
    if (attended) participationStatus = 'Attended'
    else if (isJoined) participationStatus = 'Joined'

    return {
      campaignId: String(c._id),
      title: c.title,
      location: c.location || '',
      dateTime: c.dateTime || null,
      status: derivedStatus,
      role: isOrganizer ? 'organizer' : 'participant',
      durationHours: c.durationHours || 1,
      creditsPerHour: c.creditsPerHour || 50,
      pointsGained: rewarded ? (c.totalCredits || 0) : 0,
      attended,
      participationStatus,
    }
  })

  const totalPointsGained = activities.reduce((sum, a) => sum + Number(a.pointsGained || 0), 0)
  return { activities, totalPointsGained }
}

async function markInterested({ campaignId, userId }) {
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }

  const alreadyInterested = campaign.interestedUsers?.some((p) => p.toString() === userId.toString())
  if (!alreadyInterested) {
    if (!campaign.interestedUsers) campaign.interestedUsers = []
    campaign.interestedUsers.push(new mongoose.Types.ObjectId(userId))
    await campaign.save()
  }

  const populated = await Campaign.findById(campaignId)
    .populate('organizer', '_id name profilePic')
    .populate('participants', '_id name profilePic')
  return toPlain(populated)
}

async function getLeaderboard() {
  const topParticipants = await User.find({ credits: { $gt: 0 } })
    .sort({ credits: -1 })
    .limit(10)
    .select('name profilePic credits _id')
    .lean()
  return topParticipants
}

module.exports = {
  listCampaigns,
  createCampaign,
  getCampaignById,
  joinCampaign,
  generateAttendanceQR,
  verifyAttendance,
  getMyVolunteerHistory,
  markInterested,
  scanQR,
  getLeaderboard,
}
