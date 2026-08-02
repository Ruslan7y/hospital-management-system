from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import mediapipe as mp

app = FastAPI(title="Solunum Tespit API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # prod'da domain yaz
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Sinyal yardımcıları
# ----------------------------
def ema_smooth(x, alpha=0.18):
    y = np.zeros_like(x, dtype=np.float32)
    y[0] = x[0]
    for i in range(1, len(x)):
        y[i] = alpha * x[i] + (1 - alpha) * y[i - 1]
    return y

def moving_average(x, w=25):
    if len(x) < w:
        return x.copy()
    kernel = np.ones(w, dtype=np.float32) / w
    return np.convolve(x, kernel, mode="same")

def detrend(x, w=75):
    base = moving_average(x, w=w)
    return x - base

def find_peaks_simple(x, fs, bpm_max=35):
    if len(x) < 10:
        return []
    x = x.astype(np.float32)
    std = float(np.std(x)) + 1e-6
    x = x / std

    min_dist = int((60.0 / bpm_max) * fs)
    min_dist = max(3, min_dist)

    peaks = []
    last = -10**9
    thresh = 0.6

    for i in range(1, len(x)-1):
        if x[i] > thresh and x[i] > x[i-1] and x[i] > x[i+1]:
            if i - last >= min_dist:
                peaks.append(i)
                last = i
    return peaks

def confidence_estimate(sig, peaks):
    if len(sig) < 20 or len(peaks) < 2:
        return 0.0
    s = sig.astype(np.float32)
    std = float(np.std(s)) + 1e-6
    pv = [s[p] for p in peaks if 0 <= p < len(s)]
    if not pv:
        return 0.0
    prom = float(np.mean(pv)) / std
    return float(max(0.0, min(1.0, (prom - 0.8) / 1.8)))

def decode_image(file_bytes: bytes):
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

# ----------------------------
# Kullanıcı dostu yorumlama
# ----------------------------
def classify_bpm_adult_rest(bpm):
    # Yetişkin dinlenme için basit aralıklar
    if bpm < 10:
        return ("DÜŞÜK", "Nefes sayısı beklenenden düşük görünüyor.", "blue")
    if 10 <= bpm < 12:
        return ("HAFİF DÜŞÜK", "Biraz düşük görünüyor (ölçüm hatası da olabilir).", "blue")
    if 12 <= bpm <= 20:
        return ("NORMAL", "Dinlenme halinde çoğu yetişkin için normal aralıktadır.", "green")
    if 21 <= bpm <= 24:
        return ("HAFİF YÜKSEK", "Biraz hızlı nefes alıp verme olabilir.", "yellow")
    if 25 <= bpm <= 30:
        return ("YÜKSEK", "Nefes hızı yüksek görünüyor.", "red")
    return ("ÇOK YÜKSEK", "Nefes hızı çok yüksek görünüyor.", "red")

def confidence_label(conf):
    if conf < 0.35:
        return ("DÜŞÜK", "Ölçüm net değil. Işık/poz/sabitlik yüzünden hata olabilir.")
    if conf < 0.7:
        return ("ORTA", "Genel bir fikir verir. Tekrar ölçüm önerilir.")
    return ("İYİ", "Sinyal tutarlı. Sonuç daha güvenilir görünüyor.")

def build_user_actions(level, conf_label):
    actions = []
    if conf_label == "DÜŞÜK":
        actions.append("Daha iyi ışıkta, omuz/göğüs kadrajdayken tekrar ölç.")
        actions.append("1 dakika sakinleş, konuşma/hareketi azalt, yeniden dene.")
    else:
        if level == "NORMAL":
            actions.append("Normal görünüyor. İstersen 1 kez daha ölçerek doğrulayabilirsin.")
        elif level in ["HAFİF YÜKSEK", "YÜKSEK", "ÇOK YÜKSEK"]:
            actions.append("2-3 dakika otur, sakin nefes al, tekrar ölç.")
            actions.append("Ateş, stres/anksiyete, efor, kafein/nikotin nefesi hızlandırabilir.")
            actions.append("Devam ederse veya rahatsızlık varsa doktora danış.")
        else:  # düşük
            actions.append("Tekrar ölç (ölçüm hatası olabilir).")
            actions.append("Baş dönmesi, bayılma hissi gibi şikayet varsa doktora danış.")
    urgent = [
        "Nefes darlığı, göğüs ağrısı, morarma, bayılma veya bilinç bulanıklığı varsa ACİL yardım al."
    ]
    return actions, urgent

# ----------------------------
# API
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/breathing-rate")
async def breathing_rate(frames: list[UploadFile] = File(...)):
    # MediaPipe Pose
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=True,
        model_complexity=1,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.6
    )

    times = []
    signal = []
    used = 0

    try:
        for i, f in enumerate(frames):
            data = await f.read()
            img = decode_image(data)
            if img is None:
                continue

            H, W = img.shape[:2]
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            res = pose.process(rgb)
            if not res.pose_landmarks:
                continue

            lm = res.pose_landmarks.landmark

            def p(idx):
                return np.array([lm[idx].x * W, lm[idx].y * H], dtype=np.float32)

            # 11-12 omuz, 23-24 kalça
            ls, rs, lh, rh = p(11), p(12), p(23), p(24)
            shoulder_mid = (ls + rs) / 2.0
            hip_mid = (lh + rh) / 2.0

            torso_len = float(np.linalg.norm(shoulder_mid - hip_mid))
            shoulder_w = float(np.linalg.norm(ls - rs))
            s = 0.75 * torso_len + 0.25 * shoulder_w

            signal.append(s)
            times.append(i)  # frame index (eşit aralık varsayımı)
            used += 1

    finally:
        pose.close()

    received = len(frames)

    # Minimum veri
    if used < 25:
        return {
            "ok": False,
            "disclaimer": "Bu ölçüm tanı değildir. Sadece nefes/dk tahmini verir.",
            "received_frames": received,
            "used_frames": used,
            "error": "Yeterli veri yok. Omuz/göğüs kadrajda değil veya poz tespit edilemedi.",
        }

    x = np.array(signal, dtype=np.float32)

    # Frontend interval'ı 500ms ise fs ~ 2 Hz
    fs = 2.0

    # filtre
    x2 = detrend(x, w=25)
    x2 = ema_smooth(x2, alpha=0.18)

    peaks = find_peaks_simple(x2, fs, bpm_max=35)
    breaths = len(peaks)

    duration_sec = received * 0.5  # 500ms aralık varsayımı
    bpm = breaths / max(1e-6, duration_sec) * 60.0
    conf = confidence_estimate(x2, peaks)

    level, message, color = classify_bpm_adult_rest(bpm)
    conf_label, conf_msg = confidence_label(conf)
    actions, urgent = build_user_actions(level, conf_label)

    return {
        "ok": True,
        "disclaimer": "Bu ölçüm tanı değildir. Sadece nefes/dk tahmini verir.",
        "received_frames": received,
        "used_frames": used,
        "breaths_detected": breaths,
        "breaths_per_min": round(float(bpm), 0),
        "level": level,
        "message": message,
        "confidence": conf_label,
        "confidence_note": conf_msg,
        "actions": actions,
        "urgent": urgent,
        "ui_color": color
    }
