import type { FastifyInstance } from 'fastify'
import { RetiradasService } from './retiradas.service.js'
import { confirmarRetiradaSchema, buscarBeneficiarioSchema, validarParamsSchema } from './retiradas.schema.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { createAuditLog } from '../../shared/utils/audit.js'

// ~1.5 MB em base64 (imagem JPEG 640x480 a ~95% de qualidade cabe bem abaixo disso)
const MAX_IMAGE_BASE64_BYTES = 1_500_000

export async function retiradasRoutes(fastify: FastifyInstance) {
  const service = new RetiradasService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/buscar', async (request, reply) => {
    const { q } = buscarBeneficiarioSchema.parse(request.query)
    const result = await service.buscarBeneficiario(q)
    return reply.send({ data: result })
  })

  fastify.get('/validar/:id', async (request, reply) => {
    const { id } = validarParamsSchema.parse(request.params)
    const result = await service.validarBeneficiario(id)
    return reply.send({ data: result })
  })

  fastify.post('/confirmar', async (request, reply) => {
    const user = request.user as { id: string }
    const input = confirmarRetiradaSchema.parse(request.body)
    const result = await service.confirmar(input, user.id)
    await createAuditLog({
      userId: user.id,
      acao: 'CONFIRMAR_RETIRADA',
      recurso: 'retiradas',
      recursoId: result.id,
      detalhes: { beneficiarioId: input.beneficiarioId, quantidade: result.quantidade },
      ip: request.ip,
    })
    return reply.code(201).send({ data: result })
  })

  fastify.get('/lista-diaria', async (request, reply) => {
    const { date, unidadeId } = request.query as { date?: string; unidadeId?: string }
    const result = await service.getListaDiaria(date, unidadeId)
    return reply.send({ data: result })
  })

  fastify.post('/reconhecer', async (request, reply) => {
    const user = request.user as { id: string }
    const { imageBase64 } = request.body as { imageBase64: string }
    if (!imageBase64) return reply.code(400).send({ error: 'imageBase64 é obrigatório' })
    if (imageBase64.length > MAX_IMAGE_BASE64_BYTES)
      return reply.code(413).send({ error: 'Imagem muito grande. Máximo 1,5 MB.' })
    const result = await service.reconhecerFace(imageBase64)
    await createAuditLog({
      userId: user.id,
      acao: 'RECONHECIMENTO_FACIAL',
      recurso: 'retiradas',
      detalhes: { encontrado: result.encontrado, confianca: result.encontrado ? result.confianca : undefined },
      ip: request.ip,
    })
    return reply.send({ data: result })
  })
}
