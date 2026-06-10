import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScanFace, Camera, CheckCircle2, XCircle, Ban, Loader2, AlertCircle, CameraOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { retiradasApi } from "@/lib/api/retiradas.api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reconhecimento")({ component: Reconhecimento });

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

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [startCamera]);

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
        const mensagem = data.validacoes?.familiaJaRetirou
          ? `${data.validacoes.familiaJaRetirou} já retirou as quentinhas da família hoje.`
          : "Quentinha já retirada hoje.";
        setResult({ status: "ja_retirou", beneficiario: data.beneficiario, mensagem });
        return;
      }
      setResult({ status: "encontrado", beneficiario: data.beneficiario, validacoes: data.validacoes, confianca: data.confianca ?? 0 });
    },
    onError: (e: any) => {
      setResult({ status: "erro", mensagem: e?.message ?? "Erro ao processar reconhecimento" });
    },
  });

  const confirmarMut = useMutation({
    mutationFn: (beneficiarioId: string) => retiradasApi.confirmar(beneficiarioId, undefined, "FACIAL"),
    onSuccess: () => {
      toast.success("Entrega confirmada!");
      setResult(null);
      navigate({ to: "/" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao confirmar"),
  });

  const reset = () => { setResult(null); scanMut.reset(); };

  return (
    <div className="space-y-6">
      <PageHeader title="Reconhecimento facial" subtitle="Posicione o rosto da pessoa dentro do quadro." />

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
                    <Button variant="outline" className="mt-4" onClick={startCamera}>Tentar novamente</Button>
                  </div>
                </div>
              )}

              {/* Frame overlay — só quando câmera ativa e sem resultado */}
              {cameraOn && !result && (
                <div className="pointer-events-none absolute inset-6 rounded-3xl border-2 border-primary/70">
                  <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
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
                      onConfirmar={(id) => confirmarMut.mutate(id)}
                      confirming={confirmarMut.isPending}
                      onReset={reset}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2 p-4">
              <Button
                onClick={() => { setResult(null); scanMut.mutate(); }}
                disabled={scanMut.isPending || !cameraOn || !!cameraError}
                className="h-14 w-full gap-2 text-base"
              >
                {scanMut.isPending
                  ? <><Loader2 className="h-5 w-5 animate-spin" />Reconhecendo...</>
                  : <><ScanFace className="h-5 w-5" />{result ? "Tentar novamente" : "Iniciar reconhecimento"}</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
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

function ResultPanel({ result, onConfirmar, confirming, onReset }: {
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
              {b.nome?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="font-bold">{b.nome}</div>
            <div className="text-sm text-muted-foreground">{b.bairro}</div>
            <Badge className="mt-1 bg-primary text-primary-foreground text-xs">
              {b.quentinhasAutorizadas} quentinha{b.quentinhasAutorizadas > 1 ? "s" : ""} autorizada{b.quentinhasAutorizadas > 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
        <div className="mb-4 text-xs text-muted-foreground">
          Confiança: {Math.round(result.confianca * 100)}%
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset} className="flex-1">Cancelar</Button>
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
          <Button variant="outline" onClick={onReset} className="flex-1">OK</Button>
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
        <Button variant="outline" onClick={onReset} className="mt-4 w-full">Tentar novamente</Button>
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
      <Button variant="outline" onClick={onReset} className="mt-4 w-full">Tentar novamente</Button>
    </div>
  );
}
