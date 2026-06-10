import { prisma } from '../../shared/prisma.js'
import { NotFoundError, AppError } from '../../shared/errors.js'
import type { EntrarFilaInput, AcaoFilaInput } from './fila.schema.js'

function gerarSenha(seq: number): string {
  return String(seq).padStart(3, '0')
}

export class FilaService {
  async getFila(unidadeId?: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return prisma.filaEntrada.findMany({
      where: {
        data: today,
        ...(unidadeId && { unidadeId }),
        status: { in: ['AGUARDANDO', 'CHAMADO'] },
      },
      orderBy: { horaEntrada: 'asc' },
      include: { beneficiario: { select: { nome: true, cpf: true, fotoUrl: true } } },
    })
  }

  async getFilaCompleta(unidadeId?: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [fila, stats, config] = await Promise.all([
      prisma.filaEntrada.findMany({
        where: { data: today, ...(unidadeId && { unidadeId }) },
        orderBy: { horaEntrada: 'asc' },
        include: { beneficiario: { select: { nome: true, cpf: true, fotoUrl: true, quentinhasAutorizadas: true } } },
      }),
      prisma.filaEntrada.groupBy({
        by: ['status'],
        where: { data: today, ...(unidadeId && { unidadeId }) },
        _count: true,
      }),
      prisma.configuracao.findFirst({
        where: unidadeId ? { unidadeId } : { unidadeId: null },
        select: { limiteDiario: true },
      }),
    ])

    const countByStatus = Object.fromEntries(stats.map((s) => [s.status, s._count]))
    const tempoMedio = await this.calcularTempoMedio(today, unidadeId)
    const limiteDiario = config?.limiteDiario ?? 100
    const emitidas = fila.length
    const restantes = Math.max(0, limiteDiario - emitidas)

    return {
      fila,
      stats: {
        aguardando: countByStatus.AGUARDANDO ?? 0,
        chamado: countByStatus.CHAMADO ?? 0,
        retirado: countByStatus.RETIRADO ?? 0,
        ausente: countByStatus.AUSENTE ?? 0,
        tempoMedioMin: tempoMedio,
        limiteDiario,
        emitidas,
        restantes,
      },
    }
  }

  async entrar(input: EntrarFilaInput, operadorId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const jaNaFila = await prisma.filaEntrada.findFirst({
      where: {
        beneficiarioId: input.beneficiarioId,
        data: today,
        status: { in: ['AGUARDANDO', 'CHAMADO'] },
      },
    })
    if (jaNaFila) throw new AppError('Beneficiário já está na fila hoje', 409)

    const beneficiario = await prisma.beneficiario.findFirst({
      where: { id: input.beneficiarioId, deletadoEm: null },
    })
    if (!beneficiario) throw new NotFoundError('Beneficiário')

    const [seq, config] = await Promise.all([
      prisma.filaEntrada.count({
        where: { data: today, ...(input.unidadeId && { unidadeId: input.unidadeId }) },
      }),
      prisma.configuracao.findFirst({
        where: input.unidadeId ? { unidadeId: input.unidadeId } : { unidadeId: null },
        select: { limiteDiario: true },
      }),
    ])

    const limiteDiario = config?.limiteDiario ?? 100
    if (seq >= limiteDiario) {
      throw new AppError(`Limite diário de ${limiteDiario} fichas atingido`, 409)
    }

    const senha = gerarSenha(seq + 1)

    return prisma.filaEntrada.create({
      data: {
        senha,
        beneficiarioId: input.beneficiarioId,
        unidadeId: input.unidadeId,
        status: 'AGUARDANDO',
        data: today,
      },
      include: { beneficiario: { select: { nome: true, cpf: true, fotoUrl: true, quentinhasAutorizadas: true } } },
    })
  }

  async executarAcao(id: string, input: AcaoFilaInput, operadorId: string) {
    const entrada = await prisma.filaEntrada.findUnique({ where: { id } })
    if (!entrada) throw new NotFoundError('Entrada na fila')

    const novoStatus = { CHAMAR: 'CHAMADO', CONCLUIR: 'RETIRADO', AUSENTE: 'AUSENTE' }[input.acao] as 'CHAMADO' | 'RETIRADO' | 'AUSENTE'

    const [updated] = await prisma.$transaction([
      prisma.filaEntrada.update({
        where: { id },
        data: {
          status: novoStatus,
          ...(novoStatus === 'CHAMADO' && { horaChamado: new Date() }),
          ...(novoStatus !== 'CHAMADO' && { horaConcluido: new Date() }),
        },
        include: { beneficiario: { select: { nome: true } } },
      }),
      prisma.filaAcao.create({
        data: { filaId: id, operadorId, acao: input.acao },
      }),
    ])

    return updated
  }

  async getPainelPublico(unidadeId?: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [chamados, proximas] = await Promise.all([
      prisma.filaEntrada.findMany({
        where: { data: today, status: 'CHAMADO', ...(unidadeId && { unidadeId }) },
        include: { beneficiario: { select: { nome: true } } },
        orderBy: { horaChamado: 'desc' },
        take: 3,
      }),
      prisma.filaEntrada.findMany({
        where: { data: today, status: 'AGUARDANDO', ...(unidadeId && { unidadeId }) },
        include: { beneficiario: { select: { nome: true } } },
        orderBy: { horaEntrada: 'asc' },
        take: 6,
      }),
    ])

    return { chamados, proximas }
  }

  private async calcularTempoMedio(date: Date, unidadeId?: string): Promise<number> {
    const concluidos = await prisma.filaEntrada.findMany({
      where: {
        data: date,
        status: 'RETIRADO',
        horaChamado: { not: null },
        horaConcluido: { not: null },
        ...(unidadeId && { unidadeId }),
      },
      select: { horaEntrada: true, horaConcluido: true },
      take: 20,
    })

    if (concluidos.length === 0) return 0

    const total = concluidos.reduce((acc, e) => {
      const diff = (e.horaConcluido!.getTime() - e.horaEntrada.getTime()) / 60000
      return acc + diff
    }, 0)

    return Math.round(total / concluidos.length)
  }
}
