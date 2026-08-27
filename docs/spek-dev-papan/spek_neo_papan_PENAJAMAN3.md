# PENAJAMAN SPEK NEO PAPAN — JILID 3 (§4 Compare · §5 Activity · §8 Transaction)

> Johan 26 Agu 2026: *"lanjutkan tab berikutnya"*. Tiga tab sisa.
> Berlaku di atas `spek_neo_papan_revisi.md` + `PENAJAMAN.md` + `PENAJAMAN2.md`. Kalau bertentangan, **yang ini menang**.
> **Catatan jujur di depan: jilid ini sebagian MENGOREKSI usulku sendiri di jilid 2.** Aku mengusulkan "mode Papan" tanpa mengukur apakah tiap papan sehat sebagai agregat. Setelah kuukur, tiga dari lima papan **tidak sehat kalau ditampilkan polos**. Perbaikannya di §5A.

---

## 🔴 PENAJAMAN 8 — Activity: KONSENTRASI wajib ditampilkan, kalau tidak garisnya berbohong

Kuukur nilai transaksi per kelompok, jendela 3 bulan (2026-05-25 → 2026-08-21), lalu kuhitung berapa persen kelompok itu disumbang emiten terbesarnya.

### 5A. Mode Papan — usulku sendiri ternyata perlu penjaga

| Papan | emiten | **aktif** | Σnilai | **top-1** | Verdikt |
|---|---:|---:|---:|---:|---|
| Utama | 271 | 271 (100%) | Rp 770,8 T | 11,2% | ✅ sehat |
| Pengembangan | 495 | 489 (98,8%) | Rp 156,9 T | 7,3% | ✅ sehat |
| Pemantauan Khusus | 154 | **70 (45,5%)** | Rp 2,31 T | **38,7%** | ⚠️ separuh tak berdagang, 1 emiten = 39% |
| Akselerasi | 41 | 41 (100%) | Rp 4,60 T | **60,5%** | ⚠️ 1 emiten = 60%, ini bukan agregat |
| Ekonomi Baru | **1** | 1 | Rp 1,36 T | **100%** | ❌ **satu saham berjubah nama papan** |

**Yang harus dilakukan:**
1. **Ekonomi Baru (n=1): JANGAN tampilkan sebagai garis papan.** Satu emiten yang diberi label kelompok akan dibaca sebagai tren sektoral, padahal itu grafik satu saham. Buang, atau gabung ke "Lainnya".
2. **Tampilkan `n aktif` di legenda tiap kelompok**, bukan `n terdaftar`. "Pemantauan Khusus (70 aktif dari 154)" jujur; "Pemantauan Khusus" polos menyesatkan.
3. **Tandai konsentrasi.** Bila **top-1 > 30%**, beri penanda di legenda + tooltip: *"garis ini didominasi satu emiten (X%)"*. Akselerasi 60,5% dan Pemantauan Khusus 38,7% wajib kena tanda ini.
4. Pemantauan Khusus **tetap layak ditampilkan** (justru itu papan paling menarik untuk risiko) — asal dua penanda di atas ada. Yang dilarang adalah menampilkannya seolah agregat 154 emiten.

### 5B. Mode Sektor — risiko yang sama, dan aku belum menandainya di jilid mana pun

| Sektor | emiten | aktif | Σnilai | top-1 | **top-3** |
|---|---:|---:|---:|---:|---:|
| Keuangan | 106 | 103 | Rp 216,6 T | 39,9% | **86,8%** |
| Perindustrian | 66 | 62 | Rp 52,3 T | 38,8% | **74,5%** |
| Infrastruktur | 70 | 58 | Rp 66,6 T | 36,8% | 65,4% |
| Barang Baku | 113 | 96 | Rp 246,0 T | 32,9% | 55,6% |
| Kesehatan | 41 | 39 | Rp 12,5 T | 32,0% | 53,0% |
| Transportasi & Logistik | 40 | 39 | Rp 4,7 T | 26,2% | 58,3% |
| Teknologi | 47 | 41 | Rp 12,2 T | 26,2% | 49,7% |
| Barang Konsumen Non-Primer | 163 | 143 | Rp 57,0 T | 18,3% | 35,3% |
| Energi | 91 | 83 | Rp 207,4 T | 17,9% | 44,7% |
| Barang Konsumen Primer | 133 | 127 | Rp 44,9 T | 16,5% | 30,4% |
| Properti & Real Estat | 92 | 81 | Rp 16,0 T | 13,0% | 32,4% |

**Keuangan: tiga emiten = 86,8% nilai sektor.** Artinya garis "Activity Keuangan" praktis adalah garis tiga bank besar. Itu **bukan cacat** — memang begitu bentuk pasar Indonesia — tapi pembaca berhak tahu, karena kesimpulan "sektor keuangan ramai" sebenarnya berarti "tiga bank ramai".

**Yang harus dilakukan:** tooltip tiap garis sektor menampilkan **top-3 kontributor + porsinya** pada tanggal yang di-hover. Murah (data sudah dihitung untuk agregatnya), dan mengubah grafik dari "kesan" jadi "kesan yang bisa ditelusuri".

**Catatan metode**: `porsiBergerak` memakai **nilai transaksi**, jadi bobot alami mengikuti likuiditas — konsentrasi di atas adalah konsekuensi wajar, bukan bug. Jangan "memperbaikinya" dengan sama-rata: sektor yang ramai karena tiga bank memang benar-benar ramai. Cukup buka faktanya.

---

## 🔴 PENAJAMAN 9 — Compare: ambang penjaga `CHANGE FROM A %` ditetapkan, bukan ditebak

Jilid 2 menyuruh "batasi tampilan bila basis mendekati nol" tanpa memberi ambang — itu menyerahkan keputusan penting ke perasaan implementor. Tetapkan begini:

- Bila **|CUM periode A| < Rp 100 juta**, jangan tampilkan persentase. Ganti dengan **`—`** dan tooltip: *"basis periode A terlalu kecil (Rp X) untuk persentase yang berarti"*. Alasan ambang: di bawah itu, satu transaksi kecil menghasilkan persentase ratusan sampai ribuan persen (di NeoBDM sendiri terlihat **+2773,15%** untuk basis Rp −106,81 juta) — angka yang benar secara aritmetika tapi menyesatkan sebagai perbandingan.
- Bila A dan B **berlawanan tanda** (mis. A negatif, B positif), persentase perubahan **tidak bermakna** — tampilkan `—` plus penanda arah "balik arah", bukan angka. Ini kasus yang justru paling menarik bagi pembaca, dan paling salah kalau dipaksa jadi persen.
- **Selalu tampilkan nilai absolut A dan B di sebelahnya**, supaya pembaca bisa menilai sendiri saat persentasenya ditahan.
- **Wajib ada di uji terima**: satu baris basis-kecil dan satu baris beda-tanda, dibuktikan menampilkan `—`.

Sisanya tetap: brush pakai ulang `seleksiAreaChart.ts`, periode A dan B **boleh beda tahun** (jalur tahunan lengkap 2020–2026).

---

## 🔴 PENAJAMAN 10 — Transaction Chart: putuskan skalanya dulu, baru bangun

Tiga hal yang harus **diputuskan dan ditulis sebelum kode**, bukan sesudah:

1. **Skala Participation.** Data kita punya preseden `top3_pct: 199,99` dan `top5_pct: 200` — itu karena sisi beli dan jual dihitung dua kali, jadi maksimum wajarnya **200%**, bukan 100%. Tetapkan salah satu, tulis di Metodologi, dan **assert di uji** bahwa nilainya tak pernah melampaui batas yang dipilih:
   - Skala **0–100**: pembagi = total nilai transaksi (satu sisi). Lebih intuitif.
   - Skala **0–200**: pembagi = total dua sisi. Konsisten dengan `top*_pct` yang sudah ada di data.
   Rekomendasiku: **0–100 dengan pembagi satu sisi**, karena pembaca akan membaca "participation" sebagai porsi, dan porsi di atas 100% memancing kecurigaan bug. Kalau memilih 0–200, tulis besar-besar di label.
2. **Nama kategori investor.** Jangan pinjam Retail/Institution/Zombie milik NeoBDM — kita tak punya datanya. Yang kita punya jujur: **Asing vs Domestik** (varian broker, 100% cakupan jalur tahunan) dan **Reguler vs Nego**. Beri nama yang menyebut apa yang diukur, bukan apa yang ingin disiratkan.
3. **`cross_index`** → beri nama jelas **"IHSG (basis 100)"**. `TransaksiTab` sudah menormalkan IHSG ke basis 100; tinggal namanya dijujurkan.

Setelah migrasi lightweight-charts: pakai `CandlestickSeries` sungguhan dan **hapus komentar `TransaksiTab.tsx:7-13`** bersama alasannya yang sudah gugur.

---

## Kriteria Terima tambahan jilid 3

1. **Activity**: legenda menampilkan `n aktif`; kelompok dengan top-1 > 30% bertanda konsentrasi; **Ekonomi Baru tidak muncul sebagai garis papan**; tooltip sektor menampilkan top-3 kontributor. Satu nilai Activity dihitung ulang manual.
2. **Compare**: satu baris basis < Rp 100 jt dan satu baris beda-tanda terbukti menampilkan `—`; satu baris normal dihitung ulang manual.
3. **Transaction**: Participation **di-assert tidak pernah melampaui skalanya** pada seluruh rentang uji; skala tertulis di Metodologi; nol istilah pinjaman dari NeoBDM.
