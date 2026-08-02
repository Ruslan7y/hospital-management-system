from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import json

app = FastAPI()

# CORS (site farklı porttaysa lazım)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prod'da kendi domainini yaz
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def decode_image(file_bytes: bytes):
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

@app.post("/analyze-frames")
async def analyze_frames(frames: list[UploadFile] = File(...)):
    # Burada: senin “30 sn multi-frame” analiz fonksiyonunu çağıracağız.
    # Şimdilik: kaç frame geldi + basit kalite metrikleri döndürüyorum.
    blur_list, bright_list = [], []

    for f in frames:
        b = await f.read()
        img = decode_image(b)
        if img is None:
            continue
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.Laplacian(gray, cv2.CV_64F).var()
        bright = float(np.mean(gray))
        blur_list.append(float(blur))
        bright_list.append(float(bright))

    def stats(x):
        if not x:
            return None
        x = np.array(x, dtype=np.float32)
        return {
            "n": int(len(x)),
            "min": float(x.min()),
            "median": float(np.median(x)),
            "max": float(x.max()),
            "mean": float(x.mean()),
        }

    report = {
        "disclaimer": "Bu rapor tani degildir. Sadece goruntuye dayali olasi bulgulari raporlar.",
        "received_frames": len(frames),
        "quality": {
            "blur": stats(blur_list),
            "brightness": stats(bright_list),
        },
        # Buraya: gerçek metrikler (sarılık proxy, göz altı, kızarıklık, asimetri vs.) eklenecek
        "findings": [
            {
                "id": "under_eye_darkness",
                "title": "Goz alti koyuluk",
                "score": None,
                "level": "OLCULEMEDI",
                "confidence": "ORTA/DUSUK",
                "based_on": ["Goz alti ROI", "Yanak ROI", "LAB-L farki"],
                "advice": "Devam ederse veya ek sikayet varsa doktora danisin."
            }
        ]
    }
    return report
