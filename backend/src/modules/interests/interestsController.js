const interestsService = require('./interestsService')

async function myInterested(req, res) {
  const items = await interestsService.listInterestedItems(req.user._id)
  res.json({ items })
}

module.exports = { myInterested }

