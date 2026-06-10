import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet, FileText, UploadCloud, CheckCircle2, AlertTriangle,
  ArrowLeft, Loader2, XCircle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { beneficiariosApi } from "@/lib/api/beneficiarios.api";

export const Route = createFileRoute("/_app/beneficiarios/importar")({
  component: Importar,
});

type ImportResult = {
  importados: number;
  erros: number;
  alertas: number;
  total: number;
  detalhes: Array<{ linha: number; status: "OK" | "ERRO" | "ALERTA"; mensagem?: string }>;
};

const ALL_COLUMNS = [
  { key: "nome", label: "Nome completo", req: true },
  { key: "cpf", label: "CPF (000.000.000-00)", req: true },
  { key: "rg", label: "RG" },
  { key: "nascimento", label: "Data nascimento (AAAA-MM-DD)" },
  { key: "telefone", label: "Telefone" },
  { key: "endereco", label: "Endereço (logradouro)" },
  { key: "numero", label: "Número" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
  { key: "cep", label: "CEP (00000-000)" },
  { key: "comunidade", label: "Comunidade" },
  { key: "pessoas_casa", label: "Pessoas na casa" },
  { key: "nomes_moradores", label: "Nomes dos moradores" },
  { key: "quentinhas", label: "Quentinhas autorizadas" },
  { key: "genero", label: "Gênero (MASCULINO / FEMININO / NAO_BINARIO / OUTRO)" },
  { key: "raca", label: "Raça (BRANCA / PRETA / PARDA / AMARELA / INDIGENA)" },
  { key: "naturalidade", label: "Naturalidade" },
  { key: "estado_civil", label: "Estado civil (SOLTEIRO / CASADO / DIVORCIADO / VIUVO / UNIAO_ESTAVEL)" },
  { key: "renda_familiar", label: "Renda familiar (ex: 1200.00)" },
  { key: "bolsa_familia", label: "Bolsa Família (sim / nao)" },
  { key: "nis", label: "NIS" },
  { key: "deficiencia", label: "Deficiência (sim / nao)" },
  { key: "qual_deficiencia", label: "Qual deficiência" },
  { key: "filia_mae", label: "Nome da mãe" },
  { key: "filia_pai", label: "Nome do pai" },
];

const TEMPLATE_HEADER = ALL_COLUMNS.map(c => c.key).join(",") + "\n";

function downloadTemplate() {
  const blob = new Blob(["﻿" + TEMPLATE_HEADER], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_beneficiarios.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Progress Dialog ──────────────────────────────────────────────────────────

type ProgressState = "idle" | "uploading" | "done" | "error";

function ImportProgressDialog({
  open,
  fileName,
  state,
  result,
  errorMsg,
  onClose,
}: {
  open: boolean;
  fileName: string | null;
  state: ProgressState;
  result: ImportResult | null;
  errorMsg: string | null;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (state === "uploading") {
      setProgress(5);
      const steps = [15, 28, 42, 55, 65, 73, 80, 85];
      let i = 0;
      const id = setInterval(() => {
        if (i < steps.length) setProgress(steps[i++]);
        else clearInterval(id);
      }, 350);
      return () => clearInterval(id);
    }
    if (state === "done" || state === "error") {
      setProgress(100);
    }
    if (state === "idle") {
      setProgress(0);
    }
  }, [state]);

  const done = state === "done";
  const errored = state === "error";
  const loading = state === "uploading";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && (done || errored)) onClose(); }}>
      <DialogContent className="max-w-md" onInteractOutside={e => { if (loading) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {done && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {errored && <XCircle className="h-4 w-4 text-destructive" />}
            {loading ? "Importando…" : done ? "Importação concluída" : "Erro na importação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fileName && (
            <p className="truncate text-xs text-muted-foreground">{fileName}</p>
          )}

          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-right text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>

          {/* Steps */}
          <ol className="space-y-2 text-sm">
            <Step
              label="Enviando arquivo"
              status={loading || done || errored ? "done" : "pending"}
            />
            <Step
              label="Processando registros"
              status={loading ? "active" : done || errored ? "done" : "pending"}
            />
            <Step
              label="Resultado"
              status={done ? "done" : errored ? "error" : "pending"}
            />
          </ol>

          {/* Summary after success */}
          {done && result && (
            <div className="grid grid-cols-3 gap-2 rounded-xl border p-3">
              <Stat label="Importados" value={result.importados} color="text-green-600" />
              <Stat label="Alertas" value={result.alertas} color="text-yellow-600" />
              <Stat label="Erros" value={result.erros} color="text-destructive" />
            </div>
          )}

          {errored && errorMsg && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMsg}
            </p>
          )}
        </div>

        {(done || errored) && (
          <DialogFooter>
            <Button onClick={onClose} className="w-full">Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Step({ label, status }: { label: string; status: "pending" | "active" | "done" | "error" }) {
  return (
    <li className="flex items-center gap-2">
      {status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
      {status === "active" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
      {status === "error" && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
      {status === "pending" && <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" />}
      <span className={
        status === "active" ? "font-medium text-foreground" :
        status === "done" ? "text-muted-foreground line-through" :
        status === "error" ? "text-destructive" :
        "text-muted-foreground"
      }>{label}</span>
    </li>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

function Importar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const importMut = useMutation({
    mutationFn: (file: File) => beneficiariosApi.importar(file),
    onSuccess: (data) => {
      setResult(data as ImportResult);
      setProgressState("done");
      toast.success(`${data.importados} cadastro(s) importado(s).`);
    },
    onError: (e: any) => {
      setErrorMsg(e.message ?? "Erro na importação");
      setProgressState("error");
      toast.error(e.message ?? "Erro na importação");
    },
  });

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    setErrorMsg(null);
    setProgressState("uploading");
    setDialogOpen(true);
    importMut.mutate(file);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setProgressState("idle");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importação em massa"
        subtitle="Importe planilhas CSV das fichas físicas."
        actions={
          <Link to="/beneficiarios">
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upload card */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div className="font-semibold">Importar CSV</div>
            {fileName && (
              <p className="max-w-full truncate text-sm text-muted-foreground">{fileName}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo CSV com os dados dos beneficiários.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importMut.isPending}
              className="gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              Selecionar arquivo
            </Button>
          </CardContent>
        </Card>

        {/* Template card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modelo recomendado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Colunas suportadas:</p>
            <div className="max-h-56 overflow-y-auto rounded-lg border bg-muted/40 p-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-1 text-left font-medium">Coluna</th>
                    <th className="pb-1 text-left font-medium">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ALL_COLUMNS.map(c => (
                    <tr key={c.key}>
                      <td className="py-1 pr-3 font-mono text-primary">{c.key}</td>
                      <td className="py-1 text-muted-foreground">
                        {c.label}
                        {c.req && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">obrig.</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Campos marcados como <strong>obrig.</strong> são obrigatórios. Os demais são opcionais e serão ignorados se vazios.</span>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
              <FileText className="h-4 w-4" /> Baixar modelo
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results table (shown after dialog is closed if there were errors/alerts) */}
      {result && !dialogOpen && result.detalhes.filter(d => d.status !== "OK").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Detalhes — alertas e erros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2 font-medium">Linha</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {result.detalhes.filter(d => d.status !== "OK").map((d, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2">{d.linha}</td>
                      <td className="px-4 py-2">
                        {d.status === "ALERTA"
                          ? <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Alerta</Badge>
                          : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Erro</Badge>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{d.mensagem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ImportProgressDialog
        open={dialogOpen}
        fileName={fileName}
        state={progressState}
        result={result}
        errorMsg={errorMsg}
        onClose={handleClose}
      />
    </div>
  );
}
