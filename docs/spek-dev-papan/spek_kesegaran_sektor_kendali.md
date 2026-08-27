# SAPUAN: KESEGARAN DATA · NAMA SEKTOR · KENDALI TANGGAL & FILTER
**(Fable, 27 Agu 2026)**

> Johan: *"sweep penggunaan data apakah seperti ini semua, harusnya update kan semua page serentak ketika panen otomatis update PAPAN"* · *"tanggal kok dropdown sih,"* · *"dropdown lagi dan select dong harusnya bisa filter nya lebih ampuh lagi kemudian sesuaikan semua nama sektor kalau dasarnya pakai english ya english saja jangan bahasa indonesia coba di sweep"*

Sapuan 7 agen. **Semua klaim penopang di bawah kuverifikasi ulang sendiri ke repo sebelum dikirim.** Satu klaim sapuan terbukti **SALAH** dan kucabut (§2.3); dua temuan yang sapuan lewatkan kutambahkan (§1.1, §1.2).

---

## 1. Kesegaran data — Johan benar mencurigainya

### 1.1 🔴 TEMUAN BARU (tak terlihat oleh sapuan) — hari terbaru adalah ANGKA SEMENTARA, dan hampir semua halaman diam soal itu

Terukur langsung dari berkas, 27 Agu 2026. `data-idx/json/ds_260824.json` — berkas harian **terbaru** — isinya:

```json
{ "date_iso": "2026-08-24", "trading_day": 150,
  "ihsg_value": 6501.67, "sumber": "yahoo", "sementara": true }
```

Tidak ada `sectors`, `world`, `board`, `featured`, `mcap`, `leaders_today`. Ini **bukan kegagalan** — ini placeholder sah yang sengaja dibuat dari Yahoo selagi PDF resmi IDX harinya belum terbit (`dataHarian.ts:129` menjelaskannya). Dari 147 berkas harian, **hanya 1 yang berkondisi begini** — yang terbaru.

**Cacatnya bukan di data, tapi di apa yang halaman katakan tentangnya.**

`Kalender.tsx:502-530` sudah menangani ini dengan jujur: superskrip amber `Y~` plus tooltip

> *"Angka sementara dari Yahoo Finance — bursa mungkin masih buka, jadi ini belum penutupan resmi. Akan tergantikan begitu IDX merilis statistik harinya."*

Tapi `KonteksData.tsx` — komponen "Data per &lt;tanggal&gt;" yang dipakai **7 halaman** (`BrokerSummary`, `IndeksDunia`, `PetaInvestor`, `Radar`, `SektorIndeks`, `TopBroker`, `TopStocks`) — **hanya menerima satu prop, `tanggal: string | null`**. Tidak ada jalur untuk menyampaikan "ini sementara". Jadi halaman menulis *"Data per 24 Agustus 2026"* dengan nada final, padahal angkanya placeholder Yahoo.

**Perbaikan (kecil, pakai ulang yang sudah ada — jangan tulis kalimat baru):** tambah prop `sementara?: boolean` ke `KonteksData`, dan saat `true` render penanda amber + **kalimat yang PERSIS SAMA** dengan `Kalender.tsx:519`. Satu kalimat, satu rumah. Halaman meneruskan `hari.sementara` yang sudah ada di tipe (`dataHarian.ts:25`).

**Kriteria terima**: buka salah satu dari 7 halaman itu pada hari yang `sementara:true` → penanda muncul; pada hari final → tidak muncul. Kalimatnya dibaca dari satu konstanta bersama, bukan disalin.

### 1.2 🟡 TEMUAN BARU — lubang 2 hari bursa

Berkas harian terakhir **24 Agu**; hari ini **27 Agu**. **25 dan 26 Agu tidak ada sama sekali.** Ini bagian konkret dari *"update juga datanya"*. Jalankan parser PDF IDX untuk kedua tanggal itu, dan sekalian bangun ulang 24 Agu supaya `sementara:true` tergantikan angka resmi.

### 1.3 🔴 Angka "2020" ditulis manual di 7 tempat — akan berbohong begitu broker 2016 masuk

Terverifikasi (`brokerEmitenV2.ts:143-149`):

```ts
/** Cakupan yang tervalidasi (ketetapan Johan 26 Agu 2026: "sejak tahun 2020").
 *  2016-2019 juga ada di arsip tapi TIDAK dibuka di sini — batas eksplisit
 *  Johan, menunggu keputusan terpisah. */
const TAHUN_AWAL = 2020        // ← tidak di-export
```

Keputusan itu **sudah turun** (Johan 26 Agu: *"kalau tidak jadi beban besar yaa gpp sampai 2016"*). Tapi angkanya ditulis ulang manual di:

| Berkas:baris | Bentuk |
|---|---|
| `lib/dasbor/brokerEmitenV2.ts:149` | `const TAHUN_AWAL = 2020` (tidak di-export) |
| `lib/dasbor/brokerEmitenV2.ts:197` | pesan galat "Data &lt;kode&gt; sejak 2020 belum lengkap…" |
| `components/dasbor/CatatanCakupan.tsx:15` | string statis, dipakai ~20 halaman |
| `views/dasbor/BrokerSummaryV2.tsx:221` | teks "dibatasi sejak 2020" |
| `views/dasbor/neo-papan/CompareTab.tsx:347` | "arsip tahunan (2020–2026)" |
| `views/dasbor/TraderPapan.tsx:147` | **duplikat manual** — halaman ini sudah memanggil `CatatanCakupan` |
| `views/dasbor/WhalesPapan.tsx:613` | **duplikat manual** — sama alasannya |

**Perbaikan**: `export const TAHUN_AWAL`, interpolasikan di kelimanya, hapus dua duplikat manual.

**Kriteria terima**: grep `"sejak 2020"` di `app/src` menyisakan **satu** string sumber; mengubah `TAHUN_AWAL` di satu tempat mengubah seluruh teks turunan tanpa menyentuh berkas lain.

**Pola yang benar sudah ada di proyek — tiru itu, jangan ciptakan pola ketiga:** `BrokerSummaryV2.tsx:126` menghitung `cakupanDitutup = tanggalTersedia[0] >= '2020-01-01'` **dari data**, jadi bannernya hilang sendiri kalau data ternyata lebih tua. Dan `Seasonality.tsx:175` sudah pindah dari angka patokan ke hitung-dari-data.

### 1.4 🔴 Cache tanpa kedaluwarsa di 10 hook — bug yang SAMA sudah pernah diperbaiki, tapi cuma di 2 tempat

Bug ini sudah terbukti nyata dan sudah ditambal (`UMUR_CACHE_MS` 30 menit) di `screener.ts:144-165` dan `jagoPapan.ts:311-327`. Komentar `screener.ts:147-152` menuliskan gejalanya:

> *"audit 21 Agu 2026 (#4): tab yang dibiarkan terbuka melewati pergantian hari bursa terus menyajikan 962 baris data kemarin."*

Pola identik (`let cache; if (cache) return cache`, tanpa TTL) **masih ada** di:

`kartuRingkas.ts:118` (Beranda) · `sektorIdx.ts:50` (badge papan/PKPU) · `harianPapan.ts:390` (`cacheTanggal` — gejala persis sama seperti bug `screener.ts`) · `valuasiHistoris.ts:164` · `pengendali.ts:64` · `kamusEmiten.ts:41` · `kandidatDeepDive.ts:52` · `kabar.ts:32-33` (2 cache) · `petaInvestorData.ts:48` · `ohlcvKaya.ts:43` (net asing per lilin)

Inilah jawaban langsung untuk *"harusnya update kan semua page serentak ketika panen"* — sekarang tidak serentak: dua halaman menyegarkan diri, sepuluh tidak.

**Perbaikan**: ekstrak `UMUR_CACHE_MS` yang sudah ada jadi util bersama, terapkan ke sepuluh hook.

**Pengecualian sadar**: `neoPapanData.ts:105` sengaja sekali-per-sesi (komentar `:98-103` menjelaskan ongkos 963 fetch). **Jangan diubah tanpa bertanya Johan** — ini keputusan sadar, bukan kelalaian.

### 1.5 🟡 Dua mekanisme "tanggal data" yang tak saling kenal

`KonteksData` (7 halaman) dan `CatatanCakupan` (~20 halaman) berjalan terpisah, tidak saling merujuk. `KonteksData.tsx:18-21` mengakuinya sendiri. Konsolidasi jadi satu mekanisme **di luar cakupan mendesak** — dicatat supaya tidak hilang.

---

## 2. Nama sektor — dan koreksi terhadap sapuanku sendiri

### 2.1 Peta pemakaian

Sudah Indonesia dan **selesai** (via `emiten_sektor.json`): Screener · Rotation Chart · Kartu Analisa · Harian Papan · Stock Detail (jalur utama).

Masih Inggris — **satu akar yang sama**, teks PDF resmi IDX:

| Tempat | Berkas | Sumber |
|---|---|---|
| Sektor & Indeks (`/sector`) — tile heatmap, tabel performa, peta kepemilikan | `SektorIndeks.tsx:34-52,306-346` | `hari.sectors` ← `parse_idx_pdf.py:230-268` |
| Statistik Berkala — tab "Sektor" | `StatistikBerkala.tsx:814-825` | `edisi.sektor` ← `parse_idx_monthly.py:234-249` |
| Beranda — narasi "Sektor penopang: …" | `ringkasHarian.ts:90-177` | `hari.sectors` |
| Tanya Papan — jawaban "X sektor apa?" | `tanyaPapan.ts:280-282` | `fd.sector` (Yahoo/GICS — akar **berbeda**) |

Satu lagi yang murah dan berdiri sendiri: `ActivityTab.tsx:162` — judul `<h2>` masih "Sector Activity"/"Papan Activity" padahal chip di bawahnya sudah "Sektor IDX-IC". Ganti ke "Aktivitas Sektor"/"Aktivitas Papan".

### 2.2 ✅ Kabar baik yang tak diketahui sapuan: ini BUKAN dua taksonomi, ini SATU taksonomi dalam DUA BAHASA

Kuverifikasi isi 147 berkas harian. Nama sektor `hari.sectors` **stabil dan persis 11**, di berkas pertama (7 Jan) maupun tengah (4 Mei):

```
[A] Energy        [B] Basic Materials          [C] Industrials
[D] Consumer Non-Cyclicals                     [E] Consumer Cyclicals
[F] Healthcare    [G] Financials               [H] Properties & Real Estate
[I] Technology    [J] Infrastructures          [K] Transportation & Logistic
```

Itu adalah **nama resmi IDX-IC dalam bahasa Inggris** — taksonomi yang **sama persis** dengan `emiten_sektor.json` (Energi · Barang Baku · Perindustrian · Barang Konsumen Primer · Barang Konsumen Non-Primer · Kesehatan · Keuangan · Properti & Real Estat · Teknologi · Infrastruktur · Transportasi & Logistik). Sebelas lawan sebelas, **padanan 1:1 sejati** — bukan pendekatan.

Artinya menyeragamkan bahasanya **murah dan aman**, tidak mengubah pengelompokan apa pun.

### 2.3 ❌ KOREKSI — resep "JOIN by kode A-K ke `emiten_sektor.json`" TIDAK BISA DIPAKAI

Sapuan mengusulkan memetakan lewat kode huruf A-K ke `emiten_sektor.json`, dan **jujur menandainya sebagai asumsi yang belum dicek**. Kucek: **asumsinya salah.**

Struktur sebenarnya `emiten_sektor.json` — tidak ada kode huruf di mana pun:

```json
{ "sumber": "IDX GetCompanyProfiles (klasifikasi IDX-IC resmi)", "n": 962,
  "emiten": { "AADI": { "nama": "…", "sektor": "Energi",
                        "subsektor": "Minyak, Gas & Batu Bara", … } } }
```

JOIN itu tak punya kunci untuk disambungkan. **Jangan dikerjakan.**

**Yang benar, dan lebih murah**: satu tabel konstanta 11 baris, **berkunci kode huruf** (bukan ejaan nama — kode lebih tahan kalau IDX mengubah ejaan). Kodenya sudah diekstrak di `SektorIndeks.tsx:308`:

```ts
const kode = s.n.match(/^\[(.)\]/)?.[1] ?? ''
```

Taruh tabelnya di **satu modul bersama** supaya keempat pemakai membacanya dari sana. `A→Energi` … `K→Transportasi & Logistik`.

**Wajib ada penjaga**: kalau kode tak ada di tabel, **tampilkan nama aslinya apa adanya** — jangan kosong, jangan tebak. Kegagalan senyap adalah risiko yang sudah nyata di sini: `PETA_SEKTOR_FUNDAMENTAL` (`SektorIndeks.tsx:34-45`) adalah `Record<string,string[]>` tanpa validasi — kalau ejaan PDF berubah, tile diam-diam kehilangan daftar sahamnya tanpa error.

### 2.4 Keputusan yang menunggu Johan

Sudah kusampaikan ke Johan bahwa setelah peralihan Screener→IDX-IC, arah konsistensinya menuju **Bahasa Indonesia**, dan itu wajar untuk situs berbahasa Indonesia dengan klasifikasi resmi bursa Indonesia. §2.3 di atas adalah rencana untuk arah itu. **Jangan dikerjakan sebelum Johan mengonfirmasi** — instruksinya berbunyi *"kalau dasarnya pakai english ya english saja"*, dan dasar yang terpilih justru Indonesia.

`tanyaPapan.ts:280-282` berakar beda (Yahoo/GICS, bukan PDF). Kalau arah Indonesia disetujui, alihkan ke `sektorIdx.ts` menyamai pola `StockDetail.tsx`.

---

## 3. Kendali tanggal & filter — Johan benar, dan HarianPapan satu-satunya penyimpang

### 3.1 Tanggal

| Gaya | Dipakai di | Catatan |
|---|---|---|
| **`Dropdown` daftar teks ISO** | **`HarianPapan.tsx:163-167` — 1 tempat** | ⚠️ **penyimpang tunggal**, inilah yang Johan lihat |
| `DatePicker` (kalender popover) | 10 tempat: BrokerSummary, BrokerSummaryV2, GrafikEmiten, KartuAnalisa, CompareTab, SeasonalityHarian, 4 admin | standar proyek |
| `Kalender` (strip + mode rentang) | 4 tempat: IndeksDunia, SektorIndeks, TopBroker, TopStocks | kalender terlengkap |

Tidak ada `<input type="date">` native tersisa (grep kosong) — `DatePicker.tsx:24-25` menjelaskan alasannya: picker native Chrome selalu putih di mode gelap.

Terverifikasi, kode penyimpangnya:

```tsx
<Dropdown ariaLabel="Tanggal"
  opsi={tanggalData.tanggal_tersedia.map((t) => ({ nilai: t, label: t }))}
  nilai={tanggal ?? ''} onGanti={setTanggal} />
```

`DatePicker` sudah punya persis yang dibutuhkan — prop `tersedia?: ReadonlySet<string>` (`DatePicker.tsx:37`) yang menonaktifkan tanggal tanpa data, plus stepper hari-ber-data `‹ ›` (`:104-107`).

### 3.2 Filter sektor

| Gaya | Dipakai di | Kemampuan |
|---|---|---|
| `Dropdown` **pilih satu** | `HarianPapan.tsx:169-175` | bisa dicari, satu sektor saja |
| `DropdownMulti` | `Screener.tsx:215`, `StalkerTab.tsx:70,307` | bisa dicari, **multi-pilih**, tombol ringkas "N dipilih", chip aktif |

Hanya dua kontrol filter sektor di seluruh aplikasi. `DropdownMulti` lahir 21 Agu; HarianPapan belum diikutkan.

### 3.3 Perbaikan — tukar komponen, nol komponen baru

1. `HarianPapan.tsx:163-167` → `DatePicker` dengan `tersedia={new Set(tanggalData.tanggal_tersedia)}`.
2. `HarianPapan.tsx:169-175` → `DropdownMulti` (state `string` → `string[]`), ikuti pola `sektorOpsi`/`sektorAktif`/chip di `Screener.tsx:106-134,165,249-262`.

**Kriteria terima**: HarianPapan memakai kalender yang sama dengan BrokerSummary; tanggal tanpa data nonaktif; filter sektor bisa &gt;1 sekaligus dengan chip untuk menghapus satu per satu.

---

## 4. Urutan

Langkah 1-6 **siap eksekusi tanpa keputusan Johan**. Tidak ada satu pun yang butuh komponen baru — semuanya tukar-komponen atau tukar-konstanta.

1. **Kendali HarianPapan** (§3.3) — persis yang Johan tunjuk, murah, terisolasi.
2. **Penanda "sementara" di `KonteksData`** (§1.1) — kejujuran data, satu prop, kalimatnya sudah ada.
3. **`TAHUN_AWAL` di-export** (§1.3) — **wajib satu commit dengan pembangunan broker 2016**, jangan terpisah; kalau terpisah, halaman akan berbohong di antara dua commit.
4. **Cache TTL 10 hook** (§1.4) — inti keluhan "update serentak". Tanya Johan soal `neoPapanData.ts:105`.
5. **Judul ActivityTab** (§2.1) — satu baris.
6. **Panen 25-26 Agu + bangun ulang 24 Agu** (§1.2).
7. **Bahasa sektor** (§2.3) — **tunggu konfirmasi Johan**.

Kriteria Terima umum tetap berlaku: uji visual dua viewport + tema terang/gelap, angka dicocokkan ke arsip, keadaan bawaan di-assert saat halaman pertama dibuka.
