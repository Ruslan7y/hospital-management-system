from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import mediapipe as mp

app = FastAPI(title="Kalp Atisi API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # prod'da domaininle değiştir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Sinyal yardımcıları
# ----------------------------
def ema_smooth(x, alpha=0.20):
    y = np.zeros_like(x, dtype=np.float32)
    y[0] = x[0]
    for i in range(1, len(x)):
        y[i] = alpha * x[i] + (1 - alpha) * y[i - 1]
    return y

def moving_average(x, w=25):
    if len(x) < w:
        return x.copy()
    k = np.ones(w, dtype=np.float32) / w
    return np.convolve(x, k, mode="same")

def detrend(x, w=75):
    base = moving_average(x, w=w)
    return x - base

def estimate_bpm_fft(sig, fs, bpm_min=45, bpm_max=180):
    x = sig.astype(np.float32)
    x = x - np.mean(x)
    x = detrend(x, w=int(max(25, fs * 1.8)))
    x = ema_smooth(x, alpha=0.22)

    win = np.hanning(len(x)).astype(np.float32)
    xw = x * win

    freqs = np.fft.rfftfreq(len(xw), d=1.0 / fs)
    mag = np.abs(np.fft.rfft(xw))

    fmin = bpm_min / 60.0
    fmax = bpm_max / 60.0
    mask = (freqs >= fmin) & (freqs <= fmax)
    if not np.any(mask):
        return None, 0.0, None

    freqs2 = freqs[mask]
    mag2 = mag[mask]

    peak_idx = int(np.argmax(mag2))
    peak_f = float(freqs2[peak_idx])
    bpm = peak_f * 60.0

    mag_sorted = np.sort(mag2)
    top = float(mag_sorted[-1]) if len(mag_sorted) else 0.0
    second = float(mag_sorted[-2]) if len(mag_sorted) > 1 else (np.mean(mag2) + 1e-6)

    conf_ratio = top / (second + 1e-6)  # >1 iyi
    conf01 = float(np.clip((conf_ratio - 1.1) / 1.6, 0.0, 1.0))

    return float(bpm), conf01, {"conf_ratio": float(conf_ratio), "peak_hz": float(peak_f)}

def decode_image(file_bytes: bytes):
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

# ----------------------------
# Kullanıcı dostu yorum
# ----------------------------
def classify_bpm(bpm):
    # Yetişkin dinlenme (çok kaba)
    if bpm is None:
        return ("ÖLÇÜLEMEDİ", "Ölçüm net çıkmadı. Işık/poz/hareket etkileyebilir.", "yellow")

    if bpm < 50:
        return ("DÜŞÜK", "Dinlenme halinde düşük olabilir (sporcularda normal olabilir).", "yellow")
    if 50 <= bpm < 60:
        return ("HAFİF DÜŞÜK", "Bazı kişilerde normal olabilir. İstersen tekrar ölç.", "green")
    if 60 <= bpm <= 100:
        return ("NORMAL", "Çoğu yetişkin için dinlenme halinde normal aralıktır.", "green")
    if 100 < bpm <= 120:
        return ("HAFİF YÜKSEK", "Stres/kafein/efor/ateş etkileyebilir. Dinlenip tekrar ölç.", "yellow")
    return ("YÜKSEK", "Yüksek görünüyor. Dinlenip tekrar ölç; devam ederse doktora danış.", "red")

def confidence_label(c):
    if c < 0.35:
        return ("DÜŞÜK", "Işık/poz/hareket yüzünden hata olabilir.")
    if c < 0.7:
        return ("ORTA", "Genel fikir verir. Tekrar ölçüm önerilir.")
    return ("İYİ", "Sinyal tutarlı görünüyor.")

def build_actions(level, conf_label):
    actions = []
    if conf_label == "DÜŞÜK":
        actions.append("Yüzünü iyi aydınlat (çok karanlık/parlak olmasın).")
        actions.append("Kameraya 40-70 cm mesafede dur, mümkünse sabit kal.")
        actions.append("Gözlük yansıması sonucu bozabilir, mümkünse çıkarıp dene.")
        actions.append("1-2 kez tekrar ölç ve ortalamasına bak.")
    else:
        if level in ["NORMAL", "HAFİF DÜŞÜK"]:
            actions.append("Normal görünüyor. İstersen 1 kez daha ölçerek doğrulayabilirsin.")
        else:
            actions.append("3-5 dakika dinlen, su iç, sakin nefes al ve tekrar ölç.")
            actions.append("Kafein/nikotin/anksiyete/ateş/efor BPM'i artırabilir.")
            actions.append("Devam ederse veya çarpıntı şikayetin varsa doktora danış.")
    urgent = [
        "Göğüs ağrısı, nefes darlığı, bayılma, ciddi baş dönmesi varsa ACİL yardım al."
    ]
    return actions, urgent

# ----------------------------
# API
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/heart-rate")
async def heart_rate(frames: list[UploadFile] = File(...)):
    # Yüz algılama
    mp_face = mp.solutions.face_detection
    detector = mp_face.FaceDetection(model_selection=0, min_detection_confidence=0.6)

    g_means = []
    used = 0
    received = len(frames)

    try:
        for f in frames:
            data = await f.read()
            img = decode_image(data)
            if img is None:
                continue

            H, W = img.shape[:2]
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            res = detector.process(rgb)

            if not res.detections:
                continue

            det = res.detections[0]
            box = det.location_data.relative_bounding_box
            x1 = int(box.xmin * W)
            y1 = int(box.ymin * H)
            x2 = int((box.xmin + box.width) * W)
            y2 = int((box.ymin + box.height) * H)

            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(W - 1, x2), min(H - 1, y2)

            # ROI: yüz ortası (alın+yanak)
            roi_y1 = y1 + int((y2 - y1) * 0.20)
            roi_y2 = y1 + int((y2 - y1) * 0.75)
            roi_x1 = x1 + int((x2 - x1) * 0.20)
            roi_x2 = x1 + int((x2 - x1) * 0.80)

            if roi_x2 <= roi_x1 or roi_y2 <= roi_y1:
                continue

            roi = img[roi_y1:roi_y2, roi_x1:roi_x2]
            g = roi[:, :, 1].astype(np.float32)
            g_means.append(float(np.mean(g)))
            used += 1
    finally:
        detector.close()

    if used < 35:
        return {
            "ok": False,
            "disclaimer": "Bu ölçüm tanı değildir. Sadece tahmini BPM verir.",
            "received_frames": received,
            "used_frames": used,
            "error": "Yeterli veri yok. Yüz kadrajda değil / ışık yetersiz / fazla hareket var.",
        }

    # Frontend 500ms interval => fs ~ 2 Hz
    fs = 2.0
    x = np.array(g_means, dtype=np.float32)

    bpm, conf01, meta = estimate_bpm_fft(x, fs, bpm_min=45, bpm_max=180)

    level, message, color = classify_bpm(bpm)
    conf_label, conf_msg = confidence_label(conf01)
    actions, urgent = build_actions(level, conf_label)

    return {
        "ok": True,
        "disclaimer": "Bu ölçüm tanı değildir. Sadece tahmini BPM verir.",
        "received_frames": received,
        "used_frames": used,
        "bpm": None if bpm is None else round(float(bpm), 0),
        "level": level,
        "message": message,
        "confidence": conf_label,
        "confidence_note": conf_msg,
        "actions": actions,
        "urgent": urgent,
        "ui_color": color,
        "meta": meta
    }
