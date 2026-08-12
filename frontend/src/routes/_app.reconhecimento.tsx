import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ScanFace,
  Camera,
  CheckCircle2,
  XCircle,
  Ban,
  Loader2,
  AlertCircle,
  CameraOff,
  SwitchCamera,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { retiradasApi, type VinculadoRetirada } from "@/lib/api/retiradas.api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reconhecimento")({ component: Reconhecimento });

// Celulares e tablets têm câmera frontal e traseira — a escolha do operador
// fica salva para não precisar reselecionar a cada reconhecimento.
const CAMERA_STORAGE_KEY = "mdb-camera-id";

type ScanResult =
  | { status: "encontrado"; beneficiario: any; validacoes: any; confianca: number }
  | { status: "nao_encontrado"; confianca?: number }
  | { status: "ja_retirou"; beneficiario: any; mensagem: string }
  | { status: "erro"; mensagem: string };

function Reconhecimento() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  // Retirada por procuração: após A retirar, oferece retirar as quentinhas dos
  // vinculados (com "Pode retirar") que ainda não foram retiradas hoje.
  const [procuracao, setProcuracao] = useState<{ anchorNome: string; membros: VinculadoRetirada[] } | null>(null);
  const [procuracaoSel, setProcuracaoSel] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [loadingProcuracao, setLoadingProcuracao] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(
    async (preferredId?: string) => {
      setCameraError(null);
      // Alguns aparelhos não abrem a segunda câmera enquanto a primeira estiver
      // ativa, então liberamos a atual antes de pedir a nova.
      stopStream();
      const base = { width: { ideal: 640 }, height: { ideal: 480 } };
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: preferredId
              ? { ...base, deviceId: { exact: preferredId } }
              : { ...base, facingMode: "user" },
          });
        } catch (err) {
          // A câmera salva pode não existir neste aparelho (troca de dispositivo,
          // ou o navegador rotacionou os ids) — descarta e usa a padrão.
          if (!preferredId) throw err;
          window.localStorage.removeItem(CAMERA_STORAGE_KEY);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...base, facingMode: "user" },
          });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // Os rótulos das câmeras só ficam legíveis depois da permissão concedida,
        // por isso a listagem vem depois do getUserMedia e não antes.
        const todas = await navigator.mediaDevices.enumerateDevices();
        setCameras(todas.filter((d) => d.kind === "videoinput" && d.deviceId));
        setCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? null);
        setCameraOn(true);
      } catch {
        setCameraOn(false);
        setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      }
    },
    [stopStream],
  );

  const trocarCamera = useCallback(
    (id: string) => {
      window.localStorage.setItem(CAMERA_STORAGE_KEY, id);
      setCameraId(id);
      startCamera(id);
    },
    [startCamera],
  );

  useEffect(() => {
    startCamera(window.localStorage.getItem(CAMERA_STORAGE_KEY) ?? undefined);
    return () => stopStream();
  }, [startCamera, stopStream]);

  const scanMut = useMutation({
    mutationFn: async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error("Câmera não pronta");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
      return retiradasApi.reconhecer(imageBase64);
    },
    onSuccess: (data) => {
      if (!data.encontrado) {
        setResult({ status: "nao_encontrado", confianca: data.confianca });
        return;
      }
      if (!data.validacoes?.podeRetirar) {
        setResult({ status: "ja_retirou", beneficiario: data.beneficiario, mensagem: "Quentinha já retirada hoje." });
        return;
      }
      setResult({
        status: "encontrado",
        beneficiario: data.beneficiario,
        validacoes: data.validacoes,
        confianca: data.confianca ?? 0,
      });
    },
    onError: (e: any) => {
      setResult({ status: "erro", mensagem: e?.message ?? "Erro ao processar reconhecimento" });
    },
  });

  const confirmarEntrega = async (beneficiarioId: string) => {
    setConfirming(true);
    try {
      await retiradasApi.confirmar(beneficiarioId, undefined, "FACIAL");
      toast.success("Entrega confirmada!");
      // Se A tem vinculados que ainda não retiraram, abre o fluxo de procuração.
      const enc = result?.status === "encontrado" ? result : null;
      const elegiveis: VinculadoRetirada[] = (enc?.validacoes?.vinculados ?? []).filter(
        (v: VinculadoRetirada) => !v.jaRetirou,
      );
      setResult(null);
      scanMut.reset();
      if (elegiveis.length > 0 && enc) {
        setProcuracao({ anchorNome: enc.beneficiario.nome, membros: elegiveis });
        setProcuracaoSel(new Set(elegiveis.map((v) => v.id)));
      } else {
        navigate({ to: "/" });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao confirmar");
    } finally {
      setConfirming(false);
    }
  };

  const confirmarProcuracao = async () => {
    if (!procuracao) return;
    const selecionados = procuracao.membros.filter((m) => procuracaoSel.has(m.id));
    setLoadingProcuracao(true);
    let ok = 0;
    for (const m of selecionados) {
      try {
        await retiradasApi.confirmar(m.id, undefined, "MANUAL", undefined, procuracao.anchorNome);
        ok++;
      } catch (e: any) {
        toast.error(`${m.nome.split(" ")[0]}: ${e?.message ?? "erro ao retirar"}`);
      }
    }
    if (ok > 0) toast.success(`${ok} retirada(s) por procuração registrada(s).`);
    setLoadingProcuracao(false);
    setProcuracao(null);
    navigate({ to: "/" });
  };

  const toggleProcuracao = (id: string) => {
    setProcuracaoSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setResult(null);
    scanMut.reset();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconhecimento facial"
        subtitle="Posicione o rosto da pessoa dentro do quadro."
      />

      <div className="mx-auto max-w-md">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-[4/3] w-full bg-black">
              {/* Live camera feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${result ? "opacity-30" : ""}`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Camera error / off state */}
              {!cameraOn && !cameraError && (
                <div className="absolute inset-0 grid place-items-center bg-muted">
                  <div className="text-center text-muted-foreground">
                    <Camera className="mx-auto mb-2 h-12 w-12 opacity-40" />
                    <p className="text-sm">Iniciando câmera...</p>
                  </div>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 grid place-items-center bg-muted p-6 text-center">
                  <div>
                    <CameraOff className="mx-auto mb-3 h-12 w-12 text-destructive" />
                    <p className="text-sm font-medium text-destructive">{cameraError}</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() =>
                        startCamera(window.localStorage.getItem(CAMERA_STORAGE_KEY) ?? undefined)
                      }
                    >
                      Tentar novamente
                    </Button>
                  </div>
                </div>
              )}

              {/* Frame overlay — só quando câmera ativa e sem resultado */}
              {cameraOn && !result && (
                <div className="pointer-events-none absolute inset-6 rounded-3xl border-2 border-primary/70">
                  <Corner pos="tl" />
                  <Corner pos="tr" />
                  <Corner pos="bl" />
                  <Corner pos="br" />
                </div>
              )}

              {/* Scanline */}
              {scanMut.isPending && (
                <div className="pointer-events-none absolute inset-x-6 bottom-6 top-6 overflow-hidden rounded-3xl">
                  <div className="h-1 w-full animate-scanline bg-gradient-to-r from-transparent via-primary to-transparent" />
                </div>
              )}

              {/* Result overlay */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-background/90 p-6"
                  >
                    <ResultPanel
                      result={result}
                      onConfirmar={(id) => confirmarEntrega(id)}
                      confirming={confirming}
                      onReset={reset}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2 p-4">
              {/* Só aparece quando há mais de uma câmera (celular/tablet). */}
              {cameras.length > 1 && (
                <div className="flex items-center gap-2">
                  <SwitchCamera className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Select
                    value={cameraId ?? undefined}
                    onValueChange={trocarCamera}
                    disabled={scanMut.isPending}
                  >
                    <SelectTrigger className="h-10 flex-1">
                      <SelectValue placeholder="Selecionar câmera" />
                    </SelectTrigger>
                    <SelectContent>
                      {cameras.map((c, i) => (
                        <SelectItem key={c.deviceId} value={c.deviceId}>
                          {c.label || `Câmera ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                onClick={() => {
                  setResult(null);
                  scanMut.mutate();
                }}
                disabled={scanMut.isPending || !cameraOn || !!cameraError}
                className="h-14 w-full gap-2 text-base"
              >
                {scanMut.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Reconhecendo...
                  </>
                ) : (
                  <>
                    <ScanFace className="h-5 w-5" />
                    {result ? "Tentar novamente" : "Iniciar reconhecimento"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de retirada por procuração (vinculados) */}
      <AlertDialog open={!!procuracao} onOpenChange={(v) => { if (!v && !loadingProcuracao) { setProcuracao(null); navigate({ to: "/" }); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Retirar pela família vinculada?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  <span className="font-semibold text-foreground">{procuracao?.anchorNome.split(" ")[0]}</span>{" "}
                  tem direito a retirar a quentinha de:
                </p>
                <div className="divide-y rounded-xl border">
                  {procuracao?.membros.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                      <Checkbox checked={procuracaoSel.has(m.id)} onCheckedChange={() => toggleProcuracao(m.id)} />
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={m.fotoUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {m.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{m.nome}</div>
                        <div className="text-xs text-muted-foreground">{m.cpf}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs">Cada selecionado gera uma retirada própria (1 quentinha), registrada como retirada por {procuracao?.anchorNome.split(" ")[0]}.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingProcuracao} onClick={() => { setProcuracao(null); navigate({ to: "/" }); }}>
              Não, só a dele
            </AlertDialogCancel>
            <Button className="gap-2" disabled={loadingProcuracao || procuracaoSel.size === 0} onClick={confirmarProcuracao}>
              {loadingProcuracao ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />}
              Retirar selecionadas ({procuracaoSel.size})
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls = {
    tl: "top-0 left-0 border-l-4 border-t-4 rounded-tl-2xl",
    tr: "top-0 right-0 border-r-4 border-t-4 rounded-tr-2xl",
    bl: "bottom-0 left-0 border-l-4 border-b-4 rounded-bl-2xl",
    br: "bottom-0 right-0 border-r-4 border-b-4 rounded-br-2xl",
  }[pos];
  return <span className={`absolute h-6 w-6 border-primary ${cls}`} />;
}

function ResultPanel({
  result,
  onConfirmar,
  confirming,
  onReset,
}: {
  result: ScanResult;
  onConfirmar: (id: string) => void;
  confirming: boolean;
  onReset: () => void;
}) {
  if (result.status === "encontrado") {
    const b = result.beneficiario;
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="mb-3 flex items-center justify-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarImage src={b.fotoUrl} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {b.nome
                ?.split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="font-bold">{b.nome}</div>
            <div className="text-sm text-muted-foreground">{b.bairro}</div>
            <Badge className="mt-1 bg-primary text-primary-foreground text-xs">
              {b.quentinhasAutorizadas} quentinha{b.quentinhasAutorizadas > 1 ? "s" : ""} autorizada
              {b.quentinhasAutorizadas > 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
        <div className="mb-4 text-xs text-muted-foreground">
          Confiança: {Math.round(result.confianca * 100)}%
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={() => onConfirmar(b.id)} disabled={confirming} className="flex-1">
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar entrega"}
          </Button>
        </div>
      </div>
    );
  }

  if (result.status === "ja_retirou") {
    const b = result.beneficiario;
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-destructive text-destructive-foreground">
          <Ban className="h-7 w-7" />
        </div>
        <div className="font-bold">{b?.nome}</div>
        <div className="mt-1 text-sm text-muted-foreground">{result.mensagem}</div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onReset} className="flex-1">
            OK
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirmar(b.id)}
            disabled={confirming}
            className="flex-1 text-xs"
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar tentativa"}
          </Button>
        </div>
      </div>
    );
  }

  if (result.status === "nao_encontrado") {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-warning text-warning-foreground">
          <XCircle className="h-7 w-7" />
        </div>
        <div className="font-bold">Rosto não identificado</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Realize o cadastro biométrico ou busque por CPF.
        </div>
        <Button variant="outline" onClick={onReset} className="mt-4 w-full">
          Tentar novamente
        </Button>
      </div>
    );
  }

  // erro
  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive">
        <AlertCircle className="h-7 w-7" />
      </div>
      <div className="font-bold">Erro no reconhecimento</div>
      <div className="mt-1 text-sm text-muted-foreground">{result.mensagem}</div>
      <Button variant="outline" onClick={onReset} className="mt-4 w-full">
        Tentar novamente
      </Button>
    </div>
  );
}
