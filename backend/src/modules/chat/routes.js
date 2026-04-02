const express = require('express')
const { body, param } = require('express-validator')
const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./chatController')

const router = express.Router()

router.get('/conversations', authenticate, asyncHandler(controller.conversations))

router.post(
  '/messages',
  authenticate,
  [
    body('receiverId').isString(),
    body('content').isString().isLength({ min: 1, max: 2000 }),
    body('itemId').optional().isString(),
  ],
  asyncHandler(controller.send)
)

router.get(
  '/messages/:otherUserId',
  authenticate,
  [param('otherUserId').isString()],
  asyncHandler(controller.list)
)

module.exports = router

