const mongoose = require('mongoose')

const BarterRequestSchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    offeredItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    requestedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },

    // Extra credits paid from fromUser -> toUser when barter is accepted
    credits: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('BarterRequest', BarterRequestSchema)

