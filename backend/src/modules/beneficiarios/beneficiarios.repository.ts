import { prisma } from '../../shared/prisma.js'
import type { Prisma } from '@prisma/client'
import type { CreateBeneficiarioInput, ListBeneficiariosInput } from './beneficiarios.schema.js'

export class BeneficiariosRepository {
  async findMany(filters: ListBeneficiariosInput) {
    const { search, status, biometriaStatus, bairro, deficiencia, page, limit } = filters
    const skip = (page - 1) * limit

    const where = {
      deletadoEm: null,
      ...(status && { status }),
      ...(biometriaStatus && { biometriaStatus }),
      ...(bairro && { bairro }),
      ...(deficiencia && { deficiencia: deficiencia === 'true' }),
      ...(search && {
        OR: [
          { nome: { contains: search, mode: 'insensitive' as const } },
          { cpf: { contains: search } },
          { bairro: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [items, total] = await Promise.all([
      prisma.beneficiario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        select: {
          id: true, nome: true, cpf: true, rg: true, nascimento: true, telefone: true,
          endereco: true, numero: true, bairro: true, cidade: true, cep: true,
          status: true, biometriaStatus: true,
          quentinhasAutorizadas: true, pessoasCasa: true, familiaId: true,
          deficiencia: true, qualDeficiencia: true,
          fotoUrl: true, criadoEm: true,
        },
      }),
      prisma.beneficiario.count({ where }),
    ])

    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async findById(id: string) {
    return prisma.beneficiario.findFirst({
      where: { id, deletadoEm: null },
      include: {
        familia: true,
        documentos: true,
        faceData: { select: { id: true, imageUrl: true, confianca: true, criadoEm: true } },
        retiradas: {
          orderBy: { horario: 'desc' },
          take: 20,
          include: { operador: { select: { nome: true } } },
        },
      },
    })
  }

  async findByCpf(cpf: string) {
    return prisma.beneficiario.findFirst({ where: { cpf, deletadoEm: null } })
  }

  async create(data: CreateBeneficiarioInput & { familiaId?: string }) {
    const { nascimento, ...rest } = data
    return prisma.beneficiario.create({
      data: { ...rest, nascimento: new Date(nascimento) },
    })
  }

  async update(id: string, data: Partial<CreateBeneficiarioInput & { status: string; biometriaStatus: string; fotoUrl: string }>) {
    const { nascimento, ...rest } = data
    return prisma.beneficiario.update({
      where: { id },
      data: {
        ...rest,
        ...(nascimento && { nascimento: new Date(nascimento) }),
        atualizadoEm: new Date(),
      } as Prisma.BeneficiarioUncheckedUpdateInput,
    })
  }

  async softDelete(id: string) {
    return prisma.beneficiario.update({
      where: { id },
      data: { deletadoEm: new Date() },
    })
  }

  // Cria uma família nova (agrupamento explícito). Não faz upsert por endereço:
  // o vínculo é opt-in, então cada chamada gera um grupo próprio.
  async createFamilia(data: { endereco: string; numero: string; bairro: string; cidade: string; cep: string }) {
    return prisma.familia.create({ data })
  }

  async countByStatus() {
    return prisma.beneficiario.groupBy({
      by: ['status'],
      where: { deletadoEm: null },
      _count: true,
    })
  }
}
