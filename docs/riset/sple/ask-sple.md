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
