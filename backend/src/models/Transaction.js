const mongoose = require('mongoose')

const TransactionSchema = new mongoose.Schema(
  {
    // ── Barter / QR transaction fields ──────────────────────────────────────
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    token: {
      type: String,
      default: null,
      index: true,      // fast look-ups by QR / verification token
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED'],
      default: 'PENDING',
    },

    // ── Legacy credit-transfer fields (retained for backward compatibility) ─
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
    credits: { type: Number, min: 0, default: 0 },
    type: {
      type: String,
      enum: [
        'wallet_purchase',
        'qr_payment',
        'barter_credits',
        'wallet_transfer',
        'collector_earning',
        'wallet_adjustment',
        'report_reward',
        'barter_transaction',   // used by the new barter flow
      ],
      default: 'barter_transaction',
    },
    meta: { type: Object, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

module.exports = mongoose.model('Transaction', TransactionSchema)
