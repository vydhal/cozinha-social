from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import face_recognition
import mediapipe as mp
import base64
import logging
import os

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Parâmetros de acurácia (tunáveis por env, sem rebuild) ──────────────────
# THRESHOLD: distância máxima para considerar match. Menor = mais rígido.
#   dlib recomenda 0.6 (permissivo); 0.5 corta a maioria dos falsos positivos.
# MARGIN: separação mínima entre o melhor e o 2º melhor match. Se dois cadastros
#   estão quase igualmente perto (sósias), o match é ambíguo e é rejeitado.
# QUERY_JITTERS: nº de amostras aleatórias ao codificar a face consultada —
#   embedding mais estável, melhora a discriminação (custo de latência baixo).
# REGISTER_JITTERS: idem no cadastro (afeta só embeddings novos).
DEFAULT_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.5"))
DEFAULT_MARGIN = float(os.getenv("FACE_MATCH_MARGIN", "0.06"))
QUERY_JITTERS = int(os.getenv("FACE_QUERY_JITTERS", "3"))
REGISTER_JITTERS = int(os.getenv("FACE_REGISTER_JITTERS", "5"))

# Inicializa MediaPipe uma vez (model_selection=1 = full-range, até 5m, tolerante a ângulos)
_mp_detector = mp.solutions.face_detection.FaceDetection(
    model_selection=1,
    min_detection_confidence=0.5,
)

app = FastAPI(title="Mesa do Bem — Face Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterFaceRequest(BaseModel):
    beneficiario_id: str
    image_base64: str


class ValidateFaceRequest(BaseModel):
    image_base64: str
    embedding_base64: str
    threshold: float = DEFAULT_THRESHOLD


class CompareFacesRequest(BaseModel):
    image_base64: str
    embeddings: list[dict]
    threshold: float = DEFAULT_THRESHOLD
    margin: float = DEFAULT_MARGIN


def decode_image(image_base64: str) -> np.ndarray:
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]
    img_bytes = base64.b64decode(image_base64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Imagem inválida")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def preprocess_image(img: np.ndarray) -> np.ndarray:
    """Normaliza tamanho e aplica CLAHE para melhorar detecção em iluminação variada."""
    h, w = img.shape[:2]
    max_size = 800
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    elif max(h, w) < 320:
        scale = 320 / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    # Equalização de histograma adaptativa: melhora contraste sem saturar
    img_yuv = cv2.cvtColor(img, cv2.COLOR_RGB2YUV)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    img_yuv[:, :, 0] = clahe.apply(img_yuv[:, :, 0])
    return cv2.cvtColor(img_yuv, cv2.COLOR_YUV2RGB)


def detect_faces(img: np.ndarray, upsample: int = 1) -> list:
    """Detecta faces: MediaPipe primário (tolerante a ângulos/baixa luz), fallback HOG."""
    h, w = img.shape[:2]
    results = _mp_detector.process(img)

    if results.detections:
        locations = []
        for det in results.detections:
            bb = det.location_data.relative_bounding_box
            left   = max(0, int(bb.xmin * w))
            top    = max(0, int(bb.ymin * h))
            right  = min(w, int((bb.xmin + bb.width) * w))
            bottom = min(h, int((bb.ymin + bb.height) * h))
            locations.append((top, right, bottom, left))  # formato face_recognition
        logger.debug(f"MediaPipe detectou {len(locations)} face(s)")
        return locations

    # Fallback HOG se MediaPipe não encontrar
    logger.debug("MediaPipe sem resultado, tentando HOG")
    locations = face_recognition.face_locations(img, model="hog", number_of_times_to_upsample=upsample)
    if not locations:
        locations = face_recognition.face_locations(img, model="hog", number_of_times_to_upsample=2)
    return locations


def encode_embedding(embedding: np.ndarray) -> str:
    return base64.b64encode(embedding.astype(np.float64).tobytes()).decode()


def decode_embedding(embedding_base64: str) -> np.ndarray:
    data = base64.b64decode(embedding_base64)
    return np.frombuffer(data, dtype=np.float64)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "face-service", "version": "2.0.0"}


@app.post("/face/register")
async def register_face(req: RegisterFaceRequest):
    try:
        img = decode_image(req.image_base64)
        img = preprocess_image(img)
        locations = detect_faces(img, upsample=1)

        if not locations:
            raise HTTPException(
                status_code=422,
                detail="Nenhuma face detectada. Certifique-se de estar bem iluminado e olhando para a câmera.",
            )
        if len(locations) > 1:
            raise HTTPException(
                status_code=422,
                detail="Múltiplas faces detectadas. Certifique-se de que apenas uma pessoa esteja na imagem.",
            )

        encodings = face_recognition.face_encodings(img, locations, num_jitters=REGISTER_JITTERS)
        embedding = encode_embedding(encodings[0])

        top, right, bottom, left = locations[0]
        coverage = ((bottom - top) * (right - left)) / (img.shape[0] * img.shape[1])
        logger.info(f"Registro: id={req.beneficiario_id} cobertura={coverage:.2%}")

        return {
            "beneficiario_id": req.beneficiario_id,
            "embedding": embedding,
            "face_location": locations[0],
            "confianca": round(min(1.0, coverage * 5), 4),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao registrar face: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar imagem: {str(e)}")


@app.post("/face/validate")
async def validate_face(req: ValidateFaceRequest):
    try:
        img = decode_image(req.image_base64)
        img = preprocess_image(img)
        locations = detect_faces(img)

        if not locations:
            return {"match": False, "confianca": 0.0, "motivo": "face_nao_detectada"}

        encodings = face_recognition.face_encodings(img, locations, num_jitters=QUERY_JITTERS)
        known_embedding = decode_embedding(req.embedding_base64)

        distances = face_recognition.face_distance([known_embedding], encodings[0])
        distance = float(distances[0])
        confianca = max(0.0, 1.0 - distance)
        match = distance <= req.threshold

        return {
            "match": match,
            "confianca": round(confianca, 4),
            "distance": round(distance, 4),
            "threshold": req.threshold,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao validar face: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar validação: {str(e)}")


@app.post("/face/compare")
async def compare_faces(req: CompareFacesRequest):
    try:
        img = decode_image(req.image_base64)
        img = preprocess_image(img)
        locations = detect_faces(img)

        if not locations:
            return {"encontrado": False, "motivo": "face_nao_detectada"}

        encodings = face_recognition.face_encodings(img, locations, num_jitters=QUERY_JITTERS)
        unknown_encoding = encodings[0]

        known_embeddings = [decode_embedding(e["embedding_base64"]) for e in req.embeddings]
        ids = [e["beneficiario_id"] for e in req.embeddings]

        distances = face_recognition.face_distance(known_embeddings, unknown_encoding)
        order = np.argsort(distances)  # índices do mais próximo ao mais distante
        best_idx = int(order[0])
        best_distance = float(distances[best_idx])
        confianca = max(0.0, 1.0 - best_distance)

        # 2º melhor: usado para o teste de ambiguidade (sósias).
        second_distance = float(distances[int(order[1])]) if len(distances) > 1 else None
        gap = (second_distance - best_distance) if second_distance is not None else None

        logger.info(
            f"Reconhecimento: melhor={best_distance:.4f} 2o={second_distance if second_distance is None else round(second_distance, 4)} "
            f"gap={gap if gap is None else round(gap, 4)} threshold={req.threshold} margin={req.margin} conf={confianca:.2%}"
        )

        # Rejeita se acima do threshold (não é a pessoa)...
        if best_distance > req.threshold:
            return {"encontrado": False, "confianca": round(confianca, 4), "motivo": "abaixo_do_threshold"}

        # ...ou se o 2º colocado está quase igual de perto: match ambíguo, pode
        # ser um sósia. Melhor recusar e cair no CPF do que entregar errado.
        if gap is not None and gap < req.margin:
            logger.warning(f"Match ambíguo rejeitado: gap={gap:.4f} < margin={req.margin}")
            return {
                "encontrado": False,
                "confianca": round(confianca, 4),
                "distance": round(best_distance, 4),
                "motivo": "ambiguo",
            }

        return {
            "encontrado": True,
            "beneficiario_id": ids[best_idx],
            "confianca": round(confianca, 4),
            "distance": round(best_distance, 4),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao comparar faces: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao comparar faces: {str(e)}")


@app.post("/face/detect")
async def detect_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img_array = np.frombuffer(contents, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        img_rgb = preprocess_image(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        locations = detect_faces(img_rgb)
        return {"faces_detectadas": len(locations), "locations": locations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
