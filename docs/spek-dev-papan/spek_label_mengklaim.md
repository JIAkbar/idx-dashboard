# SAPUAN SISTEMATIS: LABEL YANG MENGKLAIM LEBIH DARI YANG DIUKUR
**(Fable, pengawas, 27 Agu 2026)**

> Dipicu karena tiga cacat sejenis hari ini (kategori broker #409, kuadran v1 #411, dan sumbu identitas) semuanya ditemukan **tidak sengaja** — dua dari memverifikasi klaim, satu dari memantau commit. Nol dari mencari. Sapuan 7 agen ini mencari sisanya secara sistematis.

## Yang KUVERIFIKASI SENDIRI sebelum mengirim

Tiga temuan teratas kubuka sendiri ke kode. Ketiganya **terkonfirmasi**:

**#1 — `arus-pasar/build.py:723` mencetak ambang risiko yang SUDAH DIBATALKAN.** Ini bukan soal penamaan, ini **teks yang salah secara faktual di terbitan PDF**.

Yang tercetak: `Pemetaan risiko: >=80 Menengah · 55-79 Tinggi · <55 Ekstrem`

Yang benar-benar dipakai `tingkat_risiko()` (`build.py:124-137`): `>=70 RENDAH · >=63 MENENGAH · >=56 TINGGI · >=49 SANGAT TINGGI · <49 EKSTREM`

Docstring fungsinya sendiri menjelaskan kenapa ambang lama dibuang — *"skor nyata edisi harian bergerak 46-71 dengan median 63, sehingga tak ada satu pun emiten yang pernah keluar dari TINGGI/EKSTREM dan labelnya berhenti membedakan apa pun"* — dan mengutip Johan 18 Agu. Jadi kodenya sudah diperbaiki, **teksnya tidak ikut**. Pembaca yang memakai rumus tercetak itu akan salah menafsir setiap badge risiko di seluruh edisi.

Perbaikan yang benar bukan menyunting kalimatnya, tapi **membangkitkan teksnya dari konstanta yang sama** yang dipakai `tingkat_risiko()`, supaya tidak bisa berpisah lagi. **Prioritas tertinggi.**

**#2 — `brokerEmitenV2.ts:115,124-125` = sumbu KEEMPAT.** `LabelKuadran` berisi `Akumulasi Cerdas`, `Beli Agresif`, `Jual Panik`, `Distribusi`, lahir dari `netNilai >= 0` dan `deltaVwapPct < 0`. Dirender berwarna di `broker-summary-v2/Quadrant.tsx:30,32`.

Yang diukur: beli/jual × di atas/bawah VWAP. Yang diklaim: **kepintaran dan emosi**. Aku memeriksa kuadran v1 tadi dan melewatkan v2 — kesalahanku.

**#5 — `chartAnalitik.ts:102-109` memberi vonis arah pasar tanpa gerbang apa pun.** `BIAS_RELASI` memetakan kelas CPR ke `Bullish kuat`, `Bearish kuat`, `Volatilitas naik, potensi reversal`. Itu klaim prediktif telanjang, tampil di semua tier, tanpa BadgeRapor. Aturan proyek melarangnya.

Sisa temuan di bawah **belum kuverifikasi satu per satu** — dikirim apa adanya dari sapuan berikut vonis penyanggahnya. Perlakukan sebagai kuat-tapi-belum-final, dan buktikan sendiri sebelum menyunting.

## Batas yang jujur

Laporan ini mengakui sendiri di bagian akhir: **nol verifikasi visual** (semua kesimpulan "ada keterangan" berasal dari membaca JSX dan prop `title`, bukan dari membuka halaman), dan `tanyaPapan.ts` (72 KB narasi chatbot) **hanya di-grep, tidak dibaca** — padahal berkas naratif justru yang paling mungkin melahirkan klaim niat baru dan paling tidak cocok dengan grep.

Dua lubang itu bagian dari pekerjaan, bukan catatan kaki. Prop `title` khususnya: keterangan yang hanya hidup di hover **mati di layar sentuh**, jadi "ada keterangan" versi baca-kode belum tentu "ada keterangan" versi pemakai ponsel.

---

# Laporan Audit Label PAPAN
### Kompilasi 5 agen, sesudah tahap sanggahan
**27 Agustus 2026 · 21 temuan mentah → 15 bertahan, 2 gugur, 4 ditahan (kode mati)**

---

## 1. Temuan yang BERTAHAN sesudah sanggahan

Diurut dari yang paling merugikan pembaca. Semua baris di tabel ini **TERVERIFIKASI** (kode dibaca, lokasi render dilacak sampai komponen induk).

| # | Lokasi | Label yang tampil | Kelas cacat | Sampai pemakai? | Usul pengganti |
|---|---|---|---|---|---|
| 1 | `arus-pasar/build.py:722-723` (teks) vs `build.py:124-137` (fungsi) | "Pemetaan risiko: >=80 Menengah · 55 sampai 79 Tinggi · <55 Ekstrem" | tanpa-keterangan (keterangan **aktif salah**, bukan sekadar hilang) | Ya, tercetak di 3 halaman PDF harian (`:581`, `:711`, `:1003`) | Bangkitkan teksnya dari konstanta `tingkat_risiko()` supaya tidak bisa desync lagi. Isi nyata: >=70 Rendah, 63-69 Menengah, 56-62 Tinggi, 49-55 Sangat Tinggi, <49 Ekstrem |
| 2 | `broker-summary-v2/Quadrant.tsx:29-34,92-98,184-187` (asal: `lib/dasbor/brokerEmitenV2.ts:115-126`) | "Akumulasi Cerdas" / "Jual Panik" | klaim-niat (kepintaran + emosi) | Ya, tab aktif: overlay canvas, tooltip, legenda | "Beli di Bawah VWAP" / "Beli di Atas VWAP" / "Jual di Bawah VWAP" / "Jual di Atas VWAP". Dua sumbu yang benar benar diukur, nol klaim niat |
| 3 | `lib/dasbor/kelompokBroker.ts:22`, dirender `broker-summary-v2/Overview.tsx:80-84` (legenda) dan `:213-225` (panel) | "Smart Money" | klaim-niat **+** tanpa-keterangan (dua cacat, satu akar) | Ya, legenda tampil permanen di atas panel Broker Summary | "Institusi Lokal". Keterangan `KETERANGAN_KELOMPOK` wajib ikut di legenda (kini hanya dipakai di `brokerEmitenV2.ts:282`, panel lain yang jauh) |
| 4 | `lib/dasbor/presetScreener.ts:68,243-246`, sel `Screener.tsx:464` | "Tiga broker teratas mendominasi (konsentrasi >=60)" | skala-tanpa-arti | Ya, tab Preset Whale | Sel hanya glyph ✓/✗/– tanpa `title`, angka mentah **tidak pernah tampil**. Tampilkan `top3_pct` mentah + catat di footer bahwa basisnya milik sumber dan bisa melewati 100 |
| 5 | `components/dasbor/PanelAnalitikChart.tsx:152-157` (asal `lib/dasbor/chartAnalitik.ts:102-109`) | "Bullish kuat" / "Bearish kuat" / "potensi reversal" | klaim-niat (vonis arah pasar) | Ya, semua tier, **tanpa gerbang backtest** | Kunci `relasi.bias` di belakang `runRelasi` (pola BadgeRapor), atau ganti jadi deskripsi struktural: "CPR bergeser naik dari sesi lalu" |
| 6 | `arus-pasar/build.py:453-461` (sumber `prob.py:240-257`) | "VolVal **AKUM. SENYAP**" | klaim-niat | Ya, strip Probabilitas Historis tiap halaman emiten PDF | "NILAI TINGGI, HARGA DATAR" + definisi ambang (z>=2.0, |Δharga|<=1%) di dekat label |
| 7 | `arus-pasar/build_weekly.py:150,165` | Badge RENDAH sampai EKSTREM | tanpa-keterangan (nol metodologi di seluruh berkas) | Ya, halaman Ringkasan Mingguan | Satu baris catatan kaki berisi 5 ambang, atau rujuk ke edisi harian sesudah baris #1 diperbaiki |
| 8 | `lib/dasbor/kuliPapan.ts:90-114`, dirender `KuliPapan.tsx:360` | "UNDERVALUED" / "FAIR" / "OVERVALUED" | skala-tanpa-arti (±10%) | Ya, tab PBV Band | Ambangnya sudah tertulis di komentar kode. Pindahkan saja ke layar, satu kata "±10%" di dekat label Status |
| 9 | `stock-detail/PanelValuasiInteraktif.tsx:12-24`, render `:154,162,232` | "Undervalued" / "Overvalued" / "Wajar" | skala-tanpa-arti (±20%) | Ya, 3 kali di panel Analisis Valuasi | Ikuti standar yang panel bertetangga sudah pakai (`PanelValuasiHistoris.tsx:110` menulis basis ambangnya sendiri): "±20% dari estimasi" |
| 10 | `stock-detail/PanelValuasiInteraktif.tsx:30-54`, render `:206-212` | "▼ Murah" / "▲ Mahal" / "≈ Wajar" | skala-tanpa-arti (±5%) | Ya, 5 baris tabel Relative Valuation | Sebut pita ±5% di keterangan tabel |
| 11 | `broker-summary-v2/Overview.tsx:17-24`, render `:132,142` | "Small / Normal / Big Acc/Dist" | skala-tanpa-arti (6 / 15 / 20%) | Ya, tiap baris Top 1-5 dan Average | `title` pada chip: "Neutral <6% · Small 6-15% · Normal 15-20% · Big >=20%" |
| 12 | `lib/dasbor/akumulasi.ts:139-153`, render `Watchlist.tsx:518-524` | "Akumulasi" / "Distribusi" / "Akumulasi diam" | tanpa-keterangan **(SEBAGIAN)** | Ya, tapi keterangannya hanya di `title` (mati di layar sentuh) | `ARTI_VONIS` sudah lengkap dan jujur. Duplikasi jadi footer tabel yang selalu terlihat, jangan andalkan hover |
| 13 | `lib/dasbor/kartuAnalisa.ts:352-356`, render `KartuAnalisa.tsx:257-261` | "lebih trending / lebih sideways daripada mayoritas pasar" | ambang-median **(SEBAGIAN)** | Ya, blok Karakter Emiten tab Lengkap | Ringan karena angka persentil selalu dicetak berdampingan. Cukup tambah catatan bahwa 50 adalah median populasi, atau buang vonis binernya |
| 14 | `lib/dasbor/posisiBroker.ts:76-79`, render `neo-papan/InventoryTab.tsx:546,560` | "RE-AKUM" / "MELEPAS" (kolom Tren 10H) | tanpa-keterangan | Ya, tabel Posisi 6 Bulan | `title` pada header: RE-AKUM = status DIST tapi 10 hari terakhir net positif; MELEPAS = kebalikannya |

**Koreksi sitasi yang perlu dicatat:** temuan #5 dalam laporan agen mengutip komentar "JANGAN mengarang angka" di `chartAnalitik.ts:63-65`. Lokasi sebenarnya `PanelAnalitikChart.tsx:65` (fungsi `cariRun`). Substansinya tetap berdiri: aturan itu memang hanya menggerbang BadgeRapor, tidak menggerbang teks bias.

---

## 2. Yang GUGUR dan yang DITAHAN

### 2a. Gugur, jangan diperiksa ulang

| Temuan | Alasan gugur |
|---|---|
| "Menampung" / "Melepas" (`lib/dasbor/traderPapan.ts:97-101,217-223`, render `TraderPapan.tsx:186-188`) | Kebalikan dari cacat. Istilah internal memang memakai "akumulasi/distribusi", tapi `TEKS_STATUS` **sengaja** memetakannya ke kata netral sebelum tampil, dan blok "Cara membacanya" (`TraderPapan.tsx:226-233`) menjelaskan basis rata rata beli supaya tidak disalahartikan sebagai P&L posisi. Ini pola yang benar, bukan yang salah |
| Vonis ER "trending/sideways" versi ringkas (`KartuAnalisa.tsx:456-457`) | Duplikat dari baris #13 di atas, dan di titik ini kode hanya mencetak angka persentil tanpa kata sifat sama sekali. Tidak ada cacat berdiri sendiri |

### 2b. Ditahan: nyata di kode, belum sampai pemakai

Empat temuan ini tidak masuk tahap sanggahan karena **tidak dirender di mana pun saat audit**. Bukan berarti aman: semuanya sudah punya label siap pakai, tinggal satu commit untuk menyalakannya. Status: **TERVERIFIKASI sebagai kode mati**, **DUGAAN** soal dampaknya kalau kelak diaktifkan.

| Lokasi | Isi | Kenapa ditahan, bukan digugurkan |
|---|---|---|
| `lib/dasbor/presetScreener.ts:126-130` | Kriteria "order-kecil" preset `scalping` memakai persentil-25 populasi hari itu | `Screener.tsx` memfilter `PRESET.filter(p => p.id.startsWith('whale-'))` sebelum render, jadi `scalping`/`swing` tak pernah sampai komponen. Menurut konstruksi kriteria ini selalu meloloskan ~25% emiten, apa pun kondisi pasar |
| `lib/dasbor/kelompokBroker.ts:24` | Label "Afiliasi grup / bandar" | `KURASI['afiliasi']` kosong. Keterangannya sendiri (`:35`) hanya menyebut struktur korporasi, kata "bandar" tidak muncul di situ. Ganti ke "Afiliasi Grup Emiten" sebelum ada broker pertama masuk |
| `lib/dasbor/kategoriBroker.ts:73-80` | `LABEL_GAYA`: Akumulasi / Distribusi / Scalper / dst | Field `gaya` dikirim di `kategori_broker.json` tapi grep seluruh `app/src` menemukan pemakaian hanya di berkas itu sendiri dan test-nya. Tidak ada `KETERANGAN_GAYA` (bandingkan `KETERANGAN_KATEGORI` yang ada) |
| `scripts/bangun_kategori_broker.py:168-197` | Ambang `median_dir` dan `median_kons` dihitung ulang dari populasi broker jendela itu sendiri | Sumber dari `LABEL_GAYA` di atas. Ini persis pola median-diri yang sudah dibatalkan untuk field `kategori` 27 Agu, tapi field `gaya` di skrip yang sama tidak ikut direvisi |

---

## 3. Pola

**Menyebar, tidak terpusat.** Cacat hidup di tiga wilayah yang tidak saling kenal: komponen React v2 dan neo-papan, panel stock-detail dan kalkulator, serta generator PDF Python di `arus-pasar/`. Tidak ada satu berkas yang kalau diperbaiki menutup semuanya.

Tapi ada **tiga pola berulang**, dan dua di antaranya bisa ditutup sekaligus.

**Pola A: perbaikan tidak menjalar ke berkas sejenis.** `kategoriBroker.ts:5-11,49-61` sudah membatalkan istilah "Smart Money" dengan alasan tertulis lengkap. Revisi itu tidak menjalar ke `kelompokBroker.ts:22` (nama identik, sumbu berbeda), tidak ke `brokerEmitenV2.ts:115-126` ("Akumulasi Cerdas"), dan tidak ke `bangun_kategori_broker.py:186-195` (field `gaya` di skrip yang sama dengan field `kategori` yang sudah diperbaiki). Ini persis pelajaran "fix instance bukan sistemik" yang sudah tercatat sebagai memory proyek ini sendiri.

**Pola B: ambang hidup hanya di kode.** Angka 60, 6/15/20, ±20, ±5, ±10, z>=2.0, 70/63/56/49 semuanya menentukan kata yang dibaca pemakai, dan tidak satu pun punya rumah tunggal. Akibat terburuknya sudah kejadian di baris #1: teks metodologi ditulis tangan, fungsinya direvisi 18 Agustus, teksnya tidak ikut, dan sekarang PDF mencetak definisi yang salah.

**Pola C: keterangan lewat `title`.** `Watchlist.tsx:521-523` punya `ARTI_VONIS` yang bagus tapi hanya nyampai lewat hover, mati total di ponsel. Proyek ini sendiri sudah menetapkan standar yang lebih baik di tempat lain (`KETERANGAN_KATEGORI` sebagai paragraf tetap, catatan SSS Score sebagai footer tabel).

### Satu perbaikan struktural yang menutup banyak

Bukan komponen baru yang besar. Cukup dua hal kecil:

1. **Satu kamus, satu aturan.** Setiap `LABEL_*` wajib punya pasangan `KETERANGAN_*` dengan kunci yang sama persis, plus satu uji kecil yang gagal kalau ada kunci tanpa pasangan. Pola `KETERANGAN_KATEGORI` sudah ada dan sudah terbukti bagus, tinggal dijadikan kewajiban. Ini menutup baris #3, #11, #12, #14 dan mencegah 2b bagian `LABEL_GAYA` lahir cacat.

2. **Teks metodologi dibangkitkan dari konstanta, bukan ditulis tangan.** Berlaku untuk `build.py:722-723` dan `build_weekly.py`. Sesudah itu, ambang tidak bisa berubah tanpa teksnya ikut berubah. Ini menutup baris #1 dan #7 secara permanen, bukan sekali perbaikan.

Sisanya (baris #2, #4, #5, #6, #8, #9, #10) adalah keputusan kata per kasus yang memang harus dibaca satu satu. Tidak ada jalan pintas untuk itu, dan tidak perlu ada.

---

## 4. Urutan kerja

**Langkah 1. Hentikan keterangan yang aktif salah** (baris #1)
Bangkitkan string metodologi `build.py:722-723` dari konstanta di `tingkat_risiko()` (`build.py:124-137`).
*Kriteria terima:* ubah satu angka ambang di `tingkat_risiko()`, jalankan build, teks di PDF ikut berubah tanpa mengedit baris teks. PDF edisi terbaru menyebut 5 tingkat dan angka 70/63/56/49.

**Langkah 2. Cabut klaim niat** (baris #2, #3, #5, #6, dan `kelompokBroker.ts:24` dari 2b)
*Kriteria terima:* `grep -rE "Smart Money|Akumulasi Cerdas|Jual Panik|AKUM\. SENYAP|bandar" app/src arus-pasar` mengembalikan 0 baris pada string yang dirender. Sisa kemunculan hanya boleh di komentar sejarah, seperti yang sudah dilakukan `kategoriBroker.ts:49-61`.

**Langkah 3. Kamus wajib berpasangan** (baris #3, #11, #12, #14)
Tambahkan `KETERANGAN_*` untuk tiap `LABEL_*` yang belum punya, plus satu uji.
*Kriteria terima:* uji baru gagal kalau satu kunci `LABEL_*` dihapus dari `KETERANGAN_*` pasangannya. Jalankan sekali dengan sengaja untuk membuktikan ujinya berfungsi, bukan sekadar hijau.

**Langkah 4. Tampilkan ambang** (baris #4, #8, #9, #10, #11)
Angka ambang muncul di layar, bukan hanya di komentar kode. Untuk baris #4 khususnya: tampilkan `top3_pct` mentah, karena saat ini sel hanya glyph tanpa angka apa pun.
*Kriteria terima:* verifikasi tiga ukuran layar sesuai aturan proyek (1920x1080x1, 1536x960x1.25, 412x915x2.625 mobile). Uji khusus untuk baris #12: pada tab ponsel, keterangan Akum/Dist terbaca **tanpa** hover.

**Langkah 5. Pagari kode mati** (semua 2b)
Sebelum `gaya` / `LABEL_GAYA` / preset `scalping` / kelompok `afiliasi` dinyalakan, ambang median-diri di `bangun_kategori_broker.py:168-169` diganti ambang tetap dan namanya direvisi.
*Kriteria terima:* satu komentar `ponytail:` atau catatan setara di tiap titik, menyebut apa yang harus beres dulu. Kalau ada yang menyalakan tanpa membacanya, itu bukan lagi kelalaian yang tak terlihat.

Langkah 1 dan 2 tidak saling menunggu, boleh paralel. Langkah 3 sebaiknya sesudah 2, supaya tidak menulis keterangan untuk nama yang akan diganti.

---

## 5. Yang belum diperiksa

Digabung jujur dari batas yang diakui kelima agen. Semua di bawah ini **belum diverifikasi**, bukan "diverifikasi bersih".

**Tidak ada agen yang membacanya sama sekali.** Berkas berikut tidak muncul di daftar cakupan agen mana pun: `StatistikBerkala.tsx`, `IpoAnalysis.tsx`, `PetaInvestor.tsx` dan subfolder `peta-investor/`, `Forum.tsx`, `ForumRuang.tsx`, `Feedback.tsx`, `ChartIndeks.tsx`, `SeasonalityHarian.tsx`, `SeasonalityKomparasi.tsx`, subfolder `kalkulator/`. Ini lubang cakupan yang nyata, bukan wilayah yang sengaja dikecualikan.

**Dibaca sebagian saja.** `GrafikEmiten.tsx` (4303 baris): bagian 600-1700 (render candle dan indikator), 1700-2340 (katalog indikator), dan 2400-2800 (porsi tengah pipeline pola) tidak ditelusuri baris demi baris, hanya lolos grep kata kunci. `build_bedah.py` (1044 baris) dan `prob.py` (569 baris) sama, hanya bagian yang cocok grep.

**Digrep, tidak dibaca.** Wilayah `lib/dasbor/` berisi sekitar 90 berkas non-test dan diperiksa dengan strategi grep bertarget, bukan baca penuh. Yang paling berisiko dari sisa ini: **`tanyaPapan.ts` (72 KB, narasi jawaban chatbot)**. Isinya generatif dan naratif, justru kelas berkas yang paling mungkin melahirkan klaim niat baru, dan itu yang paling tidak cocok dengan metode grep. Berikutnya: `pengetahuan.ts`, `teksTanya.ts`, `bulletin.ts`, `kabar.ts`, `diaryPasar.ts`, `harianPapan.ts`, `polaKlasik.ts` (32 KB, hanya `StatusPolaKlasik` yang dicek), `grafikEmiten.ts` (117 KB, hanya `TemuanMusiman` dan `LABEL_POLA_KLASIK`), `statistikBerkala.ts`, `breadth.ts`, `sektorIdx.ts`, `fundamentalGabungan.ts`, `rasioTambahanKeystats.ts`, `petaInvestorData.ts`, `footprintHarian.ts`, `intradayWhales.ts`, `katalogIndikator.ts`.

**Pipeline Python.** Sekitar 62 dari 80 berkas `scripts/*.py` tidak dibuka, disaring lewat grep median/quantile/percentile saja. `scripts/riset/screener.py` tidak diperiksa. Angka mentah yang dipakai UI (skor komposit Bulletin, SSS D/W/M, skor BT Papan) **tidak diverifikasi kebenarannya**, yang diverifikasi hanya apakah render sisi klien mencantumkan keterangan.

**Nol verifikasi visual.** Tidak ada satu pun agen yang membuka browser. Semua kesimpulan "ada keterangan" berasal dari membaca JSX dan prop `title`, bukan dari render nyata. Konsekuensinya: klaim bahwa suatu `title` cukup atau tidak cukup **belum diuji di perangkat**, dan kemungkinan ada teks yang disuntik CSS `::before/::after` yang lolos dari grep `.tsx` (hanya `.bs2-legenda` yang dicek khusus).

**Dua hal lain.** Riwayat git tidak dicek, jadi tidak dipastikan apakah sebagian temuan ini pernah dibahas dan diputuskan Johan di luar CLAUDE.md. Dan audit ini adalah snapshot hari ini: ada kemungkinan sesi paralel sedang menyentuh `kelompokBroker.ts` atau berkas lain bersamaan dengan pembacaan agen.

---

## 6. Eksekusi B44 (28 Agu 2026) — sisa 12 temuan + 2 lubang

Baris #1, #2, #5 (build.py risk mapping, Quadrant.tsx sumbu kuadran,
chartAnalitik.ts BIAS_RELASI) sudah diverifikasi terpasang sebelum sesi ini
mulai — tidak diulang. Baris #3 (kata "Smart Money") **tidak disentuh** —
larangan eksplisit orkestrator, menunggu keputusan Johan.

| # tabel §1 | Verifikasi | Tindakan |
|---|---|---|
| 3 (afiliasi) | `kelompokBroker.ts:24` masih string dirender di legenda/panel, kata "bandar" masih ada | Diperbaiki: `'Afiliasi grup / bandar'` → `'Afiliasi Grup Emiten'`; test disamakan |
| 3 (Smart Money) | idem, kata "Smart Money" masih axis identitas legenda | **Tidak disentuh** — larangan keras orkestrator |
| 4 | `presetScreener.ts:245` ambang 60 sudah tercetak di label; sel `Screener.tsx:487` cuma glyph, `top3_pct` mentah memang tak pernah tampil | Diperbaiki: sel kriteria "Terkonsentrasi" mencetak `top3_pct` mentah di sebelah glyph; footer tabel menyebut basisnya milik sumber |
| 6 | `build.py:485` masih `AKUM. SENYAP` tanpa ambang tercetak | Diperbaiki: teks jadi "NILAI TINGGI, HARGA DATAR" + `(z≥VV_Z, |Δharga|≤VV_PCT%)` dari `prob.py` (tak ditulis tangan). Suffix "senyap X% n40" ganti "sinyal serupa naik X% n40" |
| 7 | `build_weekly.py` benar tak punya metodologi risiko sendiri (`halaman_ringkasan` tak diimpor) | Diperbaiki: impor `teks_pemetaan_risiko` dari `build.py`, footnote satu baris di halaman terakhir Ringkasan Mingguan (sebelum `halaman_peringkat`, sesuai urutan §4 Langkah 3) |
| 8 | `KuliPapan.tsx:385` status PBV tanpa ambang tercetak | Diperbaiki: `(±10% dari harga wajar)` dicetak di sebelah status |
| 9 | Lokasi sebenarnya `app/src/views/dasbor/stock-detail/PanelValuasiInteraktif.tsx` (path di laporan hilang segmen `dasbor/`) — `MosBadge` tanpa ambang tercetak di 3 pemakaian | Diperbaiki: label MosBadge sendiri sekarang mencetak `(>20%)`/`(<-20%)`/`(±20%)` — otomatis ikut di ketiga pemakaian |
| 10 | Tabel Relative Valuation tanpa keterangan ambang ±5% di mana pun | Diperbaiki: footnote `±5%` di bawah tabel |
| 11 | `Overview.tsx` legenda Small/Normal/Big cuma title | Diperbaiki: `title` tetap + footnote tercetak di bawah tabel Top1-5/Average (jalur sentuh, lubang #1) |
| 12 | `Watchlist.tsx:526` `ARTI_VONIS` cuma di `title` | Diperbaiki: footnote 4-kalimat tercetak di bawah tabel (jalur sentuh, lubang #1); `title` dipertahankan untuk hover desktop |
| 13 | `kartuAnalisa.ts:352` vonis trending/sideways tanpa penjelasan basis 50 | Diperbaiki: tambah klausa "(median populasi ini = persentil 50)" |
| 14 | `InventoryTab.tsx:616` RE-AKUM/MELEPAS tanpa keterangan di mana pun | Diperbaiki: `title` pada header + footnote tercetak di bawah tabel (jalur sentuh, lubang #1) |

**Gugur saat verifikasi:** nol — seluruh 11 baris tabel §1 (di luar #1/#2/#3/#5) lolos ketiga syarat (masih ada, benar dirender ke pengguna, klaimnya memang tak berdasar/ambangnya tak tercetak). Satu koreksi lokasi: baris #9/#10 di laporan menulis `app/src/views/stock-detail/...` — path sebenarnya `app/src/views/dasbor/stock-detail/...` (segmen `dasbor/` hilang dari kutipan asli, filenya sama).

### 6a. Lubang #1 — sapuan `title=` (jalur mati di layar sentuh)

Disapu `title=` di seluruh `app/src/views` + `app/src/components` yang memuat kata klaim kategori/penilaian (akumulasi, distribusi, smart money, cerdas, panik, bandar, trending, sideways, undervalued, overvalued, bullish, bearish, senyap, re-akum, melepas) plus pola ambang (`%`, `≥`, `median`, `persentil`, `ambang`, `kuartil`). Bukan sapuan buta — tiap match ditriase: kalau klaim intinya SUDAH terbaca tanpa hover (glyph/kata kunci sendiri sudah mencetak ambangnya), dibiarkan; kalau klaim inti hanya hidup di `title`, ditambahkan jalur cetak.

**Diperbaiki (jalur sentuh ditambahkan):**
- `Overview.tsx` (BSV2) — legenda Small/Normal/Big Acc/Dist (baris #11 di atas)
- `Watchlist.tsx` — `ARTI_VONIS` Akumulasi/Distribusi (baris #12)
- `InventoryTab.tsx` — RE-AKUM/MELEPAS (baris #14)
- `KartuAnalisa.tsx:700` — badge "likuiditas tipis" per baris kini mencetak `< Rp500jt/hari` di teks (dulu cuma di `title`); badge "riwayat < 250 lilin" di baris sebelahnya sudah lebih dulu benar (ambang di teks, cuma jumlah-lilin-persis yang di `title`)
- `neo-papan/CompareTab.tsx:262` — glyph `≫` (basis kiri terlalu kecil untuk dipersenkan) TIDAK bermakna apa pun tanpa hover; sekarang mencetak `≫ basis kecil`, `title` tetap menyimpan angka ambang persis
- `Bulletin.tsx` — badge kolom VolVal (web bulletin, BUKAN PDF `arus-pasar/build.py`) memakai kata "senyap"/"akumulasi terselubung" sama seperti baris #6, ditemukan lewat sapuan ini (Pola A: perbaikan #6 tidak menjalar otomatis ke berkas sejenis). Badge & paragraf "CARA BACA" (sudah tercetak, bukan `title`) disamakan ke "nilai tinggi, datar" + ambang z≥2,0/Δ≤1%

**Diperiksa, DIBIARKAN (klaim inti sudah tercetak / bukan klaim kategori):**
- `WhalesPapan.tsx` (Bubble/Footprint/dll.) — title menjelaskan MEKANIKA kontrol interaktif, bukan vonis kategori data
- `neo-papan/RotasiTab.tsx` — toggle filter (kuartil bawah, RS-Ratio<97) itu deskripsi aksi checkbox; kuadran RRG sendiri sudah punya modal "i" tercetak (sweep 27 Agu sebelumnya)
- `neo-papan/CompareTab.tsx:273` — "↺ balik akumulasi/distribusi" sudah kata-kata tercetak, `title` cuma elaborasi kenapa persennya tak dipakai
- `Seasonality.tsx`, `Kalender.tsx` — `title` cuma mengulang angka yang SUDAH tercetak di sel, bukan kategori tersembunyi
- `Bulletin.tsx` header ⓘ lain (Skor komposit, Prob 5h, dll.) — sudah diringkas di paragraf "CARA BACA" tercetak di bawah tabel, `title` di header cuma versi panjangnya
- `Beranda.tsx:104` — label visible "dirakit dari angka, bukan ditulis AI" sudah menyatakan intinya, `title` cuma memperpanjang kalimat yang sama

Catatan jujur: sapuan ini berbasis grep kata kunci, bukan baca baris demi baris seluruh 74 berkas ber-`title`. File yang tak lolos daftar kata kunci di atas (tak mengandung kata klaim eksplisit) tidak diperiksa — sama seperti batas yang diakui §5.

### 6b. Lubang #2 — `tanyaPapan.ts`, audit ditunda

`lib/dasbor/tanyaPapan.ts` (~72 KB, narasi jawaban chatbot Tanya PAPAN) **tidak
dibaca** di sapuan ini. Alasan: `TANYA_PAPAN_AKTIF = false` di `app/src/lib/fitur.ts:11`,
dan `DasborLayout.tsx:110` merender `<TanyaPapan />` hanya kalau sakelar itu
menyala — jadi naskahnya nol paparan pengguna hari ini, tak ada urgensi
memeriksanya di sapuan yang memprioritaskan klaim yang SUDAH sampai layar.

Ini bukan "aman" — 72 KB narasi generatif justru kelas berkas paling mungkin
menyimpan klaim niat baru (§5 sudah mencatat ini). **Audit naskahnya wajib
dijalankan sebelum `TANYA_PAPAN_AKTIF` diubah jadi `true`**, bukan sesudah.

### 6c. Keputusan `LabelKurasi` — rekomendasi, bukan komponen baru

Orkestrator memutuskan **tidak membuat komponen `LabelKurasi` baru**. Pola yang
sudah ada di proyek ini — konstanta `KETERANGAN_*` berpasangan kunci dengan
`LABEL_*` (`KETERANGAN_KATEGORI`, `KETERANGAN_KELOMPOK`, `ARTI_VONIS`) ditambah
modal "i" di halaman yang butuh penjelasan lebih panjang (RotasiTab, dll.) —
sudah menutup kebutuhan yang ingin dijawab `LabelKurasi`: satu sumber teks per
label, dan satu jalur baca yang tak bergantung hover. Komponen baru di titik ini
cuma akan jadi bentuk KETIGA untuk hal yang sudah punya dua bentuk yang
terbukti (persis Pola A di §3 — variasi tanpa penyatuan). Yang masih kurang
bukan komponennya, tapi **kedisiplinan memakai pola yang sudah ada**: tiap
`LABEL_*` baru wajib lahir dengan `KETERANGAN_*` di commit yang sama (usul
Langkah 3 §4, uji satu-kunci-satu-pasangan), dan tiap render tabel/legenda yang
memuat badge kategori wajib mencetak keterangannya di footer — bukan hanya di
`title` — sesuai pola 6a di atas.