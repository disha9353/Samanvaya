const mongoose = require('mongoose')

const BarterRequest = require('../../models/BarterRequest')
const Item = require('../../models/Item')
const Notification = require('../../models/Notification')
const walletService = require('../wallet/walletService')
const User = require('../../models/User')
const { withOptionalTransaction } = require('../../utils/withOptionalTransaction')

async function createBarterRequest({ fromUserId, offeredItemId, requestedItemId, credits = 0 }) {
  const offeredItem = await Item.findById(offeredItemId)
  const requestedItem = await Item.findById(requestedItemId)

  if (!offeredItem || !requestedItem) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }

  if (offeredItem.seller.toString() !== fromUserId.toString()) {
    const err = new Error('You can only offer your own item')
    err.statusCode = 403
    throw err
  }

  if (offeredItem.status !== 'Available' || requestedItem.status !== 'Available') {
    const err = new Error('Both items must be Available')
    err.statusCode = 400
    throw err
  }

  if (credits < 0) {
    const err = new Error('credits must be >= 0')
    err.statusCode = 400
    throw err
  }

  const toUserId = requestedItem.seller.toString()

  const barter = await BarterRequest.create({
    fromUser: fromUserId,
    toUser: toUserId,
    offeredItem: offeredItemId,
    requestedItem: requestedItemId,
    credits,
    status: 'pending',
  })

  await Notification.create({
    userId: toUserId,
    type: 'barter_request',
    payload: {
      barterRequestId: barter._id.toString(),
      fromUserId,
      offeredItemId,
      requestedItemId,
      credits,
    },
  })

  return barter
}

async function acceptBarter({ userId, barterRequestId }) {
  const barter = await BarterRequest.findById(barterRequestId)
  if (!barter) {
    const err = new Error('Barter request not found')
    err.statusCode = 404
    throw err
  }
  if (barter.toUser.toString() !== userId.toString()) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
  if (barter.status !== 'pending') {
    const err = new Error('Barter request not pending')
    err.statusCode = 400
    throw err
  }

  const offeredItem = await Item.findById(barter.offeredItem)
  const requestedItem = await Item.findById(barter.requestedItem)
  if (!offeredItem || !requestedItem) {
    const err = new Error('Items not found')
    err.statusCode = 404
    throw err
  }

  await withOptionalTransaction(async (session) => {
    // Re-validate availability
    if (offeredItem.status !== 'Available' || requestedItem.status !== 'Available') {
      const err = new Error('Items already processed')
      err.statusCode = 400
      throw err
    }

    // Perform swap
    offeredItem.seller = barter.toUser
    requestedItem.seller = barter.fromUser
    offeredItem.status = 'Exchanged'
    requestedItem.status = 'Exchanged'
    await Promise.all([
      offeredItem.save(session ? { session } : undefined),
      requestedItem.save(session ? { session } : undefined),
    ])

    barter.status = 'accepted'
    await barter.save(session ? { session } : undefined)
  })

  // Handle optional credit transfer after item swap
  if (barter.credits > 0) {
    await walletService.transferCredits({
      fromUserId: barter.fromUser.toString(),
      toUserId: barter.toUser.toString(),
      credits: barter.credits,
      type: 'barter_credits',
      meta: {
        barterRequestId: barter._id.toString(),
        offeredItemId: barter.offeredItem.toString(),
        requestedItemId: barter.requestedItem.toString(),
      },
    })
  }

  // Eco impact: item reuse for both users
  const ecoBoost = 10
  await User.updateOne(
    { _id: barter.fromUser },
    { $inc: { itemsReusedCount: 1, ecoScore: ecoBoost } }
  )
  await User.updateOne(
    { _id: barter.toUser },
    { $inc: { itemsReusedCount: 1, ecoScore: ecoBoost } }
  )

  await Notification.create({
    userId: barter.fromUser.toString(),
    type: 'barter_request',
    payload: {
      barterRequestId: barter._id.toString(),
      status: 'accepted',
    },
  })

  return { ok: true, barter }
}

async function rejectBarter({ userId, barterRequestId }) {
  const barter = await BarterRequest.findById(barterRequestId)
  if (!barter) {
    const err = new Error('Barter request not found')
    err.statusCode = 404
    throw err
  }
  if (barter.toUser.toString() !== userId.toString()) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
  if (barter.status !== 'pending') {
    const err = new Error('Barter request not pending')
    err.statusCode = 400
    throw err
  }

  barter.status = 'rejected'
  await barter.save()

  await Notification.create({
    userId: barter.fromUser.toString(),
    type: 'barter_request',
    payload: { barterRequestId: barter._id.toString(), status: 'rejected' },
  })

  return { ok: true, barter }
}

async function listMyBarterRequests(userId, { incoming = true } = {}) {
  const filter = incoming ? { toUser: userId } : { fromUser: userId }
  return BarterRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('fromUser', 'name profilePic role credits')
    .populate('toUser', 'name profilePic role credits')
    .populate('offeredItem', 'title images price status')
    .populate('requestedItem', 'title images price status')
}

module.exports = { createBarterRequest, acceptBarter, rejectBarter, listMyBarterRequests }

