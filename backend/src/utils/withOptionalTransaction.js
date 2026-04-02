const mongoose = require('mongoose')

function isTxnUnsupportedError(err) {
  const msg = String(err?.message || '')
  return (
    msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    msg.includes('Transactions are not supported') ||
    msg.includes('Transaction is not supported') ||
    msg.includes('replica set member or mongos')
  )
}

async function detectTxnSupport() {
  const conn = mongoose.connection
  const db = conn?.db
  if (!db) return false

  try {
    // hello: modern replacement for isMaster. Works on 4.2+.
    const hello = await db.admin().command({ hello: 1 })
    // Mongos reports msg: 'isdbgrid'
    if (hello?.msg === 'isdbgrid') return true
    // Replica set members expose setName
    if (hello?.setName) return true
    return false
  } catch {
    // If we can't determine, be conservative and assume no transactions.
    return false
  }
}

/**
 * Runs `fn` with a mongoose session when transactions are supported.
 * Falls back to calling `fn(null)` (no session) on standalone MongoDB.
 *
 * @param {(session: import('mongoose').ClientSession|null) => Promise<any>} fn
 */
async function withOptionalTransaction(fn) {
  const supports = await detectTxnSupport()
  if (!supports) {
    return fn(null)
  }

  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result
  } catch (err) {
    // Safety fallback in case server topology changed or detection was wrong.
    if (isTxnUnsupportedError(err)) {
      return fn(null)
    }
    throw err
  } finally {
    session.endSession()
  }
}

module.exports = { withOptionalTransaction }

