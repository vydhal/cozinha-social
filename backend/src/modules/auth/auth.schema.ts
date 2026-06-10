import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório'),
})

export const changePasswordSchema = z.object({
  senhaAtual: z.string().min(6),
  novaSenha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
