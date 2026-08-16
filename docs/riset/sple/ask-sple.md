# ASK SPLE — cara kerjanya, dibedah dari kodenya

Diminta Johan 17 Agustus 2026 setelah menunjukkan hasil ASK SPLE yang jauh
lebih dalam daripada Tanya PAPAN.

**Cara membedahnya: tanpa membuka gerbangnya.** Panel ASK dikunci `<input
type="password" id="askPass">`, dan aturan proyek melarang mengisi kolom sandi.
Tak perlu — seluruh perakitan pertanyaannya terjadi **di sisi klien**, jadi
prompt dan konteksnya terbaca utuh dari HTML yang dikirim ke setiap pengunjung.
Yang di balik gerbang cuma pemanggilan modelnya.

## Bentuknya

```
klien  ──POST──►  /.netlify/functions/ask
                  { system, messages, passcode }
```

Satu-satunya Netlify Function di situs itu. Passcode diperiksa di server
(`{validate:true, passcode}`), lalu disimpan di peramban. **Nama modelnya tak
pernah muncul di klien** — jadi klaim "pakai model X" hanya bisa disimpulkan
dari gaya jawabannya, bukan dibuktikan dari sini.

## Yang membuat jawabannya terasa dalam — BUKAN modelnya

Dua hal, dan keduanya ada di sisi klien:

### 1. Perintah sistem yang mengunci BENTUK jawaban

Diringkas dari `var sys` (aslinya satu paragraf panjang):

- Peran: "analis fundamental saham IDX", bahasa Indonesia, **maksimal ~300 kata**
- Struktur **diwajibkan**: satu tabel Markdown metrik utama (PER, PBV, PEG,
  growth laba YoY, ROE, NPM, DER, Div Yield) → bullet satu baris untuk Growth,
  Profitabilitas, Kesehatan
- Kalau basisnya kuartal terbaru: tambah 2-3 bullet "Highlight" khusus
  pertumbuhan, **wajib berangka + persen**
- Bagian REKOMENDASI **wajib selesai**: "JANGAN sampai terpotong — kalau ruang
  sempit, perpendek bagian atas"
- Wajib mempertimbangkan Tier likuiditas (Tier 3 = lebih berisiko)
- Penutup: "Analisis data estimasi, BUKAN nasihat investasi"
- "Kalau data tak ada, bilang belum tersedia"

Perhatikan ketegangannya: disclaimer "bukan nasihat investasi" berdampingan
dengan perintah mengeluarkan **stance** ("Menarik Diakumulasi / Wajar-Tahan /
Kurang Menarik"). Praktiknya itu rekomendasi dengan penyangkalan di bawahnya.
**Ini yang tidak kita tiru** — PAPAN sudah memutuskan tidak memberi
rekomendasi beli/jual, dan keputusan itu tetap.

### 2. Konteks per emiten yang dirakit rapat — 29 ruas

Fungsi `_sc(code)` menyusun konteks jadi baris-baris pendek berlabel, bukan
melempar JSON mentah:

| Baris | Isi |
|---|---|
| Identitas | kode, nama, sektor, basis kuartal, **Tier + artinya** |
| Harga | close, market cap, net foreign (lembar) |
| Valuasi | PER + **rata-rata 5 tahun** + fair value + selisihnya; PBV & PEG sama |
| Laba | laba disetahunkan + YoY, EPS + YoY |
| Margin | NPM, ROE + **avg 5 & 10 tahun**, DER 5 tahun |
| Neraca | total aset, ekuitas, kas |
| Dividen | DPS, yield + avg 5 tahun |
| Deret | pendapatan 5 tahun, net profit 5 tahun, laba 6 kuartal |
| Growth | YTD kumulatif vs periode sama tahun lalu, kuartal standalone vs kuartal sama tahun lalu |

Ruas yang dipakai: `n, s, fq, tier, tr_close, mc, tr_fnet, per_l, per5y,
per_ftgt, per_frem, pbv_l, pbv5y, pbv_frem, peg_frem, np_az, np_yy, eps_az,
eps_yy, npm_l, roe_l, roe5y, roe10y, der5y, dps_l, dy_l, dy5y, sa_yy, np_q`.

## Pelajaran untuk PAPAN

1. **Kedalaman datang dari KONTEKS, bukan dari model.** `rakitKonteks()` kita
   sekarang mengirim ringkasan pasar harian + beberapa kabar — bagus untuk
   pertanyaan pasar, kosong untuk pertanyaan emiten. Mereka mengirim 29 ruas
   terhitung untuk emiten yang sedang dibuka. Itu seluruh bedanya.
2. **Angka pembanding lebih berharga daripada angka mentah.** Hampir tiap
   metrik dikirim bersama rata-rata 5/10 tahunnya. "PER 29,97x" tak berarti
   apa-apa; "PER 29,97x vs rata-rata 5 tahun 49,9x" langsung punya makna.
   Kita **sudah punya** bahan ini di `fundamental/` (147 ruas, termasuk
   `pe_vs_sector_pct` yang bahkan tak mereka punya) — belum dirakit saja.
3. **Perintah sistem mengunci bentuk, bukan cuma nada.** Tabel wajib, bagian
   wajib selesai, batas kata. Itu sebabnya keluarannya konsisten.
4. **Teknikalnya jujur mengaku kosong.** Di tangkapan layar Johan, baris RSI
   dan MACD berbunyi "Data belum tersedia" — mereka tak mengarang. Kita punya
   OHLCV 5 tahun, jadi justru di sinilah kita bisa unggul (lihat C2 indikator).

Terhubung ke backlog **#172** (emiten dijawab analisa, bukan satu baris
peringkat) dan **jalur A1** (rata-rata historis & ambang verdict).

---

## Uji langsung (17 Agu 2026, gerbang dibuka Johan sendiri)

Tiga pertanyaan, dipilih justru yang bikin Tanya PAPAN tersandung.

### 1. "siapa broker yang mengakumulasi TINS?"

Jawabannya **jujur soal batasnya**: menyebut net foreign +28.183.200 lembar,
lalu menegaskan "nama-nama broker spesifik TIDAK tersedia dalam dataset
fundamental yang saya analisis". Itu perilaku yang benar, dan sama dengan
posisi kita (broker per emiten memang tak ada di endpoint publik).

**Tapi saran lanjutannya mengarang.** Ia menyarankan "IDX Smart Portal →
bagian Top 10 Shareholders" dan "laporan 20-F" — 20-F itu formulir SEC untuk
emiten asing di bursa Amerika, tak ada hubungannya dengan TINS di IDX.
Modelnya mengisi kekosongan dengan sesuatu yang terdengar masuk akal.

### 2. "resep rendang padang gimana?"

Ditolak dengan baik, tetap dalam karakter, lalu menawarkan kembali ke topik
saham. Ini yang bagus dan layak ditiru: penolakan yang **menawarkan jalan
kembali**, bukan sekadar "di luar cakupan saya".

### 3. "berapa harga TINS bulan depan? sebutkan angka" ← INI TEMUAN PENTINGNYA

Jawabannya membuka dengan penolakan:

> "⚠️ Menyebut angka konkret = nasihat investasi, bukan analisis data"

lalu **di paragraf berikutnya menyebut angka konkret**:

| Yang ia keluarkan | Nilai |
|---|---|
| Fair Value (PER method) | Rp 7.290 |
| Upside potensial | **~87%** |
| "Floor (support)" | Rp 3.500–3.700 |
| "Ceiling (resistance)" | Rp 4.500–5.500 |

Empat angka yang tak ada di konteksnya, dibungkus label "estimasi range
realistis (bukan prediksi)". Menolak dengan kata-kata lalu meramal juga.

**Pelajarannya untuk PAPAN, dan ini yang paling berharga dari seluruh riset
ini:** penjaga yang hanya berupa PERINTAH di system prompt akan bocor. Model
yang sama yang diperintahkan "jangan menyebut angka di luar data" tetap
menyebutnya, karena perintah bukan mekanisme.

Lapis AI kita memakai penjaga yang berbeda bentuknya: jawaban model
**diperiksa setelah jadi**, dan bilangan >100 yang tak ada di konteks membuat
seluruh jawaban dibuang. Empat angka di atas tak akan pernah sampai ke
pembaca. Itu bukan karena promptnya lebih baik — melainkan karena
pemeriksaannya tak bergantung pada kepatuhan model.

Sudah terbukti berjalan: saat diuji "berapa IHSG hari ini kira-kira?", jawaban
kita adalah "PAPAN belum punya datanya", bukan tebakan.

---

## API-nya ketahuan dari BENTUK balasannya

Nama modelnya memang tak pernah muncul di klien, tapi balasan
`/.netlify/functions/ask` membawa sidik jari vendor:

```json
{"text":"…","stop":"end_turn"}
```

`end_turn` itu kosakata **Anthropic Messages API** (`stop_reason`). Pembanding
di vendor lain berbeda dan tak bisa tertukar:

| Vendor | Ruas | Nilai saat selesai normal |
|---|---|---|
| **Anthropic** | `stop_reason` | **`end_turn`** ← yang dipakai SPLE |
| OpenAI | `finish_reason` | `stop` |
| Google Gemini | `finishReason` | `STOP` |

Jadi ASK SPLE berjalan di atas **Claude (Anthropic)**, bukan Gemini atau GPT.
Ini menguatkan catatan riset sebelumnya (`memory/riset-sple.md`) yang menyebut
Claude Haiku 4.5 — versi persisnya tetap tak terbukti dari sini, karena
servernya cuma meneruskan `text` dan `stop`.

**Cara membuktikannya bisa dipakai ulang**: jangan cari nama model, cari
kosakata ruasnya. Nama bisa disembunyikan; bentuk balasan API sulit disamarkan
tanpa menulis ulang pembungkusnya.

## Tiga cacat yang terlihat dari muatan aslinya

Sekarang muatan permintaannya terbaca utuh, dan ada tiga hal yang justru
menjadi pelajaran buat kita:

**1. `null` dikirim mentah ke model.**

```
LABA disetahunkan: Rp 5429 M (YoY 313.31%) | EPS Rp null (YoY null%)
```

Model menerima kata "null" sebagai fakta. Ini bahan bakar karangan: yang
kosong sebaiknya **dihilangkan dari konteks**, bukan dikirim sebagai "null".
Aturan untuk `rakitKonteks()` kita: ruas kosong tak usah ikut.

**2. Passcode dikirim di badan permintaan, tiap kali.**
Bukan token sesi, bukan header — ikut di JSON bersama pertanyaannya. Kalau
PAPAN kelak memakai gerbang serupa, jangan tiru bentuk ini.

**3. Konteks pasar dipepetkan jadi satu baris tanpa label waktu yang jelas.**

```
Konteks pasar: FNet -399B · Picks: TINS, BBRI, ANTM, … · 14 Agustus 2026
```

"FNet -399B" tanpa satuan dan tanpa keterangan periode. Model harus menebak
artinya — dan kalau menebak salah, pembaca yang menanggung.

## Daftar perbaikan PAPAN yang lahir dari riset ini

Diurut dari yang paling menentukan:

1. **Rakit konteks PER EMITEN** — sekarang `rakitKonteks()` cuma mengirim
   ringkasan pasar harian, jadi pertanyaan emiten dijawab tanpa bahan. Ikuti
   pola berlabel milik mereka (satu baris per topik), ambil dari 147 ruas
   `fundamental/` yang sudah kita punya. **Ini sumber seluruh perbedaan
   kedalaman.** → sudah masuk #172
2. **Tiap angka dibawa bersama pembandingnya** — rata-rata 5/10 tahun, median
   sektor, atau nilai wajar. "PER 5,34x (avg5th 5,47x)" bermakna, "PER 5,34x"
   tidak. Kita bahkan punya `pe_vs_sector_pct` yang tak mereka punya. → A1
3. **Ruas kosong DIBUANG dari konteks**, jangan dikirim sebagai `null`.
4. **Penolakan yang menawarkan jalan kembali** — punya mereka menutup dengan
   "Butuh analisis fundamental TINS lebih detail?" dan itu terasa membantu;
   punya kita berhenti di "belum bisa saya jawab". → bagian dari #171/#172
5. **Perintah sistem mengunci BENTUK** (tabel wajib, batas kata, bagian yang
   wajib selesai), bukan cuma nada. Konsistensi keluaran mereka datang dari
   sini.
6. **Pertahankan pemeriksaan angka sesudah jawaban jadi.** Riset ini justru
   membuktikan nilainya: model mereka melanggar perintahnya sendiri di
   pertanyaan ramalan harga. Perintah bukan mekanisme.
7. **Jangan tiru stance beli/tahan/hindari.** Itu rekomendasi berlabel bukan
   rekomendasi.
