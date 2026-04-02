const historyService = require('./historyService')

async function market(req, res) {
  const { limit } = req.query
  const data = await historyService.getMyMarketHistory(req.user._id, { limit })
  res.json(data)
}

module.exports = { market }

