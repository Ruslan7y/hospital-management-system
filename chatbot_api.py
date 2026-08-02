from flask import Flask, request, jsonify
from flask_cors import CORS  # CORS Desteği için
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

# --- 1. AYARLAR VE API KEY YÜKLEME ---
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")

# --- 2. SİSTEM TALİMATI (Eksiksiz Tanımlama) ---
SYSTEM_INSTRUCTION = """
Sen 'Sağlık Dostu' adında, uzman bir doktor gibi düşünen ancak her zaman "bu bir tıbbi tavsiye değildir" uyarısını yapan yardımsever bir asistansın.

GÖREV AKIŞIN ŞÖYLE OLACAK:
1. Kullanıcı bir şikayet belirttiğinde (örneğin "başım ağrıyor"), HEMEN teşhis koyma veya ilaç önerme.
2. Önce detayları öğrenmek için TIBBİ ANAMNEZ (Öykü Alma) yap. Şu parametreleri öğrenmek için tek tek veya gruplu sorular sor:
    - Ağrının şiddeti (1-10 arası)
    - Ağrının tam konumu (şakaklar, ense, göz arkası vb.)
    - Süresi (ne zamandır var?)
    - Eşlik eden belirtiler (ateş, mide bulantısı, ışığa hassasiyet vb.)
    - Tetikleyiciler (açlık, uykusuzluk, stres, az su içme)
    - İlaç kullanımı (daha önce bir şey aldı mı?)

3. Kullanıcıdan cevapları aldıktan sonra bu verileri analiz et. Olası sebepleri (Migren, Gerilim tipi, Sinüzit vb.) düşün.
4. ÇÖZÜM ÖNERİSİ SUN:
    - İlaçsız doğal yöntemler (su içmek, karanlık oda, masaj vb.)
    - Reçetesiz (OTC) basit ağrı kesiciler (Parol/Asetaminofen gibi) hakkında genel bilgi ver (yan etkileri azdır ama yine de dikkatli olunmalı diyerek).
    - Hangi durumlarda ACİLEN hastaneye gidilmesi gerektiğini belirt.

TONUN:
- Empatik, profesyonel, güven veren ve sakin.
- Kullanıcıyı korkutmadan ama ciddiyetle yönlendir.
"""

# Flask uygulamasını başlat
app = Flask(__name__)
# ÇÖZÜM: CORS kısıtlamasını aşmak için tüm kaynaklara izin ver
CORS(app) 

# --- 3. İSTEMCİ VE SOHBET OTURUMUNU BAŞLATMA ---
global_chat_session = None
client = None # Client'ı None olarak tanımla

if API_KEY:
    try:
        # Client'ı oluştururken API Key'i doğrudan veriyoruz.
        client = genai.Client(api_key=API_KEY) 
        
        # Sohbet oturumunu başlat
        global_chat_session = client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION
            )
        )
        print("✅ Sohbet oturumu başarıyla oluşturuldu.")
    except Exception as e:
        print(f"❌ Kritik Hata: Gemini servisi başlatılamadı. Hata: {e}")
        print("API Key'inizi kontrol edin ve kotanızın olup olmadığını kontrol edin.")
else:
    print("❌ HATA: GOOGLE_API_KEY bulunamadı. Lütfen .env dosyanızı kontrol edin.")

# --- 4. API UÇ NOKTASI ---
@app.route('/get_chatbot_response', methods=['POST'])
def get_chatbot_response():
    # Başlatma hatası kontrolü
    if global_chat_session is None:
        return jsonify({'response': 'Üzgünüm, chatbot servisi şu anda kullanılamıyor (Sunucu Başlatma Hatası).'}), 500

    if not request.json or 'message' not in request.json:
        return jsonify({'error': 'Geçersiz istek. Lütfen bir mesaj gönderin.'}), 400

    user_message = request.json.get('message')

    try:
        response = global_chat_session.send_message(user_message)
        bot_response = response.text
        return jsonify({'response': bot_response})

    except Exception as e:
        print(f"Gemini API çağrısında çalışma zamanı hatası: {e}")
        return jsonify({'response': 'Hata: Mesajınız işlenirken bir sorun oluştu. API bağlantınızı kontrol edin.'}), 500

# --- 5. FLASK SUNUCUSUNU BAŞLATMA ---
if __name__ == '__main__':
    print("🚀 Flask Sunucusu Başlatılıyor: http://127.0.0.1:5000/get_chatbot_response")
    # Sunucuyu başlatırken, eğer hata yoksa, çalıştığından emin oluruz.
    app.run(debug=True, port=5000)