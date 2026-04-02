const Item = require('../../models/Item')
const Transaction = require('../../models/Transaction')
const BarterRequest = require('../../models/BarterRequest')

function toObjectIdString(id) {
  if (!id) return null
  return typeof id === 'string' ? id : id.toString()
}

async function getMyMarketHistory(userId, { limit = 50 } = {}) {
  const l = Math.min(Math.max(Number(limit) || 50, 1), 200)

  const [purchasedItems, soldItems, barterAccepted, tx] = await Promise.all([
    Item.find({ buyer: userId, status: 'Sold' })
      .sort({ soldAt: -1, createdAt: -1 })
      .populate('seller', 'name profilePic role')
      .lean(),
    Item.find({ seller: userId, status: 'Sold' })
      .sort({ soldAt: -1, createdAt: -1 })
      .populate('buyer', 'name profilePic role')
      .lean(),
    BarterRequest.find({
      status: 'accepted',
      $or: [{ fromUser: userId }, { toUser: userId }],
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate('fromUser', 'name profilePic role')
      .populate('toUser', 'name profilePic role')
      .populate('offeredItem', 'title images price status')
      .populate('requestedItem', 'title images price status')
      .lean(),
    Transaction.find({ $or: [{ buyer: userId }, { seller: userId }] }).sort({ createdAt: -1 }).limit(l).lean(),
  ])

  const itemsById = new Map()
  for (const it of [...purchasedItems, ...soldItems]) itemsById.set(toObjectIdString(it._id), it)

  // For older tx rows, item id is typically in meta.itemId
  const txItemIds = tx
    .map((t) => toObjectIdString(t.item) || toObjectIdString(t?.meta?.itemId))
    .filter(Boolean)
    .filter((id) => !itemsById.has(id))

  if (txItemIds.length) {
    const extra = await Item.find({ _id: { $in: txItemIds } })
      .populate('seller', 'name profilePic role')
      .populate('buyer', 'name profilePic role')
      .lean()
    for (const it of extra) itemsById.set(toObjectIdString(it._id), it)
  }

  const history = []

  for (const it of purchasedItems) {
    history.push({
      kind: 'purchase',
      at: it.soldAt || it.updatedAt || it.createdAt,
      credits: it.price,
      item: it,
      counterparty: it.seller || null,
      status: it.status,
    })
  }

  for (const it of soldItems) {
    history.push({
      kind: 'sale',
      at: it.soldAt || it.updatedAt || it.createdAt,
      credits: it.price,
      item: it,
      counterparty: it.buyer || null,
      status: it.status,
    })
  }

  for (const br of barterAccepted) {
    const isFrom = toObjectIdString(br.fromUser?._id) === toObjectIdString(userId)
    history.push({
      kind: 'barter',
      at: br.updatedAt || br.createdAt,
      credits: Number(br.credits) || 0,
      item: isFrom ? br.offeredItem : br.requestedItem,
      item2: isFrom ? br.requestedItem : br.offeredItem,
      counterparty: isFrom ? br.toUser : br.fromUser,
      status: br.status,
      meta: { barterRequestId: toObjectIdString(br._id) },
    })
  }

  // Also include raw transactions (wallet transfers, etc.) enriched with item when possible.
  const txHistory = tx.map((t) => {
    const itemId = toObjectIdString(t.item) || toObjectIdString(t?.meta?.itemId)
    const item = itemId ? itemsById.get(itemId) || null : null
    const direction = toObjectIdString(t.buyer) === toObjectIdString(userId) ? 'out' : 'in'
    return {
      kind: 'transaction',
      at: t.createdAt,
      credits: t.credits,
      type: t.type,
      direction,
      item,
      meta: t.meta || {},
      counterpartyId: direction === 'out' ? toObjectIdString(t.seller) : toObjectIdString(t.buyer),
    }
  })

  history.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  // Ensure bottom panel is not massive
  const historyLimited = history.slice(0, l)

  const soldImages = soldItems
    .flatMap((it) => (Array.isArray(it.images) ? it.images.map((url) => ({ itemId: it._id, url, title: it.title })) : []))
    .filter((x) => x.url)

  return {
    purchasedItems,
    soldItems,
    soldImages,
    history: historyLimited,
    transactions: txHistory,
  }
}

module.exports = { getMyMarketHistory }

