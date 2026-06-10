import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type UserRole } from "@/lib/store";
import { authApi } from "@/lib/api/auth.api";
import { configuracoesApi } from "@/lib/api/configuracoes.api";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("mdb-auth");
        if (raw && JSON.parse(raw)?.state?.user) throw redirect({ to: "/" });
      } catch (e) {
        if ((e as any)?.isRedirect) throw e;
      }
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState("");

  const { data: cfg } = useQuery({
    queryKey: ["configuracoes-public"],
    queryFn: configuracoesApi.getPublico,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const submit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!email || !senha) { setErro("Informe e-mail e senha."); return; }
    setErro("");
    setLoading(true);
    try {
      const res = await authApi.login(email, senha);
      login(
        { id: res.user.id, nome: res.user.nome, email: res.user.email, role: res.user.role as UserRole, avatar: res.user.avatar, cargo: res.user.cargo, unidadeId: res.user.unidadeId },
        res.token,
        res.refreshToken,
      );
      toast.success(`Bem-vindo(a), ${res.user.nome.split(" ")[0]}!`);
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao conectar com o servidor. Tente novamente.";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        {/* Logo + nome da plataforma */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-md">
            {cfg?.logoUrl
              ? <img src={cfg.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              : <UtensilsCrossed className="h-7 w-7" />
            }
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{cfg?.nomeCozinha || "Mesa do Bem"}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Cozinha comunitária</div>
          </div>
        </div>

        <h2 className="text-2xl font-bold">Entrar</h2>
        <p className="mt-1 text-sm text-muted-foreground">Acesse com a conta da sua cozinha.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 pl-9" placeholder="voce@mesadobem.org" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="senha">Senha</Label>
              <button type="button" className="text-xs font-medium text-primary hover:underline"
                onClick={() => toast.info("Entre em contato com o administrador para redefinir sua senha.")}>
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="senha" type={showSenha ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} className="h-11 pl-9 pr-10" />
              <button type="button" onClick={() => setShowSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {erro && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {erro}
            </div>
          )}
          <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Entrar <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
