const jwt = require('jsonwebtoken')

const env = require('../../config/env')
const Item = require('../../models/Item')
const User = require('../../models/User')
const walletService = require('../wallet/walletService')
const Transaction = require('../../models/Transaction')
const Notification = require('../../models/Notification')

function signQR(payload) {
  return jwt.sign(payload, env.JWT_QR_SECRET, { expiresIn: env.JWT_QR_EXPIRES_IN })
}

async function generateQR({ sellerId, buyerId, itemId }) {
  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  if (item.seller.toString() !== sellerId.toString()) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
  if (item.status !== 'Available') {
    const err = new Error('Item is not available')
    err.statusCode = 400
    throw err
  }

  const credits = item.price
  const token = signQR({
    sellerId: sellerId.toString(),
    buyerId: buyerId.toString(),
    itemId: itemId.toString(),
    credits,
  })

  return { qrToken: token, sellerId: sellerId.toString(), buyerId, itemId, credits }
}

async function validateAndPay({ buyerId, qrToken }) {
  if (!env.JWT_QR_SECRET) {
    const err = new Error('QR secret not configured')
    err.statusCode = 500
    throw err
  }

  const payload = jwt.verify(qrToken, env.JWT_QR_SECRET)
  const { sellerId, buyerId: expectedBuyerId, itemId, credits } = payload

  if (expectedBuyerId.toString() !== buyerId.toString()) {
    const err = new Error('QR buyer mismatch')
    err.statusCode = 403
    throw err
  }

  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  if (item.status !== 'Available') {
    const err = new Error('Item already processed')
    err.statusCode = 400
    throw err
  }
  if (item.seller.toString() !== sellerId.toString()) {
    const err = new Error('QR seller mismatch')
    err.statusCode = 403
    throw err
  }

  // Transfer credits buyer -> seller
  await walletService.transferCredits({
    fromUserId: buyerId,
    toUserId: sellerId,
    credits,
    type: 'qr_payment',
    meta: { itemId: item._id.toString(), buyerId: buyerId.toString() },
  })

  item.status = 'Sold'
  item.buyer = buyerId
  item.soldAt = new Date()
  await item.save()

  await Notification.create({
    userId: sellerId,
    type: 'payment_completed',
    payload: { itemId: item._id.toString(), buyerId: buyerId.toString(), credits },
  })

  return { ok: true }
}

module.exports = { generateQR, validateAndPay }

