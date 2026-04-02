const { validationResult } = require('express-validator')
const adminService = require('./adminService')

function mapValidationErrors(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed')
    err.statusCode = 400
    err.details = errors.array()
    throw err
  }
}

async function stats(req, res) {
  const result = await adminService.getStats()
  res.json(result)
}

async function users(req, res) {
  mapValidationErrors(req)
  const result = await adminService.listUsers(req.query)
  res.json(result)
}

async function patchUser(req, res) {
  mapValidationErrors(req)
  const user = await adminService.updateUser({
    adminId: req.user._id,
    userId: req.params.id,
    payload: req.body,
  })
  res.json({ user })
}

async function items(req, res) {
  mapValidationErrors(req)
  const result = await adminService.listItems(req.query)
  res.json(result)
}

async function patchItem(req, res) {
  mapValidationErrors(req)
  const item = await adminService.updateItem({
    adminId: req.user._id,
    itemId: req.params.id,
    payload: req.body,
  })
  res.json({ item })
}

async function removeItem(req, res) {
  mapValidationErrors(req)
  const result = await adminService.deleteItem({
    adminId: req.user._id,
    itemId: req.params.id,
  })
  res.json(result)
}

async function campaigns(req, res) {
  mapValidationErrors(req)
  const result = await adminService.listCampaigns(req.query)
  res.json(result)
}

async function patchCampaign(req, res) {
  mapValidationErrors(req)
  const campaign = await adminService.updateCampaign({
    adminId: req.user._id,
    campaignId: req.params.id,
    payload: req.body,
  })
  res.json({ campaign })
}

async function removeCampaign(req, res) {
  mapValidationErrors(req)
  const result = await adminService.deleteCampaign({
    adminId: req.user._id,
    campaignId: req.params.id,
  })
  res.json(result)
}

async function wasteRequests(req, res) {
  mapValidationErrors(req)
  const result = await adminService.listWasteRequests(req.query)
  res.json(result)
}

async function transactions(req, res) {
  mapValidationErrors(req)
  const result = await adminService.listTransactions(req.query)
  res.json(result)
}

async function reports(req, res) {
  mapValidationErrors(req)
  const result = await adminService.listReports(req.query)
  res.json(result)
}

async function patchReport(req, res) {
  mapValidationErrors(req)
  const report = await adminService.updateReport({
    adminId: req.user._id,
    reportId: req.params.id,
    payload: req.body,
  })
  res.json({ report })
}

async function settings(req, res) {
  const result = await adminService.getSettings()
  res.json(result)
}

async function patchSettings(req, res) {
  mapValidationErrors(req)
  const result = await adminService.updateSettings({
    adminId: req.user._id,
    payload: req.body,
  })
  res.json(result)
}

module.exports = {
  stats,
  users,
  patchUser,
  items,
  patchItem,
  removeItem,
  campaigns,
  patchCampaign,
  removeCampaign,
  wasteRequests,
  transactions,
  reports,
  patchReport,
  settings,
  patchSettings,
}

