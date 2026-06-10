import type { FastifyInstance } from 'fastify'
import { ConfiguracoesService, updateConfigSchema } from './configuracoes.service.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireSuperAdmin, requireAdmin } from '../../middlewares/rbac.js'
import { saveUpload } from '../../shared/utils/upload.js'
import { z } from 'zod'

export async function configuracoesRoutes(fastify: FastifyInstance) {
  const service = new ConfiguracoesService()

  // Público — verifica se o link de auto-cadastro está ativo
  fastify.get('/cadastro-publico/status', async (request, reply) => {
    const { token } = request.query as { token?: string }
    if (!token) return reply.code(400).send({ error: 'Token obrigatório' })
    const { prisma: db } = await import('../../shared/prisma.js')
    const config = await db.configuracao.findFirst({
      where: { cadastroPublicoToken: token, cadastroPublicoAtivo: true },
    })
    return reply.send({ data: { ativo: !!config } })
  })

  // Público — submissão do auto-cadastro
  fastify.post('/cadastro-publico', async (request, reply) => {
    const { token } = request.query as { token?: string }
    if (!token) return reply.code(400).send({ error: 'Token obrigatório' })
    try {
      const body = request.body as Record<string, unknown>
      const result = await service.registrarPublico(token, body)
      return reply.code(201).send({ data: result })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message ?? 'Erro ao cadastrar' })
    }
  })

  // Público — usado na tela de login (sem auth)
  fastify.get('/public', async (_req, reply) => {
    const config = await service.get()
    return reply.send({ data: {
      nomeCozinha: config.nomeCozinha,
      logoUrl: config.logoUrl ?? null,
      faviconUrl: config.faviconUrl ?? null,
      corPrimaria: config.corPrimaria,
    }})
  })

  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const result = await service.get(user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.put('/', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const data = updateConfigSchema.parse(request.body)
    const result = await service.update(data, user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.get('/bairros', { preHandler: [authenticate] }, async (_req, reply) => {
    const result = await service.getBairros()
    return reply.send({ data: result })
  })

  fastify.post('/bairros', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const { nome } = z.object({ nome: z.string().min(2) }).parse(request.body)
    const result = await service.addBairro(nome)
    return reply.code(201).send({ data: result })
  })

  fastify.delete('/bairros/:id', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.removeBairro(id)
    return reply.code(204).send()
  })

  fastify.post('/logo', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const file = await request.file()
    if (!file) return reply.code(400).send({ error: 'Arquivo não enviado' })
    const url = await saveUpload(file, 'logos')
    const result = await service.updateField('logoUrl', url, user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.post('/favicon', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const file = await request.file()
    if (!file) return reply.code(400).send({ error: 'Arquivo não enviado' })
    const url = await saveUpload(file, 'favicons')
    const result = await service.updateField('faviconUrl', url, user.unidadeId)
    return reply.send({ data: result })
  })

  // Superadmin — gerencia link de auto-cadastro
  fastify.get('/cadastro-publico', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const result = await service.getCadastroPublico(user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.put('/cadastro-publico', { preHandler: [authenticate, requireSuperAdmin()] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { ativo } = z.object({ ativo: z.boolean() }).parse(request.body)
    const result = await service.toggleCadastroPublico(ativo, user.unidadeId)
    return reply.send({ data: { ativo: result.cadastroPublicoAtivo, token: result.cadastroPublicoToken } })
  })

  fastify.patch('/limite-diario', { preHandler: [authenticate, requireAdmin()] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { limiteDiario } = z.object({ limiteDiario: z.number().int().min(1, 'Mínimo 1').max(9999) }).parse(request.body)
    const result = await service.update({ limiteDiario }, user.unidadeId)
    return reply.send({ data: result })
  })
}
