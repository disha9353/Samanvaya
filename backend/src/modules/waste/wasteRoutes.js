const express = require('express')
const { body, query } = require('express-validator')
const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./wasteController')

const router = express.Router()

router.post(
  '/requests',
  authenticate,
  [
    body('wasteType').isString().isIn(['plastic', 'metal', 'ewaste', 'paper', 'glass']),
    body('quantity').isNumeric().toFloat().isFloat({ min: 0 }),
    body('date').isString().notEmpty(),
    body('timeSlot').isString().notEmpty(),
    body('location').optional().isObject(),
    body('lat').optional().isNumeric(),
    body('lng').optional().isNumeric(),
    body('address').optional().isString(),
  ],
  asyncHandler(controller.create)
)

router.get('/requests/me', authenticate, asyncHandler(controller.my))

module.exports = router

