import { api } from "./client";

export interface LoginResponse {
  user: { id: string; nome: string; email: string; role: string; avatar?: string; cargo?: string; unidadeId?: string };
  token: string;
  refreshToken: string;
}

export const authApi = {
  login: (email: string, senha: string) =>
    api.post<LoginResponse>("/auth/login", { email, senha }),

  refresh: (refreshToken: string) =>
    api.post<{ token: string }>("/auth/refresh", { refreshToken }),

  logout: (refreshToken: string) =>
    api.post<void>("/auth/logout", { refreshToken }),

  me: () =>
    api.get<LoginResponse["user"]>("/auth/me"),

  updateProfile: (data: { nome?: string; telefone?: string; cargo?: string }) =>
    api.patch<LoginResponse["user"]>("/auth/me", data),

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.upload<LoginResponse["user"]>("/auth/me/avatar", fd);
  },

  changePassword: (senhaAtual: string, novaSenha: string) =>
    api.patch<void>("/auth/me/senha", { senhaAtual, novaSenha }),

  impersonate: (userId: string) =>
    api.post<{ token: string; user: LoginResponse["user"] }>(`/auth/impersonate/${userId}`),
};
