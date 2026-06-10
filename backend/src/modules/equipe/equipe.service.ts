import { prisma } from '../../shared/prisma.js'
import { hashPassword } from '../../shared/utils/hash.js'
import { NotFoundError, ConflictError } from '../../shared/errors.js'
import type { CreateUserInput, UpdateUserInput } from './equipe.schema.js'

export class EquipeService {
  async list() {
    return prisma.user.findMany({
      where: { deletadoEm: null },
      select: { id: true, nome: true, email: true, role: true, status: true, avatar: true, cargo: true, telefone: true, criadoEm: true },
      orderBy: { nome: 'asc' },
    })
  }

  async getById(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletadoEm: null },
      select: { id: true, nome: true, email: true, role: true, status: true, avatar: true, cargo: true, telefone: true, criadoEm: true },
    })
    if (!user) throw new NotFoundError('Usuário')
    return user
  }

  async create(data: CreateUserInput) {
    const email = data.email.toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictError('Email já cadastrado')

    const senha = await hashPassword(data.senha)
    return prisma.user.create({
      data: { ...data, email, senha },
      select: { id: true, nome: true, email: true, role: true, status: true, cargo: true, criadoEm: true },
    })
  }

  async update(id: string, data: UpdateUserInput) {
    const user = await prisma.user.findFirst({ where: { id, deletadoEm: null } })
    if (!user) throw new NotFoundError('Usuário')
    return prisma.user.update({
      where: { id },
      data: data.email ? { ...data, email: data.email.toLowerCase() } : data,
      select: { id: true, nome: true, email: true, role: true, status: true, cargo: true, atualizadoEm: true },
    })
  }

  async toggleStatus(id: string) {
    const user = await prisma.user.findFirst({ where: { id, deletadoEm: null } })
    if (!user) throw new NotFoundError('Usuário')
    const novoStatus = user.status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
    return prisma.user.update({ where: { id }, data: { status: novoStatus }, select: { id: true, status: true } })
  }

  async remove(id: string) {
    const user = await prisma.user.findFirst({ where: { id, deletadoEm: null } })
    if (!user) throw new NotFoundError('Usuário')
    return prisma.user.update({ where: { id }, data: { deletadoEm: new Date() } })
  }

  async updateAvatar(id: string, avatarUrl: string) {
    const user = await prisma.user.findFirst({ where: { id, deletadoEm: null } })
    if (!user) throw new NotFoundError('Usuário')
    return prisma.user.update({
      where: { id },
      data: { avatar: avatarUrl },
      select: { id: true, nome: true, avatar: true },
    })
  }

  async getActivityLogs(limit = 20) {
    return prisma.auditLog.findMany({
      orderBy: { criadoEm: 'desc' },
      take: limit,
      include: { user: { select: { nome: true, avatar: true } } },
    })
  }
}
