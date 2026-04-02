const express = require('express')
const { body, param } = require('express-validator')
const { authenticate, requireRole } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./barterController')

const router = express.Router()

router.post(
  '/requests',
  authenticate,
  [
    body('offeredItemId').isString(),
    body('requestedItemId').isString(),
    body('credits').optional().isNumeric().toFloat().isFloat({ min: 0 }),
  ],
  asyncHandler(controller.create)
)

router.get('/requests/me', authenticate, asyncHandler(controller.listMy))

router.post('/requests/:id/accept', authenticate, asyncHandler(controller.accept))
router.post('/requests/:id/reject', authenticate, asyncHandler(controller.reject))

module.exports = router

