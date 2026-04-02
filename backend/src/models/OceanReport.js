const mongoose = require('mongoose');

const oceanReportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    select: false
  },
  mainMediaUrl: {
    type: String,
    required: true
  },
  additionalMediaUrls: {
    type: [String],
    default: []
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['plastic_dumping', 'oil_spill', 'dead_marine_life', 'illegal_fishing'],
    required: true
  },
  description: {
    type: String
  },
  voteCount: {
    type: Number,
    default: 0
  },
  voters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['PENDING', 'VALIDATED', 'REJECTED'],
    default: 'PENDING'
  },
  isSuspicious: {
    type: Boolean,
    default: false
  },
  aiValidationDetails: {
    type: String
  },
  imageHash: {
    type: String,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('OceanReport', oceanReportSchema);
