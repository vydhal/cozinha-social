import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Plus, MapPin, Loader2, X, UserCheck, Link2, Copy, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { configuracoesApi } from "@/lib/api/configuracoes.api";
import { adminApi } from "@/lib/api/admin.api";
import { equipeApi } from "@/lib/api/equipe.api";
import { authApi } from "@/lib/api/auth.api";
import { useAuth, type UserRole } from "@/lib/store";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("mdb-auth");
        const role = raw ? JSON.parse(raw)?.state?.user?.role : null;
        if (role !== "SUPERADMIN") throw redirect({ to: "/" });
      } catch (e) {
        if ((e as any)?.isRedirect) throw e;
        throw redirect({ to: "/" });
      }
    }
  },
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: me, startImpersonation } = useAuth();

  const { data: bairros = [] } = useQuery({ queryKey: ["bairros"], queryFn: configuracoesApi.getBairros });
  const { data: adminStats } = useQuery({ queryKey: ["admin-stats"], queryFn: adminApi.getStats });
  const { data: unidades = [] } = useQuery({ queryKey: ["admin-unidades"], queryFn: adminApi.getUnidades });
  const { data: usuarios = [] } = useQuery({ queryKey: ["equipe"], queryFn: equipeApi.list });

  const [novoBairro, setNovoBairro] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const { data: cadastroConfig } = useQuery({
    queryKey: ["cadastro-publico"],
    queryFn: configuracoesApi.getCadastroPublico,
  });

  const toggleCadastroMut = useMutation({
    mutationFn: (ativo: boolean) => configuracoesApi.toggleCadastroPublico(ativo),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cadastro-publico"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const linkCadastro = cadastroConfig?.token
    ? `${window.location.origin}/cadastro?token=${cadastroConfig.token}`
    : null;

  const handleImpersonate = async (userId: string, nome: string) => {
    setImpersonating(userId);
    try {
      const res = await authApi.impersonate(userId);
      startImpersonation(
        { id: res.user.id, nome: res.user.nome, email: res.user.email, role: res.user.role as UserRole, avatar: res.user.avatar, cargo: res.user.cargo, unidadeId: res.user.unidadeId },
        res.token,
      );
      toast.success(`Simulando acesso de ${nome}`);
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao simular acesso");
    } finally {
      setImpersonating(null);
    }
  };

  const addBairroMut = useMutation({
    mutationFn: configuracoesApi.addBairro,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bairros"] }); setNovoBairro(""); toast.success("Bairro adicionado."); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const removeBairroMut = useMutation({
    mutationFn: configuracoesApi.removeBairro,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bairros"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });


  return (
    <div className="space-y-6">
      <PageHeader title="Superadmin" subtitle="Bairros atendidos e gestão de unidades." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Bairros atendidos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 min-h-12 rounded-xl border bg-muted/30 p-3">
              {bairros.map((b: any) => (
                <Badge key={b.id} variant="outline" className="rounded-full gap-1 pr-1">
                  {b.nome}
                  <button
                    className="ml-1 grid h-4 w-4 place-items-center rounded-full hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeBairroMut.mutate(b.id)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Novo bairro..."
                value={novoBairro}
                onChange={e => setNovoBairro(e.target.value)}
                onKeyDown={e => e.key === "Enter" && novoBairro && addBairroMut.mutate(novoBairro)}
              />
              <Button
                size="sm"
                className="gap-1"
                disabled={!novoBairro || addBairroMut.isPending}
                onClick={() => addBairroMut.mutate(novoBairro)}
              >
                {addBairroMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Estatísticas globais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-center">
            <KStat label="Beneficiários" value={adminStats?.totalBeneficiarios ?? "—"} />
            <KStat label="Total retiradas" value={adminStats?.totalRetiradas ?? "—"} />
            <KStat label="Usuários" value={adminStats?.totalUsuarios ?? "—"} />
            <KStat label="Unidades" value={adminStats?.totalUnidades ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Simular acesso de usuário</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {usuarios.filter(u => u.id !== me?.id).map(u => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {u.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.nome}</div>
                <div className="text-xs text-muted-foreground">{u.role} · {u.email}</div>
              </div>
              <Badge variant={u.status === "ATIVO" ? "default" : "secondary"} className="shrink-0 text-xs">{u.status}</Badge>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 shrink-0"
                disabled={u.status !== "ATIVO" || impersonating === u.id}
                onClick={() => handleImpersonate(u.id, u.nome)}
              >
                {impersonating === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                Simular
              </Button>
            </div>
          ))}
          {usuarios.filter(u => u.id !== me?.id).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum outro usuário cadastrado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Link de auto-cadastro</CardTitle>
          <Button
            size="sm"
            variant={cadastroConfig?.ativo ? "destructive" : "default"}
            className="gap-1.5"
            disabled={toggleCadastroMut.isPending}
            onClick={() => toggleCadastroMut.mutate(!cadastroConfig?.ativo)}
          >
            {toggleCadastroMut.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : cadastroConfig?.ativo
              ? <ToggleRight className="h-3.5 w-3.5" />
              : <ToggleLeft className="h-3.5 w-3.5" />}
            {cadastroConfig?.ativo ? "Desativar" : "Ativar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Quando ativo, qualquer pessoa com o link pode se pré-cadastrar. Os cadastros chegam como <strong>Pendente</strong> para aprovação.
          </p>
          {cadastroConfig?.ativo && linkCadastro ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 text-xs font-mono">
                {linkCadastro}
              </code>
              <Button
                size="icon" variant="outline" className="h-9 w-9 shrink-0"
                onClick={() => { navigator.clipboard.writeText(linkCadastro); toast.success("Link copiado!"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {cadastroConfig?.ativo === false ? "Link desativado. Clique em Ativar para gerar." : "Carregando..."}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Multiunidades</CardTitle>
          <Button size="sm" className="gap-1" onClick={() => toast.info("Funcionalidade em breve.")}>
            <Plus className="h-4 w-4" />Nova unidade
          </Button>
        </CardHeader>
        <CardContent>
          {unidades.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">Nenhuma unidade cadastrada.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {unidades.map((u: any) => (
                <Card key={u.id} className="border-2"><CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{u.nome}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{u.cidade}</div>
                    </div>
                    {u.status === "ATIVA"
                      ? <Badge className="bg-primary text-primary-foreground">Ativa</Badge>
                      : <Badge variant="secondary">Pausada</Badge>}
                  </div>
                  <div className="mt-3 text-sm"><span className="text-muted-foreground">Cota diária:</span> <strong>{u.cotaDiaria}</strong></div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KStat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-2xl font-bold">{String(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
