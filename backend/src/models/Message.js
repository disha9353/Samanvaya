const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    content: { type: String, required: true, trim: true },
  },
  { timestamps: true }
)

MessageSchema.index({ sender: 1, receiver: 1, itemId: 1, createdAt: -1 })

module.exports = mongoose.model('Message', MessageSchema)

