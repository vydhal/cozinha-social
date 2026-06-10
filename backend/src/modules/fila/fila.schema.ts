import { z } from 'zod'

export const entrarFilaSchema = z.object({
  beneficiarioId: z.string().uuid(),
  unidadeId: z.string().uuid().optional(),
})

export const acaoFilaSchema = z.object({
  acao: z.enum(['CHAMAR', 'CONCLUIR', 'AUSENTE']),
})

export type EntrarFilaInput = z.infer<typeof entrarFilaSchema>
export type AcaoFilaInput = z.infer<typeof acaoFilaSchema>
