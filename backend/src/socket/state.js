const userSockets = new Map() // userId -> Set(socketId)
const collectorLocations = new Map() // collectorId -> { lat, lng, updatedAt }

function addUserSocket(userId, socketId) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set())
  userSockets.get(userId).add(socketId)
}

function removeUserSocket(userId, socketId) {
  if (!userSockets.has(userId)) return
  userSockets.get(userId).delete(socketId)
  if (userSockets.get(userId).size === 0) userSockets.delete(userId)
}

function setCollectorLocation(collectorId, coords) {
  collectorLocations.set(collectorId, { ...coords, updatedAt: Date.now() })
}

function getCollectorLocation(collectorId) {
  return collectorLocations.get(collectorId)
}

function getAllCollectorLocations() {
  return Array.from(collectorLocations.entries()).map(([collectorId, loc]) => ({
    collectorId,
    ...loc,
  }))
}

module.exports = {
  addUserSocket,
  removeUserSocket,
  setCollectorLocation,
  getCollectorLocation,
  getAllCollectorLocations,
  userSockets,
}

