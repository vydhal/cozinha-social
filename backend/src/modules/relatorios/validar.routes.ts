import type { FastifyInstance } from 'fastify'
import { RelatoriosService } from './relatorios.service.js'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function validarRoutes(fastify: FastifyInstance) {
  const service = new RelatoriosService()

  // Rota pública — sem autenticação — aceita código de documento (REL-*) ou ID de retirada (UUID)
  fastify.get('/validar/:codigo', async (request, reply) => {
    const { codigo } = request.params as { codigo: string }

    if (!codigo || codigo.length < 3) {
      return reply.code(400).send({ error: 'Código inválido' })
    }

    if (codigo.startsWith('REL-')) {
      const doc = await service.validarDocumento(codigo)
      if (!doc) return reply.code(404).send({ error: 'Documento não encontrado' })
      return reply.send({ data: doc })
    }

    if (!uuidRegex.test(codigo)) {
      return reply.code(400).send({ error: 'Formato de código inválido. Use REL-YYYYMMDD-XXXXX ou o ID da retirada.' })
    }

    const retirada = await service.validarRetirada(codigo)
    if (!retirada) return reply.code(404).send({ error: 'Registro não encontrado' })
    return reply.send({ data: retirada })
  })
}
