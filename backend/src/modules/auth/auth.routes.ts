import type { FastifyInstance } from 'fastify'
import { AuthService } from './auth.service.js'
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.schema.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireSuperAdmin } from '../../middlewares/rbac.js'
import { createAuditLog } from '../../shared/utils/audit.js'
import { prisma } from '../../shared/prisma.js'
import { NotFoundError, AppError } from '../../shared/errors.js'

export async function authRoutes(fastify: FastifyInstance) {
  const service = new AuthService(fastify)

  fastify.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body)
    const result = await service.login(input)
    await createAuditLog({ userId: result.user.id, acao: 'LOGIN', recurso: 'auth', ip: request.ip })
    return reply.code(200).send({ data: result })
  })

  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body)
    const result = await service.refresh(refreshToken)
    return reply.code(200).send({ data: result })
  })

  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body)
    await service.logout(refreshToken)
    return reply.code(204).send()
  })

  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const result = await service.me(user.id)
    return reply.code(200).send({ data: result })
  })

  fastify.patch('/me/senha', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const input = changePasswordSchema.parse(request.body)
    await service.changePassword(user.id, input)
    return reply.code(204).send()
  })

  fastify.post('/impersonate/:userId', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, email: true, role: true, status: true, avatar: true, cargo: true, unidadeId: true },
    })
    if (!target) throw new NotFoundError('Usuário')
    if (target.status !== 'ATIVO') throw new AppError('Usuário inativo', 400)
    const token = fastify.jwt.sign(
      { id: target.id, email: target.email, role: target.role, nome: target.nome },
      { expiresIn: '2h' },
    )
    return reply.send({ data: { token, user: target } })
  })

  fastify.patch('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const result = await service.updateProfile(user.id, request.body as Record<string, unknown>)
    return reply.send({ data: result })
  })

  fastify.post('/me/avatar', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Arquivo não enviado' })
    const { saveUpload } = await import('../../shared/utils/upload.js')
    const url = await saveUpload(data, 'avatars')
    const result = await service.updateAvatar(user.id, url)
    return reply.send({ data: result })
  })
}
