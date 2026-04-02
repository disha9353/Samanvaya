const mediaService = require('./mediaService')

async function upload(req, res) {
  const files = req.files || []
  if (files.length === 0) {
    const err = new Error('No files provided')
    err.statusCode = 400
    throw err
  }

  const folder = req.body?.folder || 'ecobarter'
  const urls = []

  for (const f of files) {
    const ext = (f.originalname.split('.').pop() || 'img').replace(/[^a-zA-Z0-9]/g, '')
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
    const result = await mediaService.uploadToCloudinary(f.buffer, name, folder)
    urls.push(result.secure_url)
  }

  res.status(201).json({ urls })
}

module.exports = { upload }

