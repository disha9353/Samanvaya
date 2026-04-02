const express = require('express')
const multer = require('multer')

const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./mediaController')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
})

router.post('/upload', upload.array('files', 5), asyncHandler(controller.upload))

module.exports = router

