const chatService = require('./chatService')
const { userSockets } = require('../../socket/state')

async function send(req, res) {
  const { receiverId, itemId, content } = req.body
  const msg = await chatService.sendMessage({
    senderId: req.user._id,
    receiverId,
    itemId,
    content,
  })

  // If Socket.io is active, push the message immediately.
  try {
    const io = req.app?.locals?.io
    if (io) {
      const receiverSockets = userSockets.get(receiverId.toString())
      receiverSockets?.forEach((sid) => {
        io.to(sid).emit('chat:message', msg)
      })
      const senderSockets = userSockets.get(req.user._id.toString())
      senderSockets?.forEach((sid) => {
        io.to(sid).emit('chat:message', msg)
      })
    }
  } catch {
    // ignore socket emit errors; REST still persisted the message.
  }

  res.status(201).json({ message: msg })
}

async function list(req, res) {
  const { otherUserId } = req.params
  const { itemId } = req.query
  const messages = await chatService.listMessages({
    userId: req.user._id,
    otherUserId,
    itemId,
  })
  res.json({ messages })
}

async function conversations(req, res) {
  const result = await chatService.listConversations({ userId: req.user._id })
  res.json({ conversations: result })
}

module.exports = { send, list, conversations }

