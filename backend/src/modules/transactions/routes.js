const express = require('express')
const { authenticate } = require('../../middlewares/auth')
const { generateTransaction, sendQR, verifyTransaction, completeTransaction } = require('./transactionController')

const router = express.Router()

// POST /api/transactions/generate
// Seller calls this to create a PENDING transaction + signed QR token
router.post('/generate', authenticate, generateTransaction)

// POST /api/transactions/send-qr
// Seller calls this to email the QR + token to the buyer and emit notification
router.post('/send-qr', authenticate, sendQR)

// POST /api/transactions/verify
// Buyer calls this with the scanned token to complete the sequence
router.post('/verify', authenticate, verifyTransaction)

// POST /api/transactions/complete
// Finalizes transaction, transfers credits, updates states, emits notifications
router.post('/complete', authenticate, completeTransaction)

module.exports = router
