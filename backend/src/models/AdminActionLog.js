const mongoose = require('mongoose')

const AdminActionLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, default: '', trim: true },
    targetId: { type: String, default: '', trim: true },
    details: { type: Object, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

module.exports = mongoose.model('AdminActionLog', AdminActionLogSchema)

