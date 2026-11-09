import { prisma } from '../../shared/prisma.js'
import { NotFoundError, ValidationError } from '../../shared/errors.js'
import { startOfDay, endOfDay, subDays } from 'date-fns'
import type { CreateItemInput, UpdateItemInput, ListItensInput, MovimentoInput, ListMovimentosInput } from './estoque.schema.js'

export class EstoqueService {
  async list(filters: ListItensInput) {
    const { categoria, search, ativo, unidadeId } = filters
    const itens = await prisma.itemEstoque.findMany({
      where: {
        ...(categoria && { categoria }),
        ...(search && { nome: { contains: search, mode: 'insensitive' as const } }),
        ...(ativo !== undefined && { ativo: ativo === 'true' }),
        ...(unidadeId && { unidadeId }),
      },
      orderBy: { nome: 'asc' },
    })

    return itens.map((item) => ({
      ...item,
      baixo: item.quantidadeAtual <= item.quantidadeMinima,
    }))
  }

  async getAlertas(unidadeId?: string) {
    const itens = await prisma.itemEstoque.findMany({
      where: { ativo: true, ...(unidadeId && { unidadeId }) },
    })
    return itens
      .filter((item) => item.quantidadeAtual <= item.quantidadeMinima)
      .map((item) => ({ id: item.id, nome: item.nome, categoria: item.categoria, quantidadeAtual: item.quantidadeAtual, quantidadeMinima: item.quantidadeMinima, unidadeMedida: item.unidadeMedida }))
  }

  async getById(id: string) {
    const item = await prisma.itemEstoque.findUnique({ where: { id } })
    if (!item) throw new NotFoundError('Item de estoque')
    return item
  }

  async create(data: CreateItemInput) {
    return prisma.itemEstoque.create({ data })
  }

  async update(id: string, data: UpdateItemInput) {
    const item = await prisma.itemEstoque.findUnique({ where: { id } })
    if (!item) throw new NotFoundError('Item de estoque')
    return prisma.itemEstoque.update({ where: { id }, data })
  }

  async remove(id: string) {
    const item = await prisma.itemEstoque.findUnique({ where: { id } })
    if (!item) throw new NotFoundError('Item de estoque')
    const totalMovimentos = await prisma.movimentoEstoque.count({ where: { itemId: id } })
    if (totalMovimentos > 0) {
      // Preserva o histórico de movimentações: desativa em vez de apagar.
      return prisma.itemEstoque.update({ where: { id }, data: { ativo: false } })
    }
    return prisma.itemEstoque.delete({ where: { id } })
  }

  async registrarMovimento(itemId: string, input: MovimentoInput, operadorId: string) {
    const item = await prisma.itemEstoque.findUnique({ where: { id: itemId } })
    if (!item) throw new NotFoundError('Item de estoque')

    let novaQuantidade = item.quantidadeAtual
    if (input.tipo === 'ENTRADA') novaQuantidade += input.quantidade
    else if (input.tipo === 'SAIDA') novaQuantidade -= input.quantidade
    else novaQuantidade = input.quantidade // AJUSTE define o valor absoluto

    if (novaQuantidade < 0) {
      throw new ValidationError(`Saída maior que o estoque disponível (${item.quantidadeAtual} ${item.unidadeMedida})`)
    }

    const [, movimento] = await prisma.$transaction([
      prisma.itemEstoque.update({ where: { id: itemId }, data: { quantidadeAtual: novaQuantidade } }),
      prisma.movimentoEstoque.create({
        data: { itemId, tipo: input.tipo, quantidade: input.quantidade, motivo: input.motivo, operadorId },
      }),
    ])

    return { ...movimento, quantidadeAtual: novaQuantidade }
  }

  async getMovimentos(itemId: string, limit = 50) {
    const item = await prisma.itemEstoque.findUnique({ where: { id: itemId } })
    if (!item) throw new NotFoundError('Item de estoque')
    return prisma.movimentoEstoque.findMany({
      where: { itemId },
      orderBy: { criadoEm: 'desc' },
      take: limit,
      include: { operador: { select: { nome: true } } },
    })
  }

  /**
   * Relatório geral de movimentações, para a aba "Relatório" do Estoque — filtra por
   * produto/categoria/tipo/período. Sem `take` artificial sobre o período escolhido (mesmo
   * bug já corrigido em relatórios de retiradas): quando `de`/`ate` não vêm, cai para os
   * últimos 30 dias como padrão razoável, mas um período customizado traz tudo.
   */
  async getMovimentosGerais(filters: ListMovimentosInput) {
    const { itemId, categoria, tipo, de, ate } = filters
    const criadoEm = de && ate
      ? { gte: startOfDay(new Date(de)), lte: endOfDay(new Date(ate)) }
      : { gte: startOfDay(subDays(new Date(), 30)), lte: endOfDay(new Date()) }

    const movimentos = await prisma.movimentoEstoque.findMany({
      where: {
        criadoEm,
        ...(itemId && { itemId }),
        ...(tipo && { tipo }),
        ...(categoria && { item: { categoria } }),
      },
      orderBy: { criadoEm: 'desc' },
      include: {
        item: { select: { nome: true, categoria: true, unidadeMedida: true } },
        operador: { select: { nome: true } },
      },
    })

    const resumo = movimentos.reduce(
      (acc, m) => {
        if (m.tipo === 'ENTRADA') acc.totalEntradas += m.quantidade
        else if (m.tipo === 'SAIDA') acc.totalSaidas += m.quantidade
        return acc
      },
      { totalEntradas: 0, totalSaidas: 0 },
    )

    return { movimentos, resumo }
  }
}
