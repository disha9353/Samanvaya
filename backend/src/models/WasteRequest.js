const mongoose = require('mongoose')

const WasteRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    wasteType: {
      type: String,
      enum: ['plastic', 'metal', 'ewaste', 'paper', 'glass', 'organic', 'others'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },

    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    address: { type: String, default: '' },

    date: { type: String, required: true }, // yyyy-mm-dd (demo)
    timeSlot: { type: String, required: true }, // e.g. "10:00-11:00"

    status: { type: String, enum: ['pending', 'accepted', 'picked_up', 'completed', 'cancelled', 'rejected'], default: 'pending' },
    collectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('WasteRequest', WasteRequestSchema)

