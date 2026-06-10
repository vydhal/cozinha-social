import { prisma } from '../../shared/prisma.js'
import { NotFoundError } from '../../shared/errors.js'
import { z } from 'zod'

export const createUnidadeSchema = z.object({
  nome: z.string().min(2),
  cidade: z.string().min(2),
  bairro: z.string().optional(),
  endereco: z.string().optional(),
  cotaDiaria: z.number().int().min(1).default(100),
})

export const updateUnidadeSchema = createUnidadeSchema.partial().extend({
  status: z.enum(['ATIVA', 'PAUSADA', 'DESATIVADA']).optional(),
})

export class AdminService {
  async getUnidades() {
    return prisma.unidade.findMany({
      where: { deletadoEm: null },
      include: {
        _count: { select: { beneficiarios: true, usuarios: true } },
        configuracao: { select: { limiteDiario: true } },
      },
      orderBy: { nome: 'asc' },
    })
  }

  async createUnidade(data: z.infer<typeof createUnidadeSchema>) {
    return prisma.unidade.create({ data })
  }

  async updateUnidade(id: string, data: z.infer<typeof updateUnidadeSchema>) {
    const unidade = await prisma.unidade.findFirst({ where: { id, deletadoEm: null } })
    if (!unidade) throw new NotFoundError('Unidade')
    return prisma.unidade.update({ where: { id }, data })
  }

  async deleteUnidade(id: string) {
    const unidade = await prisma.unidade.findFirst({ where: { id, deletadoEm: null } })
    if (!unidade) throw new NotFoundError('Unidade')
    return prisma.unidade.update({ where: { id }, data: { deletadoEm: new Date(), status: 'DESATIVADA' } })
  }

  async getStats() {
    const [totalUnidades, totalBeneficiarios, totalRetiradas, totalUsuarios] = await Promise.all([
      prisma.unidade.count({ where: { deletadoEm: null } }),
      prisma.beneficiario.count({ where: { deletadoEm: null } }),
      prisma.retirada.count({ where: { status: 'ENTREGUE' } }),
      prisma.user.count({ where: { deletadoEm: null } }),
    ])

    return { totalUnidades, totalBeneficiarios, totalRetiradas, totalUsuarios }
  }
}
