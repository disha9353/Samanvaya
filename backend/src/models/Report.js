const mongoose = require('mongoose')

const ReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['user', 'item', 'campaign'], required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 2000 },
    status: { type: String, enum: ['open', 'reviewed', 'resolved', 'dismissed'], default: 'open', index: true },
    resolutionNote: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Report', ReportSchema)

