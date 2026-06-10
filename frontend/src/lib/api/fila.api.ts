import { api } from "./client";

export interface FilaEntrada {
  id: string;
  senha: string;
  beneficiarioId: string;
  status: "AGUARDANDO" | "CHAMADO" | "RETIRADO" | "AUSENTE";
  horaEntrada: string;
  horaChamado?: string;
  beneficiario: { nome: string; cpf: string; fotoUrl?: string; quentinhasAutorizadas: number };
}

export interface FilaState {
  fila: FilaEntrada[];
  stats: {
    aguardando: number;
    chamado: number;
    retirado: number;
    ausente: number;
    tempoMedioMin: number;
    limiteDiario: number;
    emitidas: number;
    restantes: number;
  };
}

export interface PainelPublico {
  chamados: FilaEntrada[];
  proximas: FilaEntrada[];
}

export const filaApi = {
  get: (unidadeId?: string) =>
    api.get<FilaState>(`/fila${unidadeId ? `?unidadeId=${unidadeId}` : ""}`),

  entrar: (beneficiarioId: string, unidadeId?: string) =>
    api.post<FilaEntrada>("/fila", { beneficiarioId, unidadeId }),

  chamar: (id: string) =>
    api.patch<FilaEntrada>(`/fila/${id}`, { acao: "CHAMAR" }),

  concluir: (id: string) =>
    api.patch<FilaEntrada>(`/fila/${id}`, { acao: "CONCLUIR" }),

  ausente: (id: string) =>
    api.patch<FilaEntrada>(`/fila/${id}`, { acao: "AUSENTE" }),

  painel: (unidadeId?: string) =>
    api.get<PainelPublico>(`/fila/painel${unidadeId ? `?unidadeId=${unidadeId}` : ""}`),
};
