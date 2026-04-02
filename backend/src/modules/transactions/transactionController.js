const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const QRCode = require('qrcode')

const env = require('../../config/env')
const Item = require('../../models/Item')
const Transaction = require('../../models/Transaction')
const User = require('../../models/User')
const { sendQREmail } = require('../../../services/emailService')
const { createNotification } = require('../../services/notificationService')

// ─────────────────────────────────────────────────────────────────────────────
// Helper – sign a short-lived QR token (JWT)
// Falls back to a random UUID v4-style hex if JWT_QR_SECRET is absent.
// ─────────────────────────────────────────────────────────────────────────────
function buildToken(payload) {
  if (env.JWT_QR_SECRET) {
    return jwt.sign(payload, env.JWT_QR_SECRET, {
      expiresIn: env.JWT_QR_EXPIRES_IN || '10m',
    })
  }
  // Fallback: opaque random token (stored in the Transaction doc)
  return crypto.randomBytes(32).toString('hex')
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/generate
//
// Body: { itemId, buyerId }
// Auth: seller must be logged in (req.user set by authenticate middleware)
//
// Returns: { token, itemId, transactionId }
// ─────────────────────────────────────────────────────────────────────────────
async function generateTransaction(req, res) {
  try {
    const sellerId = req.user._id
    const { itemId, buyerId } = req.body

    // ── Validation ────────────────────────────────────────────────────────────
    if (!itemId) {
      return res.status(400).json({ message: 'itemId is required' })
    }
    if (!buyerId) {
      return res.status(400).json({ message: 'buyerId is required' })
    }

    // ── Fetch & authorise item ────────────────────────────────────────────────
    const item = await Item.findById(itemId)
    if (!item) {
      return res.status(404).json({ message: 'Item not found' })
    }
    if (item.seller.toString() !== sellerId.toString()) {
      return res.status(403).json({ message: 'Only the seller can generate a transaction token' })
    }
    if (item.status !== 'Available') {
      return res.status(400).json({ message: `Item is not available (status: ${item.status})` })
    }

    // ── Prevent duplicate PENDING transactions for same item+buyer ────────────
    const existing = await Transaction.findOne({
      itemId,
      buyerId,
      status: 'PENDING',
    })
    if (existing) {
      const qrData = JSON.stringify({ token: existing.token, itemId: existing.itemId })
      const qrCode = await QRCode.toDataURL(qrData)

      return res.status(200).json({
        message: 'Existing pending transaction returned',
        token: existing.token,
        itemId: existing.itemId,
        transactionId: existing._id,
        qrCode,
      })
    }

    // ── Build signed token ────────────────────────────────────────────────────
    const tokenPayload = {
      sellerId: sellerId.toString(),
      buyerId: buyerId.toString(),
      itemId: itemId.toString(),
      credits: item.price,
    }
    const token = buildToken(tokenPayload)

    // ── Persist PENDING transaction ───────────────────────────────────────────
    const transaction = await Transaction.create({
      itemId,
      sellerId,
      buyerId,
      token,
      status: 'PENDING',
      // legacy fields kept for wallet/history compatibility
      item: itemId,
      seller: sellerId,
      buyer: buyerId,
      credits: item.price,
      type: 'barter_transaction',
      meta: { generatedAt: new Date().toISOString() },
    })

    const qrData = JSON.stringify({ token, itemId })
    const qrCode = await QRCode.toDataURL(qrData)

    return res.status(201).json({
      message: 'Transaction token generated successfully',
      token,
      itemId: transaction.itemId,
      transactionId: transaction._id,
      qrCode,
    })
  } catch (err) {
    console.error('[transactionController] generateTransaction error:', err)
    return res.status(err.statusCode || 500).json({
      message: err.message || 'Internal server error',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/send-qr
// Send QR email to the selected buyer and notify them
// Body: { transactionId }
// ─────────────────────────────────────────────────────────────────────────────
async function sendQR(req, res) {
  try {
    const sellerId = req.user._id
    const { transactionId } = req.body

    if (!transactionId) {
      return res.status(400).json({ message: 'transactionId is required' })
    }

    const transaction = await Transaction.findById(transactionId)
      .populate('buyerId')
      .populate('itemId')

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' })
    }

    if (transaction.sellerId.toString() !== sellerId.toString()) {
      return res.status(403).json({ message: 'Only the seller can send the QR code' })
    }

    const buyer = transaction.buyerId
    const item = transaction.itemId

    if (!buyer || !buyer.email) {
      return res.status(400).json({ message: 'Buyer email not found' })
    }

    // Generate QR to attach to email
    const qrData = JSON.stringify({ token: transaction.token, itemId: item._id })
    const qrCode = await QRCode.toDataURL(qrData)

    // Send the beautiful QR email
    const emailSuccess = await sendQREmail(buyer.email, item.title, transaction.token, qrCode)

    // Halt if email failure, preventing false positive notification
    if (!emailSuccess) {
      return res.status(502).json({ message: 'Failed to deliver the QR email to the selected buyer. Please check server email configs.' })
    }

    // Trigger realtime notification strictly ONLY after successful email delivery
    await createNotification(
      buyer._id,
      'QR_SENT',
      'QR sent for your selected item',
      { transactionId: transaction._id, itemId: item._id }
    )

    return res.status(200).json({ message: 'QR sent successfully to the buyer' })
  } catch (err) {
    console.error('[transactionController] sendQR error:', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/verify
// Validates the token and completes the transaction
// Body: { token, itemId }
// ─────────────────────────────────────────────────────────────────────────────
async function verifyTransaction(req, res) {
  try {
    const userId = req.user._id // The user scanning/submitting the token
    const { token, itemId } = req.body

    if (!token || !itemId) {
      return res.status(400).json({ message: 'Token and itemId are required' })
    }

    // ── 1. Find the pending transaction ───────────────────────────────────────
    const transaction = await Transaction.findOne({ token, itemId, status: 'PENDING' })
    if (!transaction) {
      return res.status(404).json({ message: 'Invalid or expired transaction token' })
    }

    // ── 2. Ensure only correct buyer can use token ────────────────────────────
    if (transaction.buyerId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized: Only the designated buyer can use this token' })
    }

    // ── 3. Validate Expiration (10-15 mins) ───────────────────────────────────
    if (env.JWT_QR_SECRET) {
      try {
        jwt.verify(token, env.JWT_QR_SECRET) // Automatically throws if expired
      } catch (err) {
        return res.status(401).json({ message: 'Token has expired or is invalid' })
      }
    } else {
      // Fallback opaque token check: max 15 minutes old
      const ageMs = Date.now() - new Date(transaction.createdAt).getTime()
      if (ageMs > 15 * 60 * 1000) {
        return res.status(401).json({ message: 'Token has expired' })
      }
    }

    // ── 4. Complete Transaction ───────────────────────────────────────────────
    transaction.status = 'COMPLETED'
    await transaction.save()

    const item = await Item.findById(itemId)
    if (item) {
      item.status = 'Exchanged'
      item.soldAt = new Date()
      await item.save()
    }

    // Optional: Could trigger socket event 'transaction_update' dynamically here
    // notify parties
    await createNotification(
      transaction.sellerId,
      'TRANSACTION_UPDATE',
      `Your item "${item ? item.title : 'item'}" was successfully picked up and verified!`,
      { transactionId: transaction._id }
    )

    return res.status(200).json({
      message: 'Transaction successfully verified and completed',
      transaction,
    })
  } catch (err) {
    console.error('[transactionController] verifyTransaction error:', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/complete
// 
// Body: { token, buyerId }
// ─────────────────────────────────────────────────────────────────────────────
async function completeTransaction(req, res) {
  try {
    const { token, buyerId } = req.body
    
    if (!token || !buyerId) {
      return res.status(400).json({ message: 'token and buyerId are required' })
    }

    const transaction = await Transaction.findOne({ token })
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or token invalid' })
    }

    if (transaction.status === 'COMPLETED') {
      return res.status(400).json({ message: 'Transaction is already completed' })
    }

    if (transaction.buyerId.toString() !== buyerId.toString()) {
      return res.status(403).json({ message: 'Provided buyerId does not match the token' })
    }

    // Process Credit Transfer
    const buyer = await User.findById(transaction.buyerId)
    const seller = await User.findById(transaction.sellerId)

    if (!buyer || !seller) {
      return res.status(404).json({ message: 'User not found in system' })
    }

    if (buyer.credits < transaction.credits) {
      return res.status(400).json({ message: 'Buyer has insufficient credits for this transaction' })
    }

    buyer.credits -= transaction.credits
    seller.credits += transaction.credits
    
    // Eco Impact updates
    buyer.itemsReusedCount += 1
    seller.co2SavedKg += 5 // Fixed 5kg per item for scale
    
    await buyer.save()
    await seller.save()

    transaction.status = 'COMPLETED'
    await transaction.save()

    // Update Item
    const item = await Item.findById(transaction.itemId)
    if (item) {
      item.status = 'Sold'
      item.soldAt = new Date()
      await item.save()
    }

    // Notify both users
    await createNotification(
      buyer._id,
      'TRANSACTION_UPDATE',
      `Transaction completed successfully. You spent ${transaction.credits} credits!`,
      { transactionId: transaction._id, itemId: item?._id }
    )
    
    await createNotification(
      seller._id,
      'TRANSACTION_UPDATE',
      `Your item was sold successfully. You received ${transaction.credits} credits!`,
      { transactionId: transaction._id, itemId: item?._id }
    )

    return res.status(200).json({
      message: 'Transaction successfully completed and credits transferred',
      transaction
    })
  } catch (err) {
    console.error('[transactionController] completeTransaction error:', err)
    return res.status(500).json({ message: 'Internal server error while completing transaction' })
  }
}

module.exports = { generateTransaction, sendQR, verifyTransaction, completeTransaction }
