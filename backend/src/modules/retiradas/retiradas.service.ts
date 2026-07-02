import { Prisma } from '@prisma/client'
import { prisma } from '../../shared/prisma.js'
import { NotFoundError, AppError } from '../../shared/errors.js'
import type { ConfirmarRetiradaInput } from './retiradas.schema.js'

export class RetiradasService {
  async buscarBeneficiario(q: string) {
    // Tenta criar a extensão unaccent para busca sem sensibilidade a acentos
    try { await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS unaccent` } catch { /* sem permissão, cai no fallback */ }

    try {
      type Row = { id: string; nome: string; cpf: string; bairro: string; fotoUrl: string | null; quentinhasAutorizadas: number; pessoasCasa: number; familiaId: string | null; biometriaStatus: string; status: string }
      const pattern = `%${q}%`
      return await prisma.$queryRaw<Row[]>`
        SELECT id, nome, cpf, bairro, "fotoUrl", "quentinhasAutorizadas",
               "pessoasCasa", "familiaId", "biometriaStatus", status
        FROM beneficiarios
        WHERE "deletadoEm" IS NULL
          AND (
            unaccent(lower(nome)) LIKE unaccent(lower(${pattern}))
            OR cpf LIKE ${pattern}
          )
        ORDER BY nome
        LIMIT 10
      `
    } catch {
      // fallback: busca normal sem unaccent (case-insensitive)
      return prisma.beneficiario.findMany({
        where: {
          deletadoEm: null,
          OR: [
            { nome: { contains: q, mode: 'insensitive' } },
            { cpf: { contains: q } },
          ],
        },
        select: {
          id: true, nome: true, cpf: true, bairro: true, fotoUrl: true,
          quentinhasAutorizadas: true, pessoasCasa: true, familiaId: true,
          biometriaStatus: true, status: true,
        },
        take: 10,
      })
    }
  }

  async validarBeneficiario(beneficiarioId: string, dataParam?: string) {
    const today = dataParam ? new Date(dataParam + 'T00:00:00') : new Date()
    today.setHours(0, 0, 0, 0)

    const beneficiario = await prisma.beneficiario.findFirst({
      where: { id: beneficiarioId, deletadoEm: null },
      select: {
        id: true, nome: true, cpf: true, bairro: true, status: true,
        quentinhasAutorizadas: true, pessoasCasa: true, familiaId: true,
        fotoUrl: true, biometriaStatus: true,
      },
    })

    if (!beneficiario) throw new NotFoundError('Beneficiário')
    if (beneficiario.status !== 'ATIVO') throw new AppError('Beneficiário inativo ou bloqueado', 422)

    const [jaRetirou, familiaJaRetirou, familiaInfo, ultimaRetirada] = await Promise.all([
      prisma.retirada.findFirst({ where: { beneficiarioId, status: 'ENTREGUE', data: today } }),
      beneficiario.familiaId
        ? prisma.retirada.findFirst({
            where: {
              familiaId: beneficiario.familiaId,
              status: 'ENTREGUE',
              data: today,
              beneficiarioId: { not: beneficiarioId },
            },
            include: { beneficiario: { select: { nome: true } } },
          })
        : null,
      beneficiario.familiaId
        ? prisma.beneficiario.aggregate({
            where: { familiaId: beneficiario.familiaId, deletadoEm: null, status: 'ATIVO' },
            _sum: { quentinhasAutorizadas: true },
            _count: true,
          })
        : null,
      prisma.retirada.findFirst({
        where: { beneficiarioId, status: 'ENTREGUE' },
        orderBy: { horario: 'desc' },
        select: { data: true, horario: true },
      }),
    ])

    const quantidadeFamilia = familiaInfo?._sum.quentinhasAutorizadas ?? beneficiario.quentinhasAutorizadas
    const membrosFamilia = familiaInfo?._count ?? 1

    return {
      beneficiario,
      validacoes: {
        jaRetirou: !!jaRetirou,
        familiaJaRetirou: familiaJaRetirou ? familiaJaRetirou.beneficiario.nome : null,
        podeRetirar: !jaRetirou && !familiaJaRetirou,
        quantidadeFamilia,
        membrosFamilia,
      },
      ultimaRetirada,
    }
  }

  async confirmar(input: ConfirmarRetiradaInput, operadorId: string) {
    const today = input.data ? new Date(input.data + 'T00:00:00') : new Date()
    today.setHours(0, 0, 0, 0)

    // Quando retroativo, horario = data informada + hora atual (preserva ordem cronológica do dia)
    const horario = input.data
      ? (() => {
          const now = new Date()
          const d = new Date(input.data + 'T00:00:00')
          d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
          return d
        })()
      : new Date()

    const beneficiario = await prisma.beneficiario.findFirst({
      where: { id: input.beneficiarioId, deletadoEm: null },
    })
    if (!beneficiario) throw new NotFoundError('Beneficiário')
    if (beneficiario.status !== 'ATIVO') throw new AppError('Beneficiário inativo ou bloqueado', 422)

    // Calcula cota e limite fora da transação (dados estáticos)
    const [familiaAgg, config] = await Promise.all([
      beneficiario.familiaId
        ? prisma.beneficiario.aggregate({
            where: { familiaId: beneficiario.familiaId, deletadoEm: null, status: 'ATIVO' },
            _sum: { quentinhasAutorizadas: true },
          })
        : null,
      prisma.configuracao.findFirst({
        where: input.unidadeId ? { unidadeId: input.unidadeId } : {},
      }),
    ])
    const quantidade = familiaAgg?._sum.quentinhasAutorizadas ?? beneficiario.quentinhasAutorizadas
    const limiteDiario = config?.limiteDiario ?? 100

    // Seção crítica: checagens de duplicata + limite + criação em transação serializable
    // Isso impede race condition onde duas requisições simultâneas ultrapassam a cota
    try {
      const retirada = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const [jaRetirou, familiaJaRetirou, totalHoje] = await Promise.all([
            tx.retirada.findFirst({
              where: { beneficiarioId: input.beneficiarioId, status: 'ENTREGUE', data: today },
            }),
            beneficiario.familiaId
              ? tx.retirada.findFirst({
                  where: {
                    familiaId: beneficiario.familiaId,
                    status: 'ENTREGUE',
                    data: today,
                    beneficiarioId: { not: input.beneficiarioId },
                  },
                  include: { beneficiario: { select: { nome: true } } },
                })
              : null,
            tx.retirada.aggregate({
              where: {
                data: today,
                status: 'ENTREGUE',
                ...(input.unidadeId && { unidadeId: input.unidadeId }),
              },
              _sum: { quantidade: true },
            }),
          ])

          if (jaRetirou)
            throw new AppError('Beneficiário já realizou retirada hoje', 409, 'DUPLICADO_BLOQUEADO')

          if (familiaJaRetirou)
            throw new AppError(
              `Família já atendida hoje. ${familiaJaRetirou.beneficiario.nome} já retirou as quentinhas da família.`,
              409,
              'FAMILIA_JA_RETIROU',
            )

          if ((totalHoje._sum.quantidade ?? 0) + quantidade > limiteDiario)
            throw new AppError('Limite diário de quentinhas atingido', 422, 'LIMITE_DIARIO')

          return tx.retirada.create({
            data: {
              beneficiarioId: input.beneficiarioId,
              familiaId: beneficiario.familiaId,
              operadorId,
              quantidade,
              status: 'ENTREGUE',
              metodoRetirada: (input.metodoRetirada ?? 'MANUAL') as any,
              unidadeId: input.unidadeId,
              observacao: input.observacao,
              data: today,
              horario,
            },
            include: {
              beneficiario: { select: { nome: true, cpf: true, bairro: true } },
              operador: { select: { nome: true } },
            },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      return retirada
    } catch (err) {
      // Se foi bloqueio de duplicata, registra a tentativa fora da transação (que já foi revertida)
      if (
        err instanceof AppError &&
        (err.code === 'DUPLICADO_BLOQUEADO' || err.code === 'FAMILIA_JA_RETIROU')
      ) {
        await prisma.retirada.create({
          data: {
            beneficiarioId: input.beneficiarioId,
            familiaId: beneficiario.familiaId,
            operadorId,
            quantidade: 0,
            status: 'DUPLICADO_BLOQUEADO',
            unidadeId: input.unidadeId,
            observacao: err.message,
            data: today,
            horario,
          },
        })
      }
      throw err
    }
  }

  async deletarRetirada(id: string) {
    const retirada = await prisma.retirada.findUnique({ where: { id } })
    if (!retirada) throw new NotFoundError('Retirada')
    await prisma.retirada.delete({ where: { id } })
    return { id }
  }

  async reconhecerFace(imageBase64: string) {
    const faceServiceUrl = process.env.FACE_SERVICE_URL ?? 'http://face-service:8000'

    const faces = await prisma.biometricFace.findMany({
      select: { beneficiarioId: true, embedding: true }
    })

    if (faces.length === 0) {
      return { encontrado: false, motivo: 'sem_biometria' } as const
    }

    const embeddings = faces.map((f: { beneficiarioId: string; embedding: Buffer }) => ({
      beneficiario_id: f.beneficiarioId,
      embedding_base64: Buffer.from(f.embedding).toString('base64'),
    }))

    let faceRes: Response
    try {
      faceRes = await fetch(`${faceServiceUrl}/face/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64, embeddings, threshold: 0.6 }),
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      throw new AppError('Serviço de reconhecimento indisponível', 503)
    }

    if (!faceRes.ok) {
      throw new AppError('Erro no serviço de reconhecimento facial', 503)
    }

    const result = await faceRes.json() as { encontrado: boolean; beneficiario_id?: string; confianca?: number; motivo?: string }

    if (!result.encontrado || !result.beneficiario_id) {
      return { encontrado: false as const, motivo: result.motivo ?? 'face_nao_encontrada', confianca: result.confianca }
    }

    const validacao = await this.validarBeneficiario(result.beneficiario_id)

    return {
      encontrado: true as const,
      beneficiario: validacao.beneficiario,
      validacoes: validacao.validacoes,
      ultimaRetirada: validacao.ultimaRetirada,
      confianca: result.confianca ?? 0,
    }
  }

  async getListaDiaria(date?: string, unidadeId?: string) {
    const targetDate = date ? new Date(date) : new Date()
    targetDate.setHours(0, 0, 0, 0)

    const [retiradas, stats, config] = await Promise.all([
      prisma.retirada.findMany({
        where: { data: targetDate, ...(unidadeId && { unidadeId }) },
        orderBy: { horario: 'asc' },
        include: {
          beneficiario: { select: { nome: true, cpf: true, bairro: true } },
          operador: { select: { nome: true } },
        },
      }),
      prisma.retirada.groupBy({
        by: ['status'],
        where: { data: targetDate, ...(unidadeId && { unidadeId }) },
        _count: true,
        _sum: { quantidade: true },
      }),
      prisma.configuracao.findFirst({ where: unidadeId ? { unidadeId } : {} }),
    ])

    const countByStatus = Object.fromEntries(stats.map((s) => [s.status, { count: s._count, total: s._sum.quantidade ?? 0 }]))
    const limiteDiario = config?.limiteDiario ?? 100
    const totalQuentinhas = countByStatus.ENTREGUE?.total ?? 0

    return {
      retiradas,
      stats: {
        entregues: countByStatus.ENTREGUE?.count ?? 0,
        totalQuentinhas,
        bloqueados: countByStatus.DUPLICADO_BLOQUEADO?.count ?? 0,
        ausentes: countByStatus.AUSENTE?.count ?? 0,
        limiteDiario,
        disponivel: Math.max(0, limiteDiario - totalQuentinhas),
      },
    }
  }
}
