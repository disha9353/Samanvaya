const notificationsService = require('./notificationsService')

async function list(req, res) {
  const { unread } = req.query
  const items = await notificationsService.listNotifications({
    userId: req.user._id,
    unreadOnly: unread === 'true' || unread === '1',
  })
  res.json({ notifications: items })
}

async function readAll(req, res) {
  const { type } = req.body || {}
  const result = await notificationsService.markReadMany({ userId: req.user._id, type })
  res.json({ ok: true, ...result })
}

async function read(req, res) {
  const { id } = req.params
  const notification = await notificationsService.markRead({ userId: req.user._id, notificationId: id })
  res.json({ notification })
}

module.exports = { list, read, readAll }

