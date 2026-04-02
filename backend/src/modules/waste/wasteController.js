const wasteService = require('./wasteService')

async function create(req, res) {
  const { wasteType, quantity, lat, lng, location, date, timeSlot, address } = req.body
  const loc = location && typeof location === 'object' ? location : { lat, lng }
  const result = await wasteService.createWasteRequest({
    userId: req.user._id,
    wasteType,
    quantity,
    location: { lat: Number(loc.lat), lng: Number(loc.lng) },
    date,
    timeSlot,
    address,
  })
  res.status(201).json({ wasteRequest: result })
}

async function my(req, res) {
  const requests = await wasteService.listMyWasteRequests(req.user._id)
  res.json({ requests })
}

module.exports = { create, my }

