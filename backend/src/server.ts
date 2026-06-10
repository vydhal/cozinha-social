import { buildApp } from './app.js'
import { prisma } from './shared/prisma.js'

const PORT = parseInt(process.env.PORT ?? '3001')
const HOST = process.env.HOST ?? '0.0.0.0'

async function start() {
  const app = await buildApp()

  try {
    await prisma.$connect()
    app.log.info('Banco de dados conectado')

    await app.listen({ port: PORT, host: HOST })
    app.log.info(`Servidor rodando em http://${HOST}:${PORT}`)
  } catch (err) {
    app.log.error(err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

process.on('SIGTERM', async () => {
  console.error('[SIGTERM] Recebido — encerrando processo com código 1')
  await prisma.$disconnect()
  process.exit(1)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
  process.exit(1)
})

start()
