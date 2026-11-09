import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "SUPERADMIN" | "ADMIN" | "COLABORADOR";

export type Modulo = "BENEFICIARIOS" | "RETIRADA" | "FACIAL" | "FILA" | "LISTA_DIARIA" | "RELATORIOS" | "ESTOQUE";

export const MODULOS: { value: Modulo; label: string }[] = [
  { value: "BENEFICIARIOS", label: "Beneficiários" },
  { value: "RETIRADA", label: "Retirada" },
  { value: "FACIAL", label: "Reconhecimento facial" },
  { value: "FILA", label: "Fila" },
  { value: "LISTA_DIARIA", label: "Lista diária" },
  { value: "RELATORIOS", label: "Relatórios" },
  { value: "ESTOQUE", label: "Estoque" },
];

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  avatar?: string;
  cargo?: string;
  unidadeId?: string;
  modulosPermitidos?: Modulo[];
};

export function temModulo(user: AuthUser | null, modulo: Modulo): boolean {
  if (!user) return false;
  if (user.role === "SUPERADMIN") return true;
  return user.modulosPermitidos?.includes(modulo) ?? false;
}

type OriginalSession = { user: AuthUser; token: string; refreshToken: string };

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  originalSession: OriginalSession | null;
  login: (u: AuthUser, token: string, refreshToken: string) => void;
  setToken: (token: string) => void;
  setUser: (u: Partial<AuthUser>) => void;
  logout: () => void;
  startImpersonation: (u: AuthUser, token: string) => void;
  stopImpersonation: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      originalSession: null,
      login: (u, token, refreshToken) => set({ user: u, token, refreshToken, originalSession: null }),
      setToken: (token) => set({ token }),
      setUser: (u) => set((s) => ({ user: s.user ? { ...s.user, ...u } : null })),
      logout: () => set({ user: null, token: null, refreshToken: null, originalSession: null }),
      startImpersonation: (u, token) => {
        const s = get();
        if (!s.originalSession && s.user && s.token && s.refreshToken) {
          set({ originalSession: { user: s.user, token: s.token, refreshToken: s.refreshToken }, user: u, token });
        }
      },
      stopImpersonation: () => {
        const s = get();
        if (s.originalSession) {
          set({ user: s.originalSession.user, token: s.originalSession.token, refreshToken: s.originalSession.refreshToken, originalSession: null });
        }
      },
    }),
    { name: "mdb-auth" }
  )
);

type Settings = {
  nomeCozinha: string;
  limiteDiario: number;
  tempoEsperaMin: number;
  corPrimaria: string;
  mensagemBoasVindas: string;
  logoUrl?: string;
  faviconUrl?: string;
};

type SettingsState = Settings & {
  set: (p: Partial<Settings>) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      nomeCozinha: "Cozinha Comunitária Mesa do Bem",
      limiteDiario: 100,
      tempoEsperaMin: 5,
      corPrimaria: "#2f9d6b",
      mensagemBoasVindas: "Bem-vindo(a) à nossa mesa. Aqui há lugar para todos.",
      set: (p) => set(p),
    }),
    { name: "mdb-settings" }
  )
);
