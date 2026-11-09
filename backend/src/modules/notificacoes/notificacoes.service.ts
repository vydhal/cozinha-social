import { prisma } from '../../shared/prisma.js'

export type TipoNotificacao = 'ESTOQUE_BAIXO' | 'BENEFICIARIO_PENDENTE' | 'DOCUMENTO_PENDENTE'

export interface Notificacao {
  id: string
  tipo: TipoNotificacao
  titulo: string
  descricao: string
  link: string
  criadoEm: Date
  severidade: 'alta' | 'media'
}

function temModulo(user: { role: string; modulosPermitidos?: string[] }, modulo: string) {
  return user.role === 'SUPERADMIN' || !!user.modulosPermitidos?.includes(modulo)
}

export class NotificacoesService {
  /**
   * Agrega itens que precisam de atenção (estoque baixo, cadastros e documentos pendentes
   * de aprovação) num feed único — sem tabela própria no banco: são estados atuais, não
   * eventos pontuais, então não há "marcar como lido" a persistir. O item some sozinho
   * quando resolvido (estoque reposto, cadastro aprovado, documento avaliado).
   * Filtra pelos módulos que o usuário tem liberado, igual ao resto do sistema.
   */
  async listar(user: { role: string; modulosPermitidos?: string[] }): Promise<Notificacao[]> {
    const notificacoes: Notificacao[] = []

    if (temModulo(user, 'ESTOQUE')) {
      const itens = await prisma.itemEstoque.findMany({ where: { ativo: true } })
      for (const item of itens) {
        if (item.quantidadeAtual <= item.quantidadeMinima) {
          notificacoes.push({
            id: `estoque:${item.id}`,
            tipo: 'ESTOQUE_BAIXO',
            titulo: item.nome,
            descricao: `Estoque baixo: ${item.quantidadeAtual} ${item.unidadeMedida} (mínimo ${item.quantidadeMinima})`,
            link: '/estoque',
            criadoEm: item.atualizadoEm,
            severidade: 'alta',
          })
        }
      }
    }

    if (temModulo(user, 'BENEFICIARIOS')) {
      const [pendentes, documentos] = await Promise.all([
        prisma.beneficiario.findMany({
          where: { status: 'PENDENTE', deletadoEm: null },
          select: { id: true, nome: true, criadoEm: true },
          orderBy: { criadoEm: 'desc' },
          take: 30,
        }),
        prisma.documento.findMany({
          where: { status: 'PENDENTE' },
          select: { id: true, nome: true, tipo: true, criadoEm: true, beneficiarioId: true, beneficiario: { select: { nome: true } } },
          orderBy: { criadoEm: 'desc' },
          take: 30,
        }),
      ])

      for (const b of pendentes) {
        notificacoes.push({
          id: `beneficiario:${b.id}`,
          tipo: 'BENEFICIARIO_PENDENTE',
          titulo: b.nome,
          descricao: 'Cadastro aguardando aprovação',
          link: `/beneficiarios/${b.id}`,
          criadoEm: b.criadoEm,
          severidade: 'media',
        })
      }

      for (const d of documentos) {
        notificacoes.push({
          id: `documento:${d.id}`,
          tipo: 'DOCUMENTO_PENDENTE',
          titulo: `${d.nome} — ${d.beneficiario.nome}`,
          descricao: 'Documento aguardando avaliação',
          link: `/beneficiarios/${d.beneficiarioId}`,
          criadoEm: d.criadoEm,
          severidade: 'media',
        })
      }
    }

    return notificacoes.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
  }
}
