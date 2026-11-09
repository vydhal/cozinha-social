import { api } from "./client";

export type CategoriaEstoque = "ALIMENTO" | "LIMPEZA" | "SUPRIMENTO" | "GAS" | "OUTRO";
export type TipoMovimento = "ENTRADA" | "SAIDA" | "AJUSTE";

export interface ItemEstoque {
  id: string;
  nome: string;
  categoria: CategoriaEstoque;
  unidadeMedida: string;
  quantidadeAtual: number;
  quantidadeMinima: number;
  ativo: boolean;
  baixo: boolean;
  unidadeId?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AlertaEstoque {
  id: string;
  nome: string;
  categoria: CategoriaEstoque;
  quantidadeAtual: number;
  quantidadeMinima: number;
  unidadeMedida: string;
}

export interface MovimentoEstoque {
  id: string;
  itemId: string;
  tipo: TipoMovimento;
  quantidade: number;
  motivo?: string | null;
  criadoEm: string;
  operador: { nome: string };
}

export interface MovimentoGeral extends MovimentoEstoque {
  item: { nome: string; categoria: CategoriaEstoque; unidadeMedida: string };
}

export interface RelatorioMovimentos {
  movimentos: MovimentoGeral[];
  resumo: { totalEntradas: number; totalSaidas: number };
}

export const CATEGORIAS_ESTOQUE: { value: CategoriaEstoque; label: string }[] = [
  { value: "ALIMENTO", label: "Alimentos" },
  { value: "LIMPEZA", label: "Limpeza" },
  { value: "SUPRIMENTO", label: "Suprimentos" },
  { value: "GAS", label: "Gás" },
  { value: "OUTRO", label: "Outro" },
];

export const estoqueApi = {
  list: (params?: { categoria?: string; search?: string; ativo?: string }) =>
    api.get<ItemEstoque[]>(`/estoque?${new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v).map(([k, v]) => [k, v!])).toString()}`),

  alertas: () => api.get<AlertaEstoque[]>("/estoque/alertas"),

  create: (data: { nome: string; categoria: CategoriaEstoque; unidadeMedida: string; quantidadeAtual?: number; quantidadeMinima?: number }) =>
    api.post<ItemEstoque>("/estoque", data),

  update: (id: string, data: Partial<{ nome: string; categoria: CategoriaEstoque; unidadeMedida: string; quantidadeMinima: number; ativo: boolean }>) =>
    api.put<ItemEstoque>(`/estoque/${id}`, data),

  remove: (id: string) => api.delete<ItemEstoque>(`/estoque/${id}`),

  registrarMovimento: (id: string, data: { tipo: TipoMovimento; quantidade: number; motivo?: string }) =>
    api.post<MovimentoEstoque & { quantidadeAtual: number }>(`/estoque/${id}/movimento`, data),

  movimentos: (id: string) => api.get<MovimentoEstoque[]>(`/estoque/${id}/movimentos`),

  relatorioMovimentos: (params?: { itemId?: string; categoria?: string; tipo?: string; de?: string; ate?: string }) =>
    api.get<RelatorioMovimentos>(`/estoque/movimentos?${new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v).map(([k, v]) => [k, v!])).toString()}`),
};
