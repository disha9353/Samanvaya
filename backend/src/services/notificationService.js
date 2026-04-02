const Notification = require('../models/Notification');
const { getIo } = require('../socket/index');
const { userSockets } = require('../socket/state');

/**
 * Reusable notification service.
 * @param {string|ObjectId} userId - The recipient user ID
 * @param {string} type - Notification type enum (e.g., INTEREST_SELECTED)
 * @param {string} message - Descriptive message for the user
 * @param {Object} [payload={}] - Additional context required for UI navigation
 */
async function createNotification(userId, type, message, payload = {}) {
  // Save notification in DB
  const notification = await Notification.create({
    userId,
    type,
    message,
    payload,
    isRead: false
  });

  // Emit real-time event via Socket.io
  try {
    const io = getIo();
    const receiverSockets = userSockets.get(userId.toString());
    
    if (receiverSockets && receiverSockets.size > 0) {
      receiverSockets.forEach(socketId => {
        io.to(socketId).emit('new_notification', notification);
      });
    }
  } catch (err) {
    console.error('Failed to emit notification via Socket.io', err);
  }

  return notification;
}

module.exports = {
  createNotification
};
