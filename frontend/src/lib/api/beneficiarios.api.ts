import { api } from "./client";

export interface Beneficiario {
  id: string;
  nome: string;
  cpf: string;
  rg?: string;
  nascimento: string;
  telefone?: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  pessoasCasa: number;
  quentinhasAutorizadas: number;
  responsavel: boolean;
  podeRetirar: boolean;
  observacoes?: string;
  status: "ATIVO" | "PENDENTE" | "BLOQUEADO";
  fotoUrl?: string;
  biometriaStatus: "VERIFICADA" | "PENDENTE" | "INDISPONIVEL";
  familiaId?: string;
  criadoEm: string;
}

export type DocStatus = "PENDENTE" | "APROVADO" | "REJEITADO";
export type DocTipo = "RG_FRENTE" | "RG_VERSO" | "COMPROVANTE" | "OUTRO";

export interface Documento {
  id: string;
  beneficiarioId: string;
  tipo: DocTipo | string;
  url: string;
  nome: string;
  tamanho: number;
  status: DocStatus;
  aprovadoPorId?: string;
  aprovadoEm?: string;
  rejeitadoMotivo?: string;
  criadoEm: string;
  aprovadoPor?: { nome: string } | null;
}

export interface FamiliaMembro {
  id: string;
  nome: string;
  cpf: string;
  fotoUrl?: string;
  status: "ATIVO" | "PENDENTE" | "BLOQUEADO";
  podeRetirar: boolean;
  quentinhasAutorizadas: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const beneficiariosApi = {
  list: (params?: { search?: string; status?: string; biometriaStatus?: string; bairro?: string; page?: number; limit?: number }) =>
    api.get<ListResult<Beneficiario>>(
      `/beneficiarios?${new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
    ),

  getById: (id: string) =>
    api.get<Beneficiario & { familia?: unknown; retiradas?: unknown[]; documentos?: unknown[] }>(`/beneficiarios/${id}`),

  create: (data: Omit<Beneficiario, "id" | "criadoEm" | "biometriaStatus">) =>
    api.post<Beneficiario>("/beneficiarios", data),

  update: (id: string, data: Partial<Beneficiario>) =>
    api.put<Beneficiario>(`/beneficiarios/${id}`, data),

  remove: (id: string) =>
    api.delete<void>(`/beneficiarios/${id}`),

  importar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.upload<{ importados: number; erros: number; alertas: number; total: number; detalhes: unknown[] }>("/beneficiarios/importar", fd);
  },

  uploadFoto: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.upload<Beneficiario>(`/beneficiarios/${id}/foto`, fd);
  },

  registrarBiometria: (id: string, imageBase64: string) =>
    api.post<{ id: string; biometriaStatus: string; nome: string; fotoUrl?: string }>(
      `/beneficiarios/${id}/biometria`,
      { imageBase64 }
    ),

  getFamiliaMembros: (id: string) =>
    api.get<FamiliaMembro[]>(`/beneficiarios/${id}/familia-membros`),

  vincularMembro: (id: string, membroId: string) =>
    api.post<FamiliaMembro>(`/beneficiarios/${id}/familia-membros`, { membroId }),

  desvincularMembro: (id: string, membroId: string) =>
    api.delete<void>(`/beneficiarios/${id}/familia-membros/${membroId}`),

  listarDocumentos: (id: string) =>
    api.get<Documento[]>(`/beneficiarios/${id}/documentos`),

  uploadDocumento: (id: string, file: File, tipo: string) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.upload<Documento>(`/beneficiarios/${id}/documentos?tipo=${encodeURIComponent(tipo)}`, fd);
  },

  avaliarDocumento: (docId: string, acao: "APROVAR" | "REJEITAR", motivo?: string) =>
    api.patch<Documento>(`/beneficiarios/documentos/${docId}/avaliar`, { acao, motivo }),

  removerDocumento: (docId: string) =>
    api.delete<void>(`/beneficiarios/documentos/${docId}`),
};
