require('dotenv').config()

function must(name) {
  const v = (process.env[name] || '').trim()
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 5000),

  MONGODB_URI: must('MONGODB_URI'),

  JWT_ACCESS_SECRET: must('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: must('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  JWT_QR_SECRET: process.env.JWT_QR_SECRET || (process.env.JWT_ACCESS_SECRET ? `${process.env.JWT_ACCESS_SECRET}:qr` : ''),
  JWT_QR_EXPIRES_IN: process.env.JWT_QR_EXPIRES_IN || '10m',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  SOCKET_CORS_ORIGIN: (process.env.SOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN || '*').split(','),
  CORS_ORIGIN: (process.env.CORS_ORIGIN || '*').split(','),
}

module.exports = env

