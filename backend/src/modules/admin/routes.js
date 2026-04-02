const express = require('express')
const { body, param, query } = require('express-validator')

const { authenticate, requireRole } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./adminController')

const router = express.Router()

router.use(authenticate, requireRole('admin'))

router.get('/stats', asyncHandler(controller.stats))

router.get('/users', [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], asyncHandler(controller.users))
router.patch(
  '/user/:id',
  [
    param('id').isString(),
    body('role').optional().isIn(['user', 'collector', 'admin']),
    body('isBlocked').optional().isBoolean(),
    body('blockedReason').optional().isString(),
    body('resetCredits').optional().isBoolean(),
    body('credits').optional().isNumeric(),
  ],
  asyncHandler(controller.patchUser)
)

router.get('/items', asyncHandler(controller.items))
router.patch('/item/:id', [param('id').isString()], asyncHandler(controller.patchItem))
router.delete('/item/:id', [param('id').isString()], asyncHandler(controller.removeItem))

router.get('/campaigns', asyncHandler(controller.campaigns))
router.patch('/campaign/:id', [param('id').isString()], asyncHandler(controller.patchCampaign))
router.delete('/campaign/:id', [param('id').isString()], asyncHandler(controller.removeCampaign))

router.get('/waste-requests', asyncHandler(controller.wasteRequests))
router.get('/transactions', asyncHandler(controller.transactions))

router.get('/reports', asyncHandler(controller.reports))
router.patch('/report/:id', [param('id').isString(), body('status').optional().isString(), body('resolutionNote').optional().isString()], asyncHandler(controller.patchReport))

router.get('/settings', asyncHandler(controller.settings))
router.patch(
  '/settings',
  [
    body('default_signup_credits').optional().isNumeric(),
    body('campaign_reward_credits').optional().isNumeric(),
    body('penalty_credits').optional().isNumeric(),
    body('platform_rules').optional().isString(),
  ],
  asyncHandler(controller.patchSettings)
)

module.exports = router

