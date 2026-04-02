const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

const env = require('../config/env')
const chatService = require('../modules/chat/chatService')
const User = require('../models/User')

const {
  addUserSocket,
  removeUserSocket,
  setCollectorLocation,
  userSockets,
} = require('./state')

function normalizeLanguage(language) {
  const supported = ['en', 'hi', 'kn']
  if (!language) return null
  const base = String(language).split(',')[0].split('-')[0].toLowerCase()
  return supported.includes(base) ? base : null
}

async function resolveSocketLanguage(socket, userId) {
  const fromHeader = normalizeLanguage(socket.handshake.headers?.['x-language'])
  const fromAccept = normalizeLanguage(socket.handshake.headers?.['accept-language'])
  const fromQuery = normalizeLanguage(socket.handshake.query?.language)
  const fromAuth = normalizeLanguage(socket.handshake.auth?.language)

  const fromHandshake = fromHeader || fromQuery || fromAuth || fromAccept
  if (fromHandshake) return fromHandshake

  const user = await User.findById(userId).select('preferredLanguage').lean()
  return normalizeLanguage(user?.preferredLanguage) || 'en'
}

let globalIo = null

function initSocket(httpServer, app) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.SOCKET_CORS_ORIGIN,
      credentials: true,
    },
  })
  globalIo = io

  io.on('connection', async (socket) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization?.split('Bearer ')[1]
      if (!token) {
        socket.disconnect(true)
        return
      }
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET)
      const userId = payload.sub
      socket.data.userId = userId
      socket.data.language = await resolveSocketLanguage(socket, userId)
      addUserSocket(userId, socket.id)

      socket.on('collector:location', (coords) => {
        if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return
        setCollectorLocation(userId, { lat: coords.lat, lng: coords.lng })
        io.emit('collector:location:update', { collectorId: userId, ...coords })
      })

      socket.on('chat:send', async ({ receiverId, itemId, content }) => {
        const msg = await chatService.sendMessage({
          senderId: userId,
          receiverId,
          itemId,
          content,
        })

        const receiverSockets = userSockets.get(String(receiverId))
        if (receiverSockets) {
          receiverSockets.forEach((sid) => {
            io.to(sid).emit('chat:message', msg)
          })
        }

        socket.emit('chat:message', msg)
        // Notification is persisted in chatService; UI fetches or waits for socket.
      })
    } catch (e) {
      socket.disconnect(true)
    }

    socket.on('disconnect', () => {
      const userId = socket.data.userId
      if (userId) removeUserSocket(userId, socket.id)
    })
  })

  // Expose to request handlers (REST chat) for immediate emits.
  if (app?.locals) app.locals.io = io
  return io
}

function getIo() {
  if (!globalIo) throw new Error('Socket.io not initialized')
  return globalIo
}

module.exports = { initSocket, getIo }

