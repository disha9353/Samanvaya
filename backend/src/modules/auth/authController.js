const { validationResult } = require('express-validator')
const authService = require('./authService')

function mapValidationErrors(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed')
    err.statusCode = 400
    err.details = errors.array()
    throw err
  }
}

async function register(req, res) {
  mapValidationErrors(req)
  const { name, email, password, role, preferredLanguage } = req.body
  const result = await authService.register({
    name,
    email,
    password,
    role,
    preferredLanguage: preferredLanguage || req.language,
  })
  res.status(201).json(result)
}

async function login(req, res) {
  mapValidationErrors(req)
  const { email, password } = req.body
  const result = await authService.login({ email, password, preferredLanguage: req.language })
  res.json(result)
}

async function refresh(req, res) {
  mapValidationErrors(req)
  const { refreshToken } = req.body
  const result = await authService.refresh({ refreshToken })
  res.json(result)
}

async function me(req, res) {
  const user = req.user
  res.json({ user })
}

async function verifyOtp(req, res) {
  mapValidationErrors(req)
  const { email, otp } = req.body
  const result = await authService.verifyOtp({ email, otp })
  res.json(result)
}

async function enableTotp(req, res) {
  const userId = req.user._id
  const result = await authService.enableTotp({ userId })
  res.json(result)
}

async function toggleMfa(req, res) {
  const userId = req.user._id
  const result = await authService.toggleMfa({ userId })
  res.json(result)
}

async function setPreferredLanguage(req, res) {
  mapValidationErrors(req)
  const userId = req.user._id
  const { preferredLanguage } = req.body
  const result = await authService.setPreferredLanguage({ userId, preferredLanguage })
  res.json(result)
}

module.exports = { register, login, refresh, me, verifyOtp, enableTotp, toggleMfa, setPreferredLanguage }

