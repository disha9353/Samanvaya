const jwt = require('jsonwebtoken')
const env = require('../config/env')
const User = require('../models/User')
const { getMessage } = require('../utils/translator')

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ message: getMessage('missing_access_token', req.language) })
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET)
    const user = await User.findById(payload.sub).select('_id email role credits isBlocked blockedReason')
    if (!user) return res.status(401).json({ message: getMessage('invalid_access_token', req.language) })
    if (user.isBlocked) return res.status(403).json({ message: getMessage('account_blocked', req.language) })

    req.user = user
    return next()
  } catch (err) {
    return res.status(401).json({ message: getMessage('unauthorized_generic', req.language) })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: getMessage('unauthorized_generic', req.language) })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: getMessage('forbidden', req.language) })
    }
    return next()
  }
}

module.exports = { authenticate, requireRole }

