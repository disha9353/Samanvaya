const express = require('express')
const { asyncHandler } = require('../../utils/asyncHandler')
const { authenticate } = require('../../middlewares/auth')
const controller = require('./interestsController')

const router = express.Router()

router.get('/my', authenticate, asyncHandler(controller.myInterested))

module.exports = router

