const barterService = require('./barterService')

async function create(req, res) {
  const { offeredItemId, requestedItemId, credits } = req.body
  const barter = await barterService.createBarterRequest({
    fromUserId: req.user._id,
    offeredItemId,
    requestedItemId,
    credits: credits || 0,
  })
  res.status(201).json({ barterRequest: barter })
}

async function accept(req, res) {
  const { id } = req.params
  const result = await barterService.acceptBarter({ userId: req.user._id, barterRequestId: id })
  res.json(result)
}

async function reject(req, res) {
  const { id } = req.params
  const result = await barterService.rejectBarter({ userId: req.user._id, barterRequestId: id })
  res.json(result)
}

async function listMy(req, res) {
  const { incoming } = req.query
  const result = await barterService.listMyBarterRequests(req.user._id, {
    incoming: incoming === 'false' ? false : true,
  })
  res.json({ barterRequests: result })
}

module.exports = { create, accept, reject, listMy }

