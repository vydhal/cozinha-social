import type { FastifyInstance } from 'fastify'
import { BeneficiariosService } from './beneficiarios.service.js'
import { createBeneficiarioSchema, updateBeneficiarioSchema, listBeneficiariosSchema } from './beneficiarios.schema.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireAdmin, requireModulo } from '../../middlewares/rbac.js'
import { createAuditLog } from '../../shared/utils/audit.js'
import { saveUpload } from '../../shared/utils/upload.js'

export async function beneficiariosRoutes(fastify: FastifyInstance) {
  const service = new BeneficiariosService()

  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireModulo('BENEFICIARIOS'))

  fastify.get('/', async (request, reply) => {
    const filters = listBeneficiariosSchema.parse(request.query)
    const result = await service.list(filters)
    return reply.send({ data: result })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.getById(id)
    return reply.send({ data: result })
  })

  fastify.post('/', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const user = request.user as { id: string; role: string }
    const input = createBeneficiarioSchema.parse(request.body)
    const result = await service.create(input)
    await createAuditLog({ userId: user.id, acao: 'CRIAR_BENEFICIARIO', recurso: 'beneficiarios', recursoId: result.id, ip: request.ip })
    return reply.code(201).send({ data: result })
  })

  fastify.put('/:id', async (request, reply) => {
    const user = request.user as { id: string; role: string }
    const { id } = request.params as { id: string }
    const input = updateBeneficiarioSchema.parse(request.body)
    const result = await service.update(id, input)
    await createAuditLog({ userId: user.id, acao: 'EDITAR_BENEFICIARIO', recurso: 'beneficiarios', recursoId: id, ip: request.ip })
    return reply.send({ data: result })
  })

  fastify.delete('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const user = request.user as { id: string; role: string }
    const { id } = request.params as { id: string }
    await service.remove(id, user.role)
    await createAuditLog({ userId: user.id, acao: 'EXCLUIR_BENEFICIARIO', recurso: 'beneficiarios', recursoId: id, ip: request.ip })
    return reply.code(204).send()
  })

  fastify.post('/:id/foto', async (request, reply) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const file = await request.file()
    if (!file) return reply.code(400).send({ error: 'Arquivo não enviado' })
    const url = await saveUpload(file, 'beneficiarios')
    const result = await service.update(id, { fotoUrl: url })
    await createAuditLog({ userId: user.id, acao: 'UPLOAD_FOTO_BENEFICIARIO', recurso: 'beneficiarios', recursoId: id, ip: request.ip })
    return reply.send({ data: result })
  })

  fastify.post('/:id/biometria', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { imageBase64 } = request.body as { imageBase64: string }
    if (!imageBase64) return reply.code(400).send({ error: 'imageBase64 é obrigatório' })
    const result = await service.registrarBiometria(id, imageBase64)
    await createAuditLog({ userId: user.id, acao: 'REGISTRAR_BIOMETRIA', recurso: 'beneficiarios', recursoId: id, ip: request.ip })
    return reply.send({ data: result })
  })

  // ── Documentos ──────────────────────────────────────────────────────────────

  fastify.get('/:id/documentos', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.listarDocumentos(id)
    return reply.send({ data: result })
  })

  fastify.post('/:id/documentos', async (request, reply) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { tipo } = request.query as { tipo?: string }
    const file = await request.file()
    if (!file) return reply.code(400).send({ error: 'Arquivo não enviado' })
    const result = await service.uploadDocumento(id, file, tipo ?? 'OUTRO')
    await createAuditLog({ userId: user.id, acao: 'UPLOAD_DOCUMENTO', recurso: 'beneficiarios', recursoId: id, ip: request.ip })
    return reply.code(201).send({ data: result })
  })

  fastify.patch('/documentos/:docId/avaliar', async (request, reply) => {
    const user = request.user as { id: string; role: string }
    const { docId } = request.params as { docId: string }
    const { acao, motivo } = request.body as { acao: 'APROVAR' | 'REJEITAR'; motivo?: string }
    if (!['APROVAR', 'REJEITAR'].includes(acao)) return reply.code(400).send({ error: 'Ação inválida' })
    const result = await service.avaliarDocumento(docId, acao, user.id, motivo)
    return reply.send({ data: result })
  })

  fastify.delete('/documentos/:docId', async (request, reply) => {
    const user = request.user as { id: string }
    const { docId } = request.params as { docId: string }
    await service.removerDocumento(docId)
    await createAuditLog({ userId: user.id, acao: 'EXCLUIR_DOCUMENTO', recurso: 'beneficiarios', recursoId: docId, ip: request.ip })
    return reply.code(204).send()
  })

  // ── Família ──────────────────────────────────────────────────────────────────

  fastify.get('/:id/familia-membros', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.getFamiliaMembros(id)
    return reply.send({ data: result })
  })

  fastify.post('/:id/familia-membros', async (request, reply) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { membroId } = request.body as { membroId: string }
    if (!membroId) return reply.code(400).send({ error: 'membroId obrigatório' })
    const result = await service.vincularMembro(id, membroId)
    await createAuditLog({ userId: user.id, acao: 'VINCULAR_MEMBRO_FAMILIA', recurso: 'beneficiarios', recursoId: id, ip: request.ip })
    return reply.send({ data: result })
  })

  fastify.delete('/:id/familia-membros/:membroId', async (request, reply) => {
    const user = request.user as { id: string }
    const { id, membroId } = request.params as { id: string; membroId: string }
    await service.desvincularMembro(id, membroId)
    await createAuditLog({ userId: user.id, acao: 'DESVINCULAR_MEMBRO_FAMILIA', recurso: 'beneficiarios', recursoId: id, ip: request.ip })
    return reply.code(204).send()
  })

  fastify.post('/importar', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const user = request.user as { id: string }
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Arquivo não enviado' })

    const buffer = await data.toBuffer()
    const result = await service.importCsv(buffer, data.filename)
    await createAuditLog({ userId: user.id, acao: 'IMPORTAR_BENEFICIARIOS', recurso: 'beneficiarios', detalhes: { importados: result.importados }, ip: request.ip })
    return reply.code(201).send({ data: result })
  })
}
