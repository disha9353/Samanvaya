const express = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const { validationResult } = require('express-validator')
const Report = require('../../models/Report')

const router = express.Router()

router.post(
  '/',
  authenticate,
  [
    body('targetType').isIn(['user', 'item', 'campaign']),
    body('targetId').isString().notEmpty(),
    body('reason').isString().isLength({ min: 3, max: 160 }),
    body('description').optional().isString().isLength({ max: 2000 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed')
      err.statusCode = 400
      err.details = errors.array()
      throw err
    }
    const report = await Report.create({
      reporter: req.user._id,
      targetType: req.body.targetType,
      targetId: req.body.targetId,
      reason: req.body.reason,
      description: req.body.description || '',
    })
    res.status(201).json({ report })
  })
)

module.exports = router

