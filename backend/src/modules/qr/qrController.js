const qrService = require('./qrService')

async function generate(req, res) {
  const { buyerId, itemId } = req.body
  const sellerId = req.user._id.toString()
  const result = await qrService.generateQR({ sellerId, buyerId, itemId })
  res.json(result)
}

async function validateAndPay(req, res) {
  const buyerId = req.user._id.toString()
  const { qrToken } = req.body
  const result = await qrService.validateAndPay({ buyerId, qrToken })
  res.json(result)
}

module.exports = { generate, validateAndPay }

