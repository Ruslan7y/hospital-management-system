// veritabani_test.js
require('dotenv').config();
const sql = require('mssql');

const ayarlar = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'HastaneDB_Gecici',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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