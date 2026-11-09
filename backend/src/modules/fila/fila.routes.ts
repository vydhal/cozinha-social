import type { FastifyInstance } from 'fastify'
import { FilaService } from './fila.service.js'
import { entrarFilaSchema, acaoFilaSchema } from './fila.schema.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireModulo } from '../../middlewares/rbac.js'

interface WsClient { readyState: number; send(data: string): void }
const wsClients = new Set<WsClient>()

export function broadcastFilaUpdate(data: unknown) {
  const msg = JSON.stringify({ type: 'FILA_UPDATE', data })
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(msg)
  }
}

export async function filaRoutes(fastify: FastifyInstance) {
  const service = new FilaService()

  // Painel público — sem autenticação
  fastify.get('/painel', async (request, reply) => {
    const { unidadeId } = request.query as { unidadeId?: string }
    const result = await service.getPainelPublico(unidadeId)
    return reply.send({ data: result })
  })

  // WebSocket — painel em tempo real
  fastify.get('/ws', { websocket: true }, (socket) => {
    wsClients.add(socket)
    socket.on('close', () => wsClients.delete(socket))
    socket.send(JSON.stringify({ type: 'CONNECTED', message: 'Conectado ao painel em tempo real' }))
  })

  // Rotas protegidas
  fastify.register(async (app) => {
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', requireModulo('FILA'))

    app.get('/', async (request, reply) => {
      const user = request.user as { unidadeId?: string }
      const { unidadeId } = request.query as { unidadeId?: string }
      const result = await service.getFilaCompleta(unidadeId ?? user.unidadeId)
      return reply.send({ data: result })
    })

    app.post('/', async (request, reply) => {
      const user = request.user as { id: string; unidadeId?: string }
      const input = entrarFilaSchema.parse(request.body)
      const result = await service.entrar(input, user.id)
      broadcastFilaUpdate(await service.getPainelPublico(input.unidadeId))
      return reply.code(201).send({ data: result })
    })

    app.patch('/:id', async (request, reply) => {
      const user = request.user as { id: string }
      const { id } = request.params as { id: string }
      const input = acaoFilaSchema.parse(request.body)
      const result = await service.executarAcao(id, input, user.id)
      broadcastFilaUpdate(await service.getPainelPublico())
      return reply.send({ data: result })
    })
  })
}
