const wasteService = require('../waste/wasteService')
const { validationResult } = require('express-validator')

function mapValidationErrors(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed')
    err.statusCode = 400
    err.details = errors.array()
    throw err
  }
}

async function list(req, res) {
  const requests = await wasteService.listCollectorRequests()
  res.json({ requests })
}

async function accept(req, res) {
  const { id } = req.params
  const wr = await wasteService.acceptWasteRequest({ collectorId: req.user._id, wasteRequestId: id })
  res.json({ wasteRequest: wr })
}

async function complete(req, res) {
  mapValidationErrors(req)
  const { id } = req.params
  const { weightKg, pricePerKg } = req.body
  const result = await wasteService.completeWasteRequest({
    collectorId: req.user._id,
    wasteRequestId: id,
    weightKg,
    pricePerKg,
  })
  res.json(result)
}

async function reject(req, res) {
  const { id } = req.params
  const wr = await wasteService.rejectWasteRequest({ collectorId: req.user._id, wasteRequestId: id })
  res.json({ wasteRequest: wr })
}

module.exports = { list, accept, reject, complete }

