import { prisma } from '../../shared/prisma.js'
import { comparePassword, hashPassword } from '../../shared/utils/hash.js'
import { UnauthorizedError, NotFoundError, AppError } from '../../shared/errors.js'
import type { FastifyInstance } from 'fastify'
import type { LoginInput, ChangePasswordInput } from './auth.schema.js'
import { randomUUID } from 'crypto'

const REFRESH_EXPIRES_DAYS = 7

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: {
        id: true,
        nome: true,
        email: true,
        senha: true,
        role: true,
        status: true,
        avatar: true,
        cargo: true,
        unidadeId: true,
        modulosPermitidos: true,
      },
    })

    if (!user) throw new UnauthorizedError('Email ou senha inválidos')
    if (user.status !== 'ATIVO') throw new UnauthorizedError('Conta inativa ou bloqueada')

    const valid = await comparePassword(input.senha, user.senha)
    if (!valid) throw new UnauthorizedError('Email ou senha inválidos')

    const payload = { id: user.id, email: user.email, role: user.role, nome: user.nome, modulosPermitidos: user.modulosPermitidos }
    const token = this.fastify.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' })

    const refreshToken = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS)

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    })

    const { senha: _, ...userSafe } = user
    return { user: userSafe, token, refreshToken }
  }

  async refresh(refreshToken: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, nome: true, status: true, modulosPermitidos: true } } },
    })

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } })
      throw new UnauthorizedError('Refresh token inválido ou expirado')
    }

    if (stored.user.status !== 'ATIVO') throw new UnauthorizedError('Conta inativa')

    const payload = { id: stored.user.id, email: stored.user.email, role: stored.user.role, nome: stored.user.nome, modulosPermitidos: stored.user.modulosPermitidos }
    const token = this.fastify.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' })

    return { token }
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { senha: true } })
    if (!user) throw new NotFoundError('Usuário')

    const valid = await comparePassword(input.senhaAtual, user.senha)
    if (!valid) throw new AppError('Senha atual incorreta', 400)

    const hash = await hashPassword(input.novaSenha)
    await prisma.user.update({ where: { id: userId }, data: { senha: hash } })
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, email: true, role: true, avatar: true, cargo: true, telefone: true, unidadeId: true, status: true, modulosPermitidos: true },
    })
    if (!user) throw new NotFoundError('Usuário')
    return user
  }

  async updateProfile(userId: string, data: Record<string, unknown>) {
    const allowed = ['nome', 'telefone', 'cargo']
    const safe: Record<string, unknown> = {}
    for (const key of allowed) {
      if (data[key] !== undefined) safe[key] = data[key]
    }
    return prisma.user.update({
      where: { id: userId },
      data: safe,
      select: { id: true, nome: true, email: true, role: true, avatar: true, cargo: true, telefone: true, unidadeId: true, status: true },
    })
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: { id: true, nome: true, email: true, role: true, avatar: true, cargo: true, unidadeId: true, status: true },
    })
  }
}
