const ecoService = require('./ecoService')

async function leaderboard(req, res) {
  const { limit } = req.query
  const users = await ecoService.leaderboard({ limit })
  res.json({ leaderboard: users })
}

module.exports = { leaderboard }

