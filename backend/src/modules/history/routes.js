const express = require('express')
const { query } = require('express-validator')

const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./historyController')

const router = express.Router()

router.get('/market', authenticate, [query('limit').optional().isInt({ min: 1, max: 200 })], asyncHandler(controller.market))

module.exports = router

