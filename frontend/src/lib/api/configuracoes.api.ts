import { api } from "./client";

export interface Config {
  id: string;
  nomeCozinha: string;
  logoUrl?: string;
  faviconUrl?: string;
  corPrimaria: string;
  mensagemBoasVindas: string;
  limiteDiario: number;
  tempoEsperaMin: number;
}

export interface ConfigPublic {
  nomeCozinha: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  corPrimaria: string;
}

export interface Bairro { id: string; nome: string; ativo: boolean }

export const configuracoesApi = {
  getPublico: () => api.get<ConfigPublic>("/configuracoes/public"),
  get: () => api.get<Config>("/configuracoes"),
  update: (data: Partial<Config>) => api.put<Config>("/configuracoes", data),
  getBairros: () => api.get<Bairro[]>("/configuracoes/bairros"),
  addBairro: (nome: string) => api.post<Bairro>("/configuracoes/bairros", { nome }),
  removeBairro: (id: string) => api.delete<void>(`/configuracoes/bairros/${id}`),
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.upload<Config>("/configuracoes/logo", fd);
  },
  uploadFavicon: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.upload<Config>("/configuracoes/favicon", fd);
  },

  updateLimiteDiario: (limiteDiario: number) =>
    api.patch<Config>("/configuracoes/limite-diario", { limiteDiario }),

  getCadastroPublico: () =>
    api.get<{ ativo: boolean; token: string | null }>("/configuracoes/cadastro-publico"),

  toggleCadastroPublico: (ativo: boolean) =>
    api.put<{ ativo: boolean; token: string | null }>("/configuracoes/cadastro-publico", { ativo }),

  verificarTokenCadastro: (token: string) =>
    fetch(`/api/configuracoes/cadastro-publico/status?token=${token}`).then(r => r.json()) as Promise<{ data: { ativo: boolean } }>,

  registrarPublico: (token: string, data: Record<string, unknown>) =>
    fetch(`/api/configuracoes/cadastro-publico?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()) as Promise<{ data?: { id: string; nome: string }; error?: string }>,
};
