const User = require('../../models/User')

async function leaderboard({ limit = 20 }) {
  const l = Number(limit) || 20
  return User.find({})
    .select('name role ecoScore co2SavedKg wasteRecycledKg itemsReusedCount credits')
    .sort({ ecoScore: -1 })
    .limit(l)
    .lean()
}

module.exports = { leaderboard }

