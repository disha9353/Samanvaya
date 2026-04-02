const mongoose = require('mongoose')

const WasteRequest = require('../../models/WasteRequest')
const PickupTransaction = require('../../models/PickupTransaction')
const Notification = require('../../models/Notification')
const User = require('../../models/User')
const Transaction = require('../../models/Transaction')
const { withOptionalTransaction } = require('../../utils/withOptionalTransaction')

function co2SavedFromKg(weightKg) {
  // Demo factor: 1 kg recycled ~ 1.5 kg CO2 avoided
  return Number(weightKg) * 1.5
}

async function createWasteRequest({ userId, wasteType, quantity, location, date, timeSlot, address }) {
  const req = await WasteRequest.create({
    userId,
    wasteType,
    quantity,
    location,
    address: address || '',
    date,
    timeSlot,
    status: 'pending',
  })
  return req.populate('userId', 'name profilePic role')
}

async function listMyWasteRequests(userId) {
  return WasteRequest.find({ userId })
    .sort({ createdAt: -1 })
    .populate('collectorId', 'name profilePic role credits')
}

async function listCollectorRequests() {
  return WasteRequest.find({ status: { $in: ['pending', 'accepted'] } })
    .sort({ createdAt: -1 })
    .populate('userId', 'name profilePic role')
}

async function acceptWasteRequest({ collectorId, wasteRequestId }) {
  const wr = await WasteRequest.findById(wasteRequestId)
  if (!wr) {
    const err = new Error('Waste request not found')
    err.statusCode = 404
    throw err
  }
  if (wr.status !== 'pending') {
    const err = new Error('Waste request is not pending')
    err.statusCode = 400
    throw err
  }

  wr.status = 'accepted'
  wr.collectorId = collectorId
  await wr.save()

  await Notification.create({
    userId: wr.userId,
    type: 'pickup_accepted',
    payload: { wasteRequestId: wr._id.toString(), collectorId: collectorId.toString() },
  })

  return wr.populate('collectorId', 'name profilePic role')
}

async function rejectWasteRequest({ collectorId, wasteRequestId }) {
  const wr = await WasteRequest.findById(wasteRequestId)
  if (!wr) {
    const err = new Error('Waste request not found')
    err.statusCode = 404
    throw err
  }
  if (wr.status !== 'pending') {
    const err = new Error('Waste request is not pending')
    err.statusCode = 400
    throw err
  }

  // Rejecting simply transitions it to a rejected/cancelled status for this demo
  wr.status = 'rejected'
  // Could optionally log *which* collector rejected it if we wanted an array: wr.rejectedBy.push(collectorId)
  await wr.save()

  await Notification.create({
    userId: wr.userId,
    type: 'pickup_rejected',
    payload: { wasteRequestId: wr._id.toString() },
  })

  return wr
}

async function completeWasteRequest({ collectorId, wasteRequestId, weightKg, pricePerKg }) {
  const wr = await WasteRequest.findById(wasteRequestId)
  if (!wr) {
    const err = new Error('Waste request not found')
    err.statusCode = 404
    throw err
  }
  if (!wr.collectorId || wr.collectorId.toString() !== collectorId.toString()) {
    const err = new Error('You are not assigned to this request')
    err.statusCode = 403
    throw err
  }
  if (wr.status !== 'accepted' && wr.status !== 'picked_up') {
    const err = new Error('Waste request is not ready for completion')
    err.statusCode = 400
    throw err
  }

  const weight = Number(weightKg)
  const ppk = Number(pricePerKg)
  if (!Number.isFinite(weight) || weight <= 0) {
    const err = new Error('weightKg must be > 0')
    err.statusCode = 400
    throw err
  }
  if (!Number.isFinite(ppk) || ppk < 0) {
    const err = new Error('pricePerKg must be >= 0')
    err.statusCode = 400
    throw err
  }

  const amount = weight * ppk

  await withOptionalTransaction(async (session) => {
    if (session) {
      await PickupTransaction.create(
        [
          {
            wasteRequestId: wr._id,
            collectorId,
            weightKg: weight,
            pricePerKg: ppk,
            amount,
          },
        ],
        { session }
      )
    } else {
      await PickupTransaction.create({
        wasteRequestId: wr._id,
        collectorId,
        weightKg: weight,
        pricePerKg: ppk,
        amount,
      })
    }

    wr.status = 'completed'
    await wr.save(session ? { session } : undefined)

    // Collector earnings: add credits to collector account (platform->collector is simplified)
    const collectorQ = User.findById(collectorId)
    if (session) collectorQ.session(session)
    const collector = await collectorQ
    if (!collector) throw new Error('Collector not found')
    collector.credits += amount
    await collector.save(session ? { session } : undefined)

    if (session) {
      await Transaction.create(
        [
          {
            buyer: null,
            seller: collectorId,
            item: null,
            credits: amount,
            type: 'collector_earning',
            meta: { wasteRequestId: wr._id.toString(), weightKg: weight },
          },
        ],
        { session }
      )
    } else {
      await Transaction.create({
        buyer: null,
        seller: collectorId,
        item: null,
        credits: amount,
        type: 'collector_earning',
        meta: { wasteRequestId: wr._id.toString(), weightKg: weight },
      })
    }

    if (session) {
      await Notification.create(
        [
          {
            userId: wr.userId,
            type: 'payment_completed',
            payload: {
              wasteRequestId: wr._id.toString(),
              collectorId: collectorId.toString(),
              amount,
              weightKg: weight,
            },
          },
        ],
        { session }
      )
    } else {
      await Notification.create({
        userId: wr.userId,
        type: 'payment_completed',
        payload: {
          wasteRequestId: wr._id.toString(),
          collectorId: collectorId.toString(),
          amount,
          weightKg: weight,
        },
      })
    }

    // Eco impact: update requester based on recycled weight
    const co2SavedKg = co2SavedFromKg(weight)
    await User.updateOne(
      { _id: wr.userId },
      {
        $inc: {
          co2SavedKg,
          wasteRecycledKg: weight,
          ecoScore: co2SavedKg,
        },
      },
      session ? { session } : undefined
    )
  })

  return { ok: true }
}

module.exports = {
  createWasteRequest,
  listMyWasteRequests,
  listCollectorRequests,
  acceptWasteRequest,
  rejectWasteRequest,
  completeWasteRequest,
}

