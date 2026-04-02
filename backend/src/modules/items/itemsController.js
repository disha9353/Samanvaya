const { validationResult } = require('express-validator')
const itemsService = require('./itemsService')

function mapValidationErrors(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed')
    err.statusCode = 400
    err.details = errors.array()
    throw err
  }
}

async function create(req, res) {
  mapValidationErrors(req)
  const { title, description, images, price, location } = req.body
  const result = await itemsService.createItem({
    userId: req.user._id,
    title,
    description,
    images,
    price,
    location,
  })
  res.status(201).json(result)
}

async function list(req, res) {
  mapValidationErrors(req)
  const { q, status, page, limit } = req.query
  const result = await itemsService.listItems({
    query: q,
    status,
    page,
    limit,
  })
  res.json(result)
}

async function myItems(req, res) {
  const items = await itemsService.listMyItems(req.user._id)
  res.json({ items })
}

async function getById(req, res) {
  const { id } = req.params
  const item = await itemsService.getItem(id)
  res.json(item)
}

async function update(req, res) {
  mapValidationErrors(req)
  const { id } = req.params
  const patch = {}
  if (req.body.title !== undefined) patch.title = req.body.title
  if (req.body.description !== undefined) patch.description = req.body.description
  if (req.body.images !== undefined) patch.images = req.body.images
  if (req.body.price !== undefined) patch.price = req.body.price
  if (req.body.status !== undefined) patch.status = req.body.status
  const item = await itemsService.updateItem({ userId: req.user._id, itemId: id, patch })
  res.json(item)
}

async function remove(req, res) {
  const { id } = req.params
  const result = await itemsService.deleteItem({ userId: req.user._id, itemId: id })
  res.json(result)
}

async function like(req, res) {
  const { id } = req.params
  const item = await itemsService.toggleLike({ userId: req.user._id, itemId: id })
  res.json({ item })
}

async function save(req, res) {
  const { id } = req.params
  const item = await itemsService.toggleSave({ userId: req.user._id, itemId: id })
  res.json({ item })
}

async function interested(req, res) {
  const { id } = req.params
  const item = await itemsService.markInterested({ userId: req.user._id, itemId: id })
  res.json({ item })
}

async function selectBuyer(req, res) {
  const { id } = req.params;
  const { buyerId } = req.body;
  
  if (!buyerId) {
    return res.status(400).json({ message: 'buyerId is required' });
  }

  const item = await itemsService.selectBuyer({ userId: req.user._id, itemId: id, buyerId });
  res.json({ item });
}

async function nearby(req, res) {
  mapValidationErrors(req)
  const { lng, lat, radius, limit } = req.query
  const items = await itemsService.listNearbyItems({
    lng: parseFloat(lng),
    lat: parseFloat(lat),
    radius: radius ? parseFloat(radius) : 5,
    limit: limit ? parseInt(limit) : 20
  })
  res.json({ items })
}

module.exports = { create, list, myItems, getById, update, remove, like, save, interested, selectBuyer, nearby }

