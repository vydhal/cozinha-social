import { api } from "./client";

export type TipoNotificacao = "ESTOQUE_BAIXO" | "BENEFICIARIO_PENDENTE" | "DOCUMENTO_PENDENTE";

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  descricao: string;
  link: string;
  criadoEm: string;
  severidade: "alta" | "media";
}

export const notificacoesApi = {
  list: () => api.get<Notificacao[]>("/notificacoes"),
};
