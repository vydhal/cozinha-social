import type { FastifyInstance } from 'fastify'
import { EquipeService } from './equipe.service.js'
import { createUserSchema, updateUserSchema } from './equipe.schema.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireAdmin, requireSuperAdmin } from '../../middlewares/rbac.js'
import { saveUpload } from '../../shared/utils/upload.js'

export async function equipeRoutes(fastify: FastifyInstance) {
  const service = new EquipeService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/', { preHandler: [requireAdmin()] }, async (_req, reply) => {
    const result = await service.list()
    return reply.send({ data: result })
  })

  fastify.get('/logs', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { limit } = request.query as { limit?: string }
    const result = await service.getActivityLogs(limit ? parseInt(limit) : 20)
    return reply.send({ data: result })
  })

  fastify.get('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.getById(id)
    return reply.send({ data: result })
  })

  fastify.post('/', { preHandler: [requireSuperAdmin()] }, async (request, reply) => {
    const input = createUserSchema.parse(request.body)
    const result = await service.create(input)
    return reply.code(201).send({ data: result })
  })

  fastify.put('/:id', { preHandler: [requireSuperAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const input = updateUserSchema.parse(request.body)
    const result = await service.update(id, input)
    return reply.send({ data: result })
  })

  fastify.patch('/:id/toggle', { preHandler: [requireSuperAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.toggleStatus(id)
    return reply.send({ data: result })
  })

  fastify.delete('/:id', { preHandler: [requireSuperAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.remove(id)
    return reply.code(204).send()
  })

  fastify.post('/:id/avatar', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const file = await request.file()
    if (!file) return reply.code(400).send({ error: 'Arquivo não enviado' })
    const url = await saveUpload(file, 'avatars')
    const result = await service.updateAvatar(id, url)
    return reply.send({ data: result })
  })
}
