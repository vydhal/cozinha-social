import type { FastifyInstance } from 'fastify'
import { EstoqueService } from './estoque.service.js'
import { createItemSchema, updateItemSchema, listItensSchema, movimentoSchema, listMovimentosSchema } from './estoque.schema.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireModulo } from '../../middlewares/rbac.js'
import { createAuditLog } from '../../shared/utils/audit.js'

export async function estoqueRoutes(fastify: FastifyInstance) {
  const service = new EstoqueService()

  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireModulo('ESTOQUE'))

  fastify.get('/', async (request, reply) => {
    const filters = listItensSchema.parse(request.query)
    const result = await service.list(filters)
    return reply.send({ data: result })
  })

  fastify.get('/alertas', async (request, reply) => {
    const { unidadeId } = request.query as { unidadeId?: string }
    const result = await service.getAlertas(unidadeId)
    return reply.send({ data: result })
  })

  // Rota estática: precisa vir antes de '/:id' para não ser capturada como um :id.
  fastify.get('/movimentos', async (request, reply) => {
    const filters = listMovimentosSchema.parse(request.query)
    const result = await service.getMovimentosGerais(filters)
    return reply.send({ data: result })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.getById(id)
    return reply.send({ data: result })
  })

  fastify.get('/:id/movimentos', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { limit } = request.query as { limit?: string }
    const result = await service.getMovimentos(id, limit ? parseInt(limit) : undefined)
    return reply.send({ data: result })
  })

  fastify.post('/', async (request, reply) => {
    const user = request.user as { id: string }
    const input = createItemSchema.parse(request.body)
    const result = await service.create(input)
    await createAuditLog({
      userId: user.id,
      acao: 'CRIAR_ITEM_ESTOQUE',
      recurso: 'estoque',
      recursoId: result.id,
      detalhes: { nome: result.nome, categoria: result.categoria },
      ip: request.ip,
    })
    return reply.code(201).send({ data: result })
  })

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const input = updateItemSchema.parse(request.body)
    const result = await service.update(id, input)
    return reply.send({ data: result })
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.remove(id)
    return reply.send({ data: result })
  })

  fastify.post('/:id/movimento', async (request, reply) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const input = movimentoSchema.parse(request.body)
    const result = await service.registrarMovimento(id, input, user.id)
    await createAuditLog({
      userId: user.id,
      acao: 'MOVIMENTO_ESTOQUE',
      recurso: 'estoque',
      recursoId: id,
      detalhes: { tipo: input.tipo, quantidade: input.quantidade, motivo: input.motivo },
      ip: request.ip,
    })
    return reply.code(201).send({ data: result })
  })
}
