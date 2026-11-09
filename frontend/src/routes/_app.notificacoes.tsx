import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, UserPlus, FileText, Bell, ChevronRight } from "lucide-react";
import { notificacoesApi, type Notificacao, type TipoNotificacao } from "@/lib/api/notificacoes.api";

export const Route = createFileRoute("/_app/notificacoes")({ component: Notificacoes });

const grupos: { tipo: TipoNotificacao; titulo: string; icon: React.ElementType }[] = [
  { tipo: "ESTOQUE_BAIXO", titulo: "Estoque baixo", icon: Package },
  { tipo: "BENEFICIARIO_PENDENTE", titulo: "Cadastros pendentes de aprovação", icon: UserPlus },
  { tipo: "DOCUMENTO_PENDENTE", titulo: "Documentos pendentes de avaliação", icon: FileText },
];

function fmtData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Notificacoes() {
  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => notificacoesApi.list(),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Notificações" subtitle="Itens que precisam da sua atenção, atualizados em tempo real." />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-16 animate-pulse rounded-lg bg-muted" /></CardContent></Card>
          ))}
        </div>
      ) : notificacoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Bell className="h-8 w-8" />
            <div className="font-medium">Tudo em dia</div>
            <div className="text-sm">Nenhuma notificação pendente no momento.</div>
          </CardContent>
        </Card>
      ) : (
        grupos.map((g) => {
          const itens = notificacoes.filter((n) => n.tipo === g.tipo);
          if (itens.length === 0) return null;
          const GIcon = g.icon;
          return (
            <Card key={g.tipo}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GIcon className="h-4 w-4" />{g.titulo}
                  <Badge variant="secondary" className="ml-1">{itens.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-0">
                {itens.map((n: Notificacao) => (
                  <Link
                    key={n.id}
                    to={n.link}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{n.titulo}</div>
                      <div className="truncate text-xs text-muted-foreground">{n.descricao} · {fmtData(n.criadoEm)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {n.severidade === "alta" && <Badge variant="destructive">Urgente</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
