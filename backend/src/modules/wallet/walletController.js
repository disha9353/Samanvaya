const walletService = require('./walletService')

async function summary(req, res) {
  const summary = await walletService.getMySummary(req.user._id)
  res.json({ summary })
}

async function transactions(req, res) {
  const { type, limit } = req.query
  const tx = await walletService.listTransactions(req.user._id, { type, limit })
  res.json({ transactions: tx })
}

async function transfer(req, res) {
  const { toUserId, credits, meta } = req.body
  const tx = await walletService.transferCredits({
    fromUserId: req.user._id,
    toUserId,
    credits,
    type: 'wallet_transfer',
    meta: meta || {},
  })
  res.status(201).json({ transaction: tx })
}

module.exports = { summary, transactions, transfer }

