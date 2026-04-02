const express = require('express')
const { body } = require('express-validator')
const rateLimit = require('express-rate-limit')

const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./authController')

const router = express.Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
})

router.post(
  '/register',
  [
    body('name').isString().trim().isLength({ min: 2, max: 60 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6, max: 100 }),
    body('role').optional().isIn(['user', 'collector']),
    body('preferredLanguage').optional().isIn(['en', 'hi', 'kn']),
  ],
  authLimiter,
  asyncHandler(controller.register)
)

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6, max: 100 }),
  ],
  authLimiter,
  asyncHandler(controller.login)
)

router.post(
  '/refresh',
  [body('refreshToken').isString().notEmpty()],
  asyncHandler(controller.refresh)
)

router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isString().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
  ],
  authLimiter,
  asyncHandler(controller.verifyOtp)
)

router.get('/me', authenticate, asyncHandler(controller.me))

router.post('/enable-totp', authenticate, asyncHandler(controller.enableTotp))
router.post('/toggle-mfa', authenticate, asyncHandler(controller.toggleMfa))

router.post(
  '/preferred-language',
  [body('preferredLanguage').isIn(['en', 'hi', 'kn'])],
  authenticate,
  asyncHandler(controller.setPreferredLanguage)
)

module.exports = router

