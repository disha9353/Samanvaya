const mongoose = require('mongoose')

const PickupTransactionSchema = new mongoose.Schema(
  {
    wasteRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteRequest', required: true },
    collectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    weightKg: { type: Number, required: true, min: 0 },
    pricePerKg: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

module.exports = mongoose.model('PickupTransaction', PickupTransactionSchema)

