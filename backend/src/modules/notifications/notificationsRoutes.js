const express = require('express')
const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./notificationsController')

const router = express.Router()

router.get('/', authenticate, asyncHandler(controller.list))
router.post('/read-all', authenticate, asyncHandler(controller.readAll))
router.post('/:id/read', authenticate, asyncHandler(controller.read))

module.exports = router

