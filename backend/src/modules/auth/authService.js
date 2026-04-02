const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const env = require('../../config/env')
const User = require('../../models/User')
const PlatformSetting = require('../../models/PlatformSetting')
const { getMessage } = require('../../utils/translator')

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  )
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  )
}

async function register({ name, email, password, role, preferredLanguage }) {
  const existing = await User.findOne({ email })
  if (existing) {
    const err = new Error('Email already registered')
    err.statusCode = 409
    throw err
  }

  const signupCreditsSetting = await PlatformSetting.findOne({ key: 'default_signup_credits' }).lean()
  const signupCredits = Number(signupCreditsSetting?.value)

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({
    name,
    email,
    password: passwordHash,
    role: role === 'collector' ? 'collector' : 'user',
    credits: Number.isFinite(signupCredits) ? signupCredits : 100,
    preferredLanguage: ['en', 'hi', 'kn'].includes(preferredLanguage) ? preferredLanguage : 'en',
  })

  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  return { user: sanitizeUser(user), accessToken, refreshToken }
}

async function login({ email, password, preferredLanguage }) {
  const user = await User.findOne({ email })
  if (!user) {
    const err = new Error('Invalid email or password')
    err.statusCode = 401
    throw err
  }
  const ok = await bcrypt.compare(password, user.password)
  if (user.isBlocked) {
    const err = new Error('Account blocked')
    err.statusCode = 403
    throw err
  }

  if (!ok) {
    const err = new Error('Invalid email or password')
    err.statusCode = 401
    throw err
  }

  if (preferredLanguage && ['en', 'hi', 'kn'].includes(preferredLanguage) && user.preferredLanguage !== preferredLanguage) {
    user.preferredLanguage = preferredLanguage
    await user.save()
  }

  // Handle MFA Requirement
  if (user.isMFAEnabled) {
    const mfaService = require('../../../services/mfaService');
    const emailService = require('../../../services/emailService');
    
    const { otp, otpHash, otpExpiry } = await mfaService.generateOTP();
    user.otpHash = otpHash;
    user.otpExpiry = otpExpiry;
    await user.save();

    await emailService.sendOTPEmail(user.email, otp);

    return { status: 'OTP_REQUIRED', message: getMessage('otp_required', user.preferredLanguage) };
  }

  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  return { status: 'SUCCESS', user: sanitizeUser(user), accessToken, refreshToken }
}

async function refresh({ refreshToken }) {
  const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET)
  const user = await User.findById(payload.sub).select('_id name email role credits profilePic')
  if (!user) {
    const err = new Error('User not found')
    err.statusCode = 401
    throw err
  }
  const accessToken = signAccessToken(user)
  return { user: sanitizeUser(user), accessToken }
}

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : user
  return {
    _id: obj._id,
    name: obj.name,
    email: obj.email,
    role: obj.role,
    credits: obj.credits,
    profilePic: obj.profilePic,
    ecoScore: obj.ecoScore,
    isMFAEnabled: obj.isMFAEnabled || false,
    hasTotpSecret: !!obj.totpSecret,
  }
}

async function verifyOtp({ email, otp }) {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const mfaService = require('../../../services/mfaService');
  
  let isValid = false;
  if (user.totpSecret) {
    // Check Authenticator App TOTP token
    isValid = mfaService.verifyTOTP(otp, user.totpSecret);
  }
  
  // Always allow fallback to Email OTP if they somehow requested one or we generated one
  if (!isValid && user.otpHash && user.otpExpiry) {
    isValid = await mfaService.verifyOTP(otp, user.otpHash, user.otpExpiry);
  }
  
  if (!isValid) {
    const err = new Error('Invalid or expired confirmation code');
    err.statusCode = 401;
    throw err;
  }

  // Clear Email OTP fields after successful verification
  user.otpHash = undefined;
  user.otpExpiry = undefined;
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { status: 'SUCCESS', user: sanitizeUser(user), accessToken, refreshToken };
}

async function enableTotp({ userId }) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const mfaService = require('../../../services/mfaService');
  const qrcode = require('qrcode');

  const { secret, otpauth_url } = mfaService.generateTOTPSecret(user.email);
  
  // Save secret and enable MFA
  user.totpSecret = secret;
  user.isMFAEnabled = true;
  await user.save();

  // Generate QR code Data URL for the authenticator app
  const qrCodeUrl = await qrcode.toDataURL(otpauth_url);

  return { secret, qrCodeUrl, message: getMessage('totp_enabled', user.preferredLanguage) };
}

async function toggleMfa({ userId }) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  user.isMFAEnabled = !user.isMFAEnabled;
  if (!user.isMFAEnabled) {
    user.totpSecret = undefined; // clear TOTP secret if MFA is disabled
  }
  await user.save();

  return {
    isMFAEnabled: user.isMFAEnabled,
    message: getMessage(user.isMFAEnabled ? 'mfa_enabled' : 'mfa_disabled', user.preferredLanguage),
  };
}

async function setPreferredLanguage({ userId, preferredLanguage }) {
  if (!['en', 'hi', 'kn'].includes(preferredLanguage)) {
    const err = new Error('Invalid preferredLanguage')
    err.statusCode = 400
    throw err
  }
  const user = await User.findById(userId)
  if (!user) {
    const err = new Error('User not found')
    err.statusCode = 404
    throw err
  }
  user.preferredLanguage = preferredLanguage
  await user.save()
  return { preferredLanguage: user.preferredLanguage }
}

module.exports = { register, login, refresh, sanitizeUser, verifyOtp, enableTotp, toggleMfa, setPreferredLanguage }

