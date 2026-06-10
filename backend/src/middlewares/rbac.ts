import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '../shared/errors.js'

type Role = 'SUPERADMIN' | 'ADMIN' | 'COLABORADOR'

const ROLE_HIERARCHY: Record<Role, number> = {
  COLABORADOR: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user as { role: Role }
    const userLevel = ROLE_HIERARCHY[user.role] ?? 0
    const required = Math.min(...roles.map((r) => ROLE_HIERARCHY[r]))
    if (userLevel < required) {
      throw new ForbiddenError('Você não tem permissão para esta ação')
    }
  }
}

export function requireAdmin() {
  return requireRole('ADMIN', 'SUPERADMIN')
}

export function requireSuperAdmin() {
  return requireRole('SUPERADMIN')
}
