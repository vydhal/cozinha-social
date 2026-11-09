import type { FastifyInstance } from 'fastify'
import { NotificacoesService } from './notificacoes.service.js'
import { authenticate } from '../../middlewares/authenticate.js'

export async function notificacoesRoutes(fastify: FastifyInstance) {
  const service = new NotificacoesService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request, reply) => {
    const user = request.user as { role: string; modulosPermitidos?: string[] }
    const result = await service.listar(user)
    return reply.send({ data: result })
  })
}
