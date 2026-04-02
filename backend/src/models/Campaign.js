const mongoose = require('mongoose')

const campaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 4000 },
    category: { type: String, default: '', trim: true, maxlength: 60 },
    location: { type: String, default: '', trim: true, maxlength: 140 },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    dateTime: { type: Date },
    maxParticipants: { type: Number, default: 100, min: 1 },
    imageUrl: { type: String, default: '' },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    interestedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rewardedParticipants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['OPEN', 'FULL', 'COMPLETED'], default: 'OPEN', index: true },
    featured: { type: Boolean, default: false },

    // ── Hour-based credit system ─────────────────────────────────────────────
    durationHours: { type: Number, default: 1 },
    creditsPerHour: { type: Number, default: 50 },
    totalCredits: { type: Number, default: 0 },

    // ── QR Attendance ────────────────────────────────────────────────────────
    qrToken: { type: String },
    qrExpiry: { type: Date },
    
    attendanceQrToken: { type: String, default: null },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

campaignSchema.pre('save', function () {
  if (this.durationHours != null && this.creditsPerHour != null) {
    this.totalCredits = this.durationHours * this.creditsPerHour;
  }
})


module.exports = mongoose.model('Campaign', campaignSchema)
