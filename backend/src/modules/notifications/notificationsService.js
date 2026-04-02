const Notification = require('../../models/Notification')

async function listNotifications({ userId, unreadOnly }) {
  const filter = { userId }
  if (unreadOnly) filter.isRead = false
  return Notification.find(filter).sort({ createdAt: -1 }).limit(100)
}

async function markReadMany({ userId, type }) {
  const filter = { userId, isRead: false }
  if (type) filter.type = type
  const res = await Notification.updateMany(filter, { $set: { isRead: true } })
  return { modifiedCount: res.modifiedCount || 0 }
}

async function markRead({ userId, notificationId }) {
  const n = await Notification.findById(notificationId)
  if (!n) {
    const err = new Error('Notification not found')
    err.statusCode = 404
    throw err
  }
  if (n.userId.toString() !== userId.toString()) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
  n.isRead = true
  await n.save()
  return n
}

module.exports = { listNotifications, markRead, markReadMany }

