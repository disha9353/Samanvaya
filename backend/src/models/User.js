const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    credits: { type: Number, default: 100, min: 0 },
    role: { type: String, enum: ['user', 'collector', 'admin'], default: 'user' },
    profilePic: { type: String },
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String, default: '' },

    // Eco impact tracking
    ecoScore: { type: Number, default: 0 },
    co2SavedKg: { type: Number, default: 0 },
    wasteRecycledKg: { type: Number, default: 0 },
    itemsReusedCount: { type: Number, default: 0 },

    // MFA & Localization
    isMFAEnabled: { type: Boolean, default: false },
    otpHash: { type: String },
    otpExpiry: { type: Date },
    totpSecret: { type: String },
    preferredLanguage: { type: String, enum: ['en', 'hi', 'kn'], default: 'en' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('User', UserSchema)

