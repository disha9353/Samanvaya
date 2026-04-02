const mongoose = require('mongoose')

async function connectDB(mongodbUri) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(mongodbUri)
  return mongoose.connection
}

module.exports = { connectDB }

