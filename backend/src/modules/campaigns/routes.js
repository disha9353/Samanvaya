const express = require('express')
const { body, param, query } = require('express-validator')

const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./campaignsController')

const router = express.Router()

router.get(
  '/',
  [query('q').optional().isString(), query('status').optional().isIn(['OPEN', 'FULL', 'COMPLETED'])],
  asyncHandler(controller.list)
)

router.get('/leaderboard', asyncHandler(controller.getLeaderboard))

router.post(
  '/',
  authenticate,
  [
    body('title').isString().trim().isLength({ min: 2, max: 120 }),
    body('description').optional().isString().isLength({ max: 4000 }),
    body('category').optional().isString().trim().isLength({ max: 60 }),
    body('location').optional().isString().trim().isLength({ max: 140 }),
    body('coordinates.lat').optional().isFloat({ min: -90, max: 90 }),
    body('coordinates.lng').optional().isFloat({ min: -180, max: 180 }),
    body('dateTime').optional().isISO8601(),
    body('maxParticipants').optional().isInt({ min: 1, max: 100000 }),
    body('imageUrl').optional({ nullable: true }).isString(),
    body('durationHours')
      .optional()
      .isFloat({ min: 0.5, max: 720 })
      .withMessage('Duration must be between 0.5 and 720 hours'),
  ],
  asyncHandler(controller.create)
)

router.post('/join', authenticate, [body('campaignId').isString()], asyncHandler(controller.join))
router.post('/:id/interested', authenticate, [param('id').isString()], asyncHandler(controller.markInterested))
router.get('/my-volunteer-history', authenticate, asyncHandler(controller.myVolunteerHistory))

// ── QR Attendance ─────────────────────────────────────────────────────────────
/** Organizer generates a QR token for session attendance */
router.post(
  '/:id/generate-qr',
  authenticate,
  [param('id').isString()],
  asyncHandler(controller.generateQR)
)

/** Participant submits scanned QR token to mark attendance & earn credits */
router.post(
  '/:id/verify-attendance',
  authenticate,
  [param('id').isString(), body('qrToken').isString().notEmpty()],
  asyncHandler(controller.verifyAttendance)
)

router.post(
  '/scan',
  authenticate,
  [body('campaignId').isString().notEmpty(), body('qrToken').isString().notEmpty()],
  asyncHandler(controller.scanQR)
)

router.get('/:id', [param('id').isString()], asyncHandler(controller.getById))

module.exports = router
