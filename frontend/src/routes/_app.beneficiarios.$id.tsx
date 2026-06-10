import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, MapPin, Phone, IdCard, Cake, Home, ShieldCheck, Camera,
  Edit2, Trash2, Save, X, Loader2, Upload, Check, ScanFace, UserPlus, UserMinus, Search,
  FileText, CheckCircle2, XCircle, Eye, AlertCircle,
} from "lucide-react";
import { beneficiariosApi, type Documento } from "@/lib/api/beneficiarios.api";
import { toast } from "sonner";
import { type FamiliaMembro } from "@/lib/api/beneficiarios.api";
import { useAuth } from "@/lib/store";
import { ApiError } from "@/lib/api/client";
import { maskCpf, maskCep } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/beneficiarios/$id")({
  component: BeneficiarioDetalhe,
});

const GENERO_OPTS = [
  { value: "MASCULINO", label: "Masculino" }, { value: "FEMININO", label: "Feminino" },
  { value: "NAO_BINARIO", label: "Não-binário" }, { value: "OUTRO", label: "Outro" },
  { value: "NAO_INFORMADO", label: "Não informado" },
];
const RACA_OPTS = [
  { value: "BRANCA", label: "Branca" }, { value: "PRETA", label: "Preta" },
  { value: "PARDA", label: "Parda" }, { value: "AMARELA", label: "Amarela" },
  { value: "INDIGENA", label: "Indígena" }, { value: "NAO_INFORMADO", label: "Não informado" },
];
const CIVIL_OPTS = [
  { value: "SOLTEIRO", label: "Solteiro(a)" }, { value: "CASADO", label: "Casado(a)" },
  { value: "DIVORCIADO", label: "Divorciado(a)" }, { value: "VIUVO", label: "Viúvo(a)" },
  { value: "UNIAO_ESTAVEL", label: "União estável" }, { value: "OUTRO", label: "Outro" },
];
const UF_OPTS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type EditForm = {
  nome: string; cpf: string; rg: string; nascimento: string; telefone: string;
  endereco: string; numero: string; bairro: string; cidade: string; cep: string; uf: string; comunidade: string;
  genero: string; raca: string; estadoCivil: string; naturalidade: string; filiaPai: string; filiaMae: string;
  rendaFamiliar: string; bolsaFamilia: string; nis: string; deficiencia: string; qualDeficiencia: string;
  pessoasCasa: number; nomesMoradores: string; quentinhasAutorizadas: number; responsavel: boolean;
  observacoes: string; status: "ATIVO" | "PENDENTE" | "BLOQUEADO";
};

function BeneficiarioDetalhe() {
  const { id } = useParams({ from: "/_app/beneficiarios/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    nome: "", cpf: "", rg: "", nascimento: "", telefone: "",
    endereco: "", numero: "", bairro: "", cidade: "", cep: "", uf: "", comunidade: "",
    genero: "", raca: "", estadoCivil: "", naturalidade: "", filiaPai: "", filiaMae: "",
    rendaFamiliar: "", bolsaFamilia: "", nis: "", deficiencia: "", qualDeficiencia: "",
    pessoasCasa: 1, nomesMoradores: "", quentinhasAutorizadas: 1, responsavel: false,
    observacoes: "", status: "PENDENTE",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["beneficiario", id],
    queryFn: () => beneficiariosApi.getById(id),
  });

  useEffect(() => {
    if (data) {
      const b = data as any;
      setEditForm({
        nome: b.nome ?? "", cpf: b.cpf ?? "", rg: b.rg ?? "",
        nascimento: b.nascimento ? String(b.nascimento).split("T")[0] : "",
        telefone: b.telefone ?? "",
        endereco: b.endereco ?? "", numero: b.numero ?? "",
        bairro: b.bairro ?? "", cidade: b.cidade ?? "", cep: b.cep ?? "",
        uf: b.uf ?? "", comunidade: b.comunidade ?? "",
        genero: b.genero ?? "", raca: b.raca ?? "", estadoCivil: b.estadoCivil ?? "",
        naturalidade: b.naturalidade ?? "", filiaPai: b.filiaPai ?? "", filiaMae: b.filiaMae ?? "",
        rendaFamiliar: b.rendaFamiliar != null ? String(b.rendaFamiliar) : "",
        bolsaFamilia: b.bolsaFamilia === true ? "sim" : b.bolsaFamilia === false ? "nao" : "",
        nis: b.nis ?? "",
        deficiencia: b.deficiencia === true ? "sim" : b.deficiencia === false ? "nao" : "",
        qualDeficiencia: b.qualDeficiencia ?? "",
        pessoasCasa: b.pessoasCasa ?? 1, nomesMoradores: b.nomesMoradores ?? "",
        quentinhasAutorizadas: b.quentinhasAutorizadas ?? 1,
        responsavel: b.responsavel ?? false,
        observacoes: b.observacoes ?? "", status: b.status ?? "PENDENTE",
      });
    }
  }, [data]);

  const set = (k: keyof EditForm, v: unknown) => setEditForm(f => ({ ...f, [k]: v }));

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
      if (data.uf) set("uf", data.uf as EditForm["uf"]);
    } catch {}
  };

  const uploadMut = useMutation({
    mutationFn: (file: File) => beneficiariosApi.uploadFoto(id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beneficiario", id] }); toast.success("Foto atualizada."); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar foto"),
  });

  const buildPayload = () => {
    const p: Record<string, unknown> = { ...editForm };
    if (editForm.rendaFamiliar) p.rendaFamiliar = parseFloat(editForm.rendaFamiliar.replace(",", ".")) || undefined;
    else delete p.rendaFamiliar;
    p.bolsaFamilia = editForm.bolsaFamilia === "sim" ? true : editForm.bolsaFamilia === "nao" ? false : undefined;
    p.deficiencia = editForm.deficiencia === "sim" ? true : editForm.deficiencia === "nao" ? false : undefined;
    if (!editForm.genero) delete p.genero;
    if (!editForm.raca) delete p.raca;
    if (!editForm.estadoCivil) delete p.estadoCivil;
    if (!editForm.uf) delete p.uf;
    if (p.deficiencia !== true) delete p.qualDeficiencia;
    return p;
  };

  const updateMut = useMutation({
    mutationFn: () => beneficiariosApi.update(id, buildPayload() as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beneficiario", id] });
      qc.invalidateQueries({ queryKey: ["beneficiarios"] });
      setEditing(false);
      toast.success("Cadastro atualizado.");
    },
    onError: (e: any) => {
      if (e instanceof ApiError && e.details?.length) {
        toast.error("Dados inválidos", { description: e.details.map((d) => d.message).join(" • ") });
      } else {
        toast.error(e?.message ?? "Erro ao atualizar");
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => beneficiariosApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beneficiarios"] });
      toast.success("Beneficiário excluído.");
      navigate({ to: "/beneficiarios" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const biometriaMut = useMutation({
    mutationFn: (imageBase64: string) => beneficiariosApi.registrarBiometria(id, imageBase64),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beneficiario", id] });
      toast.success("Biometria registrada com sucesso!");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar biometria"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card><CardContent className="p-6"><div className="h-48 animate-pulse rounded-lg bg-muted" /></CardContent></Card>
          <div className="space-y-6 lg:col-span-2">
            <Card><CardContent className="p-6"><div className="h-32 animate-pulse rounded-lg bg-muted" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center text-muted-foreground p-10">Beneficiário não encontrado.</div>;

  const b = data as any;
  const retiradas: any[] = b.retiradas ?? [];
  const familia: any = b.familia;

  const retiradasMes = retiradas.filter(r => {
    const d = new Date(r.horario ?? r.data);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const viewActions = (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir beneficiário?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro de <strong>{data.nome}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
        <Edit2 className="h-4 w-4" /> Editar
      </Button>
      <Link to="/beneficiarios">
        <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
      </Link>
    </>
  );

  const editActions = (
    <>
      <Button variant="outline" onClick={() => setEditing(false)} disabled={updateMut.isPending} className="gap-2">
        <X className="h-4 w-4" /> Cancelar
      </Button>
      <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="gap-2">
        {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={editing ? "Editar cadastro" : data.nome}
        subtitle={`Cadastrado em ${new Date(data.criadoEm).toLocaleDateString("pt-BR")}`}
        actions={editing ? editActions : viewActions}
      />

      {editing ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome completo" className="sm:col-span-2"
                  value={editForm.nome} onChange={e => set("nome", e.target.value)} required />
                <Field label="CPF" placeholder="000.000.000-00"
                  value={editForm.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} required />
                <Field label="RG" value={editForm.rg} onChange={e => set("rg", e.target.value)} />
                <Field label="Data de nascimento" type="date"
                  value={editForm.nascimento} onChange={e => set("nascimento", e.target.value)} required />
                <Field label="Telefone / Contato" value={editForm.telefone} onChange={e => set("telefone", e.target.value)} />
                <ESelectField label="Gênero" value={editForm.genero} onValueChange={v => set("genero", v)} opts={GENERO_OPTS} />
                <ESelectField label="Raça / Cor" value={editForm.raca} onValueChange={v => set("raca", v)} opts={RACA_OPTS} />
                <ESelectField label="Estado civil" value={editForm.estadoCivil} onValueChange={v => set("estadoCivil", v)} opts={CIVIL_OPTS} />
                <Field label="Naturalidade" value={editForm.naturalidade} onChange={e => set("naturalidade", e.target.value)} />
                <Field label="Filiação — Pai" value={editForm.filiaPai} onChange={e => set("filiaPai", e.target.value)} />
                <Field label="Filiação — Mãe" value={editForm.filiaMae} onChange={e => set("filiaMae", e.target.value)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-6">
                <Field label="CEP" placeholder="00000-000" className="sm:col-span-2"
                  value={editForm.cep} onChange={e => set("cep", maskCep(e.target.value))}
                  onBlur={() => buscarCep(editForm.cep)} />
                <Field label="Logradouro" className="sm:col-span-3"
                  value={editForm.endereco} onChange={e => set("endereco", e.target.value)} />
                <Field label="Nº" className="sm:col-span-1"
                  value={editForm.numero} onChange={e => set("numero", e.target.value)} />
                <Field label="Bairro" className="sm:col-span-3"
                  value={editForm.bairro} onChange={e => set("bairro", e.target.value)} />
                <Field label="Cidade" className="sm:col-span-2"
                  value={editForm.cidade} onChange={e => set("cidade", e.target.value)} />
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>UF</Label>
                  <Select value={editForm.uf} onValueChange={v => set("uf", v)}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{UF_OPTS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Field label="Comunidade / Associação" className="sm:col-span-6"
                  value={editForm.comunidade} onChange={e => set("comunidade", e.target.value)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Situação socioeconômica</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Renda familiar (R$)</Label>
                  <Input placeholder="0,00" value={editForm.rendaFamiliar} onChange={e => set("rendaFamiliar", e.target.value)} />
                </div>
                <ESelectField label="Recebe Bolsa Família?" value={editForm.bolsaFamilia}
                  onValueChange={v => set("bolsaFamilia", v)}
                  opts={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
                <Field label="Número do NIS" value={editForm.nis} onChange={e => set("nis", e.target.value)} />
                <ESelectField label="Possui alguma deficiência?" value={editForm.deficiencia}
                  onValueChange={v => set("deficiencia", v)}
                  opts={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
                {editForm.deficiencia === "sim" && (
                  <Field label="Qual deficiência?" className="sm:col-span-2"
                    value={editForm.qualDeficiencia} onChange={e => set("qualDeficiencia", e.target.value)} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Família e autorização</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Field label="Pessoas na casa" type="number"
                  value={editForm.pessoasCasa} onChange={e => set("pessoasCasa", Number(e.target.value))} />
                <Field label="Quentinhas autorizadas" type="number"
                  value={editForm.quentinhasAutorizadas} onChange={e => set("quentinhasAutorizadas", Number(e.target.value))} />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={v => set("status", v as EditForm["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVO">Ativo</SelectItem>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label>Outros moradores (não cadastrados)</Label>
                  <Textarea rows={2} value={editForm.nomesMoradores}
                    onChange={e => set("nomesMoradores", e.target.value)}
                    placeholder="Nomes de moradores sem cadastro no sistema" />
                </div>
                <div className="sm:col-span-3">
                  <MembrosFamiliaEditor beneficiarioId={id} />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={editForm.observacoes}
                    onChange={e => set("observacoes", e.target.value)}
                    placeholder="Acompanhamento, vulnerabilidades, notas da equipe…" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Foto</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-center">
                <FotoCaptura
                  fotoUrl={data.fotoUrl}
                  nome={data.nome}
                  uploading={uploadMut.isPending}
                  onFile={f => uploadMut.mutate(f)}
                />
              </CardContent>
            </Card>
            <BiometriaCard
              status={b.biometriaStatus}
              onRegistrar={img => biometriaMut.mutate(img)}
              saving={biometriaMut.isPending}
            />
            <DocumentosCard beneficiarioId={id} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardContent className="p-6 text-center">
              <FotoCaptura
                fotoUrl={data.fotoUrl}
                nome={data.nome}
                uploading={uploadMut.isPending}
                onFile={f => uploadMut.mutate(f)}
                compact
              />

              <h2 className="mt-3 text-lg font-bold">{data.nome}</h2>
              <div className="mt-1 flex justify-center gap-2">
                {data.status === "ATIVO"
                  ? <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Ativo</Badge>
                  : data.status === "PENDENTE"
                  ? <Badge variant="secondary">Pendente</Badge>
                  : <Badge variant="destructive">Bloqueado</Badge>}
                {data.biometriaStatus === "VERIFICADA" && (
                  <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />Biometria</Badge>
                )}
              </div>

              <div className="mt-5 space-y-2.5 text-left text-sm">
                <Row icon={IdCard} label="CPF" value={data.cpf} />
                {data.rg && <Row icon={IdCard} label="RG" value={data.rg} />}
                <Row icon={Cake} label="Nascimento" value={new Date(data.nascimento).toLocaleDateString("pt-BR")} />
                {data.telefone && <Row icon={Phone} label="Telefone" value={data.telefone} />}
                <Row icon={MapPin} label="Endereço" value={`${b.endereco}, ${b.numero} — ${b.bairro}`} />
                <Row icon={Home} label="Pessoas na casa" value={String(b.pessoasCasa)} />
              </div>
            </CardContent>
          </Card>
          <BiometriaCard status={b.biometriaStatus} onRegistrar={img => biometriaMut.mutate(img)} saving={biometriaMut.isPending} />
          <DocumentosCard beneficiarioId={id} />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Frequência da família</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Retiradas no mês</span>
                    <span className="font-bold">{retiradasMes.length}</span>
                  </div>
                  <Progress value={Math.min((retiradasMes.length / 30) * 100, 100)} />
                </div>
                {familia && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço da família</div>
                    <div className="text-sm">{familia.endereco}, {familia.numero} — {familia.bairro}, {familia.cidade}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Perfil social</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
                {b.genero && <InfoField label="Gênero" value={GENERO_OPTS.find(o => o.value === b.genero)?.label ?? b.genero} />}
                {b.raca && <InfoField label="Raça / Cor" value={RACA_OPTS.find(o => o.value === b.raca)?.label ?? b.raca} />}
                {b.estadoCivil && <InfoField label="Estado civil" value={CIVIL_OPTS.find(o => o.value === b.estadoCivil)?.label ?? b.estadoCivil} />}
                {b.naturalidade && <InfoField label="Naturalidade" value={b.naturalidade} />}
                {b.filiaPai && <InfoField label="Filiação — Pai" value={b.filiaPai} />}
                {b.filiaMae && <InfoField label="Filiação — Mãe" value={b.filiaMae} />}
                {b.comunidade && <InfoField label="Comunidade" value={b.comunidade} className="sm:col-span-2" />}
                {b.rendaFamiliar != null && <InfoField label="Renda familiar" value={`R$ ${Number(b.rendaFamiliar).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />}
                {b.bolsaFamilia != null && <InfoField label="Bolsa Família" value={b.bolsaFamilia ? "Sim" : "Não"} />}
                {b.nis && <InfoField label="NIS" value={b.nis} />}
                {b.deficiencia != null && <InfoField label="Deficiência" value={b.deficiencia ? (b.qualDeficiencia ?? "Sim") : "Não"} />}
                {b.nomesMoradores && <InfoField label="Outros moradores" value={b.nomesMoradores} className="sm:col-span-2" />}
                {b.observacoes && <InfoField label="Observações" value={b.observacoes} className="sm:col-span-2" />}
                <div className="sm:col-span-2">
                  <MembrosFamiliaViewer beneficiarioId={id} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Histórico de retiradas</CardTitle></CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-5 py-2.5 font-medium">Data</th>
                        <th className="px-5 py-2.5 font-medium">Horário</th>
                        <th className="px-5 py-2.5 font-medium">Qtd</th>
                        <th className="px-5 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retiradas.length === 0 ? (
                        <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">Sem retiradas registradas.</td></tr>
                      ) : retiradas.slice(0, 20).map((r: any) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-5 py-2.5">{new Date(r.horario).toLocaleDateString("pt-BR")}</td>
                          <td className="px-5 py-2.5 tabular-nums">{new Date(r.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="px-5 py-2.5">{r.quantidade}</td>
                          <td className="px-5 py-2.5">
                            {r.status === "ENTREGUE"
                              ? <Badge className="bg-primary text-primary-foreground">Entregue</Badge>
                              : r.status === "DUPLICADO_BLOQUEADO"
                              ? <Badge variant="destructive">Bloqueado</Badge>
                              : <Badge variant="secondary">Ausente</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function FotoCaptura({ fotoUrl, nome, uploading, onFile, compact = false }: {
  fotoUrl?: string; nome: string; uploading: boolean;
  onFile: (f: File) => void; compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);

  const startStream = async () => {
    setCaptured(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch {
      toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
      setOpen(false);
    }
  };

  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };

  const openCamera = () => { setOpen(true); startStream(); };
  const close = () => { stopStream(); setCaptured(null); setOpen(false); };

  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setCaptured(c.toDataURL("image/jpeg", 0.92));
    stopStream();
  };

  const usePhoto = () => {
    if (!captured) return;
    const [header, data] = captured.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    onFile(new File([arr], "foto.jpg", { type: mime }));
    close();
  };

  const initials = nome.split(" ").map(n => n[0]).slice(0, 2).join("");

  if (compact) {
    return (
      <div className="relative mx-auto w-fit">
        <Avatar className="h-24 w-24">
          <AvatarImage src={fotoUrl} />
          <AvatarFallback className="bg-primary/15 text-primary text-2xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        <button
          className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow"
          onClick={openCamera}
          disabled={uploading}
          title="Atualizar foto"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <CameraDialog open={open} onClose={close} videoRef={videoRef} canvasRef={canvasRef}
          captured={captured} onCapture={capture} onRetake={() => { setCaptured(null); startStream(); }}
          onUse={usePhoto} onPickFile={() => { close(); fileRef.current?.click(); }} uploading={uploading} />
      </div>
    );
  }

  return (
    <>
      <Avatar className="mx-auto h-24 w-24">
        <AvatarImage src={fotoUrl} />
        <AvatarFallback className="bg-primary/15 text-primary text-2xl font-bold">{initials}</AvatarFallback>
      </Avatar>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openCamera} disabled={uploading}>
          <Camera className="h-4 w-4" />Câmera
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2"
          onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4" />Arquivo
        </Button>
      </div>
      {uploading && <p className="text-xs text-muted-foreground">Enviando foto...</p>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <CameraDialog open={open} onClose={close} videoRef={videoRef} canvasRef={canvasRef}
        captured={captured} onCapture={capture} onRetake={() => { setCaptured(null); startStream(); }}
        onUse={usePhoto} onPickFile={() => { close(); fileRef.current?.click(); }} uploading={uploading} />
    </>
  );
}

function CameraDialog({ open, onClose, videoRef, canvasRef, captured, onCapture, onRetake, onUse, onPickFile, uploading }: {
  open: boolean; onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  captured: string | null; onCapture: () => void; onRetake: () => void;
  onUse: () => void; onPickFile: () => void; uploading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Foto do beneficiário</DialogTitle></DialogHeader>
        <div className="overflow-hidden rounded-xl bg-black aspect-square">
          {captured
            ? <img src={captured} className="h-full w-full object-cover" alt="Preview" />
            : <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          }
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {!captured ? (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={onPickFile}>
                <Upload className="h-4 w-4" />Arquivo
              </Button>
              <Button className="flex-1 gap-2" onClick={onCapture}>
                <Camera className="h-4 w-4" />Capturar
              </Button>
            </div>
          ) : (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={onRetake}>Tirar novamente</Button>
              <Button className="flex-1 gap-2" onClick={onUse} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Usar esta foto
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-2.5">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </div>
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

function ESelectField({ label, value, onValueChange, opts, placeholder, className }: {
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

function InfoField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`space-y-0.5 ${className ?? ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

// ── Documentos ───────────────────────────────────────────────────────────────

const DOC_TIPOS: { tipo: string; label: string; desc: string }[] = [
  { tipo: "RG_FRENTE", label: "Identidade — Frente", desc: "Foto da frente do RG ou CNH" },
  { tipo: "RG_VERSO",  label: "Identidade — Verso",  desc: "Foto do verso do RG ou CNH" },
  { tipo: "COMPROVANTE", label: "Comprovante de residência", desc: "Conta de luz, água ou contrato" },
];

function DocumentosCard({ beneficiarioId }: { beneficiarioId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const [preview, setPreview] = useState<Documento | null>(null);
  const [rejMotivo, setRejMotivo] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: docs = [] } = useQuery({
    queryKey: ["documentos", beneficiarioId],
    queryFn: () => beneficiariosApi.listarDocumentos(beneficiarioId),
  });

  const uploadMut = useMutation({
    mutationFn: ({ file, tipo }: { file: File; tipo: string }) =>
      beneficiariosApi.uploadDocumento(beneficiarioId, file, tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentos", beneficiarioId] });
      toast.success("Documento enviado. Aguardando aprovação.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar documento"),
  });

  const avaliarMut = useMutation({
    mutationFn: ({ docId, acao, motivo }: { docId: string; acao: "APROVAR" | "REJEITAR"; motivo?: string }) =>
      beneficiariosApi.avaliarDocumento(docId, acao, motivo),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["documentos", beneficiarioId] });
      setRejecting(null);
      setRejMotivo("");
      toast.success(vars.acao === "APROVAR" ? "Documento aprovado." : "Documento rejeitado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao avaliar"),
  });

  const removerMut = useMutation({
    mutationFn: (docId: string) => beneficiariosApi.removerDocumento(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentos", beneficiarioId] });
      toast.success("Documento removido.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const docPorTipo = (tipo: string) => (docs as Documento[]).find(d => d.tipo === tipo);

  const statusIcon = (s: string) => {
    if (s === "APROVADO") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s === "REJEITADO") return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const statusLabel: Record<string, string> = { PENDENTE: "Pendente", APROVADO: "Aprovado", REJEITADO: "Rejeitado" };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Documentos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {DOC_TIPOS.map(({ tipo, label, desc }) => {
            const doc = docPorTipo(tipo);
            return (
              <div key={tipo} className="rounded-xl border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  {doc ? (
                    <div className="flex items-center gap-1 shrink-0">
                      {statusIcon(doc.status)}
                      <span className="text-xs font-medium">{statusLabel[doc.status]}</span>
                    </div>
                  ) : null}
                </div>

                {doc ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setPreview(doc)}>
                      <Eye className="h-3.5 w-3.5" />Visualizar
                    </Button>
                    {isAdmin && doc.status === "PENDENTE" && (
                      <>
                        <Button type="button" size="sm" variant="outline"
                          className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => avaliarMut.mutate({ docId: doc.id, acao: "APROVAR" })}
                          disabled={avaliarMut.isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5" />Aprovar
                        </Button>
                        <Button type="button" size="sm" variant="outline"
                          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setRejecting(doc.id)}
                          disabled={avaliarMut.isPending}>
                          <XCircle className="h-3.5 w-3.5" />Rejeitar
                        </Button>
                      </>
                    )}
                    {doc.status === "REJEITADO" && doc.rejeitadoMotivo && (
                      <p className="w-full text-xs text-destructive">Motivo: {doc.rejeitadoMotivo}</p>
                    )}
                    {doc.aprovadoPor && doc.status === "APROVADO" && (
                      <p className="w-full text-xs text-muted-foreground">
                        Aprovado por {doc.aprovadoPor.nome} em {new Date(doc.aprovadoEm!).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    <Button type="button" size="sm" variant="ghost"
                      className="gap-1.5 text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => removerMut.mutate(doc.id)} disabled={removerMut.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />Substituir
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={el => { inputRefs.current[tipo] = el; }}
                      type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) uploadMut.mutate({ file: f, tipo });
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" size="sm" variant="outline" className="gap-1.5 w-full"
                      onClick={() => inputRefs.current[tipo]?.click()}
                      disabled={uploadMut.isPending}>
                      {uploadMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Enviar documento
                    </Button>
                  </div>
                )}

                {/* Formulário de rejeição inline */}
                {rejecting === doc?.id && (
                  <div className="space-y-2 pt-1 border-t">
                    <input
                      className="w-full rounded-md border px-3 py-1.5 text-xs"
                      placeholder="Motivo da rejeição (opcional)"
                      value={rejMotivo}
                      onChange={e => setRejMotivo(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(null)}>Cancelar</Button>
                      <Button type="button" size="sm" variant="destructive" className="flex-1"
                        onClick={() => avaliarMut.mutate({ docId: doc.id, acao: "REJEITAR", motivo: rejMotivo || undefined })}
                        disabled={avaliarMut.isPending}>
                        Confirmar rejeição
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={v => { if (!v) setPreview(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {DOC_TIPOS.find(d => d.tipo === preview?.tipo)?.label ?? preview?.tipo}
              {preview && (
                <span className={`ml-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  preview.status === "APROVADO" ? "bg-green-100 text-green-700" :
                  preview.status === "REJEITADO" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {statusIcon(preview.status)}{statusLabel[preview.status]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="mt-2">
              {preview.url.match(/\.(pdf)$/i) ? (
                <iframe src={preview.url} className="w-full h-[60vh] rounded-lg border" title="documento" />
              ) : (
                <img src={preview.url} alt="documento" className="w-full max-h-[60vh] object-contain rounded-lg border bg-muted" />
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Enviado em {new Date(preview.criadoEm).toLocaleDateString("pt-BR")}</span>
                {preview.aprovadoPor && <span>Avaliado por {preview.aprovadoPor.nome}</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MembrosFamiliaEditor({ beneficiarioId }: { beneficiarioId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: membros = [] } = useQuery({
    queryKey: ["familia-membros", beneficiarioId],
    queryFn: () => beneficiariosApi.getFamiliaMembros(beneficiarioId),
  });

  const { data: searchResult } = useQuery({
    queryKey: ["beneficiarios-search", debouncedSearch],
    queryFn: () => beneficiariosApi.list({ search: debouncedSearch, limit: 5 }),
    enabled: debouncedSearch.length >= 2,
  });

  const vincularMut = useMutation({
    mutationFn: (membroId: string) => beneficiariosApi.vincularMembro(beneficiarioId, membroId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familia-membros", beneficiarioId] });
      setSearch("");
      toast.success("Membro vinculado à família.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao vincular"),
  });

  const desvincularMut = useMutation({
    mutationFn: (membroId: string) => beneficiariosApi.desvincularMembro(beneficiarioId, membroId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familia-membros", beneficiarioId] });
      toast.success("Membro desvinculado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao desvincular"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ membroId, podeRetirar }: { membroId: string; podeRetirar: boolean }) =>
      beneficiariosApi.update(membroId, { podeRetirar }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["familia-membros", beneficiarioId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const membrosIds = new Set((membros as FamiliaMembro[]).map(m => m.id));
  const sugestoes = (searchResult?.items ?? []).filter(s => s.id !== beneficiarioId && !membrosIds.has(s.id));

  return (
    <div className="space-y-3">
      <Label>Membros da família vinculados</Label>

      {(membros as FamiliaMembro[]).length > 0 && (
        <div className="divide-y rounded-lg border">
          {(membros as FamiliaMembro[]).map(m => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={m.fotoUrl} />
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                  {m.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.nome}</div>
                <div className="text-xs text-muted-foreground">{m.cpf}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Pode retirar</span>
                <Switch
                  checked={m.podeRetirar}
                  onCheckedChange={v => toggleMut.mutate({ membroId: m.id, podeRetirar: v })}
                  disabled={toggleMut.isPending}
                />
                <Button
                  type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => desvincularMut.mutate(m.id)}
                  disabled={desvincularMut.isPending}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Buscar beneficiário pelo nome ou CPF..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {sugestoes.length > 0 && (
        <div className="divide-y rounded-lg border bg-popover shadow-md">
          {sugestoes.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={s.fotoUrl} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                  {s.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.nome}</div>
                <div className="text-xs text-muted-foreground">{s.cpf} · {s.bairro}</div>
              </div>
              <Button
                type="button" variant="outline" size="sm" className="gap-1.5 shrink-0"
                onClick={() => vincularMut.mutate(s.id)}
                disabled={vincularMut.isPending}
              >
                <UserPlus className="h-3.5 w-3.5" />Vincular
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MembrosFamiliaViewer({ beneficiarioId }: { beneficiarioId: string }) {
  const { data: membros = [] } = useQuery({
    queryKey: ["familia-membros", beneficiarioId],
    queryFn: () => beneficiariosApi.getFamiliaMembros(beneficiarioId),
  });

  if ((membros as FamiliaMembro[]).length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Membros da família vinculados</div>
      <div className="divide-y rounded-lg border">
        {(membros as FamiliaMembro[]).map(m => (
          <div key={m.id} className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={m.fotoUrl} />
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                {m.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{m.nome}</span>
              <span className="ml-2 text-xs text-muted-foreground">{m.cpf}</span>
            </div>
            <Badge className={m.podeRetirar ? "bg-primary/10 text-primary hover:bg-primary/10" : ""} variant={m.podeRetirar ? "outline" : "secondary"}>
              {m.podeRetirar ? "Pode retirar" : "Não retira"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function BiometriaCard({ status, onRegistrar, saving }: {
  status: string; onRegistrar: (img: string) => void; saving: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);

  const startStream = async () => {
    setCaptured(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch {
      toast.error("Não foi possível acessar a câmera.");
      setOpen(false);
    }
  };

  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  const openCamera = () => { setOpen(true); startStream(); };
  const close = () => { stopStream(); setCaptured(null); setOpen(false); };

  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setCaptured(c.toDataURL("image/jpeg", 0.95));
    stopStream();
  };

  const confirm = () => {
    if (!captured) return;
    onRegistrar(captured.split(",")[1]);
    close();
  };

  const statusMap: Record<string, { label: string; cls: string }> = {
    VERIFICADA: { label: "Verificada", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    PENDENTE: { label: "Pendente", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    INDISPONIVEL: { label: "Indisponível", cls: "bg-muted text-muted-foreground" },
  };
  const si = statusMap[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanFace className="h-4 w-4" />Biometria facial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${si.cls}`}>{si.label}</span>
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" onClick={openCamera} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
          {status === "VERIFICADA" ? "Atualizar biometria" : "Registrar biometria"}
        </Button>
        <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Captura facial</DialogTitle></DialogHeader>
            <div className="aspect-square overflow-hidden rounded-xl bg-black">
              {captured
                ? <img src={captured} alt="Prévia" className="h-full w-full object-cover" />
                : <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter className="sm:flex-col gap-2">
              {!captured ? (
                <Button className="w-full gap-2" onClick={capture}>
                  <Camera className="h-4 w-4" />Capturar
                </Button>
              ) : (
                <div className="flex w-full gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setCaptured(null); startStream(); }}>
                    Tirar novamente
                  </Button>
                  <Button className="flex-1 gap-2" onClick={confirm} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirmar
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
