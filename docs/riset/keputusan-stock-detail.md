# Kedalaman Stock Detail — Dokumen Keputusan

**19 Agu 2026 · disusun dari lima rancangan yang sudah diadu · seluruh angka di bawah diverifikasi ulang ke cakram hari ini, bukan disalin dari rancangan**

---

## Ringkasan Eksekutif

1. Kedalaman **kuartal diskret hari ini 6 kuartal** (2025-03-31 … 2026-06-30) — bukan 2 tahun, dan bukan 5 tahun. Lapisan `keuangan_idx_diskret/` sudah jadi, 949 berkas, 80–87% terisi.
2. Kolom C (periode pembanding) di 2.615 XLSX 2025 yang **sudah di cakram** memberi seluruh interim 2024 gratis → **10 kuartal diskret, nol jaringan**.
3. Satu sesi panen (interim 2023 saja, 3 bucket ≈ 2 jam) memberi 2023 **dan** 2022 lewat kolom C-nya → **18 kuartal / 4,5 tahun**. Interim 2022 dan 2024 tidak perlu dipanen sama sekali.
4. Yang mendesak sebelum itu: **Annualised & TTM sedang mencetak angka salah** di setiap emiten, dan **kartu KUARTALAN membaca sumber terdangkal** (`fd.q_*`) yang tak akan pernah lebih dalam berapa pun panennya.
5. Cacat yang tidak bisa dihilangkan rencana ini: **Q4 = Audit − TW3 menyerap seluruh residu audit**. Terukur: 8 emiten ber-revenue Q4 **negatif** (mustahil), 33,3% net income Q4 negatif.
6. Jangan pernah menjalankan re-parse `--paksa` atas seluruh arsip: **2025/audit tidak ada di arsip**, 2020 & 2021 hanya 2 berkas — 2.330 catatan tahunan akan terhapus tanpa satu pun galat.

---

## Fakta cakram — diverifikasi hari ini, gantikan angka rancangan mana pun

| Hal | Keadaan sebenarnya (19 Agu 2026) |
|---|---|
| `_arsip-mentah/keuangan_idx/` | **6.679 berkas**. 2019/audit 664 · 2020/audit **2** · 2021/audit **2** · 2022/audit 808 · 2023/audit 855 · 2024/audit 885 · 2025/tw1 850 · tw2 898 · tw3 867 · 2026/tw1 847 · 2026/tw2 **1**. **2025/audit tidak ada.** |
| `keuangan_idx` tahunan | 2019(664) 2020(701) 2021(747) 2022(808) 2023(846) 2024(847) 2025(882) |
| `keuangan_idx` kuartal (kumulatif) | 2025-03-31(786) 06-30(896) 09-30(867) · 2026-03-31(847) 06-30(774) |
| `keuangan_idx_diskret` | 949 berkas. Kuartal nyata: 2025Q1–Q4 + 2026Q1–Q2 = **6 kuartal**, terisi 80–87%. Entri 2019–2024 hanya 31% (neraca saja — tak ada TW3-nya). |
| Baris konteks tiap sheet | **Ada, dan dua format.** 2019 & 2022/audit: literal (`31 December 2019` \| `31 December 2018`). 2023 ke atas: token (`CurrentYearInstant`\|`PriorEndYearInstant`, `CurrentYearDuration`\|`PriorYearDuration`). |
| Sheet arus kas interim | `1510000` di 2026/tw1 menulis `CurrentYearInstant\|PriorYearInstant` — **tokennya salah**, isinya durasi kumulatif. |
| `perbaiki_skala_keuangan.py` | Ada, **tidak dipanggil dari mana pun** (grep seluruh repo: yml/py/md/bat/ps1 → nol). |
| Selisih arsip vs terparse | 2025/tw1: 850 berkas mentah, 786 catatan JSON — **64 emiten gagal parse senyap**. |

---

## Keputusan per pertanyaan

### 1. SUMBER KEDALAMAN — kolom C dulu, lalu **satu** sesi panen (interim 2023 saja)

**Keputusan:** tiga langkah, urutannya mengikat.

**A. Nol jaringan — perah kolom C dari 2.615 berkas 2025 yang sudah di cakram.**
Kolom C interim laba-rugi/arus-kas = periode kumulatif yang sama tahun sebelumnya. Dari 2025/tw1+tw2+tw3 keluar TW1/TW2/TW3 **2024** lengkap; audit 2024 sudah ada → Q4'24 turunan. Hasil: **diskret 2024Q1 … 2026Q2 = 10 kuartal, 2,5 tahun, nol permintaan**.
Biaya: ±2.600 berkas × ~0,4 dtk ≈ **20 menit**, sekali jalan.

**B. Satu sesi panen — interim 2023 (tw1/tw2/tw3), 3 bucket.**
Kolom C-nya memberi interim **2022** gratis; audit 2022 & 2023 sudah di cakram → Q4 keduanya. Hasil: **diskret 2022Q1 … 2026Q2 = 18 kuartal / 4,5 tahun**.
Biaya: 3 × ~880 unduhan = **±2.640 permintaan ≈ 2 jam**, ±700 MB, wajib IP rumahan.

**C. Yang TIDAK dipanen:** interim 2024 (kolom C 2025 sudah memberinya), interim 2022 (kolom C 2023), audit tahun mana pun (2019–2025 sudah lengkap di JSON), dan tahun buku ≤2018.

**Sebelum B, wajib probe murah** (aturan 18 Agu #1): `--batas 3` untuk tw1/tw2/tw3 2023 = ~9 unduhan, <1 menit. Ketersediaan interim 2023 belum pernah diuji dari mesin ini.

**Yang dikorbankan:** kuartal diskret sebelum 2022 (butuh panen 2021 = 3 bucket lagi). FY2018 tahunan datang gratis sebagai efek samping kolom C berkas audit 2019 — **bukan tujuan**, dan tidak menjawab keluhan Johan yang seluruhnya soal kuartalan. Jangan menjualnya sebagai hasil.

> **Kalimat yang harus dipercaya, bukan tabel di CLAUDE.md:** batas "XBRL IDX berhenti di tahun buku 2019" itu benar untuk **daftar** laporan, salah untuk **isi**-nya. Perbaiki barisnya.

### 2. CAMPURAN ASAL — satu kolom, satu definisi periode. Titik.

**Keputusan:**
- **Kolom kuartal hanya memuat DISKRET.** Kalau pengurangnya tak ada → sel `—`. Nilai kumulatif **tidak pernah** dirender sebagai angka di kolom kuartal. Jalur `asal:'idx-kumulatif'` di `bacaKuartalIdx()` dimatikan **setelah** langkah A selesai (sebelum itu ia masih satu-satunya pengisi beberapa kolom).
- **Mematikannya wajib disertai sapuan pembacanya** — `lencanaAsal()`, `labelAsal()`, dan legenda teks di `PanelLaporanKeuangan.tsx` mengeja `B·YTD`. Ini pola regresi #142 persis; jangan diulang.
- **Vendor naik ke kepala kolom**, satu kata: `Bursa` / `Agregator`. Empat lencana per sel dibuang.
- **Satu lencana per sel tetap tinggal: Q4 turunan.** Alasannya di §3 — Q4 satu-satunya turunan yang punya tingkat kegagalan terukur, dan itu perbedaan yang mengubah cara membaca angkanya, bukan sekadar penerbitnya.
- `thead { position: sticky; top: 0 }` — satu baris CSS. Tanpa itu, memindahkan penanda ke header **menghapusnya di 412px** begitu pembaca menggulir mendatar (temuan rebuttal terhadap rancangan *kebutuhan-analis*, valid).
- **Yahoo turun pangkat jadi penguji-silang, tidak dihapus.** Ia satu-satunya deteksi independen atas pengurangan yang salah. Tapi jangan dicabut dari tabel sebelum Q4 diskret jalan — hari ini Yahoo satu-satunya pengisi kolom Q4.
- Emiten yang mata uangnya berselisih antar sumber: **abaikan sisi yfinance**, tiga baris penjaga. (Klaim "ANJT/MBSS/SMMT" di rancangan *satu-sumber-saja* tidak terverifikasi; yang nyata **RIGS** saja. Penjaganya tetap murah, pasang.)

**Yang dikorbankan:** tabel jadi lebih berlubang secara visual selama masa transisi. Diterima — angka salah-satuan yang tampil akan dikutip; sel kosong akan ditanyakan.

### 3. ANNUALISED & TTM — Annualised dihapus, TTM diberi syarat keberurutan

Keduanya salah **sekarang**, diverifikasi di `KolomKuartalan.tsx`:

```ts
const vals = Object.values(ymap).filter((v) => v != null)
const sum  = vals.length ? vals.reduce((a, b) => a + b, 0) : null   // ← "Annualised"
```
Tahun 2026 baru punya Q1+Q2 → **setengah tahun dicetak berlabel Annualised**.

```ts
allQ.sort(...); const ttmVals = allQ.slice(0, 4)                    // ← "TTM"
const ttmSum = ttmVals.length === 4 ? ... : null
```
`length === 4` menjaga **jumlah**, bukan **keterurutan**. Empat nilai teratas bisa merentang 15 bulan dan tetap disebut TTM.

**Keputusan:**
- **Annualised dihapus, bukan diperbaiki.** Untuk tahun buku selesai → tampilkan **angka auditan** dari `keuangan_idx.tahunan` (2019–2025 sudah lengkap), label **"Setahun (audit)"**. Kita mengarang taksiran untuk tahun yang angka resminya sudah kita punya.
- Tahun berjalan → label **"YTD (n kuartal)"** dengan jumlah apa adanya. Jujur, dan bisa diadu dengan YTD tahun lalu pada jumlah kuartal yang sama — Annualised tak bisa diadu dengan apa pun.
- **TTM tampil hanya bila 4 kuartal kalender berurutan tanpa celah**, berakhir di kuartal terlapor terakhir, dan tak satu pun ber-asal kumulatif. Selain itu `—` dengan tooltip *"butuh 4 kuartal berurutan, tersedia n"*.
- **Tidak tampil-dengan-catatan.** Angka tersalin ke spreadsheet orang; catatan kakinya tidak.

**JANGAN pakai "uji penutupan tahunan" sebagai penjaga.** Q1+Q2+Q3+Q4 = TW1 + (TW2−TW1) + (TW3−TW2) + (Audit−TW3) ≡ Audit — **identitas aljabar**, lulus 100% selamanya, untuk operand apa pun termasuk yang tertukar tahun atau salah skala. Dua rancangan mengandalkannya dan satu memakainya untuk memberi cap "terverifikasi". Itu lebih buruk daripada tidak punya uji sama sekali.

### 4. KOSONG & NOL — tiga sumbu berbeda, nol catatan kaki per sel

| Keadaan | Di mana dinyatakan | Rupa |
|---|---|---|
| Nilainya memang nol | sel | `0` — `fmtCell` sudah benar, jangan sentuh. Untuk EPS pecahan, render `<1` supaya pembulatan tampilan tak menyamar jadi nol. |
| Baris tak ada di taksonomi laporan | **label baris**, sekali | *"Pendapatan — tak dilaporkan sebagai satu baris"* (bank). `operating_income` terisi 6,4% karena taksonomi umum memang tak punya laba usaha → **ganti barisnya jadi "Laba Sebelum Pajak"**, yang terisi hampir penuh. |
| Periode tak kita punya | **kolom tidak dibuat** | Buang periode nol-ruas sebelum `slice(-8)` — hitung atas gabungan `srcYf ∪ srcIdx`, jangan `srcYf` saja. |
| Kita belum panen / gagal parse | **satu baris di bawah tabel** | *"Data yang kami punya: 2022 Q1 – 2026 Q2."* |

**Keputusan tegas: JANGAN cetak "belum lapor" di v1.** Tiga rancangan mengusulkannya lewat roster `_lapor.json`. Ditolak, dengan bukti: 2025/tw1 punya 850 berkas mentah tapi hanya 786 catatan JSON — **64 emiten gagal parse senyap**, ditambah ~117 yang tak pernah terunduh. Label itu akan mencetak pernyataan faktual tentang kepatuhan emiten yang salah untuk ~19% papan, di halaman publik, dan menurut rancangannya sendiri "telat lapor itu sinyal risiko" — jadi angkanya bukan cuma salah, ia diberi bobot analitis. Menyamarkan kegagalan kita sebagai kelalaian emiten adalah bentuk ketidakjujuran yang lebih mahal daripada `—` yang netral.

Roster tetap **disimpan** (nol biaya, datanya sudah diunduh tiap panen) — sebagai papan skor internal, bertanggal, tidak dirender. Baru dipakai di layar setelah selisih arsip-vs-terparse ditutup ke nol.

Sisa nol palsu: 7 sel `q_eps == 0` yang tersisa semuanya jenis pembulatan yang **sah** — perbaikan pembagian sudah dikerjakan agen lain. Jangan resepkan ulang.

### 5. BENTUK HALAMAN — satu sumber, satu tabel, tambah YoY

**Keputusan:**
- **Kartu KUARTALAN dialihkan sumbernya ke `keuangan_idx_diskret`, tidak dihapus.** Ia punya `KolomKuartalan.test.ts` dan `fmtCell` yang baru saja ditulis agen lain; menghapusnya membuang tes tanpa pengganti dan bentrok dengan pekerjaan yang belum di-commit. Mengalihkan sumbernya sudah menghapus penyakitnya (dua tabel yang tak akan pernah sepakat) dengan diff yang lebih kecil.
  `.slice(0, 3)` dinaikkan setelah langkah A — tanpa itu, kedalaman cakram tak akan pernah tampil.
- **`PanelTahunan` dialihkan dari `fd.hist_*` (4 tahun yfinance) ke `idx.tahunan` (7 tahun)** — sudah dimuat halaman yang sama lewat `useStockKeuanganIdx`. Nol jaringan, nol komponen baru. Sekalian betulkan judul yang mengeraskan `(B IDR)` tanpa memeriksa `currency` — 98 emiten melapor USD.
- **Tambah kolom Δ YoY** (Q2'26 vs Q2'25, baris yang sama). Ini yang membuat kuartalan berguna di bursa musiman dan sekaligus menyelesaikan musiman **tanpa panel musiman terpisah**. Syarat: kedua kolom diskret dan se-asal; kalau tidak, `—`.
  Jendela baca dilebarkan ke `slice(-12)` supaya pembandingnya ada di dalam jendela — kalau tidak, 4 dari 8 kolom Δ-nya mati sejak lahir.
- **Di bawah 768px: `slice(-4)`**, dan urutan kolom **terbaru di kiri**. Bawaan `sort()` menaik + `slice(-8)` berarti di ponsel yang pertama terlihat adalah 2019. Satu baris.
- **TIDAK ditambah sekarang:** margin per periode, QoQ, strip cakupan bertitik, panel musiman. Semuanya "gratis di data, mahal di layar" — tabel 12 kolom sudah menggulir di 412px. Antre setelah YoY terbukti terpakai.

---

## Tanpa jaringan vs butuh panen

### Tanpa jaringan — kerjakan lebih dulu, selalu

| # | Pekerjaan | Biaya | Hasil |
|---|---|---|---|
| T1 | Sambungkan `perbaiki_skala_keuangan.py` ke pipeline (jalan **sesudah** pemeras, di CI dan di `.bat`) | menit | Mencegah re-parse merusak 512 nilai yang sudah benar |
| T2 | Kunci penyimpanan dibaca dari **isi berkas** (baris konteks / sheet `1000000`), bukan dari argumen CLI | jam | ±1,5–2% emiten bertahun-buku non-Desember berhenti disimpan di bawah kunci yang berbohong |
| T3 | Baca kolom C, **per sheet**, dengan pemetaan tanggal terpisah untuk instant vs duration | jam | Prasyarat T4 |
| T4 | Perah kolom C dari 2025/tw1+tw2+tw3 → interim 2024 → turunkan diskret | 20 mnt | **Diskret 2024Q1–2026Q2 = 10 kuartal** |
| T5 | Annualised dihapus → "Setahun (audit)" / "YTD (n kuartal)"; TTM syarat keberurutan | sore | Dua baris berhenti berbohong di semua emiten |
| T6 | Kartu KUARTALAN + `PanelTahunan` dialihkan ke sumber IDX; `.slice()` dinaikkan | sore | 334 emiten berkartu kosong jadi terisi; tahunan 4→7 tahun |
| T7 | `—` untuk kumulatif, vendor ke header, `thead` sticky, kolom nol-ruas dibuang, baris "Laba Usaha"→"Laba Sebelum Pajak" | sore | Tabel jujur |
| T8 | Δ YoY + `slice(-12)` + mobile `slice(-4)` urutan terbalik | sore | Pertanyaan pembaca terjawab |

### Butuh panen

| # | Pekerjaan | Biaya | Prasyarat |
|---|---|---|---|
| P0 | Probe `--batas 3` untuk tw1/tw2/tw3 2023 | ~9 unduhan, <1 mnt | — |
| P1 | Interim 2023, 3 bucket | ±2.640 unduhan, ~2 jam, ~700 MB, IP rumahan | T1–T4 selesai & terverifikasi |
| P2 | Tambal 2025/audit + 2020/2021 audit ke arsip mentah (tidak ada di cakram) | ±900 + 1.400 unduhan | opsional, hanya kalau re-parse tahun-tahun itu pernah dibutuhkan |

**Aturan urutan yang mengikat:** P1 tidak dijalankan sebelum T1–T4 selesai. Menambah 2.640 berkas ke pemeras yang kunci tanggalnya masih dari argumen CLI dan skalanya belum berpenjaga berarti memanen dua kali.

---

## Butuh keputusan Johan — tiga, tidak lebih

**K1 · Berapa dalam yang cukup?**
- (a) **2,5 tahun / 10 kuartal**, selesai besok, nol jaringan. *(langkah T saja)*
- (b) **4,5 tahun / 18 kuartal**, tambah satu sesi ±2 jam dari mesin rumah. *(T + P1)* — **rekomendasi**, karena "minimal 4 tahun" yang Johan sebut baru terpenuhi di sini.

**K2 · Kolom Q4 yang gagal uji kewajaran — sembunyikan atau tampilkan?**
Q4 = Audit − TW3 menyerap seluruh penyesuaian auditor. Terukur di 2025: **8 emiten revenue Q4 negatif** (mustahil; CDIA −Rp64,5 T), **33,3% net income Q4 negatif**.
- (a) **Sembunyikan yang mustahil** (revenue negatif → `—`), tampilkan sisanya berlencana "turunan". Kolom Q4 hilang di ~1% emiten. — **rekomendasi**
- (b) Sembunyikan seluruh Q4 sampai ada pembanding independen. Kehilangan 25% kuartal.
- (c) Tampilkan apa adanya. Ditolak: CDIA sendirian akan menggepengkan sumbu grafik seluruh emiten.

**K3 · Kartu KUARTALAN.**
- (a) **Dialihkan sumbernya**, tetap ada. — **rekomendasi**, diff terkecil, tes yang ada selamat
- (b) Dihapus, tabel Laporan Keuangan jadi satu-satunya.

---

## Urutan pengerjaan — untuk yang mengerjakannya besok

1. **T1** — sambungkan `perbaiki_skala_keuangan.py`. *Sebelum menyentuh pemeras apa pun.*
2. **T5 + T6** — Annualised/TTM dan pengalihan sumber kartu. Nol jaringan, langsung terlihat Johan, tak bergantung apa pun di bawah.
3. **T2 + T3** — kunci dari isi berkas, kolom C per sheet. Tulis penjaganya bersamaan (lihat di bawah).
4. **T4** — perah 2025 → interim 2024 → jalankan `turunkan_kuartal_diskret.py`. Verifikasi silang sebelum menulis.
5. **T7 + T8** — tampilan. Verifikasi 1920×1080×1, 1536×960×1,25, 412×915×2,625.
6. **P0** probe, laporkan hasilnya, **tunggu K1**.
7. **P1** kalau K1 = (b), lalu ulangi langkah 4 untuk 2023+2022.

**Penjaga yang wajib masuk ke SKRIP di langkah 3–4** (bukan pemeriksaan sekali):

- **Baris konteks dibaca, dua format didukung.** Token (`PriorEndYearInstant` / `PriorYearDuration`) untuk vintage 2023+; **literal tanggal** untuk 2019 & 2022/audit. Penjaga bertoken saja membuang 100% berkas audit lama — dan gagalnya senyap (peta kosong = ruas null, bukan galat).
- **Sheet `15xxxxx` (arus kas) tidak boleh dipercaya tokennya.** Terverifikasi: 2026/tw1 menulis `PriorYearInstant` untuk data durasi. Perlakukan berdasarkan nomor sheet, bukan token.
- **Kolom C neraca → kunci `{tahun−1}-12-31`. Kolom C arus → kunci periode sama tahun sebelumnya.** Satu berkas, dua kunci berbeda, sengaja. Salah pasang menaruh posisi 31 Des di slot 31 Mar dan **terlihat sepenuhnya wajar**.
- **Kolom B selalu menang atas kolom C** untuk tanggal yang sama. Kolom C adalah versi *restated* — berbeda secara sah, dan menimpakannya diam-diam mengubah riwayat yang sudah tayang.
- **Uji silang yang benar-benar bisa gagal:** kolom C berkas tahun N vs kolom B berkas tahun N−1. Cetak yang melewati ambang sebagai **daftar restatement**, bukan galat. Sudah terukur pada sampel: ~2–3% emiten berbeda, sebagian besar wajar.
- **Uji silang kedua:** Q2'26 diskret IDX vs kuartal diskret yfinance untuk TLKM/BBCA/ASII/ICBP — empat emiten yang rasionya sudah diketahui di proyek ini. Inilah alasan `keuangan/` tidak boleh dihapus.
- **`--paksa` hanya per (tahun, periode), tidak pernah global.** Lihat risiko #1.

---

## Risiko yang diterima sadar

**1 · Re-parse global akan menghapus 2.330 catatan tahunan — dan ia terlihat gratis.**
2025/audit **tidak ada** di arsip; 2020 & 2021/audit hanya 2 berkas. JSON punya 882/701/747 catatan untuk ketiganya, berdiri di atas panen lama yang mentahnya sudah dibuang. `simpan()` menimpa per-tanggal. Re-parse `--paksa` atas seluruh direktori menjatuhkan kedalaman tahunan dari 7 tahun ke 4, tanpa satu pun galat — kebalikan persis dari yang diminta, dihasilkan oleh langkah yang dua rancangan jual sebagai "nol risiko". **Mitigasi: per-bucket saja, dan `git`/salinan JSON sebelum menjalankan.**

**2 · `main()` memanggil `ambil_daftar()` sebelum loop dan `return 1` kalau gagal.**
Artinya "re-parse dari arsip" tetap mati kalau IDX menolak, walau seluruh berkasnya di cakram. Butuh mode `--dari-arsip` yang melewati pemanasan dan mengiterasi berkas langsung. Tanpa itu, aturan "simpan mentahnya, parse boleh diulang kapan saja" tidak benar-benar berlaku.

**3 · Q4 tetap keranjang residu audit.** Rencana ini **mendeteksi** (revenue negatif) dan **menyembunyikan**, tidak menyembuhkan. Q4 yang lolos deteksi tetap bisa membawa penyesuaian setahun penuh dan terbaca sebagai kuartal biasa. Tak ada obatnya tanpa TW4 yang IDX tidak terbitkan.

**4 · `eps` ikut dikurangkan sebagai ruas arus.** EPS kumulatif dibagi rata-rata **tertimbang** saham; sesudah rights issue atau split di tengah tahun, TW2eps − TW1eps bukan EPS kuartal mana pun. Belum ditangani. Minimal: jangan turunkan `eps` — hitung ulang dari `net_income` diskret ÷ `ListedShares`.

**5 · 64 emiten gagal parse senyap di 2025/tw1** (850 arsip vs 786 JSON), pola serupa di bucket lain. Belum ada yang menghitungnya sebagai daftar kerja. Selama ini terbuka, label "belum lapor" tidak boleh tayang.

**6 · Pipa harian.** 2.640 permintaan beruntun dari satu IP rumahan bukan 3 kejadian bebas — kalau IDX menahan IP, `sinkron_emiten`/`GetStockSummary` harian ikut mati dan itu terlihat seluruh pengguna. Jadwalkan P1 di luar jam panen harian, beri jeda antar bucket.

---

## Gagasan yang dicangkok dari rancangan yang kalah

| Gagasan | Asal |
|---|---|
| Kolom C sebagai sumber kedalaman gratis | *gali-yang-sudah-ada*, *panen-dalam* |
| Kolom C memangkas jumlah pass panen jadi separuh (panen 2023 → dapat 2022) | *panen-dalam* |
| Kunci tanggal dibaca dari isi berkas, bukan argumen CLI | *gali-yang-sudah-ada* |
| Uji silang kolom C tahun N vs kolom B tahun N−1 sebagai gerbang | *gali-yang-sudah-ada* |
| Status laporan itu sifat **satu berkas** → tempatnya kepala kolom, bukan 15 sel | *nol-kosong-jujur* |
| "Angka yang hilang akan ditanyakan; catatan kaki di bawah angka akan diabaikan" | *nol-kosong-jujur* |
| Annualised diganti angka **auditan**, bukan sekadar disyaratkan lengkap | *panen-dalam*, *satu-sumber-saja* |
| Baris "Laba Usaha" (6,4%) diganti "Laba Sebelum Pajak" | *satu-sumber-saja* |
| `PanelTahunan` dialihkan ke `idx.tahunan` — 4→7 tahun, nol jaringan | *gali-yang-sudah-ada* |
| Δ YoY per kuartal menyelesaikan musiman tanpa panel terpisah | *satu-sumber-saja*, *kebutuhan-analis* |
| Yahoo turun pangkat jadi penguji-silang, tidak dihapus | *panen-dalam* |
| `thead` sticky karena penanda per-kolom hilang saat gulir mendatar | rebuttal *kebutuhan-analis* |
| Uji penutupan tahunan adalah tautologi | rebuttal *panen-dalam* |

---

## Untuk ditempel ke CLAUDE.md

> **Kumulatif vs diskret, dan kolom C — jangan digabung, jangan ditebak.**
>
> Interim IDX (`keuangan_idx/`) **KUMULATIF sejak awal tahun buku**; yfinance (`keuangan/`) **DISKRET**; keduanya berkunci tanggal yang SAMA. Terukur: revenue TLKM 1,96×, ASII 1,99×, ICBP 2,08×. **Dilarang menggabungkan per-ruas dengan aturan "yang tidak null menang"** — hasilnya hampir dua kali lipat, tanpa satu pun galat.
>
> Yang boleh tampil di kolom kuartal hanya **diskret** (`keuangan_idx_diskret/`, `Q1=TW1 · Q2=TW2−TW1 · Q3=TW3−TW2 · Q4=Audit−TW3`, ruas ARUS saja — neraca diambil apa adanya). Kalau pengurangnya tak ada, selnya **`—`**, bukan angka kumulatif berlencana. **Asal ditentukan per KOLOM, bukan per ruas** — satu kolom tak boleh memuat Jan–Jun di sebelah Apr–Jun.
>
> **Q1+Q2+Q3+Q4 = Tahunan adalah IDENTITAS ALJABAR, bukan uji.** Ia lulus 100% untuk operand apa pun, termasuk yang tertukar tahun atau salah skala. Jangan pernah memakainya sebagai penjaga atau dasar cap "terverifikasi". Uji yang benar-benar bisa gagal: kolom C tahun N vs kolom B tahun N−1, dan diskret IDX vs diskret yfinance.
>
> **Kolom C (periode pembanding) bukan satu periode.** Baris ke-4 tiap sheet menyebutkannya, dalam **dua format**: token (`CurrentYearInstant|PriorEndYearInstant`, `CurrentYearDuration|PriorYearDuration`) untuk vintage 2023+, dan **literal tanggal** (`31 December 2019|31 December 2018`) untuk 2019 & 2022/audit — penjaga yang cuma mengenali token membuang seluruh berkas audit lama, senyap. Sheet arus kas `15xxxxx` di interim menulis token yang **salah** (`PriorYearInstant` untuk data durasi) — perlakukan berdasarkan nomor sheet. Kolom C **neraca** → kunci `{tahun−1}-12-31`; kolom C **arus** → periode sama tahun sebelumnya. Salah pasang menaruh posisi 31 Des di slot 31 Mar dan hasilnya terlihat sepenuhnya wajar. **Kolom B selalu menang atas kolom C** (kolom C adalah versi *restated*).
>
> **`--paksa` hanya per (tahun, periode), tidak pernah atas seluruh arsip.** 2025/audit tidak ada di `_arsip-mentah/`, 2020 & 2021 masing-masing 2 berkas — re-parse global menghapus 2.330 catatan tahunan tanpa satu pun galat. Dan `perbaiki_skala_keuangan.py` **wajib jalan sesudah pemeras**; sampai ia tersambung ke pipeline, tiap re-parse mengembalikan bug skala 1e9 yang sudah dibetulkan (commit `d5a21310`, 512 nilai).