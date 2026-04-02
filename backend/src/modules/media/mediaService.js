const cloudinary = require('cloudinary').v2
const env = require('../../config/env')

function getCloudinaryConfig() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    const err = new Error('Cloudinary is not configured')
    err.statusCode = 500
    throw err
  }
  return {
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  }
}

async function uploadToCloudinary(fileBuffer, fileName, folder = 'ecobarter') {
  const cfg = getCloudinaryConfig()
  cloudinary.config(cfg)

  const uploader = cloudinary?.uploader
  if (!uploader) {
    const err = new Error('Cloudinary uploader not available')
    err.statusCode = 500
    throw err
  }

  // Preferred: stream upload (memory buffer -> readable -> pipe to upload_stream)
  if (typeof uploader.upload_stream === 'function') {
    const { Readable } = require('stream')
    const readable = Readable.from(fileBuffer)

    return await new Promise((resolve, reject) => {
      const uploadStream = uploader.upload_stream(
        { folder, public_id: fileName, resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error)
          return resolve(result)
        }
      )

      readable.on('error', reject)
      readable.pipe(uploadStream)
    })
  }

  // Fallback: base64 upload (slower, but works if upload_stream is missing)
  const mime = 'image/*'
  const dataUri = `data:${mime};base64,${fileBuffer.toString('base64')}`
  return await uploader.upload(dataUri, { folder, public_id: fileName, resource_type: 'image' })
}

module.exports = { uploadToCloudinary }

