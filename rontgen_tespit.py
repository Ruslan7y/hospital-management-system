import os
import uuid
import time
import numpy as np
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
from werkzeug.utils import secure_filename

# -------------------------------
# AYARLAR
# -------------------------------
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "rontgen_siniflandirici_final.h5")
CLASS_NAMES = ["NORMAL", "Pnömoni", "Tüberküloz"]
IMAGE_SIZE = (224, 224)

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
ALLOWED_EXT = {".jpg", ".jpeg", ".png"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB

os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__, template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# ✅ Live Server (5501) -> Flask (5000) cross-origin izinleri
CORS(app, resources={
    r"/*": {
        "origins": ["http://127.0.0.1:5501", "http://localhost:5501"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

print("========================================")
print("[BOOT] Flask başlatılıyor...")
print("[BOOT] MODEL_PATH =", MODEL_PATH)
print("[BOOT] UPLOAD_DIR =", UPLOAD_DIR)
print("========================================")

# ✅ Modeli 1 kere yükle
try:
    model = load_model(MODEL_PATH)
    print("[BOOT] ✅ Model yüklendi.")
except Exception as e:
    print("[BOOT] ❌ Model yüklenemedi:", e)
    raise

def preprocess_image(img_path: str) -> np.ndarray:
    img = image.load_img(img_path, target_size=IMAGE_SIZE)
    arr = image.img_to_array(img)
    arr = np.expand_dims(arr, axis=0)
    return arr / 255.0

# (İsteğe bağlı) Flask üzerinden sayfayı da servis etmek istersen:
@app.get("/")
def index():
    # templates/rontgen.html varsa açar
    try:
        return render_template("rontgen.html")
    except Exception:
        return jsonify({"ok": True, "msg": "API çalışıyor. Live Server'dan sayfa açabilirsiniz."})

@app.get("/health")
def health():
    return jsonify({"ok": True})

@app.post("/upload_and_predict")
def upload_and_predict():
    req_id = uuid.uuid4().hex[:8]
    t0 = time.time()

    print("\n----------------------------------------")
    print(f"[{req_id}] 📥 İSTEK GELDİ: /upload_and_predict")

    if "file" not in request.files:
        print(f"[{req_id}] ❌ 'file' alanı yok")
        return jsonify({"error": "file alanı gönderilmedi."}), 400

    f = request.files["file"]
    if not f or f.filename == "":
        print(f"[{req_id}] ❌ Dosya adı boş")
        return jsonify({"error": "Dosya adı boş."}), 400

    filename = secure_filename(f.filename)
    ext = os.path.splitext(filename)[1].lower()

    print(f"[{req_id}] ✅ Dosya alındı: {filename} (ext={ext})")

    if ext not in ALLOWED_EXT:
        print(f"[{req_id}] ❌ Geçersiz uzantı: {ext}")
        return jsonify({"error": "Geçersiz dosya türü. Sadece JPG/JPEG/PNG."}), 400

    saved_name = f"{uuid.uuid4().hex}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, saved_name)

    try:
        f.save(saved_path)
        print(f"[{req_id}] 💾 Kaydedildi: {saved_path}")

        x = preprocess_image(saved_path)
        preds = model.predict(x, verbose=0)[0]

        idx = int(np.argmax(preds))
        predicted_class = CLASS_NAMES[idx]
        confidence = float(preds[idx])

        all_conf = {CLASS_NAMES[i]: float(preds[i]) for i in range(len(CLASS_NAMES))}

        payload = {
            "sinif": predicted_class,
            "guven": confidence,
            "tum_tahminler": all_conf,
            "tahmin_edilen_yol": filename
        }

        dt = time.time() - t0
        print(f"[{req_id}] ✅ SONUÇ: {predicted_class} | guven={confidence:.6f} | sure={dt:.2f}s")
        print(f"[{req_id}] 📤 JSON gönderildi (200)")
        print(f"[{req_id}] ----------------------------------------")

        return jsonify(payload)

    except Exception as e:
        print(f"[{req_id}] ❌ HATA:", e)
        return jsonify({"error": f"İşlem sırasında hata: {str(e)}"}), 500

    finally:
        try:
            if os.path.exists(saved_path):
                os.remove(saved_path)
                print(f"[{req_id}] 🧹 Geçici dosya silindi.")
        except:
            pass

if __name__ == "__main__":
    print("[BOOT] 🚀 Sunucu: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
