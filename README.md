# Hastane Otomasyon Sistemi — Yapay Zekâ Destekli Full-Stack Sağlık Platformu

Hastaların randevu aldığı, doktorların teşhis kaydettiği, yöneticilerin hastaneyi yönettiği; röntgen sınıflandırma, yapay zekâ doktor asistanı ve kamera ile nabız/solunum ölçümü gibi yapay zekâ modülleri içeren bir hastane yönetim platformu.

## Özellikler

**Rol bazlı paneller**

| Rol | Yapabildikleri |
|---|---|
| Hasta | Kayıt ve giriş, uygun doktor arama, randevu alma, randevu ve teşhis geçmişi, fitness/sağlık takibi |
| Doktor | Aktif randevular, hasta çağırma, teşhis kaydetme, röntgen analizi, yapay zekâ asistanı |
| Yönetici | Yönetici başvurularını onaylama, resepsiyon personeli ekleme, hastane hastalarını görüntüleme |
| Resepsiyon | Hastane randevularını yönetme, profil tamamlama |

**Yapay zekâ modülleri**

- **Röntgen sınıflandırma:** Göğüs röntgenini üç sınıfa ayırır: Normal, Pnömoni, Tüberküloz. Keras/TensorFlow ile eğitilmiş, DenseNet121 tabanlı (transfer learning) bir model kullanır. Girdi 224×224 piksel. Sonuç, her sınıfın olasılığıyla birlikte döner.
- **Yapay zekâ doktor asistanı:** Google Gemini API ile çalışan, her yanıtta "bu bir tıbbi tavsiye değildir" uyarısı veren sohbet asistanı.
- **Kamera ile nabız ölçümü:** MediaPipe ile yüz tespiti, yüzdeki renk değişiminden sinyal çıkarma, filtreleme ve FFT ile kalp atış hızı tahmini (rPPG yöntemi).
- **Kamera ile solunum ölçümü:** Görüntü karelerinden solunum hızı tahmini.

**Diğer**

- Şifreler `bcrypt` ile hash'lenerek saklanır.
- Kayıt, giriş, randevu ve resepsiyon hesabı oluşturmada otomatik e-posta bildirimi (Nodemailer + Brevo SMTP).
- Fitness modülü: sağlık profili, hedef belirleme, günlük check-in.

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Backend (ana) | Node.js, Express |
| Veritabanı | Microsoft SQL Server (`mssql`) |
| Yapay zekâ servisleri | Python, Flask, FastAPI |
| Makine öğrenmesi | TensorFlow / Keras, OpenCV, MediaPipe, NumPy, SciPy |
| Üretken yapay zekâ | Google Gemini API |
| Frontend | HTML, CSS, JavaScript |

## Proje Yapısı

```
├── server.js              # Ana Express sunucusu: tüm roller, randevu, teşhis, fitness API'leri
├── pages/                 # Rol bazlı arayüz sayfaları (giriş, paneller, randevu, ölçüm ekranları)
├── *.html                 # Genel sayfalar (ana sayfa, hizmetler, doktorlar, iletişim)
├── rontgen_tespit.py      # Röntgen sınıflandırma servisi (Flask + Keras)
├── chatbot_api.py         # Yapay zekâ doktor asistanı (Flask + Gemini)
├── backend/
│   ├── kalp_server.py     # Kamera ile nabız ölçümü (FastAPI)
│   ├── server_sol.py      # Kamera ile solunum ölçümü (FastAPI)
│   └── server.py          # Görüntü karesi analizi (FastAPI)
├── hasta_tespit/          # Canlı kamera ile yüz tespiti ve nabız (Flask)
├── train/                 # Röntgen eğitim verisi: NORMAL (152), Pnömoni (306), Tüberküloz (100)
├── veritabani_test.js     # Veritabanı bağlantı testi
└── .env.example           # Gerekli ortam değişkenleri
```

## Kurulum

**1. Ortam değişkenleri**

```bash
cp .env.example .env
```

`.env` dosyasına veritabanı, SMTP ve Gemini API bilgilerini girin. Bu dosya `.gitignore` ile repodan hariç tutulur, gizli bilgiler asla koda yazılmaz.

**2. Node.js sunucusu**

```bash
npm install
node veritabani_test.js   # veritabanı bağlantısını test eder
npm start                 # http://localhost:5000
```

**3. Python servisleri**

```bash
pip install flask flask-cors fastapi uvicorn tensorflow opencv-python mediapipe numpy scipy python-dotenv google-genai
python rontgen_tespit.py
python chatbot_api.py
uvicorn backend.kalp_server:app --port 8001
```

Not: Birden fazla servis varsayılan olarak 5000 portunu kullanıyor. Aynı anda çalıştırırken portları ayrı ayrı ayarlayın.

**4. Röntgen modeli**

Eğitilmiş model dosyası (`rontgen_siniflandirici_final.h5`, 100 MB+) GitHub'ın dosya boyutu sınırını aştığı için repoda yok. Modeli `train/` klasöründeki veriyle yeniden eğitip proje kök dizinine koyun.

## Önemli Not

Bu proje eğitim amaçlıdır. Yapay zekâ modüllerinin sonuçları tıbbi teşhis yerine geçmez.
