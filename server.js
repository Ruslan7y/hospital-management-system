    // server.js (Tüm görünmez karakterler temizlendi)
// server.js dosyasının en üstüne ekleyin
const fs = require("fs");
const path = require("path");
const multer = require('multer');
const { spawn } = require('child_process'); // Python script'ini çalıştırmak için


const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// Dosya yükleme ayarları
const upload = multer({ 
    dest: 'uploads/', // Geçici olarak resimleri 'uploads' klasörüne kaydet
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
    const express = require('express');
    const sql = require('mssql');
    const bcrypt = require('bcrypt');
    const cors = require('cors');
    const nodemailer = require('nodemailer');
    const crypto = require('crypto'); // BU SATIRI EKLE
    const app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());
    

    // --- VERİTABANI BAĞLANTI AYARLARI ---
    const ayarlar = {
        server: 'localhost',
        database: 'HastaneDB_Gecici',
        user: 'hastane_user',
        password: 'HastaneSifre123',
        options: {
            trustServerCertificate: true,
            encrypt: false
        }
    };
    // ===============================
// ✅ MSSQL POOL (TEK BAĞLANTI)
// ===============================
let _pool = null;

async function getPool() {
  try {
    if (_pool) return _pool;

    _pool = await sql.connect(ayarlar);

    _pool.on("error", (err) => {
      console.error("❌ MSSQL Pool Error:", err);
      _pool = null;
    });

    console.log("✅ MSSQL pool hazır");
    return _pool;
  } catch (err) {
    console.error("❌ MSSQL bağlantı hatası:", err);
    _pool = null;
    throw err;
  }
}


    // --- E-POSTA (Brevo) AYARLARI ---
    const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
            user: '9964a5001@smtp-brevo.com',
            pass: 'w32hMkQArbVTyDHP'
        }
    });

    // --- KAYIT BİLDİRİMİ GÖNDER ---
    async function kayitBildirimiGonder(hastaEmail, hastaAd) {
        const mailOptions = {
            from: '"Sağlık Portalı" <medicalss110@gmail.com>',
            to: hastaEmail,
            subject: 'Sağlık Portalı Hesabınız Oluşturuldu!',
            html: `
                <h3>Hoş Geldin ${hastaAd},</h3>
                <p>Sağlık Portalı'na başarıyla kayıt oldunuz.</p>
                <p>Artık hesabınıza giriş yapabilir ve hizmetlerimizden faydalanabilirsiniz.</p>
                <p>Sağlıklı günler dileriz 🌿</p>
            `
        };
        await transporter.sendMail(mailOptions);
    }

    // --- GİRİŞ BİLDİRİMİ GÖNDER ---
    async function girisBildirimiGonder(hastaEmail, hastaAd) {
        const mailOptions = {
            from: '"Sağlık Portalı" <medicalss110@gmail.com>',
            to: hastaEmail,
            subject: 'Sağlık Portalı Hesabınıza Giriş Yapıldı',
            html: `
                <h3>Merhaba ${hastaAd},</h3>
                <p>Sağlık Portalı hesabınıza başarılı bir şekilde giriş yapıldığını bildirmek isteriz.</p>
                <p>Eğer bu işlemi siz yapmadıysanız, lütfen hemen şifrenizi değiştirin.</p>
            `
        };
        await transporter.sendMail(mailOptions);
    }
    // --- RANDEVU BİLDİRİMİ GÖNDER ---
async function randevuBildirimiGonder(hastaEmail, hastaAd, doktorAdSoyad, hastaneAd, randevuTarihi) {
    const tarihString = new Date(randevuTarihi).toLocaleString('tr-TR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    const mailOptions = {
        from: '"Sağlık Portalı" <medicalss110@gmail.com>',
        to: hastaEmail,
        subject: 'Yeni Randevu Oluşturuldu!',
        html: `
            <h3>Merhaba ${hastaAd},</h3>
            <p>Aşağıdaki bilgilerle yeni bir randevu talebiniz oluşturulmuştur ve onay beklenmektedir:</p>
            <ul>
                <li><b>Doktor:</b> Dr. ${doktorAdSoyad}</li>
                <li><b>Kurum:</b> ${hastaneAd}</li>
                <li><b>Tarih/Saat:</b> ${tarihString}</li>
            </ul>
            <p>Lütfen randevu durumunuzu kontrol etmeyi unutmayın.</p>
            <p>Sağlıklı günler dileriz 🌿</p>
        `
    };
    await transporter.sendMail(mailOptions);
}
async function resepsiyonBilgiGonder(email, ad, soyad, geciciSifre) {
    const mailOptions = {
        from: '"Sağlık Portalı Yönetim" <medicalss110@gmail.com>',
        to: email,
        subject: 'Resepsiyonist Hesabınız Oluşturuldu',
        html: `
            <h3>Merhaba ${ad} ${soyad},</h3>
            <p>Hastanemizin resepsiyon sistemine kaydınız yönetici tarafından yapılmıştır.</p>
            <p><b>Giriş Bilgileriniz:</b></p>
            <ul>
                <li><b>Email:</b> ${email}</li>
                <li><b>Geçici Şifre:</b> <strong style="color:blue;">${geciciSifre}</strong></li>
            </ul>
            <p>Sisteme ilk girişinizde güvenliğiniz için şifrenizi güncellemeniz ve profil bilgilerinizi tamamlamanız gerekmektedir.</p>
            <p>Sağlıklı günler dileriz.</p>
        `
    };
    await transporter.sendMail(mailOptions);
}

// ✅ FITNESS TABLOLARI YOKSA OLUŞTUR
// ===============================
async function ensureFitnessTables() {
  const p = await getPool();

  await p.request().query(`
    IF OBJECT_ID('dbo.FitnessProfil','U') IS NULL
    BEGIN
      CREATE TABLE dbo.FitnessProfil (
        hasta_id INT NOT NULL PRIMARY KEY,
        yas INT NOT NULL,
        boy_cm INT NOT NULL,
        kilo_kg DECIMAL(6,2) NOT NULL,
        bmi DECIMAL(6,2) NOT NULL,
        bmi_durum NVARCHAR(30) NOT NULL,
        bmr INT NOT NULL,
        tdee INT NOT NULL,
        aktivite_seviyesi INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END
  `);

  await p.request().query(`
    IF OBJECT_ID('dbo.FitnessHedef','U') IS NULL
    BEGIN
      CREATE TABLE dbo.FitnessHedef (
        hasta_id INT NOT NULL PRIMARY KEY,
        hedef_tip NVARCHAR(50) NOT NULL,
        secilen_vucut_kart NVARCHAR(50) NOT NULL,
        hedef_aciklama NVARCHAR(250) NULL,
        hedef_kalori INT NOT NULL,
        hedef_protein_g INT NOT NULL,
        haftalik_antrenman_gun INT NOT NULL,
        antrenman_plan NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END
  `);

  await p.request().query(`
    IF OBJECT_ID('dbo.FitnessHaftalik','U') IS NULL
    BEGIN
      CREATE TABLE dbo.FitnessHaftalik (
        id INT IDENTITY(1,1) PRIMARY KEY,
        hasta_id INT NOT NULL,
        hafta_baslangic DATE NOT NULL,
        kilo_kg DECIMAL(6,2) NOT NULL,
        notlar NVARCHAR(200) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );

      CREATE INDEX IX_FitnessHaftalik_hasta
      ON dbo.FitnessHaftalik (hasta_id, hafta_baslangic);
    END
  `);

  console.log("✅ Fitness tabloları hazır");
}

ensureFitnessTables().catch((e) =>
  console.error("❌ Fitness tablo kurulumu hata:", e)
);

function calcBMI(weightKg, heightCm) {
  const h = heightCm / 100;
  return weightKg / (h * h);
}
function bmiCategory(bmi) {
  if (bmi < 18.5) return "Zayıf";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Fazla Kilolu";
  return "Obez";
}
function calcBMR(age, weightKg, heightCm) {
  // Nötr yaklaşım (cinsiyet yok)
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age);
}
function activityFactor(level) {
  if (level === 3) return 1.725;
  if (level === 2) return 1.55;
  return 1.375;
}
function proteinTarget(weightKg, goalType, bmiCat) {
  let g = 1.8;
  if (goalType?.includes("aşırı kaslı") || goalType?.includes("büyük")) g = 2.2;
  else if (goalType?.includes("orta kaslı")) g = 2.0;
  else g = 1.8;

  if (bmiCat === "Zayıf") g = Math.max(g, 2.0);
  return Math.round(g * weightKg);
}
function calorieTarget(tdee, goalType, bmiCat) {
  let delta = 0;
  if (goalType?.includes("aşırı kaslı") || goalType?.includes("büyük")) delta = 300;
  else if (goalType?.includes("orta kaslı")) delta = 200;
  else delta = 0;

  if (bmiCat === "Fazla Kilolu") delta = Math.min(delta, 100);
  if (bmiCat === "Obez") delta = -400;
  return Math.round(tdee + delta);
}
function buildWorkoutPlan(goalType, bmiCat) {
  let days = 4;
  if (goalType?.includes("aşırı kaslı") || goalType?.includes("büyük")) days = 5;
  if (bmiCat === "Obez") days = Math.min(days, 4);

  const plan = [];
  for (let i = 1; i <= days; i++) {
    if (i === 1) plan.push({ gun: i, odak: "Üst Vücut (Push)", sure_dk: 60, kardiyo_dk: bmiCat !== "Zayıf" ? 15 : 10 });
    else if (i === 2) plan.push({ gun: i, odak: "Alt Vücut (Legs)", sure_dk: 60, kardiyo_dk: bmiCat === "Obez" ? 25 : 15 });
    else if (i === 3) plan.push({ gun: i, odak: "Üst Vücut (Pull)", sure_dk: 60, kardiyo_dk: 15 });
    else if (i === 4) plan.push({ gun: i, odak: "Full Body + Core", sure_dk: 55, kardiyo_dk: 20 });
    else plan.push({ gun: i, odak: "Hipertrofi (Zayıf Nokta)", sure_dk: 65, kardiyo_dk: 10 });
  }

  const notes = [
    "Her antrenmandan önce 8-10 dk ısınma (yürüyüş + eklem mobilitesi).",
    "Progressive overload: Her hafta toplam tekrar veya ağırlığı küçük artır.",
    "Uyku: 7-9 saat. Su: günde 2-2.5L (aktiviteye göre artır).",
  ];

  return { days, plan, notes };
}


    // --- HASTA KAYIT ---
    app.post('/kayit', async (req, res) => {
        try {
            const { ad, soyad, email, sifre, tcKimlik, dogumYili, telefon } = req.body;

            if (!ad || !soyad || !email || !sifre || !tcKimlik || !dogumYili || !telefon)
                return res.status(400).json({ mesaj: 'Lütfen tüm alanları doldurun.' });

            if (tcKimlik.length !== 11 || !/^[0-9]+$/.test(tcKimlik))
                return res.status(400).json({ mesaj: 'T.C. Kimlik numarası 11 haneli olmalıdır.' });

            const salt = await bcrypt.genSalt(10);
            const sifreHash = await bcrypt.hash(sifre, salt);

            const havuz = await sql.connect(ayarlar);
            await havuz.request()
                .input('Ad', sql.NVarChar, ad)
                .input('Soyad', sql.NVarChar, soyad)
                .input('Email', sql.NVarChar, email)
                .input('SifreHash', sql.NVarChar, sifreHash)
                .input('TcKimlikNo', sql.NVarChar, tcKimlik)
                .input('DogumTarihi', sql.NVarChar, dogumYili)
                .input('Telefon', sql.NVarChar, telefon)
                .query(`
                    INSERT INTO Hastalar (Ad, Soyad, Email, SifreHash, TcKimlikNo, DogumTarihi, Telefon)
                    VALUES (@Ad, @Soyad, @Email, @SifreHash, @TcKimlikNo, @DogumTarihi, @Telefon)
                `);

            kayitBildirimiGonder(email, ad).catch(console.error);
            res.status(201).json({ mesaj: 'Hasta kaydı başarıyla oluşturuldu!' });

        } catch (hata) {
            console.error(' Kayıt hatası:', hata);
            if (hata.originalError && hata.originalError.info.number === 2627)
                return res.status(409).json({ mesaj: 'Bu e-posta adresi zaten kayıtlı.' });

            res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
        }
    });     

    // --- HASTA GİRİŞ ---
    // app.js DOSYANIZA EKLEYİN (Eskisiyle değiştirin)

// app.js DOSYANIZDAKİ /giris FONKSİYONUNU BUNUNLA DEĞİŞTİRİN

// app.js DOSYANIZDAKİ /giris FONKSİYONUNU BUNUNLA DEĞİŞTİRİN

app.post('/giris', async (req, res) => {
    try {
        const { email, sifre } = req.body;
        if (!email || !sifre) return res.status(400).json({ mesaj: 'Lütfen tüm alanları doldurun.' });

        const havuz = await sql.connect(ayarlar);
        const sonuc = await havuz.request()
            .input('Email', sql.NVarChar, email)
            .query(`SELECT TOP 1 * FROM Hastalar WHERE Email = @Email OR TcKimlikNo = @Email`);

        const hasta = sonuc.recordset[0];
        if (!hasta) return res.status(401).json({ mesaj: 'Hatalı e-posta/T.C. kimlik veya şifre.' });

        // KONSOL KONTROLÜ: Terminalinizde { ..., hasta_id: 1, ... } görmelisiniz
        console.log("Veritabanından çekilen hasta objesi:", hasta); 

        const sifreDogruMu = await bcrypt.compare(sifre, hasta.SifreHash);
        if (!sifreDogruMu) return res.status(401).json({ mesaj: 'Hatalı e-posta/T.C. kimlik veya şifre.' });

        girisBildirimiGonder(hasta.Email, hasta.Ad).catch(console.error);
        
        res.status(200).json({
            mesaj: 'Giriş başarılı!',
            hasta: {
                // =========================================================
                // === DOĞRU ÇÖZÜM BURADA ===
                //
                // Veritabanındaki 'hasta_id' (küçük harf) sütununu okuyoruz
                id: hasta.hasta_id, 
                //
                // =========================================================
                ad: hasta.Ad,
                soyad: hasta.Soyad,
                email: hasta.Email,
                tcKimlik: hasta.TcKimlikNo,
                telefon: hasta.Telefon
            }
        });
    }
    catch (hata) {
        console.error('Giriş hatası:', hata);
        res.status(500).json({ mesaj: 'Sunucu hatası oluştu.' });
    }
});
// =================================================================
// --- YENİ ENDPOINT: HASTA RANDEVULARI VE DETAYLARI GETİRME ---
// =================================================================
app.get('/hasta-randevulari/:hastaId', async (req, res) => {
    try {
        const hastaId = req.params.hastaId;
        const havuz = await sql.connect(ayarlar);

        const randevuSonuc = await havuz.request()
            .input('hastaId', sql.Int, hastaId)
            .query(`
                SELECT 
                    r.randevu_id, r.randevu_tarihi, r.randevu_durumu, r.notlar,
                    d.isim AS doktorIsim, d.soyisim AS doktorSoyisim,
                    h.hastane_adi,
                    b.brans_adi
                FROM Randevular r
                JOIN Doktorlar d ON r.doktor_id = d.doktor_id
                JOIN Hastaneler h ON d.hastane_id = h.hastane_id
                JOIN Branslar b ON d.brans_id = b.brans_id
                WHERE r.hasta_id = @hastaId
                ORDER BY r.randevu_tarihi DESC
            `);

        res.status(200).json(randevuSonuc.recordset);

    } catch (hata) {
        console.error('Hasta randevuları getirme hatası:', hata);
        res.status(500).json({ mesaj: 'Randevular getirilirken bir sunucu hatası oluştu.' });
    }
});

// =================================================================
// --- YENİ ENDPOINT: TEŞHİS, İLAÇ VE TEST DETAYLARINI GETİRME ---
// =================================================================
app.get('/hasta-detay/:randevuId', async (req, res) => {
    try {
        const randevuId = req.params.randevuId;
        const havuz = await sql.connect(ayarlar);

        // Randevu bilgisi ve Teşhis bilgilerini tek sorgu ile çekelim
        const anaSonuc = await havuz.request()
            .input('randevuId', sql.Int, randevuId)
            .query(`
                SELECT 
                    r.randevu_tarihi, 
                    d.isim AS doktorIsim, d.soyisim AS doktorSoyisim,
                    t.teshis_id, t.teshis_metni, t.ek_notlar
                FROM Randevular r
                JOIN Doktorlar d ON r.doktor_id = d.doktor_id
                LEFT JOIN YeniTeshisler t ON r.randevu_id = t.randevu_id
                WHERE r.randevu_id = @randevuId
            `);
            
        if (anaSonuc.recordset.length === 0) {
            return res.status(404).json({ mesaj: 'Randevu bulunamadı.' });
        }

        const randevuKayit = anaSonuc.recordset[0];
        
        // Eğer teşhis girilmemişse (LEFT JOIN sonucu null), sadece randevu bilgisini döndür
        if (!randevuKayit.teshis_id) {
            return res.status(200).json({
                randevu: {
                    randevuTarihi: randevuKayit.randevu_tarihi,
                    doktor: `Dr. ${randevuKayit.doktorIsim} ${randevuKayit.doktorSoyisim}`,
                    teshisVar: false
                }
            });
        }

        const teshisId = randevuKayit.teshis_id;
        
        // İlaçları çek
        const ilacSonuc = await havuz.request()
            .input('teshisId', sql.Int, teshisId)
            .query('SELECT ilac_adi, kullanim_sekli, kullanim_suresi, ilac_dozaj FROM IlacReçeteleri WHERE teshis_id = @teshisId');
            
        // Testleri çek
        const testSonuc = await havuz.request()
            .input('teshisId', sql.Int, teshisId)
            .query('SELECT test_adi, sonuc_metni, sonuc_degeri, referans_araligi FROM YapilanTestler WHERE teshis_id = @teshisId');

        res.status(200).json({
            randevu: {
                randevuTarihi: randevuKayit.randevu_tarihi,
                doktor: `Dr. ${randevuKayit.doktorIsim} ${randevuKayit.doktorSoyisim}`,
                teshisVar: true
            },
            teshis: {
                teshisMetni: randevuKayit.teshis_metni,
                ekNotlar: randevuKayit.ek_notlar,
                ilaclar: ilacSonuc.recordset,
                testler: testSonuc.recordset
            }
        });

    } catch (hata) {
        console.error('Randevu detaylarını getirme hatası:', hata);
        res.status(500).json({ mesaj: 'Detaylar getirilirken bir sunucu hatası oluştu.' });
    }
});

    // =================================================================
    // --- YÖNETİCİ GİRİŞ ---
    // =================================================================
    // --- Admin GİRİŞ ---
    app.post('/yonetici/giris', async (req, res) => {
        try {
            const { kullaniciAdi, sifre } = req.body;

            if (!kullaniciAdi || !sifre) {
                return res.status(400).json({ mesaj: 'Kullanıcı adı ve şifre alanları zorunludur.' });
            }

            const havuz = await sql.connect(ayarlar);
            const sonuc = await havuz.request()
                .input('KullaniciAdi', sql.NVarChar, kullaniciAdi)
                .query('SELECT TOP 1 * FROM Admin WHERE KullaniciAdi = @KullaniciAdi');
            
            const yonetici = sonuc.recordset[0];

            if (!yonetici) {
                return res.status(401).json({ mesaj: 'Hatalı kullanıcı adı veya şifre.' });
            }

            // Şifre karşılaştırması (Hash'li veya düz metin, projenin mevcut durumuna göre)
            // ÖNEMLİ: Projenin sonunda mutlaka bcrypt kullanmalısın!
            // const sifreDogruMu = await bcrypt.compare(sifre, yonetici.SifreHash); 
            const sifreDogruMu = (sifre === yonetici.Sifre); // Geçici düz metin hali

            if (!sifreDogruMu) {
                return res.status(401).json({ mesaj: 'Hatalı kullanıcı adı veya şifre.' });
            }

            // === YENİ KONTROL ===
            // Yönetici şifresini daha önce değiştirmemişse, özel bir yanıt gönder.
            if (yonetici.SifreDegistiMi === false) {
                return res.status(200).json({
                    mesaj: 'İlk girişiniz olduğu için şifrenizi değiştirmeniz gerekmektedir.',
                    sifreGuncellemeGerekli: true,
                    yoneticiID: yonetici.AdminID // Şifre güncelleme işlemi için ID'yi gönderebiliriz.
                });
            }
            
            // Giriş başarılı ve şifre güncel
            res.status(200).json({
                mesaj: `Hoş geldiniz, ${yonetici.KullaniciAdi}!`,
                sifreGuncellemeGerekli: false
            });

        } catch (hata) {
            console.error('Yönetici giriş hatası:', hata);
            res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
        }
    });
    // --- YÖNETİCİ BAŞVURU KAYDI ---
    app.post('/yonetici/basvuru', async (req, res) => {
        try {
            const { ad, soyad, email, telefon, sehir, hastaneAdi, unvan } = req.body;
            if (!ad || !soyad || !email || !sehir || !hastaneAdi || !unvan) {
                return res.status(400).json({ mesaj: 'Lütfen tüm zorunlu alanları doldurun.' });
            }
            const havuz = await sql.connect(ayarlar);
            await havuz.request()
                .input('Ad', sql.NVarChar, ad).input('Soyad', sql.NVarChar, soyad)
                .input('Email', sql.NVarChar, email).input('Telefon', sql.NVarChar, telefon)
                .input('Sehir', sql.NVarChar, sehir).input('HastaneAdi', sql.NVarChar, hastaneAdi)
                .input('Unvan', sql.NVarChar, unvan)
                .query(`INSERT INTO YoneticiBasvurulari (Ad, Soyad, Email, Telefon, Sehir, HastaneAdi, Unvan) VALUES (@Ad, @Soyad, @Email, @Telefon, @Sehir, @HastaneAdi, @Unvan)`);
            res.status(201).json({ mesaj: 'Başvurunuz başarıyla alınmıştır. Onay sürecinden sonra bilgilendirileceksiniz.' });
        } catch (hata) {
            console.error('Yönetici başvuru hatası:', hata);
            if (hata.originalError && hata.originalError.info.number === 2627) {
                return res.status(409).json({ mesaj: 'Bu e-posta adresi ile zaten bir başvuru yapılmış.' });
            }
            res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
        }
    });

    // --- YENİ EKLENDİ: BEKLEYEN BAŞVURULARI LİSTELEME ---
    app.get('/yonetici/bekleyen-basvurular', async (req, res) => {
        try {
            const havuz = await sql.connect(ayarlar);
            const sonuc = await havuz.request()
                .query("SELECT * FROM YoneticiBasvurulari WHERE Durum = 'Beklemede' ORDER BY BasvuruTarihi DESC");
            res.status(200).json(sonuc.recordset);
        } catch (hata) {
            console.error('Bekleyen başvuruları getirme hatası:', hata);
            res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
        }
    });

    // --- YÖNETİCİ BAŞVURUSU ONAYLAMA ---
    app.post('/yonetici/onayla/:basvuruID', async (req, res) => {
    const basvuruID = req.params.basvuruID;
    let havuz; // 'try' bloğunun dışında tanımla

    try {
        // 'ayarlar' değişkeninin bu kapsamda tanımlı olduğunu varsayıyoruz
        havuz = await sql.connect(ayarlar); 

        // 1. Başvuruyu 'YoneticiBasvurulari' tablosundan al
        // 'basvuruSonuc' değişkeni burada 'const' ile doğru bir şekilde tanımlanıyor
        const basvuruSonuc = await havuz.request()
            .input('BasvuruID', sql.Int, basvuruID)
            .query('SELECT * FROM YoneticiBasvurulari WHERE BasvuruID = @BasvuruID AND Durum = \'Beklemede\'');

        // 'basvuruSonuc' değişkeni bir sonraki satırda kullanılıyor
        const basvuru = basvuruSonuc.recordset[0];

        if (!basvuru) {
            return res.status(404).json({ mesaj: 'Onaylanacak başvuru bulunamadı veya zaten işlenmiş.' });
        }

        // 2. Yeni yönetici için geçici şifre oluştur ve hash'le
        const geciciSifre = crypto.randomBytes(8).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const sifreHash = await bcrypt.hash(geciciSifre, salt);

        // 3. Veriyi 'Admin' yerine 'Yoneticiler' tablosuna ekle
        const insertYoneticilerQuery = `
            INSERT INTO Yoneticiler 
                (Ad, Soyad, Email, SifreHash, Telefon, Sehir, HastaneAdi, Unvan, KayitTarihi, SifreDegistiMi) 
            VALUES 
                (@Ad, @Soyad, @Email, @SifreHash, @Telefon, @Sehir, @HastaneAdi, @Unvan, GETDATE(), 0)
        `;

        await havuz.request()
            .input('Ad', sql.NVarChar, basvuru.Ad)
            .input('Soyad', sql.NVarChar, basvuru.Soyad)
            .input('Email', sql.NVarChar, basvuru.Email)
            .input('SifreHash', sql.NVarChar, sifreHash)
            .input('Telefon', sql.NVarChar, basvuru.Telefon)
            .input('Sehir', sql.NVarChar, basvuru.Sehir)
            .input('HastaneAdi', sql.NVarChar, basvuru.HastaneAdi)
            .input('Unvan', sql.NVarChar, basvuru.Unvan)
            .query(insertYoneticilerQuery);

        // 4. 'YoneticiBasvurulari' tablosundaki durumu 'Onaylandı' yap
        await havuz.request()
            .input('BasvuruID', sql.Int, basvuruID)
            .query('UPDATE YoneticiBasvurulari SET Durum = \'Onaylandı\' WHERE BasvuruID = @BasvuruID');

        
        // 5. Onaylanan yöneticiye e-posta gönder
        // 'transporter' değişkeninin bu kapsamda tanımlı olduğunu varsayıyoruz
        const mailOptions = {
            from: '"Sağlık Portalı" <medicalss110@gmail.com>',
            to: basvuru.Email,
            subject: 'Sağlık Portalı Yönetici Hesabınız Onaylandı!',
            html: `
                <h3>Merhaba ${basvuru.Ad} ${basvuru.Soyad},</h3>
                <p>Sağlık Portalı yönetici başvurunuz onaylanmıştır.</p>
                <p><b>Kullanıcı Adınız:</b> ${basvuru.Email}</p>
                <p>Aşağıdaki geçici şifrenizle sisteme giriş yapabilirsiniz:</p>
                <h2 style="color: #4f46e5;">${geciciSifre}</h2>
                <p><b>Önemli:</b> Güvenliğiniz için, sisteme ilk girişinizde bu şifreyi değiştirmeniz istenecektir.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        
        res.status(200).json({ mesaj: `${basvuru.Ad} ${basvuru.Soyad} adlı yöneticinin hesabı başarıyla oluşturuldu ve e-posta gönderildi.` });

    } catch (hata) {
        // Hata durumunda detaylı loglama
        console.error('Yönetici onaylama hatası:', hata); 

        // Hata 'basvuruSonuc' ile ilgiliyse, buraya düşmeden önce hata verir.
        // Eğer hata SQL ile ilgiliyse, 'originalError'u logla
        if (hata.code === 'EREQUEST') {
            console.error('SQL Hatası:', hata.originalError);
            res.status(500).json({ mesaj: 'Veritabanı işlemi sırasında bir hata oluştu.', detay: hata.originalError ? hata.originalError.message : hata.message });
        } else if (hata instanceof ReferenceError) {
             res.status(500).json({ mesaj: 'Sunucu kodunda bir değişken hatası (ReferenceError) oluştu.', detay: hata.message });
        } else {
            res.status(500).json({ mesaj: 'Sunucuda bilinmeyen bir hata oluştu.' });
        }
    }
});
    // --- YÖNETİCİ GİRİŞ ---
    // app.post('/yonetici/giris', async (req, res) => {
    //     try {
    //         const { kullaniciAdi, sifre } = req.body;
    //         // ... (Bu kısım, şifre değiştirme mantığı ile birlikte daha önce yazıldığı gibi kalabilir)
    //         // DİKKAT: Onaylama kısmında şifreyi HASH'Lİ kaydettiğimiz için, giriş yaparken de HASH'Lİ kontrol yapmalıyız!
    //         const havuz = await sql.connect(ayarlar);
    //         const sonuc = await havuz.request()
    //             .input('KullaniciAdi', sql.NVarChar, kullaniciAdi)
    //             .query('SELECT * FROM Admin WHERE KullaniciAdi = @KullaniciAdi');
    //         const yonetici = sonuc.recordset[0];
    //         if (!yonetici) {
    //             return res.status(401).json({ mesaj: 'Hatalı kullanıcı adı veya şifre.' });
    //         }

    //         const sifreDogruMu = await bcrypt.compare(sifre, yonetici.Sifre); // Düz şifre ile hash'i karşılaştır
    //         if (!sifreDogruMu) {
    //             return res.status(401).json({ mesaj: 'Hatalı kullanıcı adı veya şifre.' });
    //         }

    //         if (yonetici.SifreDegistiMi === false) {
    //             return res.status(200).json({ mesaj: 'İlk girişiniz olduğu için şifrenizi değiştirmeniz gerekmektedir.', sifreGuncellemeGerekli: true });
    //         }
            
    //         res.status(200).json({ mesaj: `Hoş geldiniz, ${yonetici.KullaniciAdi}!`, sifreGuncellemeGerekli: false });
    //     } catch (hata) {
    //         console.error('Yönetici giriş hatası:', hata);
    //         res.status(500).json({ mesaj: 'Sunucu hatası oluştu.' });
    //     }
    // })
    app.post('/yoneticiler/giris', async (req, res) => {
    try {
        const { email, parola } = req.body;

        if (!email || !parola) {
            return res.status(400).json({ mesaj: 'E-posta ve parola alanları zorunludur.' });
        }

        const havuz = await sql.connect(ayarlar);
        const sonuc = await havuz.request()
            .input('mailInput', sql.NVarChar, email)
            // HATA BURADAYDI: Tablo adı 'Yoneticilerh' olarak düzeltildi.
            .query('SELECT * FROM Yoneticilerh WHERE mail = @mailInput');

        const yonetici = sonuc.recordset[0];

        if (!yonetici) {
            return res.status(401).json({ mesaj: 'Hatalı e-posta veya parola.' });
        }
        
        if (parola !== yonetici.parola) {
            return res.status(401).json({ mesaj: 'Hatalı e-posta veya parola.' });
        }

        res.status(200).json({
            mesaj: `Giriş başarılı! Hoş geldiniz, ${yonetici.isim} ${yonetici.soyisim}.`,
            yonetici: {
                id: yonetici.yonetici_id,
                isim: yonetici.isim,
                soyisim: yonetici.soyisim,
                email: yonetici.mail
            }
        });

    } catch (hata) {
        // Hata olduğunda bu mesajı alıyordunuz.
        console.error('Yönetici giriş hatası:', hata);
        res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
    }
});
app.get('/yonetici-paneli/veri/:yoneticiId', async (req, res) => {
    try {
        const { yoneticiId } = req.params; // URL'den yönetici ID'sini al

        const havuz = await sql.connect(ayarlar);
        const sonuc = await havuz.request()
            .input('yoneticiId', sql.Int, yoneticiId)
            .query(`
                SELECT 
                    y.isim AS yoneticiIsim, 
                    y.soyisim AS yoneticiSoyisim,
                    h.hastane_adi,
                    d.isim AS doktorIsim,
                    d.soyisim AS doktorSoyisim,
                    b.brans_adi
                FROM Yoneticilerh y
                JOIN Hastaneler h ON y.hastane_id = h.hastane_id
                LEFT JOIN Doktorlar d ON h.hastane_id = d.hastane_id
                LEFT JOIN Branslar b ON d.brans_id = b.brans_id
                WHERE y.yonetici_id = @yoneticiId
            `);

        if (sonuc.recordset.length === 0) {
            return res.status(404).json({ mesaj: 'Yönetici bulunamadı.' });
        }

        // Veritabanından gelen dağınık veriyi düzenli bir JSON formatına çevirelim
        const panelVerisi = {
            yoneticiAdi: `${sonuc.recordset[0].yoneticiIsim} ${sonuc.recordset[0].yoneticiSoyisim}`,
            hastaneAdi: sonuc.recordset[0].hastane_adi,
            toplamDoktor: 0,
            branslar: {} // { "Kardiyoloji": ["Ali Veli", "Ayşe Yıldırım"], "Nöroloji": [...] }
        };

        const doktorSet = new Set(); // Aynı doktoru tekrar saymamak için

        sonuc.recordset.forEach(kayit => {
            if (kayit.doktorIsim) { // Eğer hastanenin hiç doktoru yoksa bu alanlar null gelebilir
                const doktorTamAdi = `Dr. ${kayit.doktorIsim} ${kayit.doktorSoyisim}`;
                
                if(!doktorSet.has(doktorTamAdi)) {
                    doktorSet.add(doktorTamAdi);
                    
                    const brans = kayit.brans_adi;
                    if (!panelVerisi.branslar[brans]) {
                        panelVerisi.branslar[brans] = [];
                    }
                    panelVerisi.branslar[brans].push(doktorTamAdi);
                }
            }
        });

        panelVerisi.toplamDoktor = doktorSet.size;

        res.status(200).json(panelVerisi);

    } catch (hata) {
        console.error('Panel verisi getirme hatası:', hata);
        res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
    }
});
app.post('/doktorlar/giris', async (req, res) => {
    try {
        const { email, parola } = req.body;

        if (!email || !parola) {
            return res.status(400).json({ mesaj: 'E-posta/TC ve parola alanları zorunludur.' });
        }

        const havuz = await sql.connect(ayarlar);
        const sonuc = await havuz.request()
            .input('loginIdentifier', sql.NVarChar, email)
            .query('SELECT * FROM Doktorlar WHERE mail = @loginIdentifier OR tc = @loginIdentifier');

        const doktor = sonuc.recordset[0];

        // 1. Doktor bulundu mu?
        if (!doktor) {
            return res.status(401).json({ mesaj: 'Hatalı e-posta/TC veya parola.' });
        }

        // 2. Parola doğru mu? (Düz metin karşılaştırması)
        // GÜVENLİK UYARISI: Hastalar tablosunda kullandığınız gibi bcrypt ile hash'leme yapmanız şiddetle tavsiye edilir.
        if (parola !== doktor.parola) {
            return res.status(401).json({ mesaj: 'Hatalı e-posta/TC veya parola.' });
        }

        // Giriş başarılı
        res.status(200).json({
            mesaj: `Giriş başarılı! Hoş geldiniz, Dr. ${doktor.isim} ${doktor.soyisim}.`,
            doktor: {
                id: doktor.doktor_id,
                isim: doktor.isim,
                soyisim: doktor.soyisim,
                email: doktor.mail
            }
        });

    } catch (hata) {
        console.error('Doktor giriş hatası:', hata);
        res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
    }
});
// =================================================================
// --- DOKTOR PANELİ VERİLERİNİ GETİRME ---
// =================================================================
// =================================================================
// --- DOKTOR PANELİ VERİLERİNİ GETİRME (GÜNCELLENDİ) ---
// =================================================================
// =================================================================
// --- DOKTOR PANELİ VERİLERİNİ GETİRME (GÜNCELLENDİ) ---
// =================================================================
// =================================================================
// --- DOKTOR PANELİ VERİLERİNİ GETİRME (GÜNCELLENDİ) ---
// =================================================================
app.get('/doktor-paneli/veri/:doktorId', async (req, res) => {
    try {
        const { doktorId } = req.params;
        const havuz = await sql.connect(ayarlar);
        
        // 1. ANA SORGULAMA: Doktor, Randevu, Hasta ve Özgeçmiş bilgilerini tek seferde çek
        // Not: Birden fazla özgeçmiş kaydı olan hastalar için randevular tekrarlanacaktır.
        const anaVeriSonuc = await havuz.request()
            .input('doktorId', sql.Int, doktorId)
            .query(`
                SELECT 
                    d.isim AS doktorIsim, d.soyisim AS doktorSoyisim, d.brans_id,
                    h.hastane_adi,
                    r.randevu_id, r.randevu_tarihi, r.randevu_durumu, r.notlar AS randevuNotu,
                    
                    p.hasta_id, p.Ad AS hastaIsim, p.Soyad AS hastaSoyisim,
                    p.DogumTarihi AS hastaDogumTarihi, p.Telefon AS hastaTelefon, p.Email AS hastaEmail,
                    
                    -- ho.* (Hasta Özgeçmişi: Eğer birden fazla kayıt varsa, randevu tekrarlanır)
                    ho.ozgecmis_id, ho.teshis_edilen_hastalik, ho.onceki_hastane, ho.onceki_doktor,
                    ho.kullanilan_ilac, ho.ilac_kullanim_suresi, ho.mevcut_ilaclar 
                FROM Doktorlar d
                JOIN Hastaneler h ON d.hastane_id = h.hastane_id
                LEFT JOIN Randevular r ON d.doktor_id = r.doktor_id
                LEFT JOIN Hastalar p ON r.hasta_id = p.hasta_id
                LEFT JOIN HastaOzgecmisi ho ON p.hasta_id = ho.hasta_id
                WHERE d.doktor_id = @doktorId
                ORDER BY r.randevu_tarihi ASC, ho.ozgecmis_id ASC
            `);

        if (anaVeriSonuc.recordset.length === 0) {
            // Doktor bulunamadıysa 404 dön
            return res.status(404).json({ mesaj: 'Doktor bulunamadı.' });
        }

        const ilkKayit = anaVeriSonuc.recordset[0];
        const doktorunBransId = ilkKayit.brans_id;

        // Doktor bilgileri (Tekrar eden kayıtlar olsa bile bu kısımlar aynı kalır)
        const panelVerisi = {
            doktorAdi: `${ilkKayit.doktorIsim} ${ilkKayit.doktorSoyisim}`,
            hastaneAdi: ilkKayit.hastane_adi,
            randevular: [],
            bolumSefi: null,
            sefOlduguBolum: null
        };
        
        // Randevuları ve özgeçmişleri gruplamak için Map kullanma
        const randevuMap = new Map();

        anaVeriSonuc.recordset.forEach(kayit => {
            if (!kayit.randevu_id) return; // Randevusu olmayan doktor için atla

            const randevuId = kayit.randevu_id;

            // Randevuyu Map'e ekle veya mevcut randevuyu al
            if (!randevuMap.has(randevuId)) {
    randevuMap.set(randevuId, {
        id: randevuId,
        hasta_id: kayit.hasta_id, // Bu kısım zaten doğru yerde
        hasta: `${kayit.hastaIsim} ${kayit.hastaSoyisim}`,
        tarih: kayit.randevu_tarihi,
        durum: kayit.randevu_durumu,
        not: kayit.randevuNotu,
        // DÜZELTME BURADA YAPILACAK
        hastaDetay: {
            // hasta_id'yi buraya eklemelisiniz.
            hasta_id: kayit.hasta_id, // <<< Bu satırı ekleyin!
            dogumTarihi: kayit.hastaDogumTarihi,
            telefon: kayit.hastaTelefon,
            email: kayit.hastaEmail
        },
        ozgecmisler: []
    });
}

            // Özgeçmiş kaydı varsa, ilgili randevunun özgeçmişler dizisine ekle
            if (kayit.ozgecmis_id) {
                const mevcutRandevu = randevuMap.get(randevuId);
                
                // Mükerrer özgeçmiş kaydını önlemek için basit bir kontrol
                const isOzgecmisExist = mevcutRandevu.ozgecmisler.some(
                    oz => oz.ozgecmis_id === kayit.ozgecmis_id
                );
                
                if (!isOzgecmisExist) {
                    mevcutRandevu.ozgecmisler.push({
                        ozgecmis_id: kayit.ozgecmis_id,
                        teshis_edilen_hastalik: kayit.teshis_edilen_hastalik,
                        onceki_hastane: kayit.onceki_hastane,
                        onceki_doktor: kayit.onceki_doktor,
                        kullanilan_ilac: kayit.kullanilan_ilac,
                        ilac_kullanim_suresi: kayit.ilac_kullanim_suresi,
                        mevcut_ilaclar: kayit.mevcut_ilaclar
                    });
                }
            }
        });

        // Map'ten son randevu dizisini oluştur
        panelVerisi.randevular = Array.from(randevuMap.values());
        
        // 3. SEFLİK KONTROLLERİ (Aynı kalır)
        const sefSonuc = await havuz.request()
            .input("bransId", sql.Int, doktorunBransId)
            .query("SELECT d.isim AS sefIsim, d.soyisim AS sefSoyisim, d.mail AS sefMail, d.telefon AS sefTelefon FROM BolumSefiDoktorlar bs JOIN Doktorlar d ON bs.doktor_id = d.doktor_id WHERE bs.brans_id = @bransId");
            
        const seflikKontrolSonuc = await havuz.request()
            .input("doktorId", sql.Int, doktorId)
            .query("SELECT b.brans_adi FROM BolumSefiDoktorlar bs JOIN Branslar b ON bs.brans_id = b.brans_id WHERE bs.doktor_id = @doktorId");
            
        panelVerisi.bolumSefi = sefSonuc.recordset.length > 0 ? sefSonuc.recordset[0] : null;
        panelVerisi.sefOlduguBolum = seflikKontrolSonuc.recordset.length > 0 ? seflikKontrolSonuc.recordset[0].brans_adi : null;

        // 4. BÖLÜM ŞEFİ İSE EK VERİLERİ ÇEK
        if (panelVerisi.sefOlduguBolum) {
            
            // Bölüm Doktorlarını Çek
            const bolumDoktorlariSonuc = await havuz.request()
                .input('bransId', sql.Int, doktorunBransId)
                .input('doktorId', sql.Int, doktorId) 
                .query('SELECT isim, soyisim, mail, telefon FROM Doktorlar WHERE brans_id = @bransId AND doktor_id != @doktorId');
            
            panelVerisi.bolumDoktorlari = bolumDoktorlariSonuc.recordset;

            // Bölüm Hastalarını Çek
            const bolumHastalariSonuc = await havuz.request()
                .input('bransId', sql.Int, doktorunBransId)
                .query(`
                    SELECT DISTINCT p.Ad, p.Soyad, p.TcKimlikNo, p.Email, p.Telefon
                    FROM Hastalar p
                    JOIN Randevular r ON p.hasta_id = r.hasta_id
                    JOIN Doktorlar d ON r.doktor_id = d.doktor_id
                    WHERE d.brans_id = @bransId
                `);
            panelVerisi.bolumHastalari = bolumHastalariSonuc.recordset;
        }

        res.status(200).json(panelVerisi);
        
    } catch (hata) {
        console.error('Doktor paneli verisi getirme hatası:', hata);
        res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu.' });
    }
});
// =================================================================
// --- AKILLI RANDEVU OLUŞTURMA (GÜNCELLENMİŞ) ---
// =================================================================
// GÜNCELLENMİŞ ENDPOINT: Randevu Oluşturma
// app.js DOSYANIZDAKİ /randevu-olustur FONKSİYONUNU BUNUNLA DEĞİŞTİRİN

app.post('/randevu-olustur', async (req, res) => {
    try {
        const { 
            hasta_id, // Bu, tarayıcıdan 'id' olarak gelir
            doktorId,
            randevuTarihi,
            notlar,
            tibbiGecmis
        } = req.body;

        if (!hasta_id || !doktorId || !randevuTarihi) {
            return res.status(400).json({ mesaj: 'Hasta ID, Doktor ID ve Randevu Tarihi zorunludur.' });
        }

        const havuz = await sql.connect(ayarlar);
        const islem = new sql.Transaction(havuz);
        await islem.begin();

        try {
            // --- 1. Doktor Bilgisini Çek ---
            const doktorBilgi = await new sql.Request(islem)
                .input('doktorId', sql.Int, doktorId)
                .query('SELECT d.isim, d.soyisim, h.hastane_adi FROM dbo.Doktorlar d JOIN dbo.Hastaneler h ON d.hastane_id = h.hastane_id WHERE d.doktor_id = @doktorId');
            
            if(doktorBilgi.recordset.length === 0) {
                await islem.rollback(); 
                return res.status(404).json({ mesaj: 'Seçilen doktor bulunamadı.' });
            }
            const atananDoktor = doktorBilgi.recordset[0];

            // --- 2. Hasta Bilgisini Çek (YENİ EKLENEN KISIM) ---
            const hastaBilgi = await new sql.Request(islem)
                .input('hasta_id', sql.Int, hasta_id)
                .query('SELECT Ad, Email FROM dbo.Hastalar WHERE hasta_id = @hasta_id');

            if(hastaBilgi.recordset.length === 0) {
                await islem.rollback(); 
                return res.status(404).json({ mesaj: 'Hasta bulunamadı.' });
            }
            const hasta = hastaBilgi.recordset[0];
            // ---------------------------------------------------

            // --- 3. Randevuyu Kaydetme ---
            await new sql.Request(islem)
                .input('hasta_id', sql.Int, hasta_id) 
                .input('doktorId', sql.Int, doktorId)
                .input('randevuTarihi', sql.DateTime, new Date(randevuTarihi)) 
                .input('notlar', sql.NVarChar, notlar || null) 
                .input('randevuDurumu', sql.NVarChar, 'Onay Bekliyor')
                .query(`
                    INSERT INTO dbo.Randevular (hasta_id, doktor_id, randevu_tarihi, notlar, randevu_durumu) 
                    VALUES (@hasta_id, @doktorId, @randevuTarihi, @notlar, @randevuDurumu)
                `); 
            
            // --- 4. Hasta Özgeçmişini Kaydetme (Dinamik) ---
            if (tibbiGecmis && tibbiGecmis.length > 0) {
                
                await new sql.Request(islem)
                    .input('hasta_id', sql.Int, hasta_id) 
                    .query('DELETE FROM dbo.HastaOzgecmisi WHERE hasta_id = @hasta_id'); 

                for (const gecmis of tibbiGecmis) {
                    if (gecmis.teshis_edilen_hastalik) {
                         await new sql.Request(islem)
                            .input('hasta_id', sql.Int, hasta_id) 
                            .input('teshis_edilen_hastalik', sql.NVarChar, gecmis.teshis_edilen_hastalik)
                            .input('onceki_hastane', sql.NVarChar, gecmis.onceki_hastane)
                            .input('onceki_doktor', sql.NVarChar, gecmis.onceki_doktor)
                            .input('kullanilan_ilac', sql.NVarChar, gecmis.kullanilan_ilac)
                            .input('ilac_kullanim_suresi', sql.NVarChar, gecmis.ilac_kullanim_suresi)
                            .query(`
                                INSERT INTO dbo.HastaOzgecmisi 
                                (hasta_id, teshis_edilen_hastalik, onceki_hastane, onceki_doktor, kullanilan_ilac, ilac_kullanim_suresi) 
                                VALUES (@hasta_id, @teshis_edilen_hastalik, @onceki_hastane, @onceki_doktor, @kullanilan_ilac, @ilac_kullanim_suresi)
                            `); 
                    }
                }
            }

            // İşlemi onayla
            await islem.commit();
            
            // === YENİ KISIM: E-posta Gönderimi (COMMIT sonrası) ===
            // Not: Bu fonksiyonun (randevuBildirimiGonder) sunucu kodunuzun 
            // üst kısımlarında tanımlı olduğunu varsayıyorum.
            randevuBildirimiGonder(
                hasta.Email, 
                hasta.Ad, 
                `${atananDoktor.isim} ${atananDoktor.soyisim}`, 
                atananDoktor.hastane_adi, 
                randevuTarihi
            ).catch(err => console.error("E-posta gönderme hatası:", err));
            // ======================================================
            
            res.status(201).json({
                mesaj: 'Randevunuz başarıyla oluşturuldu!',
                randevu: { 
                    doktor: `Dr. ${atananDoktor.isim} ${atananDoktor.soyisim}`, 
                    hastane: atananDoktor.hastane_adi, 
                    tarih: new Date(randevuTarihi).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })
                }
            });

        } catch (hata) {
            await islem.rollback(); 
            console.error('Randevu işlemi hatası:', hata);
            res.status(500).json({ mesaj: 'Randevu kaydedilirken bir veritabanı hatası oluştu.' });
        }

    } catch (hata) {
        console.error('Randevu oluşturma hatası:', hata);
        res.status(500).json({ mesaj: 'Randevu oluşturulurken sunucuda bir hata oluştu.' });
    }
});

// YENİ ENDPOINT: Şehir ve Branşa Göre Doktor/Zaman Getir
// (DÜZELTİLMİŞ VERSİYON - Branslar tablosu kaldırıldı)

// YENİ ENDPOINT: Şehir ve Branşa Göre Doktor/Zaman Getir
// (DÜZELTİLMİŞ VERSİYON - dbo. önekleri eklendi)

// YENİ ENDPOINT: Şehir ve Branşa Göre Doktor/Zaman Getir
// (HATA AYIKLAMA SÜRÜMÜ)

app.get('/uygun-doktorlari-bul', async (req, res) => {
    
    // --- 1. Gelen veriyi kontrol et ---
    console.log("---------------------------------");
    console.log("Yeni doktor arama isteği geldi.");
    console.log("Gelen sorgu parametreleri (req.query):", req.query);

    const { sehir, bransId } = req.query;

    if (!sehir || !bransId) {
        console.error("Hata: Şehir veya branşId eksik!");
        return res.status(400).json({ mesaj: "Şehir ve branş ID gereklidir." });
    }

    let havuz; // Veritabanı havuzunu 'try' dışında tanımla
    try {
        // --- 2. Veritabanı bağlantısını test et ---
        console.log("Veritabanına bağlanmaya çalışılıyor...");
        havuz = await sql.connect(ayarlar);
        console.log("Veritabanı bağlantısı BAŞARILI.");

        // --- 3. SQL Sorgusunu çalıştır ---
        const sorgu = `
            SELECT d.doktor_id, d.isim, d.soyisim, h.hastane_adi 
            FROM dbo.Doktorlar d
            JOIN dbo.Hastaneler h ON d.hastane_id = h.hastane_id
            WHERE h.sehir = @sehir AND d.brans_id = @bransId
        `;
        console.log("Çalıştırılacak SQL sorgusu:", sorgu);

        const doktorSonuc = await havuz.request()
            .input('sehir', sql.NVarChar, sehir)
            .input('bransId', sql.Int, bransId)
            .query(sorgu);
        
        console.log("Sorgu başarıyla çalıştı. Bulunan doktor sayısı:", doktorSonuc.recordset.length);

        if (doktorSonuc.recordset.length === 0) {
            console.log("Sonuç: Uygun doktor bulunamadı.");
            return res.json([]); // Hata değil, sadece boş sonuç
        }

        // --- 4. Saatleri Simüle Et (Bu kısım aynı) ---
        const doktorlarVeSaatler = doktorSonuc.recordset.map(doktor => {
            const today = new Date();
            const yarin = new Date(today); yarin.setDate(today.getDate() + 1);
            const oburgun = new Date(today); oburgun.setDate(today.getDate() + 2);

            const formatTarih = (date, saat) => {
                const [saatStr, dakikaStr] = saat.split(':');
                const newDate = new Date(date); 
                newDate.setHours(parseInt(saatStr), parseInt(dakikaStr), 0, 0);
                return newDate.toISOString();
            };

            return {
                ...doktor,
                tarih_bilgisi: [
                    { 
                        gun: yarin.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' }),
                        saatler: [
                            { tarihISO: formatTarih(yarin, '09:00'), saat: '09:00' },
                            { tarihISO: formatTarih(yarin, '11:30'), saat: '11:30' },
                            { tarihISO: formatTarih(yarin, '14:00'), saat: '14:00' }
                        ]
                    },
                    { 
                        gun: oburgun.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' }),
                        saatler: [
                            { tarihISO: formatTarih(oburgun, '10:00'), saat: '10:00' },
                            { tarihISO: formatTarih(oburgun, '13:30'), saat: '13:30' }
                        ]
                    }
                ]
            };
        });
        
        console.log("Doktor saatleri oluşturuldu. Yanıt gönderiliyor.");
        console.log("---------------------------------");
        res.json(doktorlarVeSaatler);

    } catch (hata) {
        // --- 5. HATA YAKALAMA ---
        console.error("!!! SUNUCU HATASI OLUŞTU !!!");
        console.error("Uygun doktorları bulma hatasının DETAYI:", hata); // <-- GERÇEK HATA BURADA
        console.error("---------------------------------");
        
        // Bağlantı açıldıysa kapatmayı dene
        if (havuz) {
            await havuz.close();
            console.log("Hata nedeniyle veritabanı bağlantısı kapatıldı.");
        }
        
        res.status(500).json({ mesaj: 'Doktorlar getirilirken bir hata oluştu.' });
    }
});

// =================================================================
// --- DOKTOR BRANŞINA GÖRE HASTALIKLARI GETİRME ---
// =================================================================
app.get('/doktor/hastaliklar/:doktorId', async (req, res) => {
    const doktorId = req.params.doktorId;
    
    try {
        const havuz = await sql.connect(ayarlar);
        
        // 1. Doktorun branş ID'sini al
        const bransSonuc = await havuz.request()
            .input('doktorId', sql.Int, doktorId)
            .query('SELECT brans_id FROM Doktorlar WHERE doktor_id = @doktorId');

        if (bransSonuc.recordset.length === 0) {
            return res.status(404).json({ mesaj: 'Doktor bulunamadı.' });
        }
        
        const bransId = bransSonuc.recordset[0].brans_id;
        
        // 2. Branşa ait hastalıkları getir (BransHastaliklari tablosu varsayımıyla)
        // Eğer BransHastaliklari tablonuz yoksa, bu sorguyu manuel hastalık listesi döndürecek şekilde düzenleyin.
        
        /* ÖRNEK: Gerçek bir BransHastaliklari tablosu varsa kullanın:
        const hastaliklarSonuc = await havuz.request()
            .input('bransId', sql.Int, bransId)
            .query(`
                SELECT h.hastalik_adi 
                FROM BransHastaliklari bh
                JOIN Hastaliklar h ON bh.hastalik_id = h.hastalik_id
                WHERE bh.brans_id = @bransId
            `);
        const hastaliklar = hastaliklarSonuc.recordset.map(r => r.hastalik_adi);
        */

        // Basit/Simülasyon için: Branş ID'sine göre örnek hastalıklar döndürelim
        let ornekHastaliklar = [];
        if (bransId === 1) { // 1 = Kardiyoloji olduğunu varsayalım
             ornekHastaliklar = ['Koroner Arter Hastalığı', 'Aritmi', 'Hipertansiyon', 'Kalp Yetmezliği', 'Kardiyomiyopati'];
        } else if (bransId === 2) { // 2 = Nöroloji olduğunu varsayalım
             ornekHastaliklar = ['Migren', 'Epilepsi', 'Alzheimer', 'Parkinson Hastalığı', 'Felç (İnme)'];
        } else {
             ornekHastaliklar = ['Genel Soğuk Algınlığı', 'Basit Enfeksiyon', 'Yüksek Ateş', 'Halsizlik'];
        }

        res.status(200).json(ornekHastaliklar);

    } catch (hata) {
        console.error('Hastalık listesi getirme hatası:', hata);
        res.status(500).json({ mesaj: 'Hastalıklar getirilirken bir sunucu hatası oluştu.' });
    }
});

// =================================================================
// --- YENİ TEŞHİS, İLAÇ VE TEST KAYDI ---
// =================================================================
app.post('/teshis-kaydet', async (req, res) => {
    const { 
        randevuId, 
        hastaId, 
        doktorId, 
        teshisMetni, 
        ekNotlar, 
        ilaclar, // Array of { ilac_adi, kullanim_sekli, kullanim_suresi, dozaj }
        testler  // Array of { test_adi, sonuc_metni, sonuc_degeri, referans_araligi }
    } = req.body;

    if (!randevuId || !hastaId || !doktorId || !teshisMetni) {
        return res.status(400).json({ mesaj: 'Randevu, Hasta, Doktor ID ve Teşhis Metni zorunludur.' });
    }

    const havuz = await sql.connect(ayarlar);
    const islem = new sql.Transaction(havuz);
    await islem.begin();

    try {
        let teshisId;

        // 1. Randevu Durumunu Onaylandı/Tamamlandı Yap
        await new sql.Request(islem)
            .input('randevuId', sql.Int, randevuId)
            .query("UPDATE Randevular SET randevu_durumu = 'Tamamlandı' WHERE randevu_id = @randevuId");
        
        // 2. YeniTeshisler Kaydını Oluştur ve teshis_id'yi al
        const teshisSonuc = await new sql.Request(islem)
            .input('randevuId', sql.Int, randevuId)
            .input('doktorId', sql.Int, doktorId)
            .input('hastaId', sql.Int, hastaId)
            .input('teshisMetni', sql.NVarChar, teshisMetni)
            .input('ekNotlar', sql.NVarChar, ekNotlar || null)
            .query(`
                INSERT INTO YeniTeshisler (randevu_id, doktor_id, hasta_id, teshis_metni, ek_notlar) 
                OUTPUT INSERTED.teshis_id 
                VALUES (@randevuId, @doktorId, @hastaId, @teshisMetni, @ekNotlar)
            `);
        
        teshisId = teshisSonuc.recordset[0].teshis_id;

        // 3. İlaç Reçetelerini Kaydet (IlacReçeteleri)
        if (ilaclar && ilaclar.length > 0) {
            for (const ilac of ilaclar) {
                await new sql.Request(islem)
                    .input('teshisId', sql.Int, teshisId)
                    .input('ilacAdi', sql.NVarChar, ilac.ilac_adi)
                    .input('kullanimSekli', sql.NVarChar, ilac.kullanim_sekli)
                    .input('kullanimSuresi', sql.NVarChar, ilac.kullanim_suresi || null)
                    .input('ilacDozaj', sql.NVarChar, ilac.dozaj || null)
                    .query(`
                        INSERT INTO IlacReçeteleri (teshis_id, ilac_adi, kullanim_sekli, kullanim_suresi, ilac_dozaj) 
                        VALUES (@teshisId, @ilacAdi, @kullanimSekli, @kullanimSuresi, @ilacDozaj)
                    `);
            }
        }

        // 4. Yapılan Testleri Kaydet (YapilanTestler)
        if (testler && testler.length > 0) {
            for (const test of testler) {
                await new sql.Request(islem)
                    .input('teshisId', sql.Int, teshisId)
                    .input('testAdi', sql.NVarChar, test.test_adi)
                    .input('sonucMetni', sql.NVarChar, test.sonuc_metni || null)
                    .input('sonucDegeri', sql.NVarChar, test.sonuc_degeri || null)
                    .input('referansAraligi', sql.NVarChar, test.referans_araligi || null)
                    .query(`
                        INSERT INTO YapilanTestler (teshis_id, test_adi, sonuc_metni, sonuc_degeri, referans_araligi) 
                        VALUES (@teshisId, @testAdi, @sonucMetni, @sonucDegeri, @referansAraligi)
                    `);
            }
        }

        await islem.commit();
        res.status(201).json({ mesaj: 'Teşhis ve tedavi bilgileri başarıyla kaydedildi!', teshisId });

    } catch (hata) {
        await islem.rollback(); 
        console.error('Teşhis kaydetme işlemi hatası:', hata);
        // Randevu zaten işlenmiş mi kontrolü (randevu_id UNIQUE hatası 2627)
        if (hata.originalError && hata.originalError.info.number === 2627) {
             return res.status(409).json({ mesaj: 'Bu randevu için teşhis zaten girilmiş.' });
        }
        res.status(500).json({ mesaj: 'Teşhis kaydedilirken bir veritabanı hatası oluştu.' });
    }
});
// server.js dosyasına diğer endpoint'lerin (örn: /teshis-kaydet) altına ekleyin

// =================================================================
// --- YENİ ENDPOINT: RÖNTGEN ANALİZİ VE PYTHON TETİKLEME ---
// =================================================================
// server.js dosyasında bu endpoint'i bulun ve aşağıdaki kodla DEĞİŞTİRİN.

app.post('/analiz_rontgen', upload.single('rontgenDosyasi'), async (req, res) => {
    
    // 1. Dosya Kontrolü
    if (!req.file) {
        return res.status(400).json({ mesaj: "Lütfen analiz için bir röntgen dosyası (JPEG, PNG) yükleyin." });
    }

    const imagePath = req.file.path; // Yüklenen dosyanın geçici yolu
    const pythonScript = 'rontgen_tespit.py';
    
    // 2. Python Script'ini Başlatma
    // Python yolunu doğru bulmak için 'python' veya 'python.exe' kullanabilirsiniz
    const pythonProcess = spawn('python', [pythonScript, imagePath]);
    let dataFromPython = '';
    let errorFromPython = '';
    
    // Python stdout çıktısını yakalama (Başarılı JSON burada olacak)
    pythonProcess.stdout.on('data', (data) => {
        dataFromPython += data.toString();
    });

    // Python stderr hata çıktısını yakalama (Hatalar ve TensorFlow logları burada)
    pythonProcess.stderr.on('data', (data) => {
        // TensorFlow uyarılarını sessize al (Çok fazla gürültü yapabilir)
        if (!data.toString().includes('tensorflow')) { 
             // Yalnızca kritik hataları logla
             console.error(`[PYTHON HATA]: ${data.toString().trim()}`);
        }
        errorFromPython += data.toString();
    });

    // 3. İşlem Tamamlandığında
    pythonProcess.on('close', (code) => {
        // Geçici dosyayı sil (İşlem bitince disk temizliği)
        fs.unlink(imagePath, (err) => {
            if (err) console.error("Geçici dosya silinirken hata:", err);
        });
        
        // Eğer Python hatayla kapandıysa
        if (code !== 0) {
            console.error(`Python script'i hata kodu ${code} ile kapandı. Hata detayları: ${errorFromPython}`);
            return res.status(500).json({ 
                mesaj: "Analiz sırasında sunucuda bir hata oluştu.", 
                detay: "Python betiği çalıştırılamadı veya model hatası verdi."
            });
        }
        
        // --- GÜVENİLİR JSON PARSE İŞLEMİ (Loglardan temizleme) ---
        let resultJsonString = dataFromPython.trim();
        const jsonStartIndex = resultJsonString.lastIndexOf('{'); // JSON objesinin başlangıcını bul

        if (jsonStartIndex > -1) {
             // Sadece son JSON objesiyle başla (önündeki tüm gereksiz logları at)
             resultJsonString = resultJsonString.substring(jsonStartIndex);
        } else {
             console.error("Python çıktısında geçerli bir JSON objesi bulunamadı. Tam çıktı:", dataFromPython);
             return res.status(500).json({ 
                 mesaj: "Analiz sonucu işlenemedi.", 
                 detay: "Python çıktısı boş veya beklenmedik formatta." 
             });
        }

        try {
            const result = JSON.parse(resultJsonString);
            console.log("JSON Çıktısı Başarılı:", result.sinif);
            
            // Düzeltildi: Tek bir JSON yanıtı gönderiliyor
            return res.json({ mesaj: "Röntgen analizi başarıyla tamamlandı.", sonuc: result });
        } catch (e) {
            console.error("Python çıktısı JSON'a dönüştürülemedi. Hata:", e.message);
            return res.status(500).json({ mesaj: "Analiz sonucu işlenemedi.", detay: "Python çıktısı JSON formatında değil." });
        }
    });

    // Python süreci başlatılamazsa (Örn: Python PATH'te yoksa)
    pythonProcess.on('error', (err) => {
        console.error('Python süreci başlatılamadı:', err);
        return res.status(500).json({ mesaj: "Sunucu hatası: Python yüklü mü veya PATH ayarı doğru mu?" });
    });
});

// server.js içine eklenecek kısım
app.post('/yonetici/resepsiyon-ekle', async (req, res) => {
    try {
        const { isim, soyisim, email, hastane_id } = req.body;
        const havuz = await sql.connect(ayarlar);
        
        const geciciSifre = crypto.randomBytes(4).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const sifreHash = await bcrypt.hash(geciciSifre, salt);

        await havuz.request()
            .input('isim', sql.NVarChar, isim)
            .input('soyisim', sql.NVarChar, soyisim)
            .input('email', sql.NVarChar, email)
            .input('parola', sql.NVarChar, sifreHash)
            .input('hastane_id', sql.Int, hastane_id)
            .query(`INSERT INTO Resepsiyonistler (isim, soyisim, mail, parola, hastane_id, ilk_giris_mi)
                    VALUES (@isim, @soyisim, @email, @parola, @hastane_id, 1)`);

        // --- KRİTİK DEĞİŞİKLİK BURADA ---
        try {
            // Mail göndermeyi dene ama await'in ağ engeline takılmasına izin verme
            resepsiyonBilgiGonder(email, isim, soyisim, geciciSifre); 
            console.log(`Geçici Şifre (${email}): ${geciciSifre}`); 
        } catch (e) {
            console.log("Ağ kısıtlı olduğu için mail gönderilemedi ama kayıt yapıldı.");
        }

        res.status(201).json({ 
            mesaj: 'Kayıt başarılı! (Not: Ağ kısıtlaması nedeniyle mail gitmemiş olabilir.)',
            geciciSifre: geciciSifre // Test için şifreyi ekrana da dönebilirsin
        });

    } catch (hata) {
        if (hata.number === 2627) return res.status(400).json({ mesaj: 'Bu e-posta zaten kayıtlı!' });
        res.status(500).json({ mesaj: 'Sunucu hatası!' });
    }
});

// --- RESEPSİYONİST GİRİŞ ---
app.post('/reception/giris', async (req, res) => {
    try {
        const { email, parola } = req.body;
        const havuz = await sql.connect(ayarlar);
        
        const sonuc = await havuz.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Resepsiyonistler WHERE mail = @email');

        const reception = sonuc.recordset[0];

        if (!reception) {
            return res.status(401).json({ mesaj: 'Hatalı e-posta veya şifre.' });
        }

        // Parola kontrolü (bcrypt)
        const sifreDogruMu = await bcrypt.compare(parola, reception.parola);
        if (!sifreDogruMu) {
            return res.status(401).json({ mesaj: 'Hatalı e-posta veya şifre.' });
        }

        res.status(200).json({
            mesaj: 'Giriş başarılı!',
            ilkGiris: reception.ilk_giris_mi, // 1 ise profil tamamlama istenecek
            reception: { id: reception.resepsiyon_id, ad: reception.isim }
        });
    } catch (err) {
        res.status(500).json({ mesaj: 'Sunucu hatası.' });
    }
});

// --- RESEPSİYONİST PROFİL TAMAMLA ---
app.post('/reception/profil-tamamla', async (req, res) => {
    try {
        const { receptionId, tc, dogumTarihi, telefon, yeniSifre } = req.body;
        
        // Yeni şifreyi hashle
        const salt = await bcrypt.genSalt(10);
        const yeniSifreHash = await bcrypt.hash(yeniSifre, salt);

        const havuz = await sql.connect(ayarlar);
        await havuz.request()
            .input('id', sql.Int, receptionId)
            .input('tc', sql.NVarChar, tc)
            .input('dogum', sql.Date, dogumTarihi)
            .input('tel', sql.NVarChar, telefon)
            .input('parola', sql.NVarChar, yeniSifreHash)
            .query(`
                UPDATE Resepsiyonistler 
                SET tc = @tc, 
                    dogum_tarihi = @dogum, 
                    telefon = @tel, 
                    parola = @parola, 
                    ilk_giris_mi = 0 
                WHERE resepsiyon_id = @id
            `);

        res.status(200).json({ mesaj: 'Profil başarıyla güncellendi!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Veritabanı güncelleme hatası.' });
    }
});

// --- RESEPSİYON PANELİ VERİLERİNİ GETİRME ---
app.get('/reception-panel/veri/:receptionId', async (req, res) => {
    try {
        const { receptionId } = req.params;
        const havuz = await sql.connect(ayarlar);
        
        const sonuc = await havuz.request()
            .input('receptionId', sql.Int, receptionId)
            .query(`
                SELECT 
                    r.*, 
                    h.hastane_adi 
                FROM Resepsiyonistler r
                JOIN Hastaneler h ON r.hastane_id = h.hastane_id
                WHERE r.resepsiyon_id = @receptionId
            `);

        if (sonuc.recordset.length === 0) {
            return res.status(404).json({ mesaj: 'Resepsiyonist bulunamadı.' });
        }

        const data = sonuc.recordset[0];
        res.status(200).json({
            isim: data.isim,
            soyisim: data.soyisim,
            mail: data.mail,
            tc: data.tc,
            dogumTarihi: data.dogum_tarihi,
            telefon: data.telefon,
            hastaneAdi: data.hastane_adi,
            hastaneId: data.hastane_id,
            kayitTarihi: data.kayit_tarihi
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Sunucu hatası oluştu.' });
    }
});
// --- BELİRLİ BİR HASTANENİN TÜM RANDEVULARINI GETİR ---
app.get('/reception/hastane-randevulari/:hastaneId', async (req, res) => {
  try {
    const { hastaneId } = req.params;
    const havuz = await sql.connect(ayarlar);

    const sonuc = await havuz.request()
      .input('hastaneId', sql.Int, hastaneId)
      .query(`
        SELECT 
          r.randevu_id,
          r.randevu_tarihi,
          r.randevu_durumu,
          ISNULL(r.randevu_onay, 'Pasif') AS randevu_onay,
          p.Ad + ' ' + p.Soyad AS hastaAdSoyad,
          p.TcKimlikNo,
          d.isim + ' ' + d.soyisim AS doktorAdSoyad
        FROM dbo.Randevular r
        INNER JOIN dbo.Hastalar p ON r.hasta_id = p.hasta_id
        INNER JOIN dbo.Doktorlar d ON r.doktor_id = d.doktor_id
        WHERE d.hastane_id = @hastaneId
        ORDER BY r.randevu_tarihi ASC
      `);

    res.status(200).json(sonuc.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mesaj: 'Veri çekme hatası', detay: err.message });
  }
});


// --- RANDEVU ONAY GÜNCELLE (Aktif / Pasif vs.) ---
app.put('/reception/randevu-onay-guncelle', async (req, res) => {
  try {
    const { randevuId, yeniDurum } = req.body;
    if (!randevuId || !yeniDurum) {
      return res.status(400).json({ mesaj: 'randevuId ve yeniDurum zorunludur.' });
    }

    const havuz = await sql.connect(ayarlar);

    const result = await havuz.request()
      .input('id', sql.Int, randevuId)
      .input('onay', sql.NVarChar(50), yeniDurum)
      .query(`
        UPDATE dbo.Randevular
        SET randevu_onay = @onay
        WHERE randevu_id = @id
      `);

    if (result.rowsAffected?.[0] > 0) {
      return res.status(200).json({ mesaj: 'Başarıyla güncellendi.' });
    }
    return res.status(404).json({ mesaj: 'Randevu bulunamadı.' });

  } catch (hata) {
    console.error("SQL Hatası:", hata);
    res.status(500).json({ mesaj: 'Veritabanı hatası.', detay: hata.message });
  }
});


// (Opsiyonel ama önerilir) "Aktif Et" için özel endpoint: hem onay hem durumu tek seferde set et
app.put('/reception/randevu-aktif-et/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const havuz = await sql.connect(ayarlar);

    const result = await havuz.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE dbo.Randevular
        SET 
          randevu_onay = 'Aktif',
          randevu_durumu = ISNULL(randevu_durumu, 'Bekliyor')
        WHERE randevu_id = @id
      `);

    if (result.rowsAffected?.[0] > 0) {
      return res.status(200).json({ mesaj: 'Randevu aktif edildi.' });
    }
    return res.status(404).json({ mesaj: 'Randevu bulunamadı.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mesaj: 'Veritabanı hatası.', detay: err.message });
  }
});
app.get('/doktor/aktif-randevular/:doktorId', async (req, res) => {
  try {
    const { doktorId } = req.params;
    const havuz = await sql.connect(ayarlar);

    const sonuc = await havuz.request()
      .input('doktorId', sql.Int, doktorId)
      .query(`
        SELECT
          r.randevu_id,
          r.randevu_tarihi,
          r.randevu_durumu,
          ISNULL(r.randevu_onay, 'Pasif') AS randevu_onay,
          h.Ad + ' ' + h.Soyad AS hastaAdSoyad,
          h.TcKimlikNo
        FROM dbo.Randevular r
        INNER JOIN dbo.Hastalar h ON r.hasta_id = h.hasta_id
        WHERE r.doktor_id = @doktorId
          AND r.randevu_onay = 'Aktif'
          AND (
            r.randevu_durumu IS NULL
            OR (
              r.randevu_durumu NOT LIKE 'Cagr%' 
              AND r.randevu_durumu NOT LIKE 'Tamam%'
            )
          )
        ORDER BY r.randevu_tarihi ASC
      `);

    res.status(200).json(sonuc.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mesaj: 'Aktif randevular çekilemedi', detay: err.message });
  }
});

// ODAYA ÇAĞIR
app.put('/doktor/randevu-cagir/:randevuId', async (req, res) => {
  try {
    const { randevuId } = req.params;
    const havuz = await sql.connect(ayarlar);

    const result = await havuz.request()
      .input('randevuId', sql.Int, randevuId)
      .query(`
        UPDATE dbo.Randevular
        SET 
          randevu_durumu = 'Cagr?ld?',
          cagirma_zamani = GETDATE()
        WHERE randevu_id = @randevuId
      `);

    if (result.rowsAffected?.[0] > 0) {
      return res.status(200).json({ mesaj: 'Hasta odaya çağrıldı.' });
    }
    return res.status(404).json({ mesaj: 'Randevu bulunamadı.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mesaj: 'Çağırma işlemi başarısız', detay: err.message });
  }
});

// SON ÇAĞRILAN (monitor ekranı için)
app.get('/doktor/son-cagrilan/:doktorId', async (req, res) => {
  try {
    const { doktorId } = req.params;
    const havuz = await sql.connect(ayarlar);

    const sonuc = await havuz.request()
      .input('doktorId', sql.Int, doktorId)
      .query(`
        SELECT TOP 1
          r.randevu_id,
          h.Ad + ' ' + h.Soyad AS hastaAdSoyad,
          r.cagirma_zamani
        FROM dbo.Randevular r
        INNER JOIN dbo.Hastalar h ON r.hasta_id = h.hasta_id
        WHERE r.doktor_id = @doktorId
          AND r.randevu_onay = 'Aktif'
          AND r.randevu_durumu LIKE 'Cagr%'
        ORDER BY r.cagirma_zamani DESC
      `);

    res.status(200).json(sonuc.recordset[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mesaj: 'Son çağrılan hasta alınamadı', detay: err.message });
  }
});



// --- YÖNETİCİ: BELİRLİ BİR HASTANEYE AİT HASTALARI (SON RANDEVU İLE) GETİR ---
app.get('/yonetici/hastane-hastalar/:hastaneId', async (req, res) => {
  try {
    const { hastaneId } = req.params;

    if (!hastaneId || isNaN(Number(hastaneId))) {
      return res.status(400).json({ mesaj: 'Geçersiz hastaneId.' });
    }

    const havuz = await sql.connect(ayarlar);

    // Hastalar tablosunda hastane_id olmadığı için:
    // Hastane filtresi = Randevular -> Doktorlar.hastane_id üzerinden yapılır.
    // OUTER APPLY ile her hasta için o hastanedeki EN SON randevuyu çekiyoruz.
    const sonuc = await havuz.request()
      .input('hastaneId', sql.Int, Number(hastaneId))
      .query(`
        SELECT
          h.hasta_id,
          h.Ad,
          h.Soyad,
          h.Email,
          h.Telefon,
          h.TcKimlikNo,
          h.DogumTarihi,

          -- Son randevu bilgileri (bu hastanedeki)
          sr.randevu_id       AS son_randevu_id,
          sr.randevu_tarihi   AS son_randevu_tarihi,
          sr.randevu_durumu   AS son_randevu_durumu,
          ISNULL(sr.randevu_onay, 'Pasif') AS son_randevu_onay,
          sr.notlar           AS son_randevu_notlar,
          sr.sira_no          AS son_sira_no,
          sr.acil_mi          AS son_acil_mi,
          sr.geldi_mi         AS son_geldi_mi,
          sr.odeme_durumu     AS son_odeme_durumu,

          -- Son randevudaki doktor
          sr.doktor_id        AS son_doktor_id,
          sr.doktorAdSoyad    AS son_doktor_ad_soyad

        FROM dbo.Hastalar h

        OUTER APPLY (
          SELECT TOP 1
            r.randevu_id,
            r.randevu_tarihi,
            r.randevu_durumu,
            r.randevu_onay,
            r.notlar,
            r.sira_no,
            r.acil_mi,
            r.geldi_mi,
            r.odeme_durumu,
            r.doktor_id,
            (d.isim + ' ' + d.soyisim) AS doktorAdSoyad
          FROM dbo.Randevular r
          INNER JOIN dbo.Doktorlar d ON d.doktor_id = r.doktor_id
          WHERE r.hasta_id = h.hasta_id
            AND d.hastane_id = @hastaneId
          ORDER BY r.randevu_tarihi DESC
        ) sr

        -- Bu hastanenin hastası olsun diye: en az 1 randevusu olmalı
        WHERE sr.randevu_id IS NOT NULL

        ORDER BY h.Ad ASC, h.Soyad ASC;
      `);

    return res.status(200).json(sonuc.recordset);

  } catch (err) {
    console.error('Hata /yonetici/hastane-hastalar:', err);
    return res.status(500).json({ mesaj: 'Veri çekme hatası', detay: err.message });
  }
});

app.get("/api/fitness/profile/:hastaId", async (req, res) => {
  try {
    const hastaId = parseInt(req.params.hastaId, 10);
    const p = await getPool();

    const r = await p.request()
      .input("hasta_id", sql.Int, hastaId)
      .query(`SELECT * FROM dbo.FitnessProfil WHERE hasta_id=@hasta_id`);

    res.json(r.recordset[0] || null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Profil alınamadı." });
  }
});

// ------------------------------------------------------
// API: Profil upsert
// POST /api/fitness/profile
// body: {hasta_id, yas, boy_cm, kilo_kg, aktivite_seviyesi(1-3)}
// ------------------------------------------------------
// ======================================================
// ✅ FITNESS HEALTHCHECK
// ======================================================
app.get("/api/fitness/health", async (req, res) => {
  try {
    const p = await getPool();
    await p.request().query("SELECT 1 AS ok");
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ /api/fitness/health hata:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ======================================================
// ✅ PROFİL GETİR
// GET /api/fitness/profile/:hastaId
// ======================================================
app.get("/api/fitness/profile/:hastaId", async (req, res) => {
  try {
    const hastaId = Number(req.params.hastaId);
    if (!hastaId || isNaN(hastaId)) {
      return res.status(400).json({ error: "Geçersiz hastaId" });
    }

    const p = await getPool();
    const r = await p.request()
      .input("hasta_id", sql.Int, hastaId)
      .query(`SELECT TOP 1 * FROM dbo.FitnessProfil WHERE hasta_id=@hasta_id`);

    res.json(r.recordset[0] || null);
  } catch (e) {
    console.error("❌ GET profile hata:", e?.originalError?.info || e);
    res.status(500).json({ error: "Profil alınamadı.", detay: e.message });
  }
});

// ======================================================
// ✅ PROFİL UPSERT
// POST /api/fitness/profile
// ======================================================
app.post("/api/fitness/profile", async (req, res) => {
  try {
    const { hasta_id, yas, boy_cm, kilo_kg, aktivite_seviyesi } = req.body;

    if (!hasta_id || !yas || !boy_cm || !kilo_kg) {
      return res.status(400).json({ error: "Eksik alan var." });
    }

    const bmi = calcBMI(Number(kilo_kg), Number(boy_cm));
    const bmiDurum = bmiCategory(bmi);
    const bmr = calcBMR(Number(yas), Number(kilo_kg), Number(boy_cm));
    const tdee = Math.round(bmr * activityFactor(Number(aktivite_seviyesi || 2)));

    const p = await getPool();

    await p.request()
      .input("hasta_id", sql.Int, Number(hasta_id))
      .input("yas", sql.Int, Number(yas))
      .input("boy_cm", sql.Int, Number(boy_cm))
      .input("kilo_kg", sql.Decimal(6, 2), Number(kilo_kg))
      .input("bmi", sql.Decimal(6, 2), Number(bmi.toFixed(2)))
      .input("bmi_durum", sql.NVarChar(30), bmiDurum)
      .input("bmr", sql.Int, Number(bmr))
      .input("tdee", sql.Int, Number(tdee))
      .input("aktivite_seviyesi", sql.Int, Number(aktivite_seviyesi || 2))
      .query(`
        MERGE dbo.FitnessProfil AS T
        USING (SELECT @hasta_id AS hasta_id) AS S
        ON T.hasta_id = S.hasta_id
        WHEN MATCHED THEN
          UPDATE SET
            yas=@yas, boy_cm=@boy_cm, kilo_kg=@kilo_kg,
            bmi=@bmi, bmi_durum=@bmi_durum, bmr=@bmr, tdee=@tdee,
            aktivite_seviyesi=@aktivite_seviyesi,
            updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (hasta_id, yas, boy_cm, kilo_kg, bmi, bmi_durum, bmr, tdee, aktivite_seviyesi, created_at, updated_at)
          VALUES (@hasta_id, @yas, @boy_cm, @kilo_kg, @bmi, @bmi_durum, @bmr, @tdee, @aktivite_seviyesi, SYSDATETIME(), SYSDATETIME());
      `);

    res.json({
      ok: true,
      bmi: Number(bmi.toFixed(2)),
      bmi_durum: bmiDurum,
      bmr,
      tdee,
    });
  } catch (e) {
    console.error("❌ POST profile hata:", e?.originalError?.info || e);
    res.status(500).json({ error: "Profil kaydedilemedi.", detay: e.message });
  }
});

// ======================================================
// ✅ HEDEF KAYDET
// POST /api/fitness/goal
// ======================================================
app.post("/api/fitness/goal", async (req, res) => {
  try {
    const { hasta_id, hedef_tip, secilen_vucut_kart, hedef_aciklama } = req.body;

    if (!hasta_id || !hedef_tip || !secilen_vucut_kart) {
      return res.status(400).json({ error: "Eksik alan var." });
    }

    const p = await getPool();

    const pr = await p.request()
      .input("hasta_id", sql.Int, Number(hasta_id))
      .query(`SELECT TOP 1 * FROM dbo.FitnessProfil WHERE hasta_id=@hasta_id`);

    const prof = pr.recordset[0];
    if (!prof) return res.status(400).json({ error: "Önce profil doldurulmalı." });

    const prot = proteinTarget(Number(prof.kilo_kg), hedef_tip, prof.bmi_durum);
    const cal = calorieTarget(Number(prof.tdee), hedef_tip, prof.bmi_durum);
    const planObj = buildWorkoutPlan(hedef_tip, prof.bmi_durum);

    await p.request()
      .input("hasta_id", sql.Int, Number(hasta_id))
      .input("hedef_tip", sql.NVarChar(50), hedef_tip)
      .input("secilen_vucut_kart", sql.NVarChar(50), secilen_vucut_kart)
      .input("hedef_aciklama", sql.NVarChar(250), hedef_aciklama || null)
      .input("hedef_kalori", sql.Int, Number(cal))
      .input("hedef_protein_g", sql.Int, Number(prot))
      .input("haftalik_antrenman_gun", sql.Int, Number(planObj.days))
      .input("antrenman_plan", sql.NVarChar(sql.MAX), JSON.stringify(planObj))
      .query(`
        MERGE dbo.FitnessHedef AS T
        USING (SELECT @hasta_id AS hasta_id) AS S
        ON T.hasta_id = S.hasta_id
        WHEN MATCHED THEN
          UPDATE SET
            hedef_tip=@hedef_tip,
            secilen_vucut_kart=@secilen_vucut_kart,
            hedef_aciklama=@hedef_aciklama,
            hedef_kalori=@hedef_kalori,
            hedef_protein_g=@hedef_protein_g,
            haftalik_antrenman_gun=@haftalik_antrenman_gun,
            antrenman_plan=@antrenman_plan,
            updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (hasta_id, hedef_tip, secilen_vucut_kart, hedef_aciklama, hedef_kalori, hedef_protein_g, haftalik_antrenman_gun, antrenman_plan, created_at, updated_at)
          VALUES (@hasta_id, @hedef_tip, @secilen_vucut_kart, @hedef_aciklama, @hedef_kalori, @hedef_protein_g, @haftalik_antrenman_gun, @antrenman_plan, SYSDATETIME(), SYSDATETIME());
      `);

    res.json({ ok: true, hedef_kalori: cal, hedef_protein_g: prot, plan: planObj });
  } catch (e) {
    console.error("❌ POST goal hata:", e?.originalError?.info || e);
    res.status(500).json({ error: "Hedef kaydedilemedi.", detay: e.message });
  }
});

// ======================================================
// ✅ HEDEF GETİR
// GET /api/fitness/goal/:hastaId
// ======================================================
app.get("/api/fitness/goal/:hastaId", async (req, res) => {
  try {
    const hastaId = Number(req.params.hastaId);
    if (!hastaId || isNaN(hastaId)) return res.status(400).json({ error: "Geçersiz hastaId" });

    const p = await getPool();
    const r = await p.request()
      .input("hasta_id", sql.Int, hastaId)
      .query(`SELECT TOP 1 * FROM dbo.FitnessHedef WHERE hasta_id=@hasta_id`);

    res.json(r.recordset[0] || null);
  } catch (e) {
    console.error("❌ GET goal hata:", e?.originalError?.info || e);
    res.status(500).json({ error: "Hedef alınamadı.", detay: e.message });
  }
});

// ======================================================
// ✅ HAFTALIK KİLO KAYDET
// POST /api/fitness/checkin
// ======================================================
app.post("/api/fitness/checkin", async (req, res) => {
  try {
    const { hasta_id, hafta_baslangic, kilo_kg, notlar } = req.body;

    if (!hasta_id || !hafta_baslangic || !kilo_kg) {
      return res.status(400).json({ error: "Eksik alan var." });
    }

    const p = await getPool();
    await p.request()
      .input("hasta_id", sql.Int, Number(hasta_id))
      .input("hafta_baslangic", sql.Date, hafta_baslangic)
      .input("kilo_kg", sql.Decimal(6, 2), Number(kilo_kg))
      .input("notlar", sql.NVarChar(200), notlar || null)
      .query(`
        INSERT INTO dbo.FitnessHaftalik(hasta_id, hafta_baslangic, kilo_kg, notlar)
        VALUES (@hasta_id, @hafta_baslangic, @kilo_kg, @notlar)
      `);

    res.json({ ok: true });
  } catch (e) {
    console.error("❌ POST checkin hata:", e?.originalError?.info || e);
    res.status(500).json({ error: "Takip kaydedilemedi.", detay: e.message });
  }
});

// ======================================================
// ✅ HAFTALIK LİSTE
// GET /api/fitness/checkins/:hastaId
// ======================================================
app.get("/api/fitness/checkins/:hastaId", async (req, res) => {
  try {
    const hastaId = Number(req.params.hastaId);
    if (!hastaId || isNaN(hastaId)) return res.status(400).json({ error: "Geçersiz hastaId" });

    const p = await getPool();
    const r = await p.request()
      .input("hasta_id", sql.Int, hastaId)
      .query(`
        SELECT TOP 50 *
        FROM dbo.FitnessHaftalik
        WHERE hasta_id=@hasta_id
        ORDER BY hafta_baslangic DESC, created_at DESC
      `);

    res.json(r.recordset);
  } catch (e) {
    console.error("❌ GET checkins hata:", e?.originalError?.info || e);
    res.status(500).json({ error: "Takipler alınamadı.", detay: e.message });
  }
});


    // --- SUNUCU ---
    const PORT = 5000;
    app.listen(PORT, () => console.log(` Sunucu ${PORT} portunda çalışıyor...`));