import type { FastifyInstance } from 'fastify'
import { AdminService, createUnidadeSchema, updateUnidadeSchema } from './admin.service.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireSuperAdmin } from '../../middlewares/rbac.js'

export async function adminRoutes(fastify: FastifyInstance) {
  const service = new AdminService()

  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireSuperAdmin())

  fastify.get('/stats', async (_req, reply) => {
    const result = await service.getStats()
    return reply.send({ data: result })
  })

  fastify.get('/unidades', async (_req, reply) => {
    const result = await service.getUnidades()
    return reply.send({ data: result })
  })

  fastify.post('/unidades', async (request, reply) => {
    const input = createUnidadeSchema.parse(request.body)
    const result = await service.createUnidade(input)
    return reply.code(201).send({ data: result })
  })

  fastify.put('/unidades/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const input = updateUnidadeSchema.parse(request.body)
    const result = await service.updateUnidade(id, input)
    return reply.send({ data: result })
  })

  fastify.delete('/unidades/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.deleteUnidade(id)
    return reply.code(204).send()
  })
}
