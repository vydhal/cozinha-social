import { api } from "./client";

export interface DocumentoValidacao {
  tipo: "documento";
  codigo: string;
  periodo: string;
  dataInicio: string;
  dataFim: string;
  totalRetiradas: number;
  totalQuentinhas: number;
  bairro: string | null;
  geradoPor: string;
  geradoEm: string;
}

export interface RetiradaValidacaoDoc {
  tipo: "retirada";
  id: string;
  beneficiario: { nome: string; cpf: string; bairro: string; fotoUrl?: string };
  quantidade: number;
  metodoRetirada: "FACIAL" | "MANUAL";
  status: string;
  data: string;
  horario: string;
  operador: string;
}

export interface BaseUsuarioRetirada {
  data: string;
  horario: string;
  quantidade: number;
  metodoRetirada: "FACIAL" | "MANUAL";
  retiradoPorNome: string | null;
}

export interface BaseUsuario {
  beneficiarioId: string;
  nome: string;
  cpf: string;
  bairro: string;
  totalQuentinhas: number;
  retiradas: BaseUsuarioRetirada[];
}

export interface BaseUsuarios {
  usuarios: BaseUsuario[];
  totalUsuarios: number;
  totalQuentinhas: number;
}

export interface DashboardData {
  disponiveisHoje: number;
  entreguesHoje: number;
  quentinhasHoje: number;
  filaVirtual: number;
  familiasAtendidas: number;
  mediaSemanal: number;
  comparecimento: number;
  tentativasDuplicadas: number;
  cadastrosIncompletos: number;
  cadastrosCompletos: number;
  limiteDiario: number;
}

export const relatoriosApi = {
  dashboard: (unidadeId?: string) =>
    api.get<DashboardData>(`/relatorios/dashboard${unidadeId ? `?unidadeId=${unidadeId}` : ""}`),

  evolucaoMensal: (unidadeId?: string) =>
    api.get<Array<{ mes: string; total: number; quentinhas: number }>>(
      `/relatorios/evolucao-mensal${unidadeId ? `?unidadeId=${unidadeId}` : ""}`
    ),

  bairros: (params?: { unidadeId?: string; periodo?: string }) =>
    api.get<Array<{ bairro: string; familias: number; total: number }>>(
      `/relatorios/bairros?${new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v).map(([k, v]) => [k, v!])).toString()}`
    ),

  familiasFrequentes: (unidadeId?: string) =>
    api.get<Array<{ familiaId: string; nome: string; retiradas: number }>>(
      `/relatorios/familias-frequentes${unidadeId ? `?unidadeId=${unidadeId}` : ""}`
    ),

  distribuicaoSemana: (unidadeId?: string) =>
    api.get<Array<{ dia: string; entregues: number; ausentes: number }>>(
      `/relatorios/distribuicao-semana${unidadeId ? `?unidadeId=${unidadeId}` : ""}`
    ),

  horariosPico: (unidadeId?: string) =>
    api.get<Array<{ hora: string; qtd: number }>>(
      `/relatorios/horarios-pico${unidadeId ? `?unidadeId=${unidadeId}` : ""}`
    ),

  relatorio: (params: { periodo?: string; de?: string; ate?: string; bairro?: string; status?: string; search?: string; unidadeId?: string }) =>
    api.get<{
      retiradas: unknown[];
      stats: { total: number; quentinhas: number; mediadiaria: number; familias: number; ausencias: number; taxa: number };
      charts: { bairros: unknown[]; frequentes: unknown[] };
    }>(`/relatorios?${new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v!])).toString()}`),

  baseUsuarios: (params: { periodo?: string; de?: string; ate?: string; bairro?: string; unidadeId?: string }) =>
    api.get<BaseUsuarios>(
      `/relatorios/base-usuarios?${new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v!])).toString()}`
    ),

  gerarDocumento: (params: {
    periodo: string; dataInicio: string; dataFim: string;
    totalRetiradas: number; totalQuentinhas: number; bairro?: string;
  }) => api.post<{ id: string; codigo: string }>("/relatorios/documento", params),

  deletarRetirada: (id: string) =>
    api.delete<{ id: string }>(`/retiradas/${id}`),

  validarCodigo: async (codigo: string): Promise<DocumentoValidacao | RetiradaValidacaoDoc> => {
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
    const res = await fetch(`${base}/validar/${encodeURIComponent(codigo)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Não encontrado");
    return json.data;
  },
};
