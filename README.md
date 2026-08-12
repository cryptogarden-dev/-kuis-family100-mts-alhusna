# 🎓 KUIS FAMILY 100 — MTS Al Husna

Aplikasi kuis interaktif bergaya Family 100 untuk media belajar siswa MTS.

---

## 🚀 Cara Menjalankan (Lokal / Jaringan Sekolah)

### 1. Install Dependencies (sekali saja)
```
npm install
```

### 2. Jalankan Server
```
npm start
```

### 3. Buka di Browser
- **Layar Game (Proyektor):** http://localhost:3000
- **Panel Admin (Guru):**     http://localhost:3000/admin

### 4. Akses dari Komputer Lain (jaringan yang sama)
- Cari IP laptop guru: buka CMD → ketik `ipconfig`
- Buka di komputer lain: `http://[IP-LAPTOP]:3000`

Mode ini menyimpan data di `db/data.json` (file lokal) dan tidak butuh akun/layanan apa pun.

---

## ☁️ Deploy ke Vercel (Opsional — akses dari internet)

App ini bisa juga dihosting di [Vercel](https://vercel.com) (gratis, tanpa kartu kredit di plan Hobby). Karena Vercel menjalankan kode sebagai *serverless function* (tidak ada proses yang hidup terus & filesystem-nya sementara), app ini didesain ulang agar:
- Real-time update memakai **polling** (setiap 1 detik) alih-alih WebSocket/Socket.io.
- Timer dihitung dari **timestamp**, bukan `setInterval` di server.
- Data disimpan di **Upstash Redis** (database eksternal gratis), bukan file lokal.

### Langkah setup:

1. **Buat database Redis gratis di Upstash**
   - Daftar di [upstash.com](https://upstash.com) (gratis, biasanya tanpa kartu kredit)
   - Buat database **Redis** baru (pilih region terdekat, misalnya Singapore)
   - Di halaman database, buka tab **REST API** dan catat:
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`

2. **Import project ini ke Vercel**
   - Buka [vercel.com/new](https://vercel.com/new), pilih repo GitHub ini
   - Sebelum klik Deploy, buka bagian **Environment Variables**, tambahkan:
     - `UPSTASH_REDIS_REST_URL` = (dari langkah 1)
     - `UPSTASH_REDIS_REST_TOKEN` = (dari langkah 1)
   - Klik **Deploy**

3. Setelah selesai, Vercel memberi URL seperti `https://nama-app.vercel.app`
   - **Layar Game:** URL itu langsung
   - **Admin Panel:** URL itu + `/admin`

> Kalau env var Upstash **tidak** diisi, app tetap bisa jalan di Vercel tapi data (soal/tim/skor) akan hilang setiap kali function di-restart — jadi untuk pemakaian serius di Vercel, setup Upstash Redis di atas wajib dilakukan.

---

## 📋 Format Import Soal

Salin format ini di Notepad/Word, isi datanya, lalu paste di menu **Import Soal**:

```
SOAL: [Tulis pertanyaanmu di sini]
KATEGORI: [Contoh: TIK / Agama Islam / IPA / Matematika]
WAKTU: 60
JAWABAN:
[Jawaban 1] | [Poin]
[Jawaban 2] | [Poin]
[Jawaban 3] | [Poin]
[Jawaban 4] | [Poin]
[Jawaban 5] | [Poin]
```

**Contoh soal TIK:**
```
SOAL: Sebutkan perangkat output komputer yang kamu ketahui!
KATEGORI: TIK
WAKTU: 60
JAWABAN:
Monitor | 30
Printer | 25
Speaker | 20
Proyektor | 15
Headphone | 10
```

Pisahkan setiap soal dengan baris kosong. Bisa import banyak soal sekaligus!

---

## 🎮 Cara Bermain

1. Buka **Admin Panel** di laptop guru
2. Buka **Layar Game** di browser yang akan diproyeksikan
3. Di Admin → **Kelola Tim**: atur nama tim (Tim Al Fatihah, dll)
4. Di Admin → **Kontrol Game**: pilih soal + pilih tim → klik **Mulai Ronde**
5. Saat siswa menjawab benar → klik jawaban yang sesuai untuk ungkap
6. Saat siswa menjawab salah → klik tombol ❌ STRIKE
7. 3 strike = Mode Steal (tim lain dapat 1 kesempatan)
8. Setelah selesai → klik **Beri Poin** ke tim yang menang
9. Lanjut ke soal berikutnya!

---

## 📁 Struktur File

```
├── server.js           ← Server utama
├── src/
│   ├── database.js     ← Database & sample data
│   └── routes/         ← API endpoints
├── public/
│   ├── game.html       ← Layar game (proyektor)
│   ├── admin.html      ← Panel admin (guru)
│   ├── css/            ← Styling
│   └── js/             ← JavaScript & sounds
└── db/kuis.db          ← Database (auto-dibuat)
```

---

Dibuat dengan ❤️ untuk MTS Al Husna
