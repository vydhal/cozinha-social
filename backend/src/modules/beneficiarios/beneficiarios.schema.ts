import { z } from 'zod'

export const createBeneficiarioSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido (formato: 000.000.000-00)'),
  rg: z.string().optional(),
  nascimento: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida'),
  telefone: z.string().optional(),
  // Endereço
  endereco: z.string().min(2, 'Endereço obrigatório'),
  numero: z.string().min(1, 'Número obrigatório'),
  bairro: z.string().min(2, 'Bairro obrigatório'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  uf: z.string().max(2).optional(),
  cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido (formato: 00000-000)'),
  comunidade: z.string().optional(),
  // Perfil social
  genero: z.enum(['MASCULINO', 'FEMININO', 'NAO_BINARIO', 'OUTRO', 'NAO_INFORMADO']).optional(),
  raca: z.enum(['BRANCA', 'PRETA', 'PARDA', 'AMARELA', 'INDIGENA', 'NAO_INFORMADO']).optional(),
  filiaPai: z.string().optional(),
  filiaMae: z.string().optional(),
  naturalidade: z.string().optional(),
  estadoCivil: z.enum(['SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL', 'OUTRO']).optional(),
  rendaFamiliar: z.number().min(0).optional(),
  // Moradia
  pessoasCasa: z.number().int().min(1, 'Mínimo 1 pessoa').max(20).default(1),
  nomesMoradores: z.string().optional(),
  quentinhasAutorizadas: z.number().int().min(1, 'Mínimo 1 quentinha').max(10).default(1),
  responsavel: z.boolean().default(false),
  podeRetirar: z.boolean().default(true),
  // Benefícios sociais
  bolsaFamilia: z.boolean().optional(),
  nis: z.string().optional(),
  deficiencia: z.boolean().optional(),
  qualDeficiencia: z.string().optional(),
  observacoes: z.string().optional(),
  status: z.enum(['ATIVO', 'PENDENTE', 'BLOQUEADO']).default('PENDENTE'),
  unidadeId: z.string().uuid().optional(),
})

export const updateBeneficiarioSchema = createBeneficiarioSchema.partial().extend({
  status: z.enum(['ATIVO', 'PENDENTE', 'BLOQUEADO']).optional(),
  biometriaStatus: z.enum(['VERIFICADA', 'PENDENTE', 'INDISPONIVEL']).optional(),
})

export const listBeneficiariosSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ATIVO', 'PENDENTE', 'BLOQUEADO']).optional(),
  biometriaStatus: z.enum(['VERIFICADA', 'PENDENTE', 'INDISPONIVEL']).optional(),
  bairro: z.string().optional(),
  // 'true' filtra só quem tem deficiência marcada no cadastro.
  deficiencia: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(9999).default(20),
})

export type CreateBeneficiarioInput = z.infer<typeof createBeneficiarioSchema>
export type UpdateBeneficiarioInput = z.infer<typeof updateBeneficiarioSchema>
export type ListBeneficiariosInput = z.infer<typeof listBeneficiariosSchema>
