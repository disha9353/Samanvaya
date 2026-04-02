const Message = require('../../models/Message')
const Notification = require('../../models/Notification')
const mongoose = require('mongoose')
const User = require('../../models/User')

async function sendMessage({ senderId, receiverId, itemId, content }) {
  const msg = await Message.create({ sender: senderId, receiver: receiverId, itemId, content })

  await Notification.create({
    userId: receiverId,
    type: 'message_received',
    payload: { itemId, fromUserId: senderId },
  })

  return msg
}

async function listMessages({ userId, otherUserId, itemId }) {
  const filter = {
    $or: [
      { sender: userId, receiver: otherUserId },
      { sender: otherUserId, receiver: userId },
    ],
  }
  if (itemId) filter.itemId = itemId

  return Message.find(filter).sort({ createdAt: 1 })
}

async function listConversations({ userId }) {
  const uid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId

  const rows = await Message.aggregate([
    { $match: { $or: [{ sender: uid }, { receiver: uid }] } },
    {
      $addFields: {
        otherUserId: {
          $cond: [{ $eq: ['$sender', uid] }, '$receiver', '$sender'],
        },
      },
    },
    // Keep per-(other user, item) thread to avoid mixing item chats.
    {
      $group: {
        _id: { otherUserId: '$otherUserId', itemId: '$itemId' },
        lastMessageAt: { $max: '$createdAt' },
        lastMessage: { $last: '$$ROOT' },
      },
    },
    { $sort: { lastMessageAt: -1 } },
    { $limit: 50 },
  ])

  const ids = Array.from(new Set(rows.map((r) => String(r._id.otherUserId))))
  const users = await User.find({ _id: { $in: ids } }).select('_id name profilePic role').lean()
  const byId = new Map(users.map((u) => [String(u._id), u]))

  return rows.map((r) => ({
    otherUser: byId.get(String(r._id.otherUserId)) || { _id: String(r._id.otherUserId) },
    itemId: r._id.itemId ? String(r._id.itemId) : null,
    lastMessageAt: r.lastMessageAt,
    lastMessage: {
      _id: String(r.lastMessage?._id),
      sender: String(r.lastMessage?.sender),
      receiver: String(r.lastMessage?.receiver),
      content: r.lastMessage?.content,
      itemId: r.lastMessage?.itemId ? String(r.lastMessage.itemId) : null,
      createdAt: r.lastMessage?.createdAt,
    },
  }))
}

module.exports = { sendMessage, listMessages, listConversations }

