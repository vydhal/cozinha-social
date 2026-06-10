import { api } from "./client";

export interface Unidade {
  id: string;
  nome: string;
  cidade: string;
  bairro?: string;
  status: "ATIVA" | "PAUSADA" | "DESATIVADA";
  cotaDiaria: number;
  _count?: { beneficiarios: number; usuarios: number };
  configuracao?: { limiteDiario: number } | null;
}

export const adminApi = {
  getStats: () =>
    api.get<{ totalUnidades: number; totalBeneficiarios: number; totalRetiradas: number; totalUsuarios: number }>("/admin/stats"),
  getUnidades: () => api.get<Unidade[]>("/admin/unidades"),
  createUnidade: (data: { nome: string; cidade: string; bairro?: string; cotaDiaria?: number }) =>
    api.post<Unidade>("/admin/unidades", data),
  updateUnidade: (id: string, data: Partial<Unidade>) =>
    api.put<Unidade>(`/admin/unidades/${id}`, data),
  deleteUnidade: (id: string) =>
    api.delete<void>(`/admin/unidades/${id}`),
};
