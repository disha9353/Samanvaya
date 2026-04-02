const express = require('express')
const { asyncHandler } = require('../../utils/asyncHandler')
const ecoController = require('./ecoController')

const router = express.Router()

router.get('/leaderboard', asyncHandler(ecoController.leaderboard))

module.exports = router

