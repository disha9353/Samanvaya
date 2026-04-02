const bcrypt = require('bcryptjs')

const env = require('../config/env')
const { connectDB } = require('../config/db')
const User = require('../models/User')
const Item = require('../models/Item')
const WasteRequest = require('../models/WasteRequest')

async function seed() {
  await connectDB(env.MONGODB_URI)

  // Idempotent-ish: clear collections for demo.
  await Promise.all([
    User.deleteMany({}),
    Item.deleteMany({}),
    WasteRequest.deleteMany({}),
  ])

  const pw = 'password123'
  const u1 = await User.create({
    name: 'EcoAsha',
    email: 'asha@example.com',
    password: await bcrypt.hash(pw, 10),
    role: 'user',
    credits: 120,
  })
  const u2 = await User.create({
    name: 'EcoRahul',
    email: 'rahul@example.com',
    password: await bcrypt.hash(pw, 10),
    role: 'user',
    credits: 140,
  })
  const c1 = await User.create({
    name: 'Zed Collector',
    email: 'collector@example.com',
    password: await bcrypt.hash(pw, 10),
    role: 'collector',
    credits: 50,
  })
  const adminPw = 'admin123'
  const a1 = await User.create({
    name: 'Admin',
    email: 'admin@gmail.com',
    password: await bcrypt.hash(adminPw, 10),
    role: 'admin',
    credits: 500,
  })

  const item1 = await Item.create({
    title: 'Kids Bicycle',
    description: 'Good condition, minor scratches.',
    images: [],
    price: 30,
    seller: u1._id,
    status: 'Available',
    interestedUsers: [u2._id],
  })
  const item2 = await Item.create({
    title: 'Metal Water Bottle',
    description: 'Stainless, like new.',
    images: [],
    price: 10,
    seller: u2._id,
    status: 'Available',
    interestedUsers: [],
  })

  await WasteRequest.create({
    userId: u1._id,
    wasteType: 'plastic',
    quantity: 5,
    location: { lat: 28.6139, lng: 77.209 },
    address: 'Demo Address',
    date: new Date().toISOString().slice(0, 10),
    timeSlot: '10:00-11:00',
    status: 'pending',
  })

  // eslint-disable-next-line no-console
  console.log('Seed complete:')
  // eslint-disable-next-line no-console
  console.log({
    users: [
      { email: u1.email, password: pw },
      { email: u2.email, password: pw },
      { email: c1.email, password: pw },
      { email: a1.email, password: adminPw },
    ],
    items: [item1.title, item2.title],
  })
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exit(1)
  })

