const express = require('express')
const { body } = require('express-validator')
const { authenticate, requireRole } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./collectorsController')

const router = express.Router()

router.use(authenticate, requireRole('collector'))

router.get('/requests', asyncHandler(controller.list))
router.post('/requests/:id/accept', asyncHandler(controller.accept))
router.post('/requests/:id/reject', asyncHandler(controller.reject))
router.post(
  '/requests/:id/complete',
  [
    body('weightKg').isNumeric().toFloat().isFloat({ gt: 0 }),
    body('pricePerKg').isNumeric().toFloat().isFloat({ min: 0 }),
  ],
  asyncHandler(controller.complete)
)

module.exports = router

