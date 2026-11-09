import { api } from "./client";
import type { Modulo } from "@/lib/store";

export interface TeamUser {
  id: string;
  nome: string;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "COLABORADOR";
  status: "ATIVO" | "INATIVO" | "BLOQUEADO";
  avatar?: string;
  cargo?: string;
  telefone?: string;
  criadoEm: string;
  modulosPermitidos?: Modulo[];
}

export interface ActivityLog {
  id: string;
  acao: string;
  recurso: string;
  recursoId?: string;
  criadoEm: string;
  user: { nome: string; avatar?: string };
}

export const equipeApi = {
  list: () => api.get<TeamUser[]>("/equipe"),
  getLogs: (limit?: number) => api.get<ActivityLog[]>(`/equipe/logs${limit ? `?limit=${limit}` : ""}`),
  create: (data: { nome: string; email: string; senha: string; role: string; cargo?: string; telefone?: string; modulosPermitidos?: Modulo[] }) =>
    api.post<TeamUser>("/equipe", data),
  update: (id: string, data: Partial<TeamUser>) =>
    api.put<TeamUser>(`/equipe/${id}`, data),
  toggleStatus: (id: string) =>
    api.patch<{ id: string; status: string }>(`/equipe/${id}/toggle`),
  remove: (id: string) =>
    api.delete<void>(`/equipe/${id}`),

  uploadAvatar: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.upload<{ id: string; nome: string; avatar: string }>(`/equipe/${id}/avatar`, fd);
  },
};
