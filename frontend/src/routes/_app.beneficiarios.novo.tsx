import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, ShieldCheck, ArrowLeft, Save, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { beneficiariosApi } from "@/lib/api/beneficiarios.api";
import { ApiError } from "@/lib/api/client";
import { maskCpf, maskCep } from "@/lib/utils";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_app/beneficiarios/novo")({
  component: NovoBeneficiario,
});

const GENERO_OPTS = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMININO", label: "Feminino" },
  { value: "NAO_BINARIO", label: "Não-binário" },
  { value: "OUTRO", label: "Outro" },
  { value: "NAO_INFORMADO", label: "Não informado" },
];
const RACA_OPTS = [
  { value: "BRANCA", label: "Branca" },
  { value: "PRETA", label: "Preta" },
  { value: "PARDA", label: "Parda" },
  { value: "AMARELA", label: "Amarela" },
  { value: "INDIGENA", label: "Indígena" },
  { value: "NAO_INFORMADO", label: "Não informado" },
];
const CIVIL_OPTS = [
  { value: "SOLTEIRO", label: "Solteiro(a)" },
  { value: "CASADO", label: "Casado(a)" },
  { value: "DIVORCIADO", label: "Divorciado(a)" },
  { value: "VIUVO", label: "Viúvo(a)" },
  { value: "UNIAO_ESTAVEL", label: "União estável" },
  { value: "OUTRO", label: "Outro" },
];
const UF_OPTS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function NovoBeneficiario() {
  const navigate = useNavigate();
  const faceRef = useRef<HTMLInputElement>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const docRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});

  const [form, setForm] = useState({
    // Dados pessoais
    nome: "", cpf: "", rg: "", nascimento: "", telefone: "",
    genero: "" as string, raca: "" as string, estadoCivil: "" as string,
    naturalidade: "", filiaPai: "", filiaMae: "",
    // Endereço
    cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "" as string,
    comunidade: "",
    // Situação socioeconômica
    rendaFamiliar: "" as string,
    bolsaFamilia: "" as string,
    nis: "",
    deficiencia: "" as string,
    qualDeficiencia: "",
    // Família
    pessoasCasa: 1, nomesMoradores: "", quentinhasAutorizadas: 1,
    responsavel: true, observacoes: "", status: "PENDENTE" as const,
  });

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const buscarCep = async (cep: string) => {
    const raw = cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (data.erro) return;
      if (data.logradouro) set("endereco", data.logradouro);
      if (data.bairro) set("bairro", data.bairro);
      if (data.localidade) set("cidade", data.localidade);
      if (data.uf) set("uf", data.uf);
    } catch {}
  };

  const createMut = useMutation({
    mutationFn: beneficiariosApi.create,
    onSuccess: async (beneficiario) => {
      if (faceFile) {
        try { await beneficiariosApi.uploadFoto(beneficiario.id, faceFile); } catch { /* não bloqueante */ }
      }
      for (const [tipo, file] of Object.entries(docFiles)) {
        try { await beneficiariosApi.uploadDocumento(beneficiario.id, file, tipo); } catch { /* não bloqueante */ }
      }
      toast.success("Beneficiário cadastrado com sucesso.");
      navigate({ to: "/beneficiarios" });
    },
    onError: (e: any) => {
      if (e instanceof ApiError && e.details?.length) {
        toast.error("Dados inválidos", { description: e.details.map((d) => d.message).join(" • ") });
      } else {
        toast.error(e?.message ?? "Erro ao cadastrar");
      }
    },
  });

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.cpf || !form.nascimento) {
      return toast.error("Preencha nome, CPF e data de nascimento.");
    }
    const payload: Record<string, unknown> = { ...form };
    // Converte strings para tipos corretos
    if (form.rendaFamiliar) payload.rendaFamiliar = parseFloat(String(form.rendaFamiliar).replace(",", ".")) || undefined;
    else delete payload.rendaFamiliar;
    payload.bolsaFamilia = form.bolsaFamilia === "sim" ? true : form.bolsaFamilia === "nao" ? false : undefined;
    payload.deficiencia = form.deficiencia === "sim" ? true : form.deficiencia === "nao" ? false : undefined;
    if (!form.genero) delete payload.genero;
    if (!form.raca) delete payload.raca;
    if (!form.estadoCivil) delete payload.estadoCivil;
    if (!form.uf) delete payload.uf;
    if (!form.qualDeficiencia || payload.deficiencia !== true) delete payload.qualDeficiencia;
    createMut.mutate(payload as any);
  };

  return (
    <form onSubmit={salvar} className="space-y-6">
      <PageHeader
        title="Novo cadastro"
        subtitle="Preencha os dados do beneficiário. Famílias são identificadas pelo endereço."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/beneficiarios" })} className="gap-2">
              <ArrowLeft className="h-4 w-4" />Voltar
            </Button>
            <Button type="submit" className="gap-2" disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar cadastro
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">

          {/* Dados pessoais */}
          <Card>
            <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo *" placeholder="Maria Aparecida Silva" className="sm:col-span-2"
                value={form.nome} onChange={e => set("nome", e.target.value)} required />
              <Field label="CPF *" placeholder="000.000.000-00" value={form.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} required />
              <Field label="RG" placeholder="00.000.000-0" value={form.rg} onChange={e => set("rg", e.target.value)} />
              <Field label="Data de nascimento *" type="date" value={form.nascimento} onChange={e => set("nascimento", e.target.value)} required />
              <Field label="Telefone / Contato" placeholder="(11) 90000-0000" value={form.telefone} onChange={e => set("telefone", e.target.value)} />
              <SelectField label="Gênero" value={form.genero} onValueChange={v => set("genero", v)} opts={GENERO_OPTS} placeholder="Selecionar..." />
              <SelectField label="Raça / Cor" value={form.raca} onValueChange={v => set("raca", v)} opts={RACA_OPTS} placeholder="Selecionar..." />
              <SelectField label="Estado civil" value={form.estadoCivil} onValueChange={v => set("estadoCivil", v)} opts={CIVIL_OPTS} placeholder="Selecionar..." />
              <Field label="Naturalidade" placeholder="Cidade/Estado de nascimento" value={form.naturalidade} onChange={e => set("naturalidade", e.target.value)} />
              <Field label="Filiação — Pai" placeholder="Nome do pai" value={form.filiaPai} onChange={e => set("filiaPai", e.target.value)} />
              <Field label="Filiação — Mãe" placeholder="Nome da mãe" value={form.filiaMae} onChange={e => set("filiaMae", e.target.value)} />
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader><CardTitle className="text-base">Endereço (identifica a família)</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-6">
              <Field label="CEP" placeholder="00000-000" className="sm:col-span-2" value={form.cep}
                onChange={e => set("cep", maskCep(e.target.value))}
                onBlur={() => buscarCep(form.cep)} />
              <Field label="Logradouro" placeholder="Rua / Avenida" className="sm:col-span-3" value={form.endereco} onChange={e => set("endereco", e.target.value)} />
              <Field label="Nº" placeholder="s/n" className="sm:col-span-1" value={form.numero} onChange={e => set("numero", e.target.value)} />
              <Field label="Bairro" className="sm:col-span-3" value={form.bairro} onChange={e => set("bairro", e.target.value)} />
              <Field label="Cidade" className="sm:col-span-2" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
              <div className="space-y-1.5 sm:col-span-1">
                <Label>UF</Label>
                <Select value={form.uf} onValueChange={v => set("uf", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UF_OPTS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Field label="Comunidade / Associação" placeholder="Nome da comunidade (opcional)" className="sm:col-span-6"
                value={form.comunidade} onChange={e => set("comunidade", e.target.value)} />
            </CardContent>
          </Card>

          {/* Situação socioeconômica */}
          <Card>
            <CardHeader><CardTitle className="text-base">Situação socioeconômica</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Renda familiar (R$)</Label>
                <Input placeholder="0,00" value={form.rendaFamiliar} onChange={e => set("rendaFamiliar", e.target.value)} />
              </div>
              <SelectField label="Recebe Bolsa Família?" value={form.bolsaFamilia}
                onValueChange={v => set("bolsaFamilia", v)}
                opts={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]}
                placeholder="Selecionar..." />
              <Field label="Número do NIS" placeholder="000.00000.00-0" value={form.nis} onChange={e => set("nis", e.target.value)} />
              <SelectField label="Possui alguma deficiência?" value={form.deficiencia}
                onValueChange={v => set("deficiencia", v)}
                opts={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]}
                placeholder="Selecionar..." />
              {form.deficiencia === "sim" && (
                <Field label="Qual deficiência?" className="sm:col-span-2"
                  placeholder="Descreva a deficiência" value={form.qualDeficiencia} onChange={e => set("qualDeficiencia", e.target.value)} />
              )}
            </CardContent>
          </Card>

          {/* Família e autorização */}
          <Card>
            <CardHeader><CardTitle className="text-base">Família e autorização</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Pessoas na casa" type="number" min={1} max={20}
                value={form.pessoasCasa} onChange={e => set("pessoasCasa", Number(e.target.value))} />
              <Field label="Quentinhas autorizadas" type="number" min={1} max={10}
                value={form.quentinhasAutorizadas} onChange={e => set("quentinhasAutorizadas", Number(e.target.value))} />
              <SelectField label="Responsável familiar" value={form.responsavel ? "sim" : "nao"}
                onValueChange={v => set("responsavel", v === "sim")}
                opts={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
              <SelectField label="Status inicial" value={form.status} onValueChange={v => set("status", v)}
                opts={[{ value: "PENDENTE", label: "Pendente" }, { value: "ATIVO", label: "Ativo" }]}
                className="sm:col-span-3" />
              <div className="sm:col-span-3 space-y-1.5">
                <Label>Nomes das pessoas que moram com você</Label>
                <Textarea placeholder="Liste os nomes dos moradores" rows={2}
                  value={form.nomesMoradores} onChange={e => set("nomesMoradores", e.target.value)} />
              </div>
              <div className="sm:col-span-3 space-y-1.5">
                <Label>Observações sociais</Label>
                <Textarea placeholder="Acompanhamento, vulnerabilidades, notas da equipe…" rows={3}
                  value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Foto de identificação</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div
                className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted cursor-pointer"
                onClick={() => faceRef.current?.click()}
              >
                {facePreview ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
                    <img src={facePreview} alt="Foto" className="h-full w-full object-cover" />
                    <div className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </motion.div>
                ) : (
                  <Camera className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <input ref={faceRef} type="file" accept="image/*" capture="user" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFaceFile(f); setFacePreview(URL.createObjectURL(f)); } }} />
              <Button type="button" className="w-full gap-2" variant={facePreview ? "outline" : "default"}
                onClick={() => faceRef.current?.click()}>
                <Camera className="h-4 w-4" />
                {facePreview ? "Substituir foto" : "Capturar / escolher foto"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Documentos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Opcional. Enviados após salvar o cadastro.</p>
              {[
                { tipo: "RG_FRENTE",   label: "Identidade — Frente" },
                { tipo: "RG_VERSO",    label: "Identidade — Verso" },
                { tipo: "COMPROVANTE", label: "Comprovante de residência" },
              ].map(({ tipo, label }) => (
                <div key={tipo}>
                  <input
                    ref={el => { docRefs.current[tipo] = el; }}
                    type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setDocFiles(prev => ({ ...prev, [tipo]: f }));
                      e.target.value = "";
                    }}
                  />
                  <button type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-dashed bg-muted/40 px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                    onClick={() => docRefs.current[tipo]?.click()}>
                    <span className={docFiles[tipo] ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
                    {docFiles[tipo]
                      ? <span className="text-xs text-primary font-medium truncate max-w-28">{docFiles[tipo].name}</span>
                      : <Upload className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

function Field({ label, className, ...rest }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input {...rest} />
    </div>
  );
}

function SelectField({ label, value, onValueChange, opts, placeholder, className }: {
  label: string; value: string; onValueChange: (v: string) => void;
  opts: { value: string; label: string }[]; placeholder?: string; className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder={placeholder ?? "Selecionar..."} /></SelectTrigger>
        <SelectContent>
          {opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
