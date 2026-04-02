const express = require('express')
const { body, query, param } = require('express-validator')
const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./walletController')

const router = express.Router()

router.get('/summary', authenticate, asyncHandler(controller.summary))

router.get(
  '/transactions',
  authenticate,
  [
    query('type').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(controller.transactions)
)

router.post(
  '/transfer',
  authenticate,
  [
    body('toUserId').isString(),
    body('credits').isNumeric().toFloat().isFloat({ gt: 0 }),
    body('meta').optional().isObject(),
  ],
  asyncHandler(controller.transfer)
)

module.exports = router

