import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Upload, MapPin, Phone, Filter, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { beneficiariosApi, type Beneficiario } from "@/lib/api/beneficiarios.api";

export const Route = createFileRoute("/_app/beneficiarios/")({
  component: BeneficiariosList,
});

function statusBadge(status: Beneficiario["status"]) {
  if (status === "ATIVO") return <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Ativo</Badge>;
  if (status === "PENDENTE") return <Badge variant="secondary">Pendente</Badge>;
  return <Badge variant="destructive">Bloqueado</Badge>;
}

function exportToCsv(items: Beneficiario[]) {
  const cols: [string, (b: Beneficiario) => string][] = [
    ["Nome",           b => b.nome ?? ""],
    ["CPF",            b => b.cpf ?? ""],
    ["RG",             b => b.rg ?? ""],
    ["Nascimento",     b => b.nascimento ? new Date(b.nascimento).toLocaleDateString("pt-BR") : ""],
    ["Telefone",       b => b.telefone ?? ""],
    ["Endereço",       b => b.endereco ?? ""],
    ["Número",         b => b.numero ?? ""],
    ["Bairro",         b => b.bairro ?? ""],
    ["Cidade",         b => b.cidade ?? ""],
    ["CEP",            b => b.cep ?? ""],
    ["Pessoas na casa",b => String(b.pessoasCasa ?? "")],
    ["Quentinhas/dia", b => String(b.quentinhasAutorizadas ?? "")],
    ["Status",         b => b.status ?? ""],
    ["Biometria",      b => b.biometriaStatus ?? ""],
  ];

  const header = cols.map(([label]) => label).join(";");
  const rows = items.map(b =>
    cols.map(([, fn]) => `"${fn(b).replace(/"/g, '""')}"`).join(";")
  );
  const csv = "﻿" + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `beneficiarios_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function BeneficiariosList() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["beneficiarios", debouncedQ, status, page],
    queryFn: () => beneficiariosApi.list({
      search: debouncedQ || undefined,
      status: status !== "todos" ? status.toUpperCase() as Beneficiario["status"] : undefined,
      page,
      limit: 18,
    }),
  });

  const list = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await beneficiariosApi.list({
        search: debouncedQ || undefined,
        status: status !== "todos" ? status.toUpperCase() as Beneficiario["status"] : undefined,
        limit: 9999,
      });
      exportToCsv(result.items);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beneficiários"
        subtitle={`${total} pessoa(s) cadastrada(s) — identificação por endereço (família).`}
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar
            </Button>
            <Link to="/beneficiarios/importar"><Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> Importar</Button></Link>
            <Link to="/beneficiarios/novo"><Button className="gap-2"><Plus className="h-4 w-4" /> Novo cadastro</Button></Link>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF ou bairro" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="h-11 pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-11 w-full sm:w-48"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="bloqueado">Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-20 animate-pulse rounded-lg bg-muted" /></CardContent></Card>
          ))
        ) : list.map((b) => (
          <Link key={b.id} to="/beneficiarios/$id" params={{ id: b.id }}>
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {b.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{b.nome}</div>
                    <div className="text-xs text-muted-foreground">CPF {b.cpf}</div>
                  </div>
                  {statusBadge(b.status)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {b.bairro}</div>
                  {b.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {b.telefone}</div>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="text-muted-foreground">Quentinhas/dia</span>
                  <span className="font-bold">{b.quentinhasAutorizadas}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!isLoading && list.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-10 text-center text-sm text-muted-foreground">Nenhum beneficiário encontrado.</CardContent></Card>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
