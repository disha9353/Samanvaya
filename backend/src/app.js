const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const env = require('./config/env')
const { errorHandler } = require('./middlewares/errorHandler')
const setLanguage = require('./middlewares/language')
const { routes } = require('./routes')

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(setLanguage)

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api', routes)

app.use(errorHandler)

module.exports = { app }

