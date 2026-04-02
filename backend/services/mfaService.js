const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const crypto = require('crypto');

/**
 * Generate a 6-digit OTP, hash it with bcrypt, and set a 5-minute expiry
 * @returns {Promise<{ otp: string, otpHash: string, otpExpiry: Date }>}
 */
async function generateOTP() {
  // Generate random 6-digit number
  // Using crypto for more secure random generation instead of Math.random
  const otp = crypto.randomInt(100000, 999999).toString();
  
  // Hash OTP using bcrypt
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(otp, salt);
  
  // Set expiry (5 minutes from now)
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
  
  return { otp, otpHash, otpExpiry };
}

/**
 * Verify a provided OTP against the stored hash and expiry
 * @param {string} userOtp - The 6-digit OTP provided by the user
 * @param {string} storedHash - The bcrypt hash stored in the database
 * @param {Date} expiryDate - The expiry date stored in the database
 * @returns {Promise<boolean>} True if valid, false otherwise
 */
async function verifyOTP(userOtp, storedHash, expiryDate) {
  if (!userOtp || !storedHash || !expiryDate) return false;
  
  if (new Date() > new Date(expiryDate)) {
    return false; // OTP expired
  }
  
  return await bcrypt.compare(userOtp.toString(), storedHash);
}

/**
 * Generate a TOTP secret using speakeasy
 * @param {string} userEmail - Used to identify the account in the Authenticator app
 * @returns {{ secret: string, otpauth_url: string }}
 */
function generateTOTPSecret(userEmail) {
  const secret = speakeasy.generateSecret({ 
    length: 20,
    name: `UrbanPulse:${userEmail}`
  });
  
  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url
  };
}

/**
 * Verify a TOTP token using speakeasy
 * @param {string} token - The 6-digit code from the Authenticator app
 * @param {string} secret - The base32 secret stored in the database
 * @returns {boolean} True if valid, false otherwise
 */
function verifyTOTP(token, secret) {
  if (!token || !secret) return false;
  
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1 // Allow 1 step before/after to account for slight time drift
  });
}

module.exports = {
  generateOTP,
  verifyOTP,
  generateTOTPSecret,
  verifyTOTP
};
