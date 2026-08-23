# Rombak Workflow Panen — catatan keputusan (23 Agustus 2026)

Johan: *"artinya jadikan sebuah catatan di proyek ini, nanti diubah semua itu
workflow panen nya, pekerjaan besar"* · *"ayolah ambil semua data itu"* ·
*"jalan yang memiliki likuiditas tinggi 300 emiten dulu setelah itu panen semua
sampai habis 300-300-sisanya"*

Dokumen ini mencatat **apa yang berubah dan kenapa**, supaya rombakan CI
menyusul tidak dimulai dari tebakan. Status panen harian tetap dibaca dari
`docs/status-panen.md`; yang di sini keputusannya.

---

## 1 · Yang berubah secara mendasar

Sebelum hari ini, sumber utama data harga kita adalah **Yahoo Finance** dan
broker per emiten dianggap **tidak tersedia di endpoint publik mana pun**.
Keduanya tidak berlaku lagi.

| Lapis | Dulu | Sekarang |
|---|---|---|
| OHLCV emiten | Yahoo (2016→), volume 2,66% salah | **Stockbit chartbit** (2004→), volume = IDX 100,00% |
| OHLCV IHSG | Yahoo (1990→), **1.268 bar volume 0** | Yahoo untuk 1990–1999 + **Stockbit untuk volume 2000→** |
| Broker per emiten | hanya setoran screenshot kontributor | **Stockbit marketdetectors**, 12 varian, 2017→ |
| Aliran asing rupiah | **ditaksir** lembar × harga rata-rata (meleset 1,33× kumulatif) | **angka resmi** dari `foreignbuy`/`foreignsell` chartbit |
| Rasio fundamental | yfinance + XBRL | + **keystats Stockbit** (±94 rasio) |
| Pemegang saham & anak usaha | profil IDX | + **profil Stockbit** |
| Keanggotaan indeks, notasi khusus, UMA | tidak ada | **info Stockbit** |

---

## 2 · Dua belas varian broker — dan alasan tiap keputusan

`VARIAN` di `scripts/panen_broker_harian.py` naik dari 3 jadi **12**:
3 papan (`REGULER`/`NEGO`/`TUNAI`) × 2 tipe investor (`ALL`/`FOREIGN`) ×
2 jenis transaksi (`GROSS`/`NET`).

### Yang SENGAJA tidak dipanen

**`DOMESTIC` — diturunkan, bukan dipanen.** Terukur pada BUMI 21 Agu 2026:

```
beli: ALL 1.227.466.284.000 − FOREIGN 229.889.595.600 = 997.576.688.400
      DOMESTIC                                        = 997.576.688.400  COCOK
jual: ALL        62.432.794 − FOREIGN      14.247.426 =      48.185.368
      DOMESTIC                                        =      48.185.368  COCOK
```

Menghemat sepertiga beban panen tanpa kehilangan apa pun.

### Yang hampir dilewatkan dan ternyata wajib

**`TUNAI` tidak selalu kosong.** Uji 4 emiten × 3 tanggal: 3 dari 12 ada isinya
(BUMI 15 Jul: 2 broker, TPIA 21 Agu: 3 broker, TPIA 15 Jul: 2 broker). Jarang,
tapi nyata — melewatkannya berarti kehilangan transaksi yang benar-benar
terjadi.

### Yang belum terpecahkan, jadi dipanen untuk aman

**`NET` dipanen terpisah karena definisinya belum kupahami** — bukan karena
sudah terbukti mustahil diturunkan dari `GROSS`. Bedanya penting dan wajib
dijaga saat menulis ulang catatan ini nanti.

Riwayat pengujiannya, supaya tak diulang dari nol:

1. **Percobaan pertama salah alat.** `padatkan()` ditulis khusus mode GROSS
   (docstring-nya sendiri berkata begitu; mode GROSS menaruh satu broker di
   KEDUA daftar, mode NET hanya di satu). Memakainya untuk balasan NET
   menghasilkan perbandingan yang tak bermakna.
2. **Percobaan kedua memakai ruas yang lebih tepat** (`bvalv`/`svalv`, bukan
   `bval`/`sval` — di mode GROSS keduanya sama, di mode NET berbeda). Sebagian
   broker cocok persis (TP: `31.584.692.700` vs hitungan GROSS
   `31.584.494.935`), tapi mayoritas tidak: BUMI 9/80, BBCA 19/69, TPIA 19/74.

Jadi ada aturan yang belum terbaca. Sampai terbaca, NET ditarik dari sumber.

---

## 3 · Urutan kerja: 300 — 300 — sisanya

Keputusan Johan. Alasannya beban: 12 varian × 1.309 hari rata-rata × 961 emiten
≈ **31 hari** berjalan pada paralel 12. Diambil bertahap supaya emiten yang
benar-benar dianalisis selesai lebih dulu.

| Gelombang | Emiten | Perkiraan (paralel 12) |
|---|---|---|
| 1 | peringkat likuiditas 1–300 | ±10 hari |
| 2 | 301–600 | ±10 hari |
| 3 | 601–963 | ±11 hari |

Urutan likuiditas dihitung dari rata-rata nilai transaksi 20 hari terakhir.
Sepuluh teratas saat ini: TPIA · BBCA · BUMI · BBRI · BMRI · DSSA · CUAN ·
AMMN · DEWA · ANTM.

Runner (`scripts/backfill_broker_massal.py`) **resume otomatis** — memeriksa
arsip per hari per varian sebelum menembak jaringan, jadi menghentikan dan
melanjutkan tidak membuang pekerjaan. Gelombang berikutnya dijalankan dengan
`--mulai-dari <KODE>` atau menaikkan `--batas`.

---

## 4 · Yang masih harus dirombak (belum dikerjakan)

- [x] **CI harian broker naik ke 12 varian** — SELESAI 23 Agu 2026
      (commit `72432b3a`). Yang ditemukan saat mengerjakannya: langkah 3d
      memanggil `panen_broker_harian.py` **tanpa** `--varian`, jadi bawaannya
      `reguler` SAJA — bukan 3 seperti yang tertulis di catatan ini
      sebelumnya. Sekarang 12 varian dieja lengkap, jeda 0,4 detik
      (±1,3 jam; pada jeda 1,0 detik akan jadi 3,2 jam).
- [ ] **Langkah OHLCV/keystats Stockbit di CI** — belum ada. Keystats/profil/
      info cukup **mingguan atau bulanan** (snapshot, jarang berubah);
      `ohlcv_stockbit/` juga **tak boleh harian** — lihat catatan churn di
      bawah.
- [ ] **`panen_ohlc.py`** — masih Yahoo sebagai sumber utama. Perlu diputuskan:
      Stockbit jadi sumber utama dengan Yahoo cadangan, atau tetap dua jalur
      dengan penggantian volume sebagai langkah pasca-panen
      (`scripts/ganti_volume_ohlc.py`).
- [x] **IHSG dijahit** — SELESAI 23 Agu 2026 (`scripts/jahit_ihsg.py`,
      commit `d217d247`). 8.861 bar 1990-04-06→2026-08-21; volume 0 tinggal
      1.261 yang semuanya **pra-1997-07-01**, di luar jangkauan Stockbit.
      (Angka "pra-2000" di versi pertama catatan ini salah — ikut terbawa dari
      docstring `jahit_ihsg.py` yang belum disegarkan sesudah TO_TERLAMA
      diturunkan ke 1980; Stockbit IHSG sebenarnya mulai 1997-07-01.) Dua jebakan
      yang ditemukan sebelum menulis: potong-tempel akan menghilangkan 38 hari
      yang hanya ada di Yahoo, dan Yahoo melapor volume indeks dalam **lot**
      sementara Stockbit dalam **lembar** (rasio median tepat 100,00) sehingga
      grafik akan melompat 100× tepat di sambungan.
- [ ] **Mirror produksi** — frontend membaca `app/public/data-idx/json/ohlc/`,
      BUKAN `data-idx/json/ohlc/`. Perubahan volume belum sampai ke layar
      sampai mirror disinkronkan.
- [ ] **Aliran asing rupiah** — `foreignbuy`/`foreignsell` chartbit belum
      dipakai halaman mana pun; taksiran lama masih yang tampil.
- [x] **Keputusan ukuran git** — SELESAI 23 Agu 2026, Johan: *"harus masuk
      lah kan ada aturan di github maks 10GB kan?"*. `ohlcv_stockbit/`,
      `keystats_stockbit/`, `profil_stockbit/`, `info_stockbit/` dilepas dari
      `.gitignore` (commit `72432b3a`). Terukur: 363 MB mentah → `.git`
      naik 289 MB ke 414 MB.

      Yang membatasi bukan ukuran sekali unggah melainkan **churn**: berkas
      ditulis ulang UTUH tiap disegarkan dan git menyimpan blob baru, bukan
      selisih baris. Menyegarkan `ohlcv_stockbit/` harian = ±101 MB/hari,
      menembus 10 GB dalam ±3 bulan. Karena itu penyegaran harian tetap
      jatuh ke `ohlc/`; `ohlcv_stockbit/` berkala.
- [ ] **Batas sisi Vercel belum diuji** — `vercel.json` menyalin
      `data-idx/json` apa adanya, dan direktori itu kini **670 MB / 13.378
      berkas** (dari 273 MB). Build pertama sesudah ini yang akan
      membuktikan apakah lolos; kalau ditolak, jalan keluarnya menyaring
      salinan di `buildCommand`, bukan mengeluarkannya dari git.
- [ ] **Endpoint yang parameternya belum terpecahkan**: Top Broker level pasar,
      laporan keuangan per periode, aksi korporasi, **intraday**, orderbook
      (paywall Pro), fundachart.

---

## 5 · Aturan yang lahir dari sesi ini

Sudah masuk `CLAUDE.md`, diulang di sini supaya dokumen ini berdiri sendiri:

**Tiap laporan panen wajib menyebut LAPIS · CAKUPAN · RUAS.** "Panen broker
jalan" bukan laporan. Yang wajib: papan & tipe investor yang benar-benar
diambil (bukan nama pendeknya), berapa emiten dan **apakah IHSG termasuk**, dan
ruas mana yang tersentuh.

Yang membuat aturan ini mahal: nama pendek menyembunyikan isi. "asing"
terdengar seperti seluruh transaksi asing padahal hanya papan reguler; "OHLCV"
terdengar mencakup indeks padahal `ohlcv_stockbit/` berisi 962 emiten **tanpa**
IHSG sementara `ohlc/` berisi 964 berkas **termasuk** IHSG — dan IHSG di sana
volumenya selalu 0.

**Jangan menimpa angka dengan nol.** Saat mengganti volume, 296 bar berisi 0 di
Stockbit padahal Yahoo mencatat volume nyata (ABDA 11.000, ALTO 10.000, ALDO
208 lembar). Nol tak bisa dibedakan dari "tak diperdagangkan", jadi bar seperti
itu mempertahankan nilai lama.

**Kesimpulan negatif wajib menyebut apa yang sudah dilihat.** "IHSG tidak ada
di Stockbit" lahir hanya karena `IHSG.json` absen dari hasil panen — padahal
`daftar_emiten.json` memang tak memuat IHSG, jadi **tak pernah dicoba**.
Sekali diuji, IHSG menjawab 200 dengan 6.426 bar.
