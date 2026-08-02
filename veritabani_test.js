// veritabani_test.js
const sql = require('mssql');

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

async function veritabaniTest() {
    console.log('Veritabanına bağlanılıyor...');
    try {
        await sql.connect(ayarlar);
        console.log('BAŞARILI: Veritabanına bağlantı kuruldu!');

        const doktorlarSonuc = await sql.query`SELECT * FROM Doktorlar`;
        console.log('\n--- DOKTOR LİSTESİ ---');
        console.table(doktorlarSonuc.recordset);

        const hastalarSonuc = await sql.query`SELECT * FROM Hastalar`;
        console.log('\n--- HASTA LİSTESİ ---');
        console.table(hastalarSonuc.recordset);

    } catch (hata) {
        console.error('HATA: Veritabanına bağlanılamadı!', hata);
    } finally {
        await sql.close();
    }
}

veritabaniTest();