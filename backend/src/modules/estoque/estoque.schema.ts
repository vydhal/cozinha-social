import { z } from 'zod'

const categorias = ['ALIMENTO', 'LIMPEZA', 'SUPRIMENTO', 'GAS', 'OUTRO'] as const

export const createItemSchema = z.object({
  nome: z.string().min(2),
  categoria: z.enum(categorias),
  unidadeMedida: z.string().min(1),
  quantidadeAtual: z.number().min(0).default(0),
  quantidadeMinima: z.number().min(0).default(0),
  unidadeId: z.string().uuid().optional(),
})

export const updateItemSchema = createItemSchema.partial().extend({
  ativo: z.boolean().optional(),
})

export const listItensSchema = z.object({
  categoria: z.enum(categorias).optional(),
  search: z.string().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  unidadeId: z.string().uuid().optional(),
})

export const movimentoSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  quantidade: z.number().positive(),
  motivo: z.string().optional(),
})

export const listMovimentosSchema = z.object({
  itemId: z.string().uuid().optional(),
  categoria: z.enum(categorias).optional(),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']).optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
export type ListItensInput = z.infer<typeof listItensSchema>
export type MovimentoInput = z.infer<typeof movimentoSchema>
export type ListMovimentosInput = z.infer<typeof listMovimentosSchema>
