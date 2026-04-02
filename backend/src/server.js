const http = require('http')
const swaggerUi = require('swagger-ui-express')
const swaggerJSDoc = require('swagger-jsdoc')

const env = require('./config/env')
const { connectDB } = require('./config/db')
const { app } = require('./app')
const { initSocket } = require('./socket')

async function start() {
  await connectDB(env.MONGODB_URI)

  const openapiDefinition = {
    openapi: '3.0.0',
    info: {
      title: 'EcoBarter+ API',
      version: '1.0.0',
      description: 'Circular economy platform API',
    },
    servers: [{ url: `http://localhost:${env.PORT}` }],
  }

  const swaggerSpec = swaggerJSDoc({
    definition: openapiDefinition,
    apis: ['./src/modules/**/*.js'],
  })

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  const server = http.createServer(app)
  initSocket(server, app)

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`EcoBarter+ API listening on port ${env.PORT}`)
  })
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err)
  process.exit(1)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal}. Shutting down gracefully…`)
  try {
    const { aiCache } = require('./utils/aiCache')
    aiCache.destroy()
  } catch { /* cache may not have been initialised */ }
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
process.once('SIGUSR2', () => shutdown('SIGUSR2'))


