const express = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./qrController')

const router = express.Router()

router.post(
  '/generate',
  authenticate,
  [body('buyerId').isString().notEmpty(), body('itemId').isString().notEmpty()],
  asyncHandler(controller.generate)
)

router.post(
  '/validate-and-pay',
  authenticate,
  [body('qrToken').isString().notEmpty()],
  asyncHandler(controller.validateAndPay)
)

module.exports = router

