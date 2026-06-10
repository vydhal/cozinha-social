import { z } from 'zod'

export const confirmarRetiradaSchema = z.object({
  beneficiarioId: z.string().uuid(),
  unidadeId: z.string().uuid().optional(),
  observacao: z.string().optional(),
  metodoRetirada: z.enum(['FACIAL', 'MANUAL']).optional(),
})

export const buscarBeneficiarioSchema = z.object({
  q: z.string().min(2, 'Busca mínima de 2 caracteres').max(100, 'Busca máxima de 100 caracteres'),
})

export const validarParamsSchema = z.object({
  id: z.string().uuid('ID inválido'),
})

export type ConfirmarRetiradaInput = z.infer<typeof confirmarRetiradaSchema>
