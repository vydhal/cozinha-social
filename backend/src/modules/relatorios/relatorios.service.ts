import { prisma } from '../../shared/prisma.js'
import type { RetiradaStatus, Prisma } from '@prisma/client'
import { startOfMonth, endOfMonth, subMonths, format, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays } from 'date-fns'

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado'

function buildDateRange(periodo: Periodo, de?: string, ate?: string) {
  const now = new Date()
  if (periodo === 'personalizado' && de && ate) {
    return { gte: startOfDay(new Date(de)), lte: endOfDay(new Date(ate)) }
  }
  switch (periodo) {
    case 'hoje': return { gte: startOfDay(now), lte: endOfDay(now) }
    case 'semana': return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'mes': return { gte: startOfMonth(now), lte: endOfMonth(now) }
    case 'ano': return { gte: new Date(now.getFullYear(), 0, 1), lte: new Date(now.getFullYear(), 11, 31) }
    default: return { gte: startOfMonth(now), lte: endOfMonth(now) }
  }
}

export class RelatoriosService {
  async getDashboard(unidadeId?: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const config = await prisma.configuracao.findFirst({
      where: unidadeId ? { unidadeId } : {},
    })
    const limiteDiario = config?.limiteDiario ?? 100

    const [entreguesHoje, filaHoje, totalBeneficiarios, familiasHoje, semana, duplicados, semBiometria, comBiometria] = await Promise.all([
      prisma.retirada.aggregate({
        where: { data: today, status: 'ENTREGUE', ...(unidadeId && { unidadeId }) },
        _count: true, _sum: { quantidade: true },
      }),
      prisma.filaEntrada.count({
        where: { data: today, status: { in: ['AGUARDANDO', 'CHAMADO'] }, ...(unidadeId && { unidadeId }) },
      }),
      prisma.beneficiario.count({ where: { deletadoEm: null, status: 'ATIVO' } }),
      prisma.retirada.groupBy({
        by: ['familiaId'],
        where: { data: today, status: 'ENTREGUE', ...(unidadeId && { unidadeId }) },
      }),
      prisma.retirada.aggregate({
        where: {
          data: { gte: startOfWeek(new Date(), { weekStartsOn: 1 }), lte: new Date() },
          status: 'ENTREGUE',
          ...(unidadeId && { unidadeId }),
        },
        _count: true,
        _sum: { quantidade: true },
      }),
      prisma.retirada.count({
        where: { data: today, status: 'DUPLICADO_BLOQUEADO', ...(unidadeId && { unidadeId }) },
      }),
      prisma.beneficiario.count({
        where: { deletadoEm: null, biometriaStatus: 'PENDENTE' },
      }),
      prisma.beneficiario.count({
        where: { deletadoEm: null, biometriaStatus: 'VERIFICADA' },
      }),
    ])

    const diasSemana = semana._count > 0 ? 7 : 1
    const mediaSemanal = Math.round((semana._sum.quantidade ?? 0) / diasSemana)
    const comparecimento = entreguesHoje._count > 0 && totalBeneficiarios > 0
      ? Math.round((entreguesHoje._count / totalBeneficiarios) * 100)
      : 0

    return {
      disponiveisHoje: limiteDiario - (entreguesHoje._sum.quantidade ?? 0),
      entreguesHoje: entreguesHoje._count,
      quentinhasHoje: entreguesHoje._sum.quantidade ?? 0,
      filaVirtual: filaHoje,
      familiasAtendidas: familiasHoje.length,
      mediaSemanal,
      comparecimento,
      tentativasDuplicadas: duplicados,
      cadastrosIncompletos: semBiometria,
      cadastrosCompletos: comBiometria,
      limiteDiario,
    }
  }

  async getEvolucaoMensal(unidadeId?: string) {
    const meses = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), 11 - i))

    const dados = await Promise.all(
      meses.map(async (mes) => {
        const agg = await prisma.retirada.aggregate({
          where: {
            data: { gte: startOfMonth(mes), lte: endOfMonth(mes) },
            status: 'ENTREGUE',
            ...(unidadeId && { unidadeId }),
          },
          _count: true,
          _sum: { quantidade: true },
        })
        return {
          mes: format(mes, 'MMM', { locale: undefined }),
          total: agg._count,
          quentinhas: agg._sum.quantidade ?? 0,
        }
      }),
    )

    return dados
  }

  async getFrequenciaBairros(unidadeId?: string, periodo: Periodo = 'mes') {
    const dateRange = buildDateRange(periodo)

    const retiradas = await prisma.retirada.findMany({
      where: { data: dateRange, status: 'ENTREGUE', ...(unidadeId && { unidadeId }) },
      include: { beneficiario: { select: { bairro: true } } },
    })

    const bairroMap = new Map<string, { familias: Set<string>; total: number }>()
    for (const r of retiradas) {
      const bairro = r.beneficiario.bairro
      if (!bairroMap.has(bairro)) bairroMap.set(bairro, { familias: new Set(), total: 0 })
      const entry = bairroMap.get(bairro)!
      if (r.familiaId) entry.familias.add(r.familiaId)
      entry.total++
    }

    return Array.from(bairroMap.entries())
      .map(([bairro, d]) => ({ bairro, familias: d.familias.size, total: d.total }))
      .sort((a, b) => b.familias - a.familias)
  }

  async getFamiliasFrequentes(unidadeId?: string, limit = 5) {
    const startDate = startOfMonth(new Date())

    const retiradas = await prisma.retirada.groupBy({
      by: ['familiaId'],
      where: {
        data: { gte: startDate },
        status: 'ENTREGUE',
        familiaId: { not: null },
        ...(unidadeId && { unidadeId }),
      },
      _count: true,
      orderBy: { _count: { familiaId: 'desc' } },
      take: limit,
    })

    const familias = await Promise.all(
      retiradas.map(async (r) => {
        const membros = await prisma.beneficiario.findMany({
          where: { familiaId: r.familiaId!, deletadoEm: null },
          select: { nome: true },
          take: 1,
        })
        return { familiaId: r.familiaId, nome: membros[0]?.nome ?? 'Família', retiradas: r._count }
      }),
    )

    return familias
  }

  async getDistribuicaoSemana(unidadeId?: string) {
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const days = Array.from({ length: 7 }, (_, i) => subDays(startOfDay(new Date()), 6 - i))

    return Promise.all(
      days.map(async (day) => {
        const [entregues, ausentes] = await Promise.all([
          prisma.retirada.count({ where: { data: day, status: 'ENTREGUE', ...(unidadeId && { unidadeId }) } }),
          prisma.retirada.count({ where: { data: day, status: 'AUSENTE', ...(unidadeId && { unidadeId }) } }),
        ])
        return { dia: nomes[day.getDay()], entregues, ausentes }
      })
    )
  }

  async getHorariosPico(unidadeId?: string) {
    const today = startOfDay(new Date())
    const retiradas = await prisma.retirada.findMany({
      where: { data: today, status: 'ENTREGUE', ...(unidadeId && { unidadeId }) },
      select: { horario: true },
    })

    const map = new Map<number, number>()
    for (const r of retiradas) {
      const h = new Date(r.horario).getHours()
      map.set(h, (map.get(h) ?? 0) + 1)
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([h, qtd]) => ({ hora: `${h}h`, qtd }))
  }

  async getRelatorio(filters: { periodo?: Periodo; de?: string; ate?: string; bairro?: string; operadorNome?: string; status?: string; search?: string; unidadeId?: string }) {
    const { periodo = 'mes', de, ate, bairro, status, search, unidadeId } = filters
    const dateRange = buildDateRange(periodo, de, ate)

    const where: Prisma.RetiradaWhereInput = {
      data: dateRange,
      ...(status && { status: status as RetiradaStatus }),
      ...(unidadeId && { unidadeId }),
      ...(bairro && { beneficiario: { bairro } }),
      ...(search && { beneficiario: { nome: { contains: search, mode: 'insensitive' as const } } }),
    }

    const [retiradas, stats, bairros, frequentes] = await Promise.all([
      prisma.retirada.findMany({
        where,
        orderBy: { horario: 'desc' },
        take: 100,
        include: {
          beneficiario: { select: { nome: true, cpf: true, bairro: true } },
          operador: { select: { nome: true } },
        },
      }),
      prisma.retirada.aggregate({ where, _count: true, _sum: { quantidade: true } }),
      this.getFrequenciaBairros(unidadeId, periodo),
      this.getFamiliasFrequentes(unidadeId),
    ])

    const ausentes = await prisma.filaEntrada.count({ where: { data: dateRange, status: 'AUSENTE', ...(unidadeId && { unidadeId }) } })

    const config = await prisma.configuracao.findFirst({ where: unidadeId ? { unidadeId } : {} })
    const limiteDiario = config?.limiteDiario ?? 100
    let diasPeriodo: number
    if (periodo === 'personalizado' && de && ate) {
      diasPeriodo = Math.max(1, Math.round((new Date(ate).getTime() - new Date(de).getTime()) / 86400000) + 1)
    } else {
      diasPeriodo = periodo === 'hoje' ? 1 : periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : 365
    }
    const statsCount = stats._count as number
    const taxa = Math.min(100, Math.round((statsCount / (limiteDiario * diasPeriodo)) * 100))

    return {
      retiradas,
      stats: {
        total: statsCount,
        quentinhas: stats._sum?.quantidade ?? 0,
        mediadiaria: Math.round(statsCount / diasPeriodo),
        familias: retiradas.filter((r, i, arr) => arr.findIndex((x) => x.familiaId === r.familiaId) === i).length,
        ausencias: ausentes,
        taxa,
      },
      charts: { bairros, frequentes },
    }
  }

  async gerarDocumento(params: {
    periodo: string
    dataInicio: Date
    dataFim: Date
    totalRetiradas: number
    totalQuentinhas: number
    bairro?: string
    geradoPorId: string
  }) {
    const date = new Date()
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()
    const codigo = `REL-${dateStr}-${randomPart}`

    const doc = await (prisma as any).documentoRelatorio.create({
      data: {
        codigo,
        periodo: params.periodo,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        totalRetiradas: params.totalRetiradas,
        totalQuentinhas: params.totalQuentinhas,
        bairro: params.bairro ?? null,
        geradoPorId: params.geradoPorId,
      },
    })

    return { id: doc.id, codigo: doc.codigo }
  }

  async validarDocumento(codigo: string) {
    const doc = await (prisma as any).documentoRelatorio.findUnique({
      where: { codigo },
      include: { geradoPor: { select: { nome: true } } },
    })

    if (!doc) return null

    return {
      tipo: 'documento' as const,
      codigo: doc.codigo,
      periodo: doc.periodo,
      dataInicio: doc.dataInicio,
      dataFim: doc.dataFim,
      totalRetiradas: doc.totalRetiradas,
      totalQuentinhas: doc.totalQuentinhas,
      bairro: doc.bairro,
      geradoPor: doc.geradoPor.nome,
      geradoEm: doc.geradoEm,
    }
  }

  async validarRetirada(id: string) {
    const retirada = await prisma.retirada.findUnique({
      where: { id },
      include: {
        beneficiario: { select: { nome: true, cpf: true, bairro: true, fotoUrl: true } },
        operador: { select: { nome: true } },
      },
    })

    if (!retirada) return null

    return {
      tipo: 'retirada' as const,
      id: retirada.id,
      beneficiario: {
        nome: retirada.beneficiario.nome,
        cpf: retirada.beneficiario.cpf,
        bairro: retirada.beneficiario.bairro,
        fotoUrl: retirada.beneficiario.fotoUrl,
      },
      quantidade: retirada.quantidade,
      metodoRetirada: (retirada as any).metodoRetirada ?? 'MANUAL',
      status: retirada.status,
      data: retirada.data,
      horario: retirada.horario,
      operador: retirada.operador.nome,
    }
  }
}
