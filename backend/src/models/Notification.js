const mongoose = require('mongoose')

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'interest_received',
        'message_received',
        'barter_request',
        'pickup_accepted',
        'collector_arriving',
        'payment_completed',
        'INTEREST_SELECTED',
        'QR_SENT',
        'TRANSACTION_UPDATE'
      ],
      required: true,
    },

    message: { type: String },
    payload: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
)

NotificationSchema.index({ userId: 1, createdAt: -1 })
NotificationSchema.index({ userId: 1, isRead: 1 })

module.exports = mongoose.model('Notification', NotificationSchema)

