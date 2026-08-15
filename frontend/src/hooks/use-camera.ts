import { useCallback, useRef, useState } from "react";

// Preferência de câmera compartilhada entre as telas (retirada, reconhecimento,
// cadastro/biometria). Mesma chave usada em `_app.reconhecimento.tsx`.
const CAMERA_STORAGE_KEY = "mdb-camera-id";

export function savedCameraId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(CAMERA_STORAGE_KEY) ?? undefined;
}

/**
 * Encapsula abrir/trocar/parar a câmera com escolha de dispositivo:
 * - lista as câmeras só DEPOIS do getUserMedia (antes da permissão os rótulos vêm vazios);
 * - para o stream atual antes de abrir outro (Androids recusam a 2ª com a 1ª ativa);
 * - se o deviceId salvo não existir mais, limpa a preferência e volta para a frontal.
 */
export function useCameraStream(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (preferredId?: string) => {
      stop();
      const base = { width: { ideal: 640 }, height: { ideal: 640 } };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: preferredId
            ? { ...base, deviceId: { exact: preferredId } }
            : { ...base, facingMode: "user" },
        });
      } catch (err) {
        if (!preferredId) throw err;
        // Câmera salva não existe mais neste aparelho: descarta e usa a frontal.
        window.localStorage.removeItem(CAMERA_STORAGE_KEY);
        stream = await navigator.mediaDevices.getUserMedia({ video: { ...base, facingMode: "user" } });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const todas = await navigator.mediaDevices.enumerateDevices();
      setCameras(todas.filter((d) => d.kind === "videoinput" && d.deviceId));
      setCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? null);
    },
    [stop, videoRef],
  );

  const select = useCallback(
    (id: string) => {
      window.localStorage.setItem(CAMERA_STORAGE_KEY, id);
      setCameraId(id);
      return start(id);
    },
    [start],
  );

  return { cameras, cameraId, start, stop, select };
}
