import type { FastifyInstance } from 'fastify'
import { RelatoriosService } from './relatorios.service.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireAdmin, requireModulo } from '../../middlewares/rbac.js'
import { z } from 'zod'

export async function relatoriosRoutes(fastify: FastifyInstance) {
  const service = new RelatoriosService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/dashboard', async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { unidadeId } = request.query as { unidadeId?: string }
    const result = await service.getDashboard(unidadeId ?? user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.get('/evolucao-mensal', { preHandler: [requireAdmin(), requireModulo('RELATORIOS')] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { unidadeId } = request.query as { unidadeId?: string }
    const result = await service.getEvolucaoMensal(unidadeId ?? user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.get('/bairros', { preHandler: [requireAdmin(), requireModulo('RELATORIOS')] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { unidadeId, periodo } = request.query as { unidadeId?: string; periodo?: 'hoje' | 'semana' | 'mes' | 'ano' }
    const result = await service.getFrequenciaBairros(unidadeId ?? user.unidadeId, periodo)
    return reply.send({ data: result })
  })

  fastify.get('/familias-frequentes', { preHandler: [requireAdmin(), requireModulo('RELATORIOS')] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { unidadeId } = request.query as { unidadeId?: string }
    const result = await service.getFamiliasFrequentes(unidadeId ?? user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.get('/distribuicao-semana', async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { unidadeId } = request.query as { unidadeId?: string }
    const result = await service.getDistribuicaoSemana(unidadeId ?? user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.get('/horarios-pico', async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const { unidadeId } = request.query as { unidadeId?: string }
    const result = await service.getHorariosPico(unidadeId ?? user.unidadeId)
    return reply.send({ data: result })
  })

  fastify.get('/', { preHandler: [requireAdmin(), requireModulo('RELATORIOS')] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const query = request.query as {
      periodo?: 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado'
      de?: string
      ate?: string
      bairro?: string
      operadorNome?: string
      status?: string
      search?: string
      unidadeId?: string
    }
    const result = await service.getRelatorio({ ...query, unidadeId: query.unidadeId ?? user.unidadeId })
    return reply.send({ data: result })
  })

  fastify.get('/base-usuarios', { preHandler: [requireAdmin(), requireModulo('RELATORIOS')] }, async (request, reply) => {
    const user = request.user as { unidadeId?: string }
    const query = request.query as {
      periodo?: 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado'
      de?: string
      ate?: string
      bairro?: string
      unidadeId?: string
    }
    const result = await service.getBaseUsuarios({ ...query, unidadeId: query.unidadeId ?? user.unidadeId })
    return reply.send({ data: result })
  })

  fastify.post('/documento', { preHandler: [requireAdmin(), requireModulo('RELATORIOS')] }, async (request, reply) => {
    const user = request.user as { id: string }
    const schema = z.object({
      periodo: z.string(),
      dataInicio: z.string(),
      dataFim: z.string(),
      totalRetiradas: z.number().int().min(0),
      totalQuentinhas: z.number().int().min(0),
      bairro: z.string().optional(),
    })
    const body = schema.parse(request.body)
    const result = await service.gerarDocumento({
      periodo: body.periodo,
      dataInicio: new Date(body.dataInicio),
      dataFim: new Date(body.dataFim),
      totalRetiradas: body.totalRetiradas,
      totalQuentinhas: body.totalQuentinhas,
      bairro: body.bairro,
      geradoPorId: user.id,
    })
    return reply.code(201).send({ data: result })
  })
}
