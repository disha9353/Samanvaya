const User = require('../../models/User')
const Item = require('../../models/Item')
const Campaign = require('../../models/Campaign')
const WasteRequest = require('../../models/WasteRequest')
const Transaction = require('../../models/Transaction')
const Report = require('../../models/Report')
const AdminActionLog = require('../../models/AdminActionLog')
const PlatformSetting = require('../../models/PlatformSetting')

async function logAction({ adminId, action, targetType = '', targetId = '', details = {} }) {
  await AdminActionLog.create({
    adminId,
    action,
    targetType,
    targetId: targetId ? String(targetId) : '',
    details,
  })
}

function toPage(page, limit) {
  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))
  return { p, l, skip: (p - 1) * l }
}

async function getStats() {
  const [
    totalUsers,
    activeUsers,
    totalItems,
    soldOrExchangedItems,
    activeCampaigns,
    completedCampaigns,
    totalWasteAgg,
    totalTransactions,
    totalCreditsAgg,
    recentLogs,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isBlocked: false }),
    Item.countDocuments({}),
    Item.countDocuments({ status: { $in: ['Sold', 'Exchanged'] } }),
    Campaign.countDocuments({ status: { $in: ['OPEN', 'FULL'] } }),
    Campaign.countDocuments({ status: 'COMPLETED' }),
    WasteRequest.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),
    Transaction.countDocuments({}),
    User.aggregate([{ $group: { _id: null, total: { $sum: '$credits' } } }]),
    AdminActionLog.find({}).sort({ createdAt: -1 }).limit(20).populate('adminId', '_id name email').lean(),
  ])

  const transactionsPerDay = await Transaction.aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ])
  const userGrowth = await User.aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ])
  const wasteTrends = await WasteRequest.aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, kg: { $sum: '$quantity' } } },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ])

  return {
    metrics: {
      totalUsers,
      activeUsers,
      totalItems,
      soldOrExchangedItems,
      activeCampaigns,
      completedCampaigns,
      totalWasteCollectedKg: Number(totalWasteAgg?.[0]?.total || 0),
      totalTransactions,
      totalCreditsInSystem: Number(totalCreditsAgg?.[0]?.total || 0),
    },
    charts: {
      transactionsPerDay,
      userGrowth,
      wasteTrends,
    },
    recentActivities: recentLogs,
  }
}

async function listUsers({ q, role, page, limit }) {
  const { p, l, skip } = toPage(page, limit)
  const filter = {}
  if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }]
  if (role && ['user', 'collector', 'admin'].includes(role)) filter.role = role

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l).select('-password').lean(),
    User.countDocuments(filter),
  ])

  const userIds = users.map((u) => u._id)
  const [items, campaigns] = await Promise.all([
    Item.aggregate([{ $match: { seller: { $in: userIds } } }, { $group: { _id: '$seller', count: { $sum: 1 } } }]),
    Campaign.aggregate([
      { $match: { participants: { $in: userIds } } },
      { $unwind: '$participants' },
      { $match: { participants: { $in: userIds } } },
      { $group: { _id: '$participants', count: { $sum: 1 } } },
    ]),
  ])
  const itemMap = new Map(items.map((x) => [String(x._id), x.count]))
  const campaignMap = new Map(campaigns.map((x) => [String(x._id), x.count]))

  return {
    users: users.map((u) => ({
      ...u,
      itemsPosted: itemMap.get(String(u._id)) || 0,
      campaignsJoined: campaignMap.get(String(u._id)) || 0,
    })),
    pagination: { page: p, limit: l, total },
  }
}

async function updateUser({ adminId, userId, payload }) {
  const user = await User.findById(userId)
  if (!user) {
    const err = new Error('User not found')
    err.statusCode = 404
    throw err
  }
  const allowedRoles = ['user', 'collector', 'admin']
  if (payload.role && allowedRoles.includes(payload.role)) user.role = payload.role
  if (typeof payload.isBlocked === 'boolean') user.isBlocked = payload.isBlocked
  if (payload.blockedReason !== undefined) user.blockedReason = String(payload.blockedReason || '')
  if (payload.resetCredits === true) user.credits = Number(payload.credits ?? 100)
  await user.save()

  await logAction({ adminId, action: 'update_user', targetType: 'user', targetId: userId, details: payload })
  return user.toObject()
}

async function listItems({ status, category, q, page, limit }) {
  const { p, l, skip } = toPage(page, limit)
  const filter = {}
  if (status && ['Available', 'Sold', 'Exchanged'].includes(status)) filter.status = status
  if (category) filter.category = category
  if (q) filter.title = { $regex: q, $options: 'i' }

  const [items, total] = await Promise.all([
    Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l).populate('seller', '_id name email').lean(),
    Item.countDocuments(filter),
  ])
  return { items, pagination: { page: p, limit: l, total } }
}

async function updateItem({ adminId, itemId, payload }) {
  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  if (typeof payload.flagged === 'boolean') item.flagged = payload.flagged
  if (payload.status && ['Available', 'Sold', 'Exchanged'].includes(payload.status)) item.status = payload.status
  await item.save()
  await logAction({ adminId, action: 'update_item', targetType: 'item', targetId: itemId, details: payload })
  return item
}

async function deleteItem({ adminId, itemId }) {
  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  await item.deleteOne()
  await logAction({ adminId, action: 'delete_item', targetType: 'item', targetId: itemId })
  return { deleted: true }
}

async function listCampaigns({ status, q, page, limit }) {
  const { p, l, skip } = toPage(page, limit)
  const filter = {}
  if (status && ['OPEN', 'FULL', 'COMPLETED'].includes(status)) filter.status = status
  if (q) filter.$or = [{ title: { $regex: q, $options: 'i' } }, { location: { $regex: q, $options: 'i' } }]
  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .populate('organizer', '_id name email')
      .populate('participants', '_id name email')
      .lean(),
    Campaign.countDocuments(filter),
  ])
  return { campaigns, pagination: { page: p, limit: l, total } }
}

async function updateCampaign({ adminId, campaignId, payload }) {
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }
  if (typeof payload.featured === 'boolean') campaign.featured = payload.featured
  if (payload.forceClose === true) campaign.status = 'COMPLETED'
  if (payload.status && ['OPEN', 'FULL', 'COMPLETED'].includes(payload.status)) campaign.status = payload.status
  await campaign.save()
  await logAction({ adminId, action: 'update_campaign', targetType: 'campaign', targetId: campaignId, details: payload })
  return campaign
}

async function deleteCampaign({ adminId, campaignId }) {
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.statusCode = 404
    throw err
  }
  await campaign.deleteOne()
  await logAction({ adminId, action: 'delete_campaign', targetType: 'campaign', targetId: campaignId })
  return { deleted: true }
}

async function listWasteRequests({ status, page, limit }) {
  const { p, l, skip } = toPage(page, limit)
  const filter = {}
  if (status && ['pending', 'accepted', 'picked_up', 'completed', 'cancelled'].includes(status)) filter.status = status
  const [requests, total] = await Promise.all([
    WasteRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .populate('userId', '_id name email')
      .populate('collectorId', '_id name email')
      .lean(),
    WasteRequest.countDocuments(filter),
  ])

  const now = new Date()
  return {
    requests: requests.map((r) => {
      const schedule = r.date ? new Date(`${r.date}T00:00:00`) : null
      const delayed = Boolean(schedule && schedule < now && !['completed', 'cancelled'].includes(r.status))
      return { ...r, delayed }
    }),
    pagination: { page: p, limit: l, total },
  }
}

async function listTransactions({ type, userId, from, to, page, limit }) {
  const { p, l, skip } = toPage(page, limit)
  const filter = {}
  if (type) filter.type = type
  if (userId) filter.$or = [{ buyer: userId }, { seller: userId }]
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .populate('buyer', '_id name email')
      .populate('seller', '_id name email')
      .lean(),
    Transaction.countDocuments(filter),
  ])
  const suspicious = transactions.filter((t) => Number(t.credits) > 10000)
  return { transactions, suspiciousCount: suspicious.length, pagination: { page: p, limit: l, total } }
}

async function listReports({ status, targetType, page, limit }) {
  const { p, l, skip } = toPage(page, limit)
  const filter = {}
  if (status) filter.status = status
  if (targetType) filter.targetType = targetType
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .populate('reporter', '_id name email')
      .populate('reviewedBy', '_id name email')
      .lean(),
    Report.countDocuments(filter),
  ])
  return { reports, pagination: { page: p, limit: l, total } }
}

async function updateReport({ adminId, reportId, payload }) {
  const report = await Report.findById(reportId)
  if (!report) {
    const err = new Error('Report not found')
    err.statusCode = 404
    throw err
  }
  if (payload.status && ['open', 'reviewed', 'resolved', 'dismissed'].includes(payload.status)) report.status = payload.status
  if (payload.resolutionNote !== undefined) report.resolutionNote = String(payload.resolutionNote || '')
  report.reviewedBy = adminId
  await report.save()
  await logAction({ adminId, action: 'update_report', targetType: 'report', targetId: reportId, details: payload })
  return report
}

async function getSettings() {
  const docs = await PlatformSetting.find({ key: { $in: ['default_signup_credits', 'campaign_reward_credits', 'penalty_credits', 'platform_rules'] } }).lean()
  const map = Object.fromEntries(docs.map((d) => [d.key, d.value]))
  return {
    default_signup_credits: Number(map.default_signup_credits ?? 100),
    campaign_reward_credits: Number(map.campaign_reward_credits ?? 10),
    penalty_credits: Number(map.penalty_credits ?? 5),
    platform_rules: String(map.platform_rules ?? 'Be respectful. No inappropriate listings or abuse.'),
  }
}

async function updateSettings({ adminId, payload }) {
  const allowed = ['default_signup_credits', 'campaign_reward_credits', 'penalty_credits', 'platform_rules']
  for (const key of allowed) {
    if (payload[key] === undefined) continue
    await PlatformSetting.findOneAndUpdate({ key }, { key, value: payload[key] }, { upsert: true, new: true })
  }
  await logAction({ adminId, action: 'update_settings', targetType: 'settings', details: payload })
  return getSettings()
}

module.exports = {
  getStats,
  listUsers,
  updateUser,
  listItems,
  updateItem,
  deleteItem,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  listWasteRequests,
  listTransactions,
  listReports,
  updateReport,
  getSettings,
  updateSettings,
}

