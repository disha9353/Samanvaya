const mongoose = require('mongoose')

const Item = require('../../models/Item')
const Notification = require('../../models/Notification')

async function createItem({ userId, title, description, images, price, location }) {
  const payload = {
    title,
    description,
    images: images || [],
    price,
    seller: userId,
    status: 'Available',
  }

  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    payload.location = {
      type: 'Point',
      coordinates: [location.lng, location.lat]
    }
  }

  const item = await Item.create(payload)
  return item.populate('seller', 'name email profilePic role credits')
}

async function updateItem({ userId, itemId, patch }) {
  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  if (item.seller.toString() !== userId.toString()) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }

  Object.assign(item, patch)
  await item.save()
  return item.populate('seller', 'name email profilePic role credits')
}

async function deleteItem({ userId, itemId }) {
  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  if (item.seller.toString() !== userId.toString()) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
  await item.deleteOne()
  return { deleted: true }
}

async function getItem(itemId) {
  const item = await Item.findById(itemId).populate('seller', 'name profilePic role')
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  return item
}

async function listItems({ query, status, page, limit }) {
  const filter = {}
  if (status) filter.status = status
  if (query) {
    filter.title = { $regex: query, $options: 'i' }
  }

  const p = Number(page) || 1
  const l = Number(limit) || 10
  const skip = (p - 1) * l

  const [items, total] = await Promise.all([
    Item.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .populate('seller', 'name profilePic role'),
    Item.countDocuments(filter),
  ])
  return { items, total, page: p, limit: l }
}

async function listMyItems(userId) {
  return Item.find({ seller: userId }).sort({ createdAt: -1 }).populate('seller', 'name profilePic role')
}

async function toggleLike({ userId, itemId }) {
  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  const idx = item.likedUsers.findIndex((id) => id.toString() === userId.toString())
  if (idx >= 0) item.likedUsers.splice(idx, 1)
  else item.likedUsers.push(new mongoose.Types.ObjectId(userId))
  await item.save()
  return item
}

async function toggleSave({ userId, itemId }) {
  const item = await Item.findById(itemId)
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  const idx = item.savedUsers.findIndex((id) => id.toString() === userId.toString())
  if (idx >= 0) item.savedUsers.splice(idx, 1)
  else item.savedUsers.push(new mongoose.Types.ObjectId(userId))
  await item.save()
  return item
}

async function markInterested({ userId, itemId }) {
  const item = await Item.findById(itemId).populate('seller', '_id name')
  if (!item) {
    const err = new Error('Item not found')
    err.statusCode = 404
    throw err
  }
  const already = item.interestedUsers.some((id) => id.toString() === userId.toString())
  if (!already) item.interestedUsers.push(new mongoose.Types.ObjectId(userId))
  await item.save()

  // Notification for seller
  if (item.seller && item.seller._id.toString() !== userId.toString()) {
    await Notification.create({
      userId: item.seller._id,
      type: 'interest_received',
      payload: { itemId, fromUserId: userId },
    })
  }

  return item
}

async function selectBuyer({ userId, itemId, buyerId }) {
  // Populate seller so we have their name & email for the notification email
  const item = await Item.findById(itemId).populate('seller', 'name email');
  if (!item) {
    const err = new Error('Item not found');
    err.statusCode = 404;
    throw err;
  }
  if (item.seller._id.toString() !== userId.toString()) {
    const err = new Error('Forbidden: Only the seller can select a buyer');
    err.statusCode = 403;
    throw err;
  }

  const User = require('../../models/User');
  const buyer = await User.findById(buyerId);
  if (!buyer) {
    const err = new Error('Buyer not found');
    err.statusCode = 404;
    throw err;
  }

  item.buyer = buyerId;
  item.status = 'Exchanged';
  item.soldAt = new Date();
  await item.save();

  // ── In-app notification (real-time via Socket.io + DB) ──────────────────
  const { createNotification } = require('../../services/notificationService');
  await createNotification(
    buyerId,
    'INTEREST_SELECTED',
    `You have been selected as the recipient for "${item.title}". Contact the seller to arrange the exchange.`,
    { itemId }
  );

  // ── Email notification to selected buyer ────────────────────────────────
  // Path: src/modules/items/ → ../../.. → backend/ → services/emailService
  const { sendBuyerSelectedEmail } = require('../../../services/emailService');
  await sendBuyerSelectedEmail(
    buyer.email,
    item.title,
    { name: item.seller.name, email: item.seller.email }
  );

  return item;
}

async function listNearbyItems({ lng, lat, radius = 5, limit = 20 }) {
  if (isNaN(lng) || isNaN(lat)) {
    const err = new Error('Invalid coordinates for nearby search')
    err.statusCode = 400
    throw err
  }
  
  const maxDistance = Number(radius) * 1000 // Convert km to meters
  
  const items = await Item.find({
    status: 'Available',
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [Number(lng), Number(lat)]
        },
        $maxDistance: maxDistance
      }
    }
  })
    .limit(Number(limit))
    .populate('seller', 'name profilePic role')
    
  return items
}

module.exports = { createItem, updateItem, deleteItem, getItem, listItems, listMyItems, toggleLike, toggleSave, markInterested, selectBuyer, listNearbyItems }

