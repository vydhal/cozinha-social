import { prisma } from '../prisma.js'
import type { Prisma } from '@prisma/client'

interface AuditParams {
  userId: string
  acao: string
  recurso: string
  recursoId?: string
  detalhes?: Record<string, unknown>
  ip?: string
}

export async function createAuditLog(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      ...params,
      detalhes: params.detalhes as Prisma.InputJsonValue | undefined,
    },
  })
}
