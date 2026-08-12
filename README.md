# 🎓 KUIS FAMILY 100 — MTS Al Husna

Aplikasi kuis interaktif bergaya Family 100 untuk media belajar siswa MTS.

---

## 🚀 Cara Menjalankan

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
