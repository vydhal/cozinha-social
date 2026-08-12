import { prisma } from '../../shared/prisma.js'
import { z } from 'zod'
import { randomBytes } from 'crypto'

export const updateConfigSchema = z.object({
  nomeCozinha: z.string().min(2).optional(),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  mensagemBoasVindas: z.string().optional(),
  limiteDiario: z.number().int().min(1).max(9999).optional(),
  tempoEsperaMin: z.number().int().min(1).max(120).optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
})

export class ConfiguracoesService {
  async get(unidadeId?: string) {
    let config = await prisma.configuracao.findFirst({
      where: unidadeId ? { unidadeId } : { unidadeId: null },
    })

    if (!config) {
      config = await prisma.configuracao.create({
        data: { unidadeId: unidadeId ?? null },
      })
    }

    return config
  }

  async update(data: z.infer<typeof updateConfigSchema>, unidadeId?: string) {
    let config = await prisma.configuracao.findFirst({
      where: unidadeId ? { unidadeId } : { unidadeId: null },
    })

    if (!config) {
      return prisma.configuracao.create({ data: { ...data, unidadeId: unidadeId ?? null } })
    }

    return prisma.configuracao.update({ where: { id: config.id }, data })
  }

  async getBairros() {
    return prisma.bairro.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } })
  }

  async addBairro(nome: string) {
    return prisma.bairro.upsert({
      where: { nome },
      create: { nome },
      update: { ativo: true },
    })
  }

  async removeBairro(id: string) {
    return prisma.bairro.update({ where: { id }, data: { ativo: false } })
  }

  async getCadastroPublico(unidadeId?: string) {
    const config = await this.get(unidadeId)
    return {
      ativo: config.cadastroPublicoAtivo,
      token: config.cadastroPublicoToken ?? null,
    }
  }

  async toggleCadastroPublico(ativo: boolean, unidadeId?: string) {
    let config = await prisma.configuracao.findFirst({
      where: unidadeId ? { unidadeId } : { unidadeId: null },
    })
    const token = ativo
      ? (config?.cadastroPublicoToken ?? randomBytes(16).toString('hex'))
      : null
    if (!config) {
      return prisma.configuracao.create({
        data: { cadastroPublicoAtivo: ativo, cadastroPublicoToken: token, unidadeId: unidadeId ?? null },
      })
    }
    return prisma.configuracao.update({
      where: { id: config.id },
      data: { cadastroPublicoAtivo: ativo, cadastroPublicoToken: token },
    })
  }

  async registrarPublico(token: string, data: Record<string, unknown>) {
    const config = await prisma.configuracao.findFirst({
      where: { cadastroPublicoToken: token, cadastroPublicoAtivo: true },
    })
    if (!config) throw new Error('Link de cadastro inativo ou inválido')

    const cpf = String(data.cpf ?? '').trim()
    if (!cpf) throw new Error('CPF obrigatório')
    const existing = await prisma.beneficiario.findFirst({ where: { cpf, deletadoEm: null } })
    if (existing) throw new Error('CPF já cadastrado')

    // Auto-cadastro público nasce independente (sem família), igual ao cadastro
    // manual. O vínculo é feito depois em "Membros da família vinculados".
    return prisma.beneficiario.create({
      data: {
        nome: String(data.nome),
        cpf,
        rg: data.rg ? String(data.rg) : undefined,
        nascimento: new Date(String(data.nascimento)),
        telefone: data.telefone ? String(data.telefone) : undefined,
        endereco: String(data.endereco ?? ''),
        numero: String(data.numero ?? 's/n'),
        bairro: String(data.bairro ?? ''),
        cidade: String(data.cidade ?? ''),
        cep: String(data.cep ?? '00000-000'),
        uf: data.uf ? String(data.uf) : undefined,
        pessoasCasa: Number(data.pessoasCasa ?? 1),
        nomesMoradores: data.nomesMoradores ? String(data.nomesMoradores) : undefined,
        quentinhasAutorizadas: Number(data.quentinhasAutorizadas ?? 1),
        observacoes: data.observacoes ? String(data.observacoes) : undefined,
        status: 'PENDENTE',
        unidadeId: config.unidadeId ?? undefined,
      },
      select: { id: true, nome: true, status: true },
    })
  }

  async updateField(field: 'logoUrl' | 'faviconUrl', value: string, unidadeId?: string) {
    let config = await prisma.configuracao.findFirst({
      where: unidadeId ? { unidadeId } : { unidadeId: null },
    })
    if (!config) {
      return prisma.configuracao.create({ data: { [field]: value, unidadeId: unidadeId ?? null } })
    }
    return prisma.configuracao.update({ where: { id: config.id }, data: { [field]: value } })
  }
}
