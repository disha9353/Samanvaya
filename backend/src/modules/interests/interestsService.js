const Item = require('../../models/Item')

async function listInterestedItems(userId) {
  return Item.find({ interestedUsers: userId })
    .sort({ createdAt: -1 })
    .populate('seller', 'name profilePic role')
}

module.exports = { listInterestedItems }

