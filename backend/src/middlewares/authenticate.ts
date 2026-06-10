import type { FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError } from '../shared/errors.js'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado')
  }
}
