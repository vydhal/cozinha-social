import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Printer, Pencil, Check, X, Ban, UtensilsCrossed } from "lucide-react";
import { retiradasApi } from "@/lib/api/retiradas.api";
import { configuracoesApi } from "@/lib/api/configuracoes.api";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/lista-diaria")({ component: ListaDiaria });

type Filtro = "ENTREGUE" | "BLOQUEADO";

function statusBadge(status: string) {
  if (status === "ENTREGUE") return <Badge className="bg-primary text-primary-foreground">Entregue</Badge>;
  if (status === "DUPLICADO_BLOQUEADO") return <Badge variant="destructive">Bloqueado</Badge>;
  return <Badge variant="secondary">Ausente</Badge>;
}

function ListaDiaria() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const [filtro, setFiltro] = useState<Filtro>("ENTREGUE");
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["lista-diaria"],
    queryFn: () => retiradasApi.listaDiaria(),
    refetchInterval: 30_000,
  });

  const lista = data?.retiradas ?? [];
  const stats = data?.stats;

  const listaFiltrada = lista.filter((r) =>
    filtro === "ENTREGUE" ? r.status === "ENTREGUE" : r.status === "DUPLICADO_BLOQUEADO",
  );

  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const updateLimitMut = useMutation({
    mutationFn: (val: number) => configuracoesApi.updateLimiteDiario(val),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista-diaria"] });
      setEditingLimit(false);
      toast.success("Limite diário atualizado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar limite"),
  });

  const startEdit = () => {
    setLimitInput(String(stats?.limiteDiario ?? 100));
    setEditingLimit(true);
  };

  const saveLimit = () => {
    const val = parseInt(limitInput, 10);
    if (!val || val < 1) return toast.error("Informe um número válido.");
    updateLimitMut.mutate(val);
  };

  const handlePrint = () => {
    // Impressão sempre exibe apenas ENTREGUES
    if (filtro !== "ENTREGUE") {
      setFiltro("ENTREGUE");
      setTimeout(() => window.print(), 80);
    } else {
      window.print();
    }
  };

  const pct = stats ? Math.min(100, Math.round((stats.totalQuentinhas / stats.limiteDiario) * 100)) : 0;
  const disponivel = stats?.disponivel ?? 0;
  const limitColor = pct >= 90 ? "text-destructive" : pct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-primary";
  const borderCritical = pct >= 90 ? "border-destructive/60" : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lista diária"
        subtitle={`Retiradas do dia — ${hoje}`}
        actions={
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />Imprimir
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.entregues}</div>
              <div className="text-xs text-muted-foreground">Entregues</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.ausentes}</div>
              <div className="text-xs text-muted-foreground">Ausentes</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.totalQuentinhas}</div>
              <div className="text-xs text-muted-foreground">Quentinhas entregues</div>
            </CardContent>
          </Card>

          <Card className={borderCritical}>
            <CardContent className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-2xl font-bold ${limitColor}`}>{disponivel}</span>
                {canEdit && !editingLimit && (
                  <button onClick={startEdit} className="text-muted-foreground hover:text-foreground transition-colors" title="Editar limite diário">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {canEdit && editingLimit && (
                  <div className="flex items-center gap-1">
                    <button onClick={saveLimit} disabled={updateLimitMut.isPending} className="text-primary hover:text-primary/80">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingLimit(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {editingLimit ? (
                <Input
                  type="number"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveLimit(); if (e.key === "Escape") setEditingLimit(false); }}
                  className="h-6 w-full px-1.5 text-xs"
                  autoFocus
                  min={1}
                  max={9999}
                  placeholder="Limite diário"
                />
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">Disponíveis de {stats.limiteDiario}</div>
                  <Progress
                    value={pct}
                    className={`mt-1.5 h-1.5 ${pct >= 90 ? "[&>div]:bg-destructive" : pct >= 70 ? "[&>div]:bg-yellow-500" : ""}`}
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground">{pct}% utilizado</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alternador de visualização — oculto na impressão */}
      <div className="flex items-center gap-2 print:hidden">
        <button
          onClick={() => setFiltro("ENTREGUE")}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            filtro === "ENTREGUE"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          Entregues
          <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${filtro === "ENTREGUE" ? "bg-primary-foreground/20" : "bg-muted"}`}>
            {stats?.entregues ?? 0}
          </span>
        </button>

        <button
          onClick={() => setFiltro("BLOQUEADO")}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            filtro === "BLOQUEADO"
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Ban className="h-4 w-4" />
          Tentativas bloqueadas
          {(stats?.bloqueados ?? 0) > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${filtro === "BLOQUEADO" ? "bg-destructive-foreground/20" : "bg-destructive/10 text-destructive"}`}>
              {stats?.bloqueados}
            </span>
          )}
        </button>

        {filtro === "BLOQUEADO" && (
          <span className="ml-auto text-xs text-muted-foreground">
            Estes registros não entram no relatório impresso.
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">CPF</th>
                  <th className="px-4 py-3 font-medium">Horário</th>
                  <th className="px-4 py-3 font-medium">Qtd</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Operador</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {filtro === "ENTREGUE" ? "Nenhuma retirada entregue hoje." : "Nenhuma tentativa bloqueada hoje."}
                    </td>
                  </tr>
                ) : listaFiltrada.map((r: any, i: number) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{String(i + 1).padStart(3, "0")}</td>
                    <td className="px-4 py-3 font-medium">{r.beneficiario?.nome ?? "—"}</td>
                    <td className="px-4 py-3">{r.beneficiario?.cpf ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{new Date(r.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3">{r.quantidade}</td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3">{r.operador?.nome ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Rodapé de impressão — só visível ao imprimir */}
      <div className="hidden print:block mt-4 text-xs text-muted-foreground text-center border-t pt-3">
        Impresso em {new Date().toLocaleString("pt-BR")} · Apenas retiradas com status Entregue
      </div>
    </div>
  );
}
