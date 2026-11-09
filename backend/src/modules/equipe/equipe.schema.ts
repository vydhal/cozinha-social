import { z } from 'zod'
import { MODULOS } from '../../middlewares/rbac.js'

export const createUserSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'COLABORADOR']).default('COLABORADOR'),
  cargo: z.string().optional(),
  telefone: z.string().optional(),
  unidadeId: z.string().uuid().optional(),
  modulosPermitidos: z.array(z.enum(MODULOS)).optional(),
})

export const updateUserSchema = createUserSchema.omit({ senha: true }).partial().extend({
  status: z.enum(['ATIVO', 'INATIVO', 'BLOQUEADO']).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
