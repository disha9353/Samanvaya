const mongoose = require('mongoose')

const User = require('../../models/User')
const Transaction = require('../../models/Transaction')
const { withOptionalTransaction } = require('../../utils/withOptionalTransaction')

async function getMySummary(userId) {
  const user = await User.findById(userId).select('credits ecoScore co2SavedKg wasteRecycledKg itemsReusedCount')
  return user
}

async function listTransactions(userId, { type, limit = 50 }) {
  const q = {
    $or: [{ buyer: userId }, { seller: userId }],
  }
  if (type) q.type = type
  return Transaction.find(q).sort({ createdAt: -1 }).limit(Number(limit)).lean()
}

async function transferCredits({ fromUserId, toUserId, credits, type, meta = {} }) {
  const c = Number(credits)
  if (!Number.isFinite(c) || c <= 0) {
    const err = new Error('Credits must be > 0')
    err.statusCode = 400
    throw err
  }

  let created
  await withOptionalTransaction(async (session) => {
    const fromQ = User.findById(fromUserId).select('credits')
    const toQ = User.findById(toUserId).select('credits')
    if (session) {
      fromQ.session(session)
      toQ.session(session)
    }

    const [from, to] = await Promise.all([fromQ, toQ])
    if (!from || !to) {
      const err = new Error('User not found')
      err.statusCode = 404
      throw err
    }
    if (from.credits < c) {
      const err = new Error('Insufficient credits')
      err.statusCode = 400
      throw err
    }

    from.credits -= c
    to.credits += c
    await Promise.all([from.save(session ? { session } : undefined), to.save(session ? { session } : undefined)])

    if (session) {
      created = await Transaction.create(
        [
          {
            buyer: fromUserId,
            seller: toUserId,
            credits: c,
            type,
            meta,
          },
        ],
        { session }
      )
    } else {
      created = await Transaction.create({
        buyer: fromUserId,
        seller: toUserId,
        credits: c,
        type,
        meta,
      })
    }
  })

  return created?.[0] || created
}

module.exports = { getMySummary, listTransactions, transferCredits }

