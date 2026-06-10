import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyWebsocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { ZodError } from 'zod'
import { AppError } from './shared/errors.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { beneficiariosRoutes } from './modules/beneficiarios/beneficiarios.routes.js'
import { filaRoutes } from './modules/fila/fila.routes.js'
import { retiradasRoutes } from './modules/retiradas/retiradas.routes.js'
import { relatoriosRoutes } from './modules/relatorios/relatorios.routes.js'
import { equipeRoutes } from './modules/equipe/equipe.routes.js'
import { configuracoesRoutes } from './modules/configuracoes/configuracoes.routes.js'
import { adminRoutes } from './modules/admin/admin.routes.js'
import { validarRoutes } from './modules/relatorios/validar.routes.js'
import { integracaoRoutes } from './modules/integracao/integracao.routes.js'

export async function buildApp() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não definido. Configure a variável de ambiente antes de iniciar em produção.')
  }

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  })

  // Plugins de segurança
  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false })

  await fastify.register(fastifyCors, {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await fastify.register(fastifyRateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW ?? '60000'),
    errorResponseBuilder: () => ({ error: 'Muitas requisições. Aguarde e tente novamente.' }),
  })

  // JWT
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'fallback_secret_change_in_production',
  })

  // Multipart (uploads)
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760') },
  })

  // WebSocket
  await fastify.register(fastifyWebsocket)

  // Servir uploads estáticos
  const uploadDir = process.env.UPLOAD_DIR ?? '/app/uploads'
  const { mkdirSync } = await import('fs')
  mkdirSync(uploadDir, { recursive: true })
  await fastify.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  })

  // Error handler global
  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: 'Dados inválidos',
        details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      })
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.message, code: error.code })
    }
    fastify.log.error(error)
    return reply.code(500).send({ error: 'Erro interno do servidor' })
  })

  // Healthcheck
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }))

  // Rotas
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(beneficiariosRoutes, { prefix: '/api/beneficiarios' })
  await fastify.register(filaRoutes, { prefix: '/api/fila' })
  await fastify.register(retiradasRoutes, { prefix: '/api/retiradas' })
  await fastify.register(relatoriosRoutes, { prefix: '/api/relatorios' })
  await fastify.register(equipeRoutes, { prefix: '/api/equipe' })
  await fastify.register(configuracoesRoutes, { prefix: '/api/configuracoes' })
  await fastify.register(adminRoutes, { prefix: '/api/admin' })
  await fastify.register(validarRoutes, { prefix: '/api' })
  await fastify.register(integracaoRoutes, { prefix: '/api/integracao' })

  return fastify
}
