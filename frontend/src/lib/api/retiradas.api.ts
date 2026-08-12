import { api } from "./client";

export interface VinculadoRetirada {
  id: string;
  nome: string;
  cpf: string;
  fotoUrl?: string;
  quentinhasAutorizadas: number;
  jaRetirou: boolean;
}

export interface RetiradaValidacao {
  beneficiario: {
    id: string; nome: string; cpf: string; bairro: string; fotoUrl?: string;
    quentinhasAutorizadas: number; pessoasCasa: number; familiaId?: string;
    biometriaStatus: string; status: string;
  };
  validacoes: {
    jaRetirou: boolean;
    podeRetirar: boolean;
    quantidade: number;
    // Membros vinculados que A pode retirar por procuração (toggle "Pode retirar").
    vinculados: VinculadoRetirada[];
  };
  ultimaRetirada?: { data: string; horario: string } | null;
}

export interface Retirada {
  id: string;
  beneficiario: { nome: string; cpf: string; bairro: string };
  operador: { nome: string };
  quantidade: number;
  status: "ENTREGUE" | "DUPLICADO_BLOQUEADO" | "AUSENTE" | "CANCELADO";
  retiradoPorNome?: string | null;
  horario: string;
  data: string;
}

export const retiradasApi = {
  buscar: (q: string) =>
    api.get<RetiradaValidacao["beneficiario"][]>(`/retiradas/buscar?q=${encodeURIComponent(q)}`),

  validar: (id: string, data?: string) =>
    api.get<RetiradaValidacao>(`/retiradas/validar/${id}${data ? `?data=${data}` : ""}`),

  confirmar: (
    beneficiarioId: string,
    unidadeId?: string,
    metodoRetirada: "FACIAL" | "MANUAL" = "MANUAL",
    data?: string,
    retiradoPorNome?: string,
  ) =>
    api.post<Retirada>("/retiradas/confirmar", {
      beneficiarioId,
      unidadeId,
      metodoRetirada,
      ...(data && { data }),
      ...(retiradoPorNome && { retiradoPorNome }),
    }),

  listaDiaria: (date?: string, unidadeId?: string) =>
    api.get<{
      retiradas: Retirada[];
      stats: {
        entregues: number; totalQuentinhas: number;
        bloqueados: number; ausentes: number;
        limiteDiario: number; disponivel: number;
      };
    }>(`/retiradas/lista-diaria${date ? `?date=${date}` : ""}${unidadeId ? `${date ? "&" : "?"}unidadeId=${unidadeId}` : ""}`),

  reconhecer: (imageBase64: string) =>
    api.post<{
      encontrado: boolean;
      motivo?: string;
      confianca?: number;
      beneficiario?: {
        id: string; nome: string; cpf: string; bairro: string; fotoUrl?: string;
        quentinhasAutorizadas: number; pessoasCasa: number;
        biometriaStatus: string; status: string;
      };
      validacoes?: {
        jaRetirou: boolean;
        podeRetirar: boolean;
        quantidade: number;
        vinculados: VinculadoRetirada[];
      };
      ultimaRetirada?: { data: string; horario: string } | null;
    }>("/retiradas/reconhecer", { imageBase64 }),
};
