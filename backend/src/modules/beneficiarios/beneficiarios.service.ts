import { BeneficiariosRepository } from './beneficiarios.repository.js'
import { ConflictError, NotFoundError, ForbiddenError, AppError } from '../../shared/errors.js'
import { parse as csvParse } from 'csv-parse/sync'
import { prisma } from '../../shared/prisma.js'
import { saveBase64Image, saveUpload } from '../../shared/utils/upload.js'
import type { CreateBeneficiarioInput, UpdateBeneficiarioInput, ListBeneficiariosInput } from './beneficiarios.schema.js'

export class BeneficiariosService {
  private repo = new BeneficiariosRepository()

  async list(filters: ListBeneficiariosInput) {
    return this.repo.findMany(filters)
  }

  async getById(id: string) {
    const b = await this.repo.findById(id)
    if (!b) throw new NotFoundError('Beneficiário')
    return b
  }

  async create(data: CreateBeneficiarioInput) {
    const existing = await this.repo.findByCpf(data.cpf)
    if (existing) throw new ConflictError('CPF já cadastrado')

    // Sem vínculo automático por endereço: a pessoa nasce independente
    // (familiaId nulo). O agrupamento é feito manualmente em "Membros da
    // família vinculados" quando o operador quiser que alguém retire pela outra.
    return this.repo.create(data)
  }

  async update(id: string, data: UpdateBeneficiarioInput & { fotoUrl?: string }) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Beneficiário')

    if (data.cpf && data.cpf !== existing.cpf) {
      const dup = await this.repo.findByCpf(data.cpf)
      if (dup) throw new ConflictError('CPF já cadastrado')
    }

    // Endereço NÃO altera vínculo de família: o agrupamento é manual e opt-in.
    // Editar o endereço não junta nem separa ninguém automaticamente.
    return this.repo.update(id, data as Parameters<typeof this.repo.update>[1])
  }

  async remove(id: string, userRole: string) {
    if (userRole === 'COLABORADOR') throw new ForbiddenError('Apenas admins podem excluir beneficiários')
    const b = await this.repo.findById(id)
    if (!b) throw new NotFoundError('Beneficiário')
    return this.repo.softDelete(id)
  }

  async registrarBiometria(id: string, imageBase64: string) {
    const faceServiceUrl = process.env.FACE_SERVICE_URL ?? 'http://face-service:8000'

    const beneficiario = await this.repo.findById(id)
    if (!beneficiario) throw new NotFoundError('Beneficiário')

    let faceRes: Response
    try {
      faceRes = await fetch(`${faceServiceUrl}/face/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beneficiario_id: id, image_base64: imageBase64 }),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new AppError('Serviço de biometria indisponível', 503)
    }

    if (!faceRes.ok) {
      const err = await faceRes.json().catch(() => ({})) as { detail?: string }
      throw new AppError(err.detail ?? 'Nenhuma face detectada na imagem', faceRes.status === 422 ? 422 : 503)
    }

    const result = await faceRes.json() as { embedding: string; confianca: number }
    const embeddingBuffer = Buffer.from(result.embedding, 'base64')

    // Salva a imagem da biometria como foto de perfil (se ainda não tiver)
    let fotoUrl: string | undefined
    try {
      fotoUrl = saveBase64Image(imageBase64, 'beneficiarios')
    } catch {
      // não bloqueia o registro da biometria se falhar ao salvar foto
    }

    await prisma.biometricFace.upsert({
      where: { beneficiarioId: id },
      create: { beneficiarioId: id, embedding: embeddingBuffer, confianca: result.confianca ?? 1.0, imageUrl: fotoUrl },
      update: { embedding: embeddingBuffer, confianca: result.confianca ?? 1.0, ...(fotoUrl && { imageUrl: fotoUrl }) },
    })

    return prisma.beneficiario.update({
      where: { id },
      data: {
        biometriaStatus: 'VERIFICADA',
        ...(fotoUrl && { fotoUrl }),
      },
      select: { id: true, biometriaStatus: true, nome: true, fotoUrl: true },
    })
  }

  async uploadDocumento(beneficiarioId: string, file: import('@fastify/multipart').MultipartFile, tipo: string) {
    const b = await this.repo.findById(beneficiarioId)
    if (!b) throw new NotFoundError('Beneficiário')
    const url = await saveUpload(file, 'documentos')
    return prisma.documento.create({
      data: {
        beneficiarioId,
        tipo,
        url,
        nome: file.filename || tipo,
        tamanho: 0,
        status: 'PENDENTE',
      },
    })
  }

  async listarDocumentos(beneficiarioId: string) {
    return prisma.documento.findMany({
      where: { beneficiarioId },
      include: { aprovadoPor: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
    })
  }

  async removerDocumento(id: string) {
    const doc = await prisma.documento.findUnique({ where: { id } })
    if (!doc) throw new NotFoundError('Documento')
    return prisma.documento.delete({ where: { id } })
  }

  async avaliarDocumento(id: string, acao: 'APROVAR' | 'REJEITAR', operadorId: string, motivo?: string) {
    const doc = await prisma.documento.findUnique({ where: { id } })
    if (!doc) throw new NotFoundError('Documento')
    return prisma.documento.update({
      where: { id },
      data: {
        status: acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO',
        aprovadoPorId: operadorId,
        aprovadoEm: new Date(),
        rejeitadoMotivo: acao === 'REJEITAR' ? (motivo ?? 'Documento rejeitado') : null,
      },
      include: { aprovadoPor: { select: { nome: true } } },
    })
  }

  async getFamiliaMembros(id: string) {
    const b = await this.repo.findById(id)
    if (!b) throw new NotFoundError('Beneficiário')
    if (!b.familiaId) return []
    return prisma.beneficiario.findMany({
      where: { familiaId: b.familiaId, id: { not: id }, deletadoEm: null },
      select: { id: true, nome: true, cpf: true, fotoUrl: true, status: true, podeRetirar: true, quentinhasAutorizadas: true },
      orderBy: { nome: 'asc' },
    })
  }

  async vincularMembro(id: string, membroId: string) {
    const beneficiario = await this.repo.findById(id)
    if (!beneficiario) throw new NotFoundError('Beneficiário')
    const membro = await this.repo.findById(membroId)
    if (!membro) throw new NotFoundError('Membro')
    if (membro.id === id) throw new AppError('Não é possível vincular a si mesmo', 400)

    // O beneficiário-âncora nasce sem família (independente). No primeiro
    // vínculo, cria-se a família sob demanda e o âncora entra nela.
    let familiaId = beneficiario.familiaId
    if (!familiaId) {
      const familia = await this.repo.createFamilia({
        endereco: beneficiario.endereco, numero: beneficiario.numero,
        bairro: beneficiario.bairro, cidade: beneficiario.cidade, cep: beneficiario.cep,
      })
      familiaId = familia.id
      await prisma.beneficiario.update({ where: { id }, data: { familiaId } })
    }

    return prisma.beneficiario.update({
      where: { id: membroId },
      data: { familiaId },
      select: { id: true, nome: true, cpf: true, fotoUrl: true, status: true, podeRetirar: true, quentinhasAutorizadas: true },
    })
  }

  async desvincularMembro(id: string, membroId: string) {
    const beneficiario = await this.repo.findById(id)
    if (!beneficiario) throw new NotFoundError('Beneficiário')
    const membro = await this.repo.findById(membroId)
    if (!membro) throw new NotFoundError('Membro')
    // Volta o membro a ser independente (sem família). Antes o código recriava a
    // família pelo endereço e, para quem morava junto, devolvia a MESMA família —
    // por isso não era possível separar membros do mesmo endereço.
    await prisma.beneficiario.update({ where: { id: membroId }, data: { familiaId: null } })
  }

  async importCsv(buffer: Buffer, fileName: string) {
    const rawRows = csvParse(buffer, { columns: true, skip_empty_lines: true, trim: true })
    // Normaliza cabeçalhos: aceita tanto o formato PT-BR (planilha) quanto snake_case (legado)
    const rows = (rawRows as Record<string, string>[]).map(normalizeRow)

    const results: { linha: number; status: 'OK' | 'ERRO' | 'ALERTA'; mensagem?: string }[] = []
    let importados = 0
    let erros = 0
    let alertas = 0

    const importacao = await prisma.importacao.create({
      data: { fileName, status: 'PROCESSANDO', totalLinhas: rows.length },
    })

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const linha = i + 2

      if (!row.nome?.trim()) {
        results.push({ linha, status: 'ERRO', mensagem: 'Nome obrigatório' })
        erros++
        continue
      }

      const cpf = row.cpf?.trim()
      if (!cpf) {
        results.push({ linha, status: 'ERRO', mensagem: 'CPF obrigatório' })
        erros++
        continue
      }

      const dup = await this.repo.findByCpf(cpf)
      if (dup) {
        results.push({ linha, status: 'ALERTA', mensagem: `CPF ${cpf} já cadastrado (${dup.nome})` })
        alertas++
        continue
      }

      try {
        // Importados nascem independentes (sem família), igual ao cadastro
        // manual. O vínculo é feito depois em "Membros da família vinculados".
        await prisma.beneficiario.create({
          data: {
            nome: row.nome.trim(),
            cpf,
            rg: row.rg?.trim() || undefined,
            nascimento: row.nascimento ? new Date(row.nascimento) : new Date('1990-01-01'),
            telefone: row.telefone?.trim() || undefined,
            endereco: row.endereco?.trim() ?? '',
            numero: row.numero?.trim() ?? 's/n',
            bairro: row.bairro?.trim() ?? '',
            cidade: row.cidade?.trim() ?? '',
            uf: row.uf?.trim()?.toUpperCase() || undefined,
            cep: row.cep?.trim() ?? '00000-000',
            comunidade: row.comunidade?.trim() || undefined,
            genero: normEnum(row.genero, ['MASCULINO', 'FEMININO', 'NAO_BINARIO', 'OUTRO', 'NAO_INFORMADO']),
            raca: normEnum(row.raca, ['BRANCA', 'PRETA', 'PARDA', 'AMARELA', 'INDIGENA', 'NAO_INFORMADO']),
            filiaPai: row.filiaPai?.trim() || undefined,
            filiaMae: row.filiaMae?.trim() || undefined,
            naturalidade: row.naturalidade?.trim() || undefined,
            estadoCivil: normEnum(row.estadoCivil, ['SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL', 'OUTRO']),
            rendaFamiliar: row.rendaFamiliar ? parseFloat(row.rendaFamiliar.replace(',', '.')) || undefined : undefined,
            pessoasCasa: row.pessoasCasa ? parseInt(row.pessoasCasa) || 1 : 1,
            nomesMoradores: row.nomesMoradores?.trim() || undefined,
            quentinhasAutorizadas: row.quentinhasAutorizadas ? parseInt(row.quentinhasAutorizadas) || 1 : 1,
            bolsaFamilia: row.bolsaFamilia ? parseBool(row.bolsaFamilia) : undefined,
            nis: row.nis?.trim() || undefined,
            deficiencia: row.deficiencia ? parseBool(row.deficiencia) : undefined,
            qualDeficiencia: row.qualDeficiencia?.trim() || undefined,
            status: 'PENDENTE',
          },
        })

        results.push({ linha, status: 'OK' })
        importados++
      } catch {
        results.push({ linha, status: 'ERRO', mensagem: 'Erro ao importar linha' })
        erros++
      }
    }

    await prisma.importacao.update({
      where: { id: importacao.id },
      data: { status: 'CONCLUIDA', importados, erros, alertas, errosDetalhes: results },
    })

    return { importados, erros, alertas, total: rows.length, detalhes: results.slice(0, 50) }
  }
}

// ── Helpers de importação CSV ─────────────────────────────────────────────────

// Mapeamento dos cabeçalhos PT-BR (planilha) → chaves internas
const CSV_COL_MAP: Record<string, string> = {
  'BENEFICIÁRIO': 'nome', 'BENEFICIARIO': 'nome', 'nome': 'nome',
  'RG': 'rg', 'rg': 'rg',
  'CPF': 'cpf', 'cpf': 'cpf',
  'COMUNIDADE': 'comunidade', 'comunidade': 'comunidade',
  'GENERO': 'genero', 'GÊNERO': 'genero', 'genero': 'genero',
  'RAÇA': 'raca', 'RACA': 'raca', 'raca': 'raca',
  'FILIAÇÃO PAI': 'filiaPai', 'FILIACAO PAI': 'filiaPai', 'filia_pai': 'filiaPai',
  'FILIAÇÃO MÃE': 'filiaMae', 'FILIACAO MAE': 'filiaMae', 'filia_mae': 'filiaMae',
  'DATA DE NASCIMENTO': 'nascimento', 'nascimento': 'nascimento',
  'NATURALIDADE': 'naturalidade', 'naturalidade': 'naturalidade',
  'LAGRADOURO': 'endereco', 'LOGRADOURO': 'endereco', 'endereco': 'endereco',
  'NUMERO': 'numero', 'NÚMERO': 'numero', 'numero': 'numero',
  'BAIRRO': 'bairro', 'bairro': 'bairro',
  'CIDADE': 'cidade', 'cidade': 'cidade',
  'UF': 'uf', 'uf': 'uf',
  'CEP': 'cep', 'cep': 'cep',
  'CONTATO': 'telefone', 'telefone': 'telefone',
  'ESTADO CÍVIL': 'estadoCivil', 'ESTADO CIVIL': 'estadoCivil', 'estado_civil': 'estadoCivil',
  'RENDA FAMILIAR': 'rendaFamiliar', 'renda_familiar': 'rendaFamiliar',
  'NUMERO DE PESSOAS QUE MORA COM VOCÊ': 'pessoasCasa', 'pessoas_casa': 'pessoasCasa',
  'NOMES DAS PESSOAS QUE MORAM COM VOCÊ': 'nomesMoradores', 'nomes_moradores': 'nomesMoradores',
  'RECEBE BOLSA FAMÍLIA?': 'bolsaFamilia', 'RECEBE BOLSA FAMILIA?': 'bolsaFamilia', 'bolsa_familia': 'bolsaFamilia',
  'NUMERO DO NIS': 'nis', 'nis': 'nis',
  'POSSUI ALGUMA DEFICIÊNCIA?': 'deficiencia', 'POSSUI ALGUMA DEFICIENCIA?': 'deficiencia', 'deficiencia': 'deficiencia',
  'SE SIM, QUAL?': 'qualDeficiencia', 'qual_deficiencia': 'qualDeficiencia',
  'quentinhas': 'quentinhasAutorizadas', 'QUENTINHAS': 'quentinhasAutorizadas',
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(row)) {
    const mapped = CSV_COL_MAP[key.trim()] ?? key.trim().toLowerCase()
    out[mapped] = val
  }
  return out
}

function parseBool(val: string): boolean {
  return /^(s|sim|yes|true|1)$/i.test(val.trim())
}

function normEnum(val: string | undefined, allowed: string[]): string | undefined {
  if (!val?.trim()) return undefined
  const norm = val.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return allowed.includes(norm) ? norm : undefined
}
