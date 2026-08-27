# PENAJAMAN KEDALAMAN DATA — semua halaman PAPAN (Fable, 26 Agu 2026)

> Johan: *"pastikan data nya sudah pakai yang lebih lengkap dan pasang data OHLCV dengan data lengkap dan Broker Summary sampai tahun 2016 itupun kalau dari sisi server bisa kalau tidak bisa ya sampai tahun 2020 saja"* · lalu saat ditanya: *"kalau tidak jadi beban besar yaa gpp sampai 2016 untuk data broker tapi untuk yang lain masih penting juga selain itu ada OHCLV, Keystat, Profile, dll"*.
> Semua angka di bawah **hasil ukur langsung 26 Agu 2026**.

---

## 1. 🔴 TEMUAN UTAMA — 4 tahun data broker sudah dipanen tapi TIDAK BISA DIBACA halaman mana pun

| Lapis | Isi | Tahun |
|---|---|---|
| Arsip mentah `_arsip-mentah/broker-harian/` | **2016 → 2026** (11 tahun); BBCA sendiri 24.956 berkas | ✅ lengkap |
| Berkas olahan `data-idx/json/broker_tahunan/` | **2020 → 2026** (7 tahun) | ❌ 2016–2019 HILANG |

Penyebabnya bukan data, melainkan **satu baris di pembangun**: `scripts/bangun_broker_tahunan.py:56` → `TAHUN_PENUH = ("2020", …, "2026")`. Komentar `:48` menyebut *"Ketetapan Johan 26 Agu 2026: pasang Broker Summary sejak tahun 2020"* — dan ketetapan itu **dibuat saat 2016–2019 belum dipanen** (komentar `:49` sendiri mengatakan gerbang itu berlaku "saat 2020-2024 masih gelombang backfill").

**Sekarang panen mundur sudah tuntas 2016–2026** (lantai sumber terbukti `2016-01-04` lewat uji 2015 yang nihil). Jadi alasan pembatasan itu **sudah gugur**. Yang tersisa hanya menjalankan ulang pembangunnya.

Bukti data 2016–2019 memang ada (contoh BBCA): 2016 = 1.476 berkas · 2017 = 1.523 · 2018 = 1.566 · 2019 = 1.548.

### Ongkosnya — dan kenapa kekhawatiran Johan soal dataset lain TIDAK terbukti mengancam

| | Sekarang | Setelah +2016–2019 |
|---|---|---|
| Berkas `broker_tahunan` | 6.651 | **10.499** (+3.848) |
| Ukuran `broker_tahunan` | 1,6 GB | **±2,5 GB** |
| Total berkas `data-idx` | 22.068 | ±25.900 |

**Batas 15.000 berkas Vercel TIDAK berlaku di sini** — itu batas unggah lewat CLI. PAPAN memakai **deploy berbasis git** (`vercel.json` → `buildCommand: cd app && npm install && npm run build`), dan `data-idx/json` memang ikut git (**17.008 berkas sudah ter-track dan deploy-nya jalan**). Jadi penambahan 3.848 berkas bukan pemicu batas apa pun.

**Dataset lain yang Johan sebut tidak terancam** — semuanya berukuran ±960 berkas, jauh di bawah broker:
OHLCV 963 · Keystats 963 · Profil 963 · Profil Stockbit 963 · Kepemilikan 1.036 · Keuangan IDX 949 · Fundamental 967 · Broker harian 962.
Broker adalah satu-satunya dataset yang tumbuh per-tahun-per-emiten; sisanya satu berkas per emiten dan tidak ikut membengkak.

### Ketetapan
✅ **Bangun `broker_tahunan` untuk 2016–2019** (Johan 26 Agu: *"kalau tidak jadi beban besar yaa gpp sampai 2016"* — terukur tidak jadi beban besar).
- Ubah `TAHUN_PENUH` di `bangun_broker_tahunan.py:56` menjadi 2016–2026, **perbarui komentar `:48`** supaya tidak ada yang mengira 2020 masih ketetapan berlaku.
- Jalankan pembangun ulang; jangan panen ulang — arsip mentahnya sudah lengkap.
- **Uji terima**: `broker_tahunan/BBCA/2016.json` ada dan `n_hari` masuk akal (±240); satu hari sampel dicocokkan manual ke `_arsip-mentah`; dan **satu halaman** (mis. Inventory rentang "Semua") terbukti menampilkan data 2016.

### Satu risiko yang perlu diketahui, bukan penghalang
Berkas ini ikut git, dan pembangunan ulang mengubah banyak berkas sekaligus → **riwayat git bertambah besar tiap rebuild**. Ini sudah berlaku untuk 7 tahun yang ada sekarang; menambah 4 tahun memperbesar efeknya. Bukan alasan membatalkan, tapi kalau kelak repo terasa berat, **inilah penyebabnya** — solusinya nanti memindahkan data ke penyimpanan objek, bukan mengurangi tahun.

---

## 2. Kedalaman OHLCV — sudah lengkap di berkas, periksa pemakaian di halaman

Terukur: `ohlcv_stockbit/` menyimpan riwayat penuh sejak IPO tiap emiten — IHSG **1997-07-01**, ASII **2000-10-17**, BUMI **2003-01-01**, BBCA & TLKM **2004-01-02**, SIDO 2013-12-18 — semua sampai 2026-08-21. **Bukan 2017** seperti tertulis di enam spek sebelumnya (sudah dikoreksi).

Jadi tugasnya bukan menambah data, melainkan **memastikan halaman tidak memotongnya secara buatan**. Yang wajib diperiksa tiap halaman:
1. Adakah `slice(-N)` atau batas bar yang dipatok mati tanpa alasan? (Preseden: RRG memakai `pekanIdx.slice(-40)` — di situ **beralasan** karena RRG memang jendela pendek, tapi angkanya wajib dihitung dari warm-up, bukan dipatok.)
2. Kalau halaman menawarkan pilihan rentang, apakah pilihan terpanjangnya mencerminkan data yang benar-benar ada? Seasonality sudah benar (opsi sampai 20 tahun + caption "diminta X, arsip hanya Y").
3. Apakah ada halaman yang menyebut angka tahun di teksnya? Kalau ya, **hitung dari data, jangan tulis tetap** (preseden cacat: `Seasonality.tsx:172` menulis "8.848 hari bursa" padahal sudah 8.862 dan terus bertambah).

---

## 3. Sumber sektor — ganti ke IDX-IC penuh (keputusan Johan 26 Agu)

Johan: *"saya ikuti rekomendasimu saja"* → **opsi B: IDX-IC penuh**.

Latar: kolom `sektor` di `screener.json` diambil dari data fundamental (**taksonomi GICS/Yahoo**), sementara tooltip mengklaim IDX-IC resmi. Sesi Papan menemukan cacat lebih dalam dari yang kutulis di `spek_halaman_lama_PENAJAMAN.md` §1.4 — dan **temuan mereka menggugurkan resep perbaikanku sendiri**:

> Resepku (`fund?.sector ?? sektorResmi[kode]`) akan mencampur DUA TAKSONOMI dalam satu kolom filter. Contoh nyata: TLKM = *Communication Services* (GICS) vs *Infrastruktur* (IDX-IC); JSMR = *Industrials* vs *Infrastruktur*; BIRD = *Industrials* vs *Transportasi & Logistik*; ASII = *Industrials* vs *Perindustrian*. Akibatnya JSMR dan TLKM — sama-sama Infrastruktur menurut IDX — **terpencar ke grup GICS berbeda**, dan kolom filter berisi ±22 nama dari dua sistem.

**Yang dikerjakan**: `bangun-screener.mjs` mengambil `sektor` dari `emiten_sektor.json` (IDX-IC resmi, 962/962 lengkap) untuk **semua** baris. GICS **tidak dibuang** — tetap tersedia di `fundamental/*.json` untuk keperluan lain. Sesuai aturan tetap Johan 3c: sumber terlengkap jadi utama, yang lama jadi cadangan yang ditandai.

Akibat yang diharapkan: label filter jadi Bahasa Indonesia (situsnya Indonesia), `'-'` praktis hilang, tooltip jadi jujur, dan **akar "dua penamaan sektor" tertutup untuk jalur screener**. Pemakai turunan (`sektorUnik`, `kandidat.ts` `perSektor`/`sektorJumlah` Neo Papan) aman karena semuanya membangun grup dari baris screener sendiri.

**Uji terima**: nol baris ber-`sektor:'-'` (kecuali emiten yang memang tak ada di `emiten_sektor.json`); TLKM/JSMR terbukti satu grup; filter Sektor Neo Papan Activity tetap cocok kuncinya; tooltip diperbarui menyebut IDX-IC dan itu **benar**.

---

## 4. Dua halaman yang BELUM PERNAH DIAUDIT

`spek_halaman_lama_PENAJAMAN.md` mencakup 22 halaman, tapi **dua tidak tersentuh sama sekali**:
- **Trader Papan** (`TraderPapan.tsx`)
- **Chart** (`/chart` — identitasnya terhadap Grafik Emiten belum dikonfirmasi; bisa jadi halaman berbeda, bisa jadi rute lama)

**Jangan dianggap bersih.** Keduanya perlu diaudit dengan delapan kelas cacat yang sama sebelum PAPAN bisa disebut "seluruh halaman sudah ditajamkan". Ini pekerjaan tersisa yang jelas, bukan opsional.

---

## 5. Urutan

1. **Sektor IDX-IC** (§3) — keputusan Johan sudah turun, dampaknya lintas halaman (Screener + Neo Activity), dan menutup akar dua-penamaan.
2. **Bangun broker 2016–2019** (§1) — jalankan pembangun, uji terima, lalu periksa halaman mana yang otomatis mendapat rentang lebih panjang.
3. **Sapuan kedalaman OHLCV** (§2) — periksa tiap halaman untuk potongan buatan & angka tahun yang dipatok mati.
4. **Audit Trader Papan + Chart** (§4).
5. Sisa temuan 🔴/🟡 `spek_halaman_lama_PENAJAMAN.md` yang belum tertutup.
