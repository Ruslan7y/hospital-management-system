from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import mediapipe as mp

app = FastAPI()

# CORS: HTML farklı portta çalışacağı için açık
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prod'da domaininle değiştir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Yardımcılar
# -----------------------------
def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))

def decode_image(file_bytes: bytes):
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

def blur_score(gray):
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def brightness_score(gray):
    return float(np.mean(gray))

def poly_mask(shape_hw, pts_xy):
    mask = np.zeros(shape_hw, dtype=np.uint8)
    cv2.fillPoly(mask, [pts_xy.astype(np.int32)], 255)
    return mask

def mean_lab(img_bgr, mask):
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    sel = lab[mask > 0]
    if sel.size == 0:
        return None
    L = float(np.mean(sel[:, 0]))
    a = float(np.mean(sel[:, 1]))
    b = float(np.mean(sel[:, 2]))
    return L, a, b

# -----------------------------
# FaceMesh bölgeleri (yaklaşık)
# -----------------------------
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]
LEFT_UNDER_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133]
RIGHT_UNDER_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263]
LEFT_CHEEK = [50, 101, 205, 206, 207, 187, 147, 116]
RIGHT_CHEEK = [280, 330, 425, 426, 427, 411, 376, 345]

def sclera_yellow_proxy(img_bgr, eye_mask, skin_mask):
    eye_lab = mean_lab(img_bgr, eye_mask)
    skin_lab = mean_lab(img_bgr, skin_mask)
    if eye_lab is None or skin_lab is None:
        return None
    _, _, b_eye = eye_lab
    _, _, b_skin = skin_lab
    delta = (b_eye - b_skin)
    score = clamp01((delta - 2.0) / 10.0)  # demo
    return score

def under_eye_darkness_proxy(img_bgr, under_eye_mask, cheek_mask):
    u = mean_lab(img_bgr, under_eye_mask)
    c = mean_lab(img_bgr, cheek_mask)
    if u is None or c is None:
        return None
    L_u, _, _ = u
    L_c, _, _ = c
    delta = (L_c - L_u)  # + ise göz altı daha koyu
    score = clamp01((delta - 2.0) / 18.0)  # demo
    return score

def cheek_redness_proxy(img_bgr, cheek_mask, skin_mask):
    ch = mean_lab(img_bgr, cheek_mask)
    sk = mean_lab(img_bgr, skin_mask)
    if ch is None or sk is None:
        return None
    _, a_ch, _ = ch
    _, a_sk, _ = sk
    delta = a_ch - a_sk
    score = clamp01((delta - 2.0) / 10.0)  # demo
    return score

def asymmetry_proxy(pts):
    # basit: ağız köşesi yükseklik farkı / iki göz arası mesafe
    MOUTH_LEFT = 61
    MOUTH_RIGHT = 291
    ipd = np.linalg.norm(pts[33] - pts[263]) + 1e-6
    diff = abs(float(pts[MOUTH_LEFT][1] - pts[MOUTH_RIGHT][1]))
    mouth_norm = diff / ipd
    score = clamp01(mouth_norm * 3.0)
    return score

def score_level(score):
    if score is None:
        return "OLCULEMEDI"
    if score < 0.33:
        return "DUSUK"
    if score < 0.66:
        return "ORTA"
    return "YUKSEK"

# -----------------------------
# Tek frame analiz
# -----------------------------
def analyze_one_frame(frame_bgr, mesh):
    H, W = frame_bgr.shape[:2]
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    blur = float(blur_score(gray))
    bright = float(brightness_score(gray))

    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    res = mesh.process(rgb)
    if not res.multi_face_landmarks:
        return None

    lm = res.multi_face_landmarks[0].landmark
    pts = np.array([[int(p.x * W), int(p.y * H)] for p in lm], dtype=np.float32)

    left_eye_pts = pts[LEFT_EYE]
    right_eye_pts = pts[RIGHT_EYE]
    left_under_pts = pts[LEFT_UNDER_EYE]
    right_under_pts = pts[RIGHT_UNDER_EYE]
    left_cheek_pts = pts[LEFT_CHEEK]
    right_cheek_pts = pts[RIGHT_CHEEK]

    eye_mask = poly_mask((H, W), left_eye_pts) | poly_mask((H, W), right_eye_pts)
    under_eye_mask = poly_mask((H, W), left_under_pts) | poly_mask((H, W), right_under_pts)
    cheek_mask = poly_mask((H, W), left_cheek_pts) | poly_mask((H, W), right_cheek_pts)

    # diğer cilt maskesi: yanak maskesini genişlet
    skin_mask = cv2.dilate(cheek_mask, np.ones((21, 21), np.uint8), iterations=1)

    metrics = {
        "jaundice_proxy": sclera_yellow_proxy(frame_bgr, eye_mask, skin_mask),
        "under_eye_darkness": under_eye_darkness_proxy(frame_bgr, under_eye_mask, cheek_mask),
        "cheek_redness": cheek_redness_proxy(frame_bgr, cheek_mask, skin_mask),
        "asymmetry": asymmetry_proxy(pts),
    }

    # basit kalite eşiği
    quality_ok = (blur >= 110.0) and (75.0 <= bright <= 190.0)

    return {
        "blur": blur,
        "brightness": bright,
        "quality_ok": quality_ok,
        "metrics": metrics
    }

def agg(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    a = np.array(vals, dtype=np.float32)
    return {
        "n": int(len(a)),
        "min": float(a.min()),
        "median": float(np.median(a)),
        "max": float(a.max()),
        "mean": float(a.mean()),
    }

# -----------------------------
# API
# -----------------------------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/analyze-frames")
async def analyze_frames(frames: list[UploadFile] = File(...)):
    # FaceMesh'i istek başına oluşturuyoruz (kolay + stabil)
    mp_mesh = mp.solutions.face_mesh
    with mp_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.6
    ) as mesh:

        per_frame = []
        for f in frames:
            data = await f.read()
            img = decode_image(data)
            if img is None:
                continue
            r = analyze_one_frame(img, mesh)
            if r is None:
                continue
            if r["quality_ok"]:
                per_frame.append(r)

    if not per_frame:
        return {
            "disclaimer": "Bu rapor tani degildir. Sadece goruntuye dayali olasi bulgulari raporlar.",
            "received_frames": len(frames),
            "used_frames": 0,
            "error": "Yuz bulunamadi veya kalite yetersiz (isik/netlik).",
            "findings": []
        }

    # metrikleri topla
    keys = ["jaundice_proxy", "under_eye_darkness", "cheek_redness", "asymmetry"]
    agg_metrics = {}
    for k in keys:
        agg_metrics[k] = agg([p["metrics"].get(k) for p in per_frame])

    def finding(title, key, confidence, based_on, advice):
        st = agg_metrics.get(key)
        score = None if st is None else st["median"]
        return {
            "id": key,
            "title": title,
            "score": score,
            "level": score_level(score),
            "confidence": confidence,
            "based_on": based_on,
            "stats": st,
            "advice": advice
        }

    findings = [
        finding(
            "Sarılık benzeri göz sarı ton (proxy)",
            "jaundice_proxy",
            "DUSUK",
            ["Göz bölgesi renk metriği (LAB-b)", "Cilt referansı (yaklaşık)"],
            "Bu sadece görsel bir ölçümdür. Devam eden sararma/şikayet varsa doktora danışın."
        ),
        finding(
            "Göz altı koyuluk (proxy)",
            "under_eye_darkness",
            "ORTA",
            ["Göz altı bölgesi (yaklaşık)", "Yanak referansı (LAB-L farkı)"],
            "Yorgunluk/uykusuzluk/alerji/ışık etkileyebilir. Uzun sürerse doktora danışın."
        ),
        finding(
            "Yanak kızarıklığı (proxy)",
            "cheek_redness",
            "DUSUK",
            ["Yanak bölgeleri (yaklaşık)", "Cilt referansı (LAB-a farkı)"],
            "Işık/ısı/makyaj etkileyebilir. Sürekli döküntü/kızarıklık varsa doktora danışın."
        ),
        finding(
            "Yüz asimetri (proxy)",
            "asymmetry",
            "ORTA",
            ["Ağız köşeleri yükseklik farkı", "Yüz ölçeği (gözler arası mesafe)"],
            "Ani gelişen belirgin asimetri/acil bulgu varsa sağlık kuruluşuna başvurun."
        ),
    ]

    # kalite istatistiği
    blur_stats = agg([p["blur"] for p in per_frame])
    bright_stats = agg([p["brightness"] for p in per_frame])

    return {
        "disclaimer": "Bu rapor tani degildir. Sadece goruntuye dayali olasi bulgulari raporlar.",
        "received_frames": len(frames),
        "used_frames": len(per_frame),
        "quality": {
            "blur": blur_stats,
            "brightness": bright_stats
        },
        "findings": findings
    }
