const mongoose = require('mongoose')

const ItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'general', trim: true },
    images: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 }, // price in credits

    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Available', 'Sold', 'Exchanged'], default: 'Available' },

    interestedUsers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    savedUsers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },

    likedUsers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    flagged: { type: Boolean, default: false },

    // Minimal tracking for demo
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    soldAt: { type: Date },

    // Location using GeoJSON format
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    },
  },
  { timestamps: true }
)

ItemSchema.index({ location: '2dsphere' })

module.exports = mongoose.model('Item', ItemSchema)

