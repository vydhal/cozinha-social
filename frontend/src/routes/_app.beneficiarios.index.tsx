import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Upload, MapPin, Phone, Filter, ScanFace, ChevronLeft, ChevronRight, Download, FileText, Loader2, Accessibility } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { beneficiariosApi, type Beneficiario } from "@/lib/api/beneficiarios.api";
import { useSettings } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/beneficiarios/")({
  validateSearch: (s: Record<string, unknown>): { biometria?: string; deficiencia?: string } => ({
    ...(typeof s.biometria === "string" ? { biometria: s.biometria } : {}),
    ...(typeof s.deficiencia === "string" ? { deficiencia: s.deficiencia } : {}),
  }),
  component: BeneficiariosList,
});

const statusLabel: Record<Beneficiario["status"], string> = {
  ATIVO: "Ativo",
  PENDENTE: "Pendente",
  BLOQUEADO: "Bloqueado",
};

const biometriaLabel: Record<Beneficiario["biometriaStatus"], string> = {
  VERIFICADA: "Verificada",
  PENDENTE: "Pendente",
  INDISPONIVEL: "Indisponível",
};

function statusBadge(status: Beneficiario["status"]) {
  if (status === "ATIVO") return <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Ativo</Badge>;
  if (status === "PENDENTE") return <Badge variant="secondary">Pendente</Badge>;
  return <Badge variant="destructive">Bloqueado</Badge>;
}

function biometriaBadge(status: Beneficiario["biometriaStatus"]) {
  if (status === "VERIFICADA") return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 gap-1"><ScanFace className="h-3 w-3" /> Biometria ok</Badge>;
  if (status === "PENDENTE") return <Badge variant="outline" className="gap-1 border-warning text-warning-foreground"><ScanFace className="h-3 w-3" /> Sem biometria</Badge>;
  return <Badge variant="outline" className="gap-1"><ScanFace className="h-3 w-3" /> Indisponível</Badge>;
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
    ["Deficiência",    b => b.deficiencia ? (b.qualDeficiencia || "Sim") : "Não"],
    ["Cadastrado em",  b => b.criadoEm ? new Date(b.criadoEm).toLocaleDateString("pt-BR") : ""],
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
  const { biometria: biometriaParam, deficiencia: deficienciaParam } = useSearch({ from: "/_app/beneficiarios/" });
  const { logoUrl, nomeCozinha } = useSettings();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [biometria, setBiometria] = useState<string>(biometriaParam ?? "todas");
  const [deficiencia, setDeficiencia] = useState<string>(deficienciaParam ?? "todas");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const deficienciaParamApi = deficiencia === "com" ? "true" : deficiencia === "sem" ? "false" : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["beneficiarios", debouncedQ, status, biometria, deficiencia, page],
    queryFn: () => beneficiariosApi.list({
      search: debouncedQ || undefined,
      status: status !== "todos" ? status.toUpperCase() as Beneficiario["status"] : undefined,
      biometriaStatus: biometria !== "todas" ? biometria.toUpperCase() : undefined,
      deficiencia: deficienciaParamApi,
      page,
      limit: 18,
    }),
  });

  const list = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  async function fetchAllFiltered() {
    const result = await beneficiariosApi.list({
      search: debouncedQ || undefined,
      status: status !== "todos" ? status.toUpperCase() as Beneficiario["status"] : undefined,
      biometriaStatus: biometria !== "todas" ? biometria.toUpperCase() : undefined,
      deficiencia: deficienciaParamApi,
      limit: 9999,
    });
    return result.items;
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const items = await fetchAllFiltered();
      exportToCsv(items);
    } finally {
      setExporting(false);
    }
  };

  async function exportPdf() {
    setExportingPdf(true);
    try {
      const items = await fetchAllFiltered();
      if (!items.length) { toast.error("Nenhum beneficiário para exportar."); return; }

      const origin = window.location.origin;
      const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const logoHtml = logoUrl
        ? `<img src="${origin}${logoUrl.startsWith("/") ? logoUrl : "/" + logoUrl}" alt="Logo" style="height:60px;object-fit:contain;" />`
        : `<div style="width:60px;height:60px;background:#2f9d6b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;">🍽</div>`;

      const ativos = items.filter(b => b.status === "ATIVO").length;
      const pendentes = items.filter(b => b.status === "PENDENTE").length;
      const bloqueados = items.filter(b => b.status === "BLOQUEADO").length;
      const comBiometria = items.filter(b => b.biometriaStatus === "VERIFICADA").length;
      const semBiometria = items.length - comBiometria;

      const filtros: string[] = [];
      if (debouncedQ) filtros.push(`Busca: "${debouncedQ}"`);
      if (status !== "todos") filtros.push(`Status: ${statusLabel[status.toUpperCase() as Beneficiario["status"]]}`);
      if (biometria !== "todas") filtros.push(`Biometria: ${biometriaLabel[biometria.toUpperCase() as Beneficiario["biometriaStatus"]]}`);
      if (deficiencia !== "todas") filtros.push(`Deficiência: ${deficiencia === "com" ? "Com" : "Sem"}`);

      const rows = items.map(b => `<tr>
        <td>${b.nome}</td>
        <td>${b.cpf}</td>
        <td>${b.bairro || "—"}</td>
        <td>${b.telefone || "—"}</td>
        <td style="text-align:center;">${statusLabel[b.status]}</td>
        <td style="text-align:center;">${biometriaLabel[b.biometriaStatus]}</td>
        <td style="text-align:center;">${b.quentinhasAutorizadas}</td>
        <td style="text-align:center;">${b.criadoEm ? new Date(b.criadoEm).toLocaleDateString("pt-BR") : "—"}</td>
      </tr>`).join("");

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
        <title>Beneficiários — ${nomeCozinha || "Mesa do Bem"}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 0 24px; }
          .header { display: flex; align-items: center; gap: 16px; padding: 20px 0 12px; border-bottom: 3px solid #2f9d6b; margin-bottom: 16px; }
          .header-text h1 { font-size: 18px; color: #111; }
          .header-text p { font-size: 11px; color: #555; margin-top: 2px; }
          .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
          .stat { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 90px; flex: 1; }
          .stat strong { display: block; font-size: 20px; color: #2f9d6b; }
          .stat span { font-size: 10px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 80px; }
          th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; padding: 6px 8px; text-align: left; border: 1px solid #e0e0e0; }
          td { border: 1px solid #e8e8e8; padding: 5px 8px; vertical-align: middle; font-size: 11px; }
          tr:nth-child(even) td { background: #fafafa; }
          .footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; }
          .footer img { width: 100%; display: block; }
          @media print {
            body { padding: 0 16px; }
            .footer { position: fixed; bottom: 0; left: 0; right: 0; }
          }
        </style>
      </head><body>
        <div class="header">
          ${logoHtml}
          <div class="header-text">
            <h1>${nomeCozinha || "Mesa do Bem"}</h1>
            <p>Lista de Beneficiários</p>
            <p>Gerado em ${date}${filtros.length ? ` · ${filtros.join(" · ")}` : ""}</p>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><strong>${items.length}</strong><span>Total</span></div>
          <div class="stat"><strong>${ativos}</strong><span>Ativos</span></div>
          <div class="stat"><strong>${pendentes}</strong><span>Pendentes</span></div>
          <div class="stat"><strong>${bloqueados}</strong><span>Bloqueados</span></div>
          <div class="stat"><strong>${comBiometria}</strong><span>Com biometria</span></div>
          <div class="stat"><strong>${semBiometria}</strong><span>Sem biometria</span></div>
        </div>

        <table>
          <thead><tr>
            <th>Nome</th><th>CPF</th><th>Bairro</th><th>Telefone</th>
            <th style="text-align:center;">Status</th><th style="text-align:center;">Biometria</th>
            <th style="text-align:center;">Quentinhas/dia</th><th style="text-align:center;">Cadastrado em</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
          <img src="${origin}/rodape.png" alt="Rodapé institucional" />
        </div>

        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`;

      const w = window.open("", "_blank");
      if (!w) { toast.error("Permita pop-ups para exportar PDF."); return; }
      w.document.write(html);
      w.document.close();
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beneficiários"
        subtitle={`${total} pessoa(s) cadastrada(s) — identificação por endereço (família).`}
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportPdf} disabled={exportingPdf}>
              {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
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
          <Select value={biometria} onValueChange={(v) => { setBiometria(v); setPage(1); }}>
            <SelectTrigger className="h-11 w-full sm:w-52"><ScanFace className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas biometrias</SelectItem>
              <SelectItem value="verificada">Com biometria</SelectItem>
              <SelectItem value="pendente">Sem biometria (pendente)</SelectItem>
              <SelectItem value="indisponivel">Indisponível</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deficiencia} onValueChange={(v) => { setDeficiencia(v); setPage(1); }}>
            <SelectTrigger className="h-11 w-full sm:w-52"><Accessibility className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos (deficiência)</SelectItem>
              <SelectItem value="com">Com deficiência</SelectItem>
              <SelectItem value="sem">Sem deficiência</SelectItem>
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
                {b.criadoEm && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Cadastrado em {new Date(b.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {biometriaBadge(b.biometriaStatus)}
                  {b.deficiencia && (
                    <Badge
                      className="gap-1 bg-accent/15 text-accent-foreground hover:bg-accent/15"
                      title={b.qualDeficiencia || "Pessoa com deficiência"}
                    >
                      <Accessibility className="h-3 w-3" /> Deficiência
                    </Badge>
                  )}
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
