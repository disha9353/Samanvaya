const express = require('express')
const { body, query, param } = require('express-validator')

const { authenticate } = require('../../middlewares/auth')
const { asyncHandler } = require('../../utils/asyncHandler')
const controller = require('./itemsController')

const router = express.Router()

router.post(
  '/',
  authenticate,
  [
    body('title').isString().trim().isLength({ min: 2, max: 120 }),
    body('description').optional().isString().trim().isLength({ max: 2000 }),
    body('images').optional().isArray(),
    body('price').isNumeric().toFloat().isFloat({ min: 0 }),
    body('location').optional().isObject(),
    body('location.lat').optional().isNumeric().toFloat(),
    body('location.lng').optional().isNumeric().toFloat(),
  ],
  asyncHandler(controller.create)
)

router.get(
  '/',
  [
    query('q').optional().isString(),
    query('status').optional().isIn(['Available', 'Sold', 'Exchanged']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  asyncHandler(controller.list)
)

router.get('/me', authenticate, asyncHandler(controller.myItems))

router.get(
  '/nearby',
  [
    query('lng').isNumeric().notEmpty(),
    query('lat').isNumeric().notEmpty(),
    query('radius').optional().isNumeric(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(controller.nearby)
)

router.get('/:id', asyncHandler(controller.getById))

router.patch(
  '/:id',
  authenticate,
  [
    param('id').isString(),
    body('title').optional().isString().trim().isLength({ min: 2, max: 120 }),
    body('description').optional().isString().trim().isLength({ max: 2000 }),
    body('images').optional().isArray(),
    body('price').optional().isNumeric().toFloat().isFloat({ min: 0 }),
    body('status').optional().isIn(['Available', 'Sold', 'Exchanged']),
  ],
  asyncHandler(controller.update)
)

router.delete('/:id', authenticate, asyncHandler(controller.remove))

router.post('/:id/like', authenticate, asyncHandler(controller.like))
router.post('/:id/save', authenticate, asyncHandler(controller.save))
router.post('/:id/interested', authenticate, asyncHandler(controller.interested))
router.post(
  '/:id/select-buyer',
  authenticate,
  [body('buyerId').isString().notEmpty()],
  asyncHandler(controller.selectBuyer)
)

module.exports = router

