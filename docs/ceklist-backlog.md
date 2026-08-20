# Ceklist backlog PAPAN

> ⚠️ **Antrean pindah ke `docs/antrean.md` (20 Agu 2026).** Berkas ini dan
> empat lainnya (`rencana-berjalan.md`, `BACKLOG-SWEEP-VISUAL.md`,
> `RENCANA-REFACTOR-REACT.md`, `backlog-edisi.md`) dulu masing-masing punya
> antrean sendiri — akibatnya "ada backlog?" dijawab salah berkali-kali
> (C3 Screener tercatat "belum" berbulan-bulan karena tak pernah dibaca dari
> sini). **"Ada backlog?" sekarang dijawab dari `docs/antrean.md` saja.**
> Tabel di bawah tetap ada sebagai riwayat audit (17-19 Agu) dan bukti
> "Selesai" — jangan dipakai lagi untuk menjawab status antrean terkini.

Papan status kerja borongan 16 Agustus 2026. Centang = selesai & terverifikasi
(tsc + uji + dua viewport kalau menyentuh tampilan).

Terakhir diperbarui: **19 Agu 2026** (C3 tutup; Grup 1 indikator + VWAP tutup; #130 tak lagi terhalang)
sesudah audit 18 Agu — sesudah audit ulang seluruh baris lawan
kode yang benar-benar berjalan (hasilnya di bagian "Audit ulang 18 Agu 2026" di
bawah). Yang tercentang sampai 16 Agu **sudah live** (48 commit,
`778ec1c2..94958c5a`); yang dicentang 17–18 Agu masih di checkout lokal.

> ⚠️ **Berkas ini pernah berbohong ke dua arah, dan itu yang paling mahal.**
> Audit 18 Agu menemukan **lima baris ☐ yang ternyata sudah jadi** (B2, B4,
> Chart 3, A3, #161) dan **enam baris ☐ yang sebagian besarnya sudah jalan**.
> Sebaliknya ada juga baris **☑ yang barangnya mati** (#123). Aturannya sekarang:
> centang hanya boleh dipasang bersama **bukti di barisnya** — hash commit,
> `berkas:baris`, atau jumlah berkas data — dan bukti itu harus menunjukkan
> barangnya **dipanggil**, bukan cuma ada.

Aturan rilis tetap: `git push` hanya setelah Johan bilang "live", dan yang
menunggu push dihitung dari `origin/main` — bukan dari commit teratas saat sesi
dimulai, yang selalu melebihkan:

```bash
git rev-list --count origin/main..HEAD
```

## 🚦 Urutan kerja — dari paling RINGAN ke paling MAHAL

Disusun 17 Agu 2026 atas permintaan Johan. **Ini urutan eksekusi yang mengikat**;
tabel bertema di bawahnya cuma pengelompokan.

Membacanya: kerjakan dari atas. Tiap baris menyebut apa yang DIBUKANYA, karena
itu yang menentukan urutan — bukan besar-kecilnya saja.

### Ringan (jam-jaman, tak butuh panen data baru)

| ☐ | Urut | Fase | Tugas | Bergantung | Membuka |
|---|---|---|---|---|---|
| ☑ | 1 | **B1** | ~~Sektor IDX-IC resmi~~ — **SELESAI 17 Agu**: `scripts/panen_sektor_idx.py` → 962 emiten, 11 sektor, plus papan pencatatan. Ternyata cukup `GetCompanyProfiles`, BUKAN sheet `1000000` | — | Panen selesai; penyambungan ke layar menyusul |
| ☑ | 2 | **A0** | ~~Satukan `keuangan/` + `fundamental/`~~ — **SELESAI 17 Agu**: `operating_cf` 8,5% → **99,4%**, `eps` 29% → **99,8%**. Sel tertambal ditandai † + asal angkanya | — | `076ec76b`, 278 tes |
| ☐ | 3 | **C6** | Halaman metodologi & glosarium | — | 75 istilah sudah jadi `glosarium.json`, tinggal dipindah ke layar. **BELUM** — `glosarium.json` cuma dibaca `tanyaPapan.ts`; tak ada rute `/metodologi` di `App.tsx` maupun entri di `menu.ts` |
| ☐ | 4 | **C7** | Foreign flow 5D/10D — **SEBAGIAN** | — | **Sudah:** agregasi `ds_*.json` jadi net foreign harian + kumulatif, tab **Flow** di `/broker-summary` (`lib/dasbor/flowNego.ts`, `BrokerSummary.tsx:255`, ada `flowNego.test.ts`), preset 1 Minggu/1 Bulan/3 Bulan/YTD. **Belum:** angkanya level PASAR (`nf_today_idr`), belum ada kolom 5D/10D **per emiten** |
| ☐ | 5 | **C8** | Watchlist **dinamis** | — | **Spek dari Johan 19 Agu 2026**, verbatim: *"watchlist yang dinamis jadi akan update berdasarkan data OHLCV"* + *"dan harga yang dimiliki"*. Artinya bukan sekadar daftar kode tersimpan: tiap baris ikut bergerak mengikuti OHLCV harian, dan pengguna menyimpan **harga miliknya** (harga masuk / rata-rata) sehingga untung-rugi berjalan ikut terhitung. Dua hal yang wajib diputuskan sebelum kode: (a) harga milik itu data PRIBADI — localStorage tak ikut berpindah peranti, Supabase butuh baris per pengguna + RLS; (b) harga milik hasil hitungan rata-rata **tidak wajib jatuh di tick** (`keFraksi()` hanya untuk harga pasar). **BELUM** — nol jejak; "Radar Watchlist" (`menu.ts:139`) halaman lain, jangan tertukar |
| ☐ | 6 | **C4** | Heatmap & market breadth — **SEBAGIAN** | — | **Sudah:** heatmap sektor buatan sendiri (`SektorIndeks.tsx:302`, dari data harian) + widget heatmap TradingView di `/chart`. **Belum:** market breadth — `ringkasHarian.ts` tak menghitung advance/decline sama sekali |

### Sedang (sehari-dua, sebagian butuh hitungan baru)

| ☐ | Urut | Fase | Tugas | Bergantung | Membuka |
|---|---|---|---|---|---|
| ☐ | 7 | **A1** | Rata-rata 5 tahun + ambang verdict valuasi | A0 ✅ | **Kunci kedalaman AI** — tiap angka jadi punya pembanding (riset ASK SPLE). **BELUM** — yang ada cuma ruas mentah `pe_vs_sector_pct` (`stockDetailData.ts:210`); nol rerata historis, nol ambang verdict. Prasyaratnya kini **lebih kuat dari saat baris ini ditulis**: A3 memberi riwayat resmi bursa, bukan cuma 5 tahun yfinance |
| ☑ | ~~8~~ | **B2** | ~~Broker summary harian ke JSON~~ — **SELESAI**: `scripts/fetch_broker_summary.py` menembak `GetBrokerSummary` langsung, **753 berkas** `bs_YYMMDD.json` (2023-06-15 → 2026-08-14), `broker/index.json` diperbarui 17 Agu; dibaca `lib/dasbor/brokerHarian.ts:84`. **Sudah bukan dari PDF** | — | Bukti: 753 berkas + pembacanya hidup |
| ☑ | ~~9~~ | **B4** | ~~Pasar NEGO / Bandar Flow~~ — **SELESAI (level pasar)**: `lib/dasbor/flowNego.ts` + tab **NEGO** & **Flow** (`BrokerSummary.tsx:254-255`), ber-`flowNego.test.ts` | — | Sisa yang belum: pecahan per emiten — dicatat di C7 urut 4, bukan di sini |
| ☐ | 10 | **#173** | Tabel Akses bertingkat (induk–turunan): `probvv` di dalam `bulletin`, `seasonality-hari` di dalam `seasonality` | — | Kunci anak yang induknya tertutup = setelan yang tak pernah berlaku. **BELUM** — nol kata `induk` di `lib/aksesHalaman.ts`, `AksesAdmin.tsx`, maupun `supabase/` |
| ☐ | 10b | **#165** | Thumbnail dibuat saat unggah | — | Gambar 420–520 KB berhenti dipakai di kotak 40 px. **BELUM** — nol `drawImage`/`toBlob` di jalur unggah. Yang sudah ada cuma penundaan: `UnggahHarian.tsx:738` memuat thumbnail **saat terlihat saja**, jadi bandwidth-nya tetap gambar penuh |
| ☐ | 11 | **#171** | Rule engine paham dari satu kata — **SEBAGIAN** | — | **Sudah:** imbuhan Indonesia dilepas sebelum dicocokkan (`pengetahuan.ts:533-534`, `6f8f076d`), kata tunggal didaftarkan sebagai kunci (`94133bdc`). **Belum:** peta sinonim terpusat, toleransi salah ketik (nol jejak Levenshtein), kata tunggal ditawari cabang |
| ☐ | 12 | **#172** | Emiten dijawab analisa + chip saran — **SEBAGIAN** | A1 | **Sudah:** aspek sudah bercabang — `jawabHarga`/`jawabValuasi`/`jawabSektor`/`jawabKinerja`/`jawabPemilik` (`tanyaPapan.ts:200-296`), tautannya ikut aspek. **Belum:** aspek **broker** (tak ada cabang ke Broker Summary), chip saran lanjutan (`interface Jawaban` tak punya ruasnya), dan sambungan kata ganti — komentar `tanyaPapan.ts:378-381` mengakui sendiri `topik` cuma menyimpan JENIS jawaban, bukan kode emitennya |

### Besar (berhari-hari, halaman/mesin baru)

| ☐ | Urut | Fase | Tugas | Bergantung | Membuka |
|---|---|---|---|---|---|
| ☐ | 13 | **C2** | Indikator per emiten — **SEBAGIAN, jauh lebih maju dari yang tertulis dulu**. Spek: `docs/spek-indikator.md` (4 grup) | — | **Sudah:** MA, EMA, RSI, MACD, Bollinger, **OBV**, ATR sebagai instans **berparameter** yang bisa dipasang berkali-kali, plus pola Double Bottom & Lonjakan Volume dan template `localStorage` — `lib/dasbor/grafikEmiten.ts` (1.010 baris), `5bdc09b8` `2aa235ef` `f39fb953` `09bdd051`. **Grup 1 & VWAP SELESAI 19 Agu** — Stochastic, StochRSI, Williams %R, VWAP kini jenis terkurasi sendiri (`katalogIndikator.ts:126` `ID_SUDAH_ADA`), rumusnya dari pustaka, semuanya bervonis `BEKERJA` di `docs/riset/audit-indikator.tsv`. **Prasyarat #130 dengan sendirinya hilang.** **Belum:** Grup 3 **Wyckoff Phase** (nol jejak) · seluruh **Grup 4 Harmonic** (nol jejak). Data OHLCV kini **10 tahun** (`ce0b03e`, median 2.256 baris/emiten), bukan 5 |
| ☑ | ~~14~~ | **Chart 3** | ~~Chart dasar: lilin + volume + zoom~~ — **SELESAI 17 Agu**: rute `/grafik` terdaftar `App.tsx:113`, `GrafikEmiten.tsx` + `3d47eca5`; sesudahnya bertambah jenis chart Lilin/Garis (`57555f33`) dan perbesar/perkecil/muat-semua (`f03be621`) | — | `/chart` TradingView **tetap ada** dan memang halaman lain — jangan dikira ini belum jalan gara-gara itu |
| ☑ | ~~14~~ | **C3** | ~~Screener seluruh emiten~~ — **SELESAI 19 Agu**: tab **Semua** di `/kartu?tab=semua`, 383 emiten, 9 kolom bisa diurut, chip saringan berkalimat kondisi, paginasi 100/25 | C2 (sebagian ✅) + B1 ✅ | `1d58712b` · `kartuRingkas.ts` + `ringkas.json` + `kartuRingkas.test.ts`. `tsc` bersih, **770/770 uji**. Dua ukuran layar: badan `scrollWidth − clientWidth = 0`, tabel 807px menggulung di wadah 394px |
| ☐ | 15 | **A2** | Bedah Emiten — 12 section, satu commit per section | A0 ✅ + A1 | Padanan sple-mf, plus Altman Z & F-Score yang tak mereka punya. **BELUM sebagai halaman.** Jangan tertukar: `arus-pasar/build_bedah.py` + tab admin `BedahTab` itu **edisi terbitan** "Bedah", bukan halaman analisa 12 section |
| ☑ | 16 | **#130** | Divergensi tiga lapis (harga + stochastic + volume) | ~~C2 (Stochastic)~~ ✅ + Chart 3 ✅ | **SELESAI 20 Agu 2026** (`88f7526c`). Pola keempat di menu Pola `/grafik`: `cariDivergensi()` fungsi murni di `grafikEmiten.ts`, %K-nya lewat `stochUntukDivergensi()` → `hitungInstans` jenis `stoch` (satu jalur dengan indikator Stoch di menu). Dua arah, tiga derajat, penanda di seri harga + seri volume, daftar hasil berangka, lima entri panduan. Kalibrasi 916 berkas OHLC / 1,51 juta lilin: **2,83 temuan per 100 lilin** (Double Bottom 2,43). Uji: 806/44 hijau. Papan Pekerjaan di `jejak-permintaan.md` — verifikasi layar masih tertunda |
| ☑ | ~~18~~ | **A3** | ~~Panen laporan keuangan resmi IDX (XLSX ber-XBRL)~~ — **SELESAI 17 Agu**: `scripts/panen_keuangan_idx.py`, `data-idx/json/keuangan_idx/` **943 berkas, nol yang kosong** (`1e4a40be`), lalu disambungkan ke panel Stock Detail (`bde4b97e`) | ~~A2~~ — ternyata tak perlu menunggu A2 | Menutup 313 emiten yang **tak bisa** ditutup lewat yfinance sama sekali |
| ☐ | 17 | **B3** | Pemegang saham pengendali | ~~A3~~ ✅ **penghalangnya sudah hilang** | Menutup celah kepemilikan lewat perusahaan perantara. **BELUM** — nol kata `pengendali` di `scripts/` maupun `app/src`. **Naik dari urut 19**: prasyarat A3 sudah selesai dan mentah XBRL-nya sudah diarsipkan di `_arsip-mentah/`, jadi menambah ruas ini **tak berbiaya jaringan sama sekali** |
| ☐ | 18 | **#166** | Rakit ulang mesin Mingguan & Bulanan — **SEBAGIAN** | — | **Sudah:** Bulanan kini **murni agregat** (sampul, scorecard, statistik, peringkat — nol halaman emiten salinan harian, `build_monthly.py:391-397`); Mingguan dapat halaman **Pola Sepekan** + ringkasan mingguan + strip Progresi Skor (`284f0003`, `39545443`). **Belum:** halaman per-emiten Mingguan **masih memanggil `halaman_emiten()` milik `build.py`** (`build_weekly.py:469`) — itu sumber keluhan "identik dengan edisi harian" |
| ☑ | ~~21~~ **NAIK** | **#170** | **Selesai 18 Agu** (K1/K2/K3/K5/K8/K10 + seluruh temuan audit); K4/K6/K7 menunggu keputusan Johan. Penyeragaman kendali — **spek: `docs/spek-kendali.md`** (10 keluhan verbatim). Tahap: audit → komponen kanonis → terapkan per halaman | — | **Diangkat jadi pekerjaan utama 17 Agu** atas perintah Johan; alasan "sengaja terakhir" dibatalkan |

### Menunggu pembahasan, bukan menunggu giliran

| ☐ | # | Tugas | Yang menghalangi |
|---|---|---|---|
| 🅿️ | #167 | Penyetelan lanjutan lapis Gemini | **DIPARKIR** atas keputusan Johan 17 Agu 2026 — "tetap jadikan backlog sampai saya panggil kmu lagi". Jangan diangkat sendiri ke antrean kerja |
| ☐ | #168 | Cara scraping arsip berita yang benar | Perlu dibahas dulu — jangan menembak `news_id` satu per satu |
| 🅿️ | #129 | Chart bandarmologi | **DIPARKIR** atas keputusan Johan 17 Agu 2026, alasan yang sama. Tetap terhalang data juga: broker per emiten tak ada di endpoint publik mana pun |

> 🅿️ = **diparkir**, bukan antre. Bedanya penting: yang antre boleh naik sendiri
> begitu penghalangnya hilang; yang diparkir **hanya boleh diangkat kalau Johan
> memanggilnya**. Menawarkannya berulang kali sama saja mengabaikan keputusan
> yang sudah diambil.

### Kenapa urutannya begini

- **Enam pertama tak bergantung apa pun** — laju terasa sejak hari pertama, dan
  A0 memperbaiki halaman yang sudah dipakai, bukan menambah halaman baru.
- **A1 naik lebih tinggi dari besarnya** karena riset ASK SPLE membuktikan
  kedalaman jawaban datang dari angka yang punya pembanding, bukan dari model.
- **C2 mendahului C3 dan #130** — screener tanpa kolom indikator cuma tabel
  harga, dan divergensi butuh Stochastic yang lahir di C2.
- **#170 sengaja paling akhir.** Menyeragamkan kendali sebelum halaman barunya
  ada berarti menyeragamkan dua kali.

**Perubahan urutan 18 Agu 2026, dan alasannya.** Nomor urut ditutup rapat
setelah B2, B4, Chart 3 dan A3 dicoret — nomor yang bolong membuat orang
mengira ada baris yang hilang. Satu baris benar-benar **berpindah tempat**:

- **B3 pemegang saham pengendali naik dari 19 ke 17.** Ia diletakkan di bawah
  karena "butuh A3" — dan A3 ternyata sudah selesai sejak 17 Agu. Baris ini
  duduk di antrean tanpa penghalang tanpa ada yang tahu. Ongkosnya juga turun:
  XLSX mentahnya sudah diarsipkan di `_arsip-mentah/`, jadi menambah ruas tak
  menembak jaringan sama sekali (aturan arsip mentah di `CLAUDE.md`).
- **A3 dicoret dari posisi 18 berikut ketergantungannya pada A2.** Urutan
  lamanya ("sesudah A2, supaya datanya punya tempat") terbukti salah arah:
  datanya dipanen duluan dan justru A2 yang sekarang punya bahan.
- **C2 tidak dinaikkan walau ongkos sisanya sekarang paling kecil** — itu
  keputusan Johan (urutan ringan → mahal mengikat), bukan keputusan saya.
  Usulannya ada di catatan audit di bawah; kalau disetujui, C2-sisa pindah ke
  tier Ringan.

## Antrean berikutnya — **halaman & fitur baru dari riset SPLE**

> Jejak permintaan (**apa yang diminta Johan · sebelum · sesudah**) ada di
> `docs/jejak-permintaan.md` — itu yang menjawab "kenapa baris ini ada",
> yang tak terjawab papan centang mana pun.
>
> Rencana kerjanya **sudah tertulis lengkap** di `docs/workflow-fundamental.md`
> (jalur A/B/C), risetnya di `docs/riset/sple/`. Jangan menyusun ulang — tabel
> di bawah cuma papan centangnya.

> ⚠️ **Dua tabel di bawah ini SALINAN LAMA (16 Agu) dan sudah kedaluwarsa.**
> Statusnya tak diperbarui sejak ditulis, dan itu yang membuat B1/A0/B2/B4/A3
> terlihat masih terbuka padahal sudah selesai. **Patokannya tabel "Urutan
> kerja" di atas, bukan yang ini.** Dipertahankan hanya karena kolom "Kenapa
> duluan"/"Bahan"-nya masih menjelaskan asal-usul tiap fase.

**Empat ini dulu — semuanya kecil dan tak bergantung panen apa pun:**

| ☑ | Fase | Tugas | Kenapa duluan |
|---|---|---|---|
| ☑ | **B1** | Sektor IDX-IC resmi (#157) — **selesai** `4b659427`+`b60c5f66` | Dipakai hampir semua halaman lain — screener, bedah, banding sektor |
| ☑ | **A0** | Satukan dua sumber fundamental — **selesai** `076ec76b` | Menambal `operating_cf` kosong **80%** di panel Stock Detail yang **sudah ada**. Murni kode, tanpa panen |
| ☐ | **A1** | Rata-rata 5 tahun + ambang verdict valuasi | Verdict kita **dua sumbu**: riwayat emiten sendiri **dan** median sektornya (`pe_vs_sector_pct` sudah ada). Konflik antar-sumbu wajib disebut |
| ☑ | **B2** | Broker summary harian ke JSON (#159) — **selesai**, 753 berkas `bs_*.json` | 88 broker per tanggal; **sudah tidak lagi** di-parse dari PDF |

**Halaman & fitur BARU:**

| ☐ | Fase | Halaman/fitur baru | Bahan | Syarat |
|---|---|---|---|---|
| ◐ | **C2** | **Indikator per emiten** — sebagian: MA/EMA/RSI/MACD/Bollinger/OBV/ATR sudah jalan; Stochastic, VWAP, StochRSI, Williams %R, Wyckoff, Harmonic belum | OHLCV **10 tahun**; rumus sudah ada di `lib/radar/` + `lib/dasbor/grafikEmiten.ts` | **wajib sebelum C3** |
| ☐ | **C3** | **Screener seluruh emiten — halaman baru** | `fundamental/` 967×147 + `ohlc/` **964** + B1 ✅ | butuh C2, kalau tidak cuma jadi tabel harga |
| ☐ | **A2** | **Bedah Emiten — halaman baru, 12 section** (padanan sple-mf) | Tujuh dari sebelas section bahannya sudah ada; A3 menambah lagi | A0 ✅ + A1 |
| ☐ | **C6** | Halaman metodologi/glosarium di web | 75 istilah sudah jadi `glosarium.json` | — |
| ◐ | **C4** | Heatmap & market breadth — heatmap sektor sudah ada, breadth belum | data harian | — |
| ◐ | **C7** | Foreign flow 5D/10D — level pasar sudah ada, per emiten belum | agregasi `ds_*.json` | — |
| ☐ | **C8** | Watchlist | localStorage | — |
| ☑ | **B4** | Pasar NEGO / Bandar Flow (#152) — **selesai**, tab NEGO & Flow | ruas `GetStockSummary` sudah dipakai lewat `ds_*.json` | — |
| ☑ | **A3** | Panen laporan keuangan resmi IDX (#156) — **selesai** `1e4a40be`, 943 berkas | 777/778 emiten TW2 2026, XLSX ber-XBRL | ~~sesudah A2~~ — ternyata tak perlu menunggu |
| ☐ | **B3** | Pemegang saham pengendali (#158) | laporan resmi IDX (**sudah dipanen & diarsipkan**) | ~~butuh A3~~ ✅ sudah bebas |

**Sisanya:**

| ☐ | # | Tugas | Catatan |
|---|---|---|---|
| ☐ | 172 | **Emiten dijawab analisa + saran pertanyaan** | PENTING. Sekarang `DSSA`, `analisa DSSA`, dan `DSSA diakumulasi broker apa` dijawab kalimat yang sama persis, tautannya selalu Stock Detail. Perlu: jawaban dirakit dari semua sudut, tautan mengikuti aspek yang ditanya, chip saran lanjutan yang diturunkan dari data yang benar-benar ada, dan sambungan kata ganti ("keenam itu") |
| ☐ | 171 | **Rule engine paham dari satu kata** | Peta sinonim terpusat, tahan salah ketik ringan, kata tunggal dijawab ringkas + menawarkan cabang |
| ☐ | 170 | **Penyeragaman kendali** | Tombol kalender, kotak cari, pemilih rentang waktu tak senada: campur `<select>` bawaan, `Dropdown` proyek, `DatePicker`. Menyeragamkan + mencabut duplikat. **Sesudah halaman baru jadi** supaya tak dikerjakan dua kali |
| ☐ | 168 | Cara scraping arsip berita yang benar | Endpoint IPOT mengabaikan `halaman` → mentok ±200 berita/kanal. Menelusuri `news_id` mundur **tidak dilakukan tanpa pembahasan** |
| ☐ | 167 | Lapis Gemini Flash di Tanya PAPAN (C9) | Lapis aturannya sudah jalan. LLM ditunda sampai halaman baru jadi — datanya bertambah, cakupan rule-engine harus lengkap dulu |
| ☐ | 166 | Rakit ulang mesin Mingguan & Bulanan | Mingguan 21 dari 24 halaman identik karakter-per-karakter dengan edisi harian |
| ☐ | 165 | Thumbnail dibuat saat unggah | Gambar penuh 420–520 KB dikecilkan ke 40px di peramban |
| ☐ | 162 | Sebab penolakan MBMA | ~~Bergantung #161~~ — **#161 sudah selesai**, jadi alat diagnosanya sudah ada. Tinggal memakainya |
| ☑ | 161 | ~~Pesan galat unggah masih generik~~ — **SELESAI** `71733906`: galat membawa keterangan server + menandai tahapnya | Seluruh penjaga server sudah diuji satu per satu sebagai akun kontributor di dalam transaksi yang di-rollback |
| ☐ | 154 | Peringatan konteks + tanggal metodologi di tiap halaman analitik | Yang membuat SPLE dipercaya bukan sinyalnya, tapi panduannya |
| ☐ | 151 | Broker per emiten — sumbernya belum ketemu | `GetBrokerSummary` **mengabaikan** `stockCode`, hasilnya selalu level pasar |

**Menunggu keputusan Johan** (tak bisa dikerjakan tanpa jawabannya):

| ☐ | # | Pertanyaan |
|---|---|---|
| ☑ | 145 | **DILEWATI** (Johan, 17 Agu) — istilahnya tak pernah punya rujukan di kode |
| ☑ | 146 | **DIDEFINISIKAN** (Johan, 17 Agu) — harga + stochastic + volume sebagai pengesah. Spesifikasi lengkap di `rencana-berjalan.md`; #130 tinggal menunggu C2 |

## Selesai — gelombang ketiga (16 Agu, siang–malam)

| ☑ | # | Tugas | Catatan |
|---|---|---|---|
| ☑ | — | **Beranda baru** | Halaman utama bukan lagi dasbor: PAPAN + IHSG lilin YTD, ringkasan pasar, terbit terakhir, kabar 4 kolom, kartu menu |
| ☑ | — | **Ringkasan pasar dari aturan** | Ambangnya **dikalibrasi dari 2.409 hari bursa** (`scripts/kalibrasi_ambang.py`), bukan ditebak. Bukan LLM |
| ☑ | — | **Kabar Pasar** (`/kabar`) | 1.028 kabar, 5 sumber. Tab & daftar bulan **diturunkan dari data**, jadi ikut tumbuh/menyusut sendiri |
| ☑ | — | Arsip IPOT | 737 item, 13 Jul–16 Agu. **Temuan: endpoint mengabaikan `halaman`** — YTD tak terjangkau, sisanya jadi #168 |
| ☑ | — | Arsip Stockbit Snips | 238 item setahun lewat `?format=json` Squarespace |
| ☑ | — | CNBC & detikFinance dicabut | CNBC isinya bukan pasar murni; detik timeout berulang. Item lamanya dibuang dari `kabar.json` |
| ☑ | — | Tautan per pengumuman IDX | `attachments[]` yang `IsAttachment:false` = PDF dokumennya. Sebelumnya semua baris menunjuk satu halaman pencarian |
| ☑ | — | **Tanya PAPAN** | Tombol mengambang + panel. Menjawab data harian, lintas waktu, per emiten, KSEI, grup, kalender + 32 entri pengetahuan + **75 istilah glosarium** yang ditambang dari terbitan PAPAN sendiri |
| ☑ | — | Panen otomatis | GitHub Actions tiap 2 jam untuk sumber tanpa batasan IP |
| ☑ | 160 | **Sisa migrasi `'ditolak'` dituntaskan** | 3 objek SQL diperbaiki + 7 berkas klien. Akurasi berhenti selalu 100%: superadmin kini 96% (22/23) |
| ☑ | 163 | Baris yatim INDY | Dihapus atas persetujuan Johan. **Nol baris yatim, nol berkas yatim**, 24 setoran |
| ☑ | — | Keterangan aturan kurasi di superadmin | Panel lipat: apa yang hilang & apa yang tetap ada, diturunkan dari kode + fungsi SQL yang berjalan |
| ☑ | — | Urutan hapus berkas dibalik | Baris dulu, berkas belakangan + periksa hasilnya. **RLS yang menolak DELETE tidak melempar galat** — itu yang dulu melahirkan baris yatim |
| ☑ | — | Batang gulir 2px jadi aturan bawaan | Dulu disalin per komponen, jadi panel baru kebagian batang tebal sistem. Terukur 15px → 1px |
| ☑ | — | `CLAUDE.md` di-track | Dikeluarkan dari `.gitignore` supaya aturannya terbawa ke tiap worktree baru |

## Selesai

| ☑ | # | Tugas | Catatan |
|---|---|---|---|
| ☑ | 139 | Verifikasi sisi kontributor | Diuji dengan akun Pemula di konteks browser terpisah. Tiga cacat ditemukan & diperbaiki |
| ☑ | 144 | Sweep istilah orderbook → broker summary (lapis teks) | 9 berkas. Lapis data (enum DB, path storage, tabel `contoh_orderbook`) menunggu #142 |
| ☑ | 109b | Peta Investor: mode ekspor "Seluruh dataset" | Sudah bersih — menu tinggal dua mode, tak ada fungsi menganggur |
| ☑ | 143 | Jalur transkripsi kalau produksi pindah ke CI | Diputus sebelumnya: tetap manual (opsi A) |
| ☑ | 108 | Panen harga BUKA harian IHSG | `scripts/panen_ihsg.py`; 8.849 hari OHLCV 1990–2026. Lilin harian berhenti jadi aproksimasi |
| ☑ | 124 | Chart IHSG: pemilih rentang + judul | Chip YTD/1T/5T/10T/Semua; riwayat 36 tahun diunduh hanya saat diminta |
| ☑ | 128 | Cocokkan fraksi harga ke dokumen IDX | Fraksi lima jenjang BENAR. **ARB 15% ternyata usang** — diperbaiki jadi simetris |
| ☑ | 127 | PDF bulletin: daftarkan Red Hat | Font ditanam data URI + render menunggu `document.fonts` |
| ☑ | 122 | Panen OHLC harian seluruh emiten — **diperdalam 5 → 10 tahun 18 Agu** (`ce0b03e`) | 962 dari 963 emiten. Median **2.256 baris/emiten** (dari 1.208), 472 emiten kini mulai 2016. Hanya GOTOM gagal (tak ada di Yahoo). `--lewati-cukup` membuat panen yang putus bisa dilanjutkan |
| ☑ | 132 | Chart komparasi Seasonality antar-emiten | Garis per emiten, sumbu dikunci 0–100%, bulan tanpa data digambar putus |
| ☑ | 131b | Seasonality tab 2 — bagian emiten | Pemilih sumber IHSG ↔ satu emiten, memakai OHLC hasil #122 |
| ☑ | 99 | Stock Detail: laporan keuangan kuartalan | Panelnya sudah lengkap (kuartal/tahunan × laba rugi/neraca/arus kas); yang kurang cuma cakupan data — panen seluruh emiten dijalankan |
| ☑ | 107 | Dasbor: badge % + klik ke TradingView | Badge persen dipasang di baris kapitalisasi. Klik-ke-chart ternyata sudah ada di seluruh tabel. **"Bar tembus" dipisah jadi #145** |

## Selesai — gelombang kedua (setelah izin migrasi DB dibuka)

| ☑ | # | Tugas | Catatan |
|---|---|---|---|
| ☑ | 142 | Ganti "Tolak" → "Hapus + notice" | Migrasi mengonversi status `ditolak` → `dihapus` (1 baris), constraint diperbarui, dan seluruh UI ikut: tab, label, tombol, modal, hitungan akurasi |
| ☑ | 137 | Notifikasi hasil kurasi | Tabel `notifikasi` + RLS + trigger `kabari_hasil_kurasi`. Pesan berbentuk apresiasi: pengakuan di depan, keterangan teknis di belakang |
| ☑ | 123 | Badge/notifikasi fitur baru | Satu tabel dengan #137 (`jenis='fitur'`, `untuk=NULL` untuk semua). Lonceng + lencana di kepala admin |
| ☑ | 138 | Pilih emiten masuk produksi | Kolom `setoran.dimuat` (default TRUE), tombol "Di edisi / Di luar edisi" per kartu kurasi, dan `build.py --kecuali=TICKER,…` |

## Masih terhalang

| # | Tugas | Penghalang |
|---|---|---|
| 129 | Chart bandarmologi | **Terhalang data**: broker per emiten tak ada di endpoint publik IDX |
| 130 | Divergensi tiga lapis | Butuh definisi analitik dulu — lihat #146 |

## Temuan #139 — tiga cacat, semuanya diperbaiki

1. **Tautan CTA halaman terkunci berwarna biru bawaan peramban.** Akarnya bukan
   di tombolnya: seluruh token tema (`--amber`, `--bg1`, `--line`, `--r`)
   didefinisikan pada `.lantai`, bukan `:root` (alasannya di lantai.css baris
   606), sedangkan kerangka terkunci dirender langsung di `.dasbor-main`. Di
   luar `.lantai` semua variabel kosong. Diperbaiki dengan membungkus kerangka
   itu `.lantai` — satu pembungkus memperbaiki warna, latar kartu, garis, dan
   radius sekaligus.
2. **`.pgh-kartu` dan `.pgh-lambang` ditulis di CSS tapi tak pernah dipakai
   JSX.** Kartu ajakan karena itu tak punya badan: gembok telanjang dan teks
   mengambang di atas blur — persis yang dihindari komentar CSS-nya sendiri.
3. **Radar tak menampilkan jarak setoran**, sedangkan tab Seasonality
   menampilkannya. Logikanya diangkat ke `lib/jarakJenjang.ts` +
   `PenunjukJarak.tsx` supaya satu sumber, lalu dipasang di kedua tempat.

## Temuan #128 — ARB yang sudah kedaluwarsa

`BATAS_ARB = 15` adalah aturan **tahap I** (5 Juni 2023). BEI mengembalikan ARB
**simetris** dengan ARA pada **4 September 2023** (Kep-00055/BEI/03-2023,
Peraturan II-A): 35% / 25% / 20% menurut jenjang harga. Angka 15% membuat
proyeksi ARB kalkulator terlalu dangkal untuk saham di bawah Rp 200 dan terlalu
dalam untuk saham di atas Rp 5.000.

Sekalian: `ProfitAra.tsx` menyalin ulang tabel fraksi dan ARA dengan batas
**eksklusif** (`p < 200`), padahal aturan BEI inklusif — harga tepat Rp 200
masih fraksi Rp 1. Salinan itu dibuang; keduanya kini memanggil
`lib/fraksiHarga.ts`.

## Temuan #127 — kenapa font PDF tak berganti walau CSS-nya benar

Tiga jebakan berturut-turut, semuanya gagal tanpa pesan galat:

1. **Font file:// diblokir.** Chromium membuka `keluaran/*.html` lewat `file://`
   dan memperlakukan tiap berkas sebagai asal berbeda, jadi `url('../../app/...')`
   ditolak diam-diam. Font akhirnya ditanam sebagai data URI — efek sampingnya
   menguntungkan: HTML terbitan jadi berdiri sendiri.
2. **`url()` tanpa tanda kutip menolak base64.** Data URI memuat `=` dan `/`,
   yang tidak sah di `url()` telanjang.
3. **Chromium mencetak sebelum font selesai dimuat.** `page.pdf()` tidak
   menunggu `document.fonts`; halaman yang sama di layar sudah memakai Red Hat,
   tapi PDF-nya keluar dengan Segoe UI. `render_pdf` sekarang menunggu
   `document.fonts.status === 'loaded'`.


## Catatan #137 — trigger belum diuji ujung-ke-ujung

Tabel, RLS, trigger, dan loncengnya sudah terpasang dan lonceng terbukti
merender (kosong, karena memang belum ada kabar). Yang SENGAJA tidak dilakukan:
memicu trigger dengan mengubah status setoran nyata milik kontributor —
itu akan mengirim kabar palsu ke orang sungguhan. Buktinya akan muncul sendiri
pada kurasi berikutnya; kalau tidak muncul, periksa trigger
`setoran_kabari_kurasi` di tabel `setoran`.

## Catatan #138 — kenapa `--kecuali` lewat argumen, bukan baca DB

`build.py` dijalankan lokal saat perakitan dan TIDAK punya kredensial Supabase.
Membaca kolom `dimuat` langsung dari sana berarti menambah kredensial ke jalur
yang selama ini bersih. Sebagai gantinya layar Kurasi punya tombol **"Salin
daftar masuk edisi"** — daftar itu yang dipakai saat transkripsi, dan emiten
yang dikeluarkan dipangkas dengan `--kecuali=TICKER,…` saat merakit.


---

## #175 — Rel navigasi: batasnya 2 ikon lagi, dan luapannya senyap

Dicatat 17 Agu 2026 atas permintaan Johan: *"untuk menu rail untuk sementara
dibiarkan gini dulu kan bisa scrolling ya, jadi dipikirkan kemudian jadikan
backlog"*.

**Koreksi terhadap dasar keputusannya: relnya TIDAK bisa digulung.** Terukur di
1536×960 dari `.dasbor-rail`:

| Yang diukur | Nilai |
|---|---|
| `overflow-y` | `visible` — bukan `auto`, jadi tak ada gulir |
| `scrollHeight` vs `clientHeight` | 960 vs 960 — tak ada yang tersembunyi untuk digulung |
| `.dasbor-rail-list` (15 ikon) | 784px |
| `.dasbor-rail-foot` (status, tema, Admin) | 110px |
| Ruang kosong antara ikon terakhir dan kaki | **96px** |
| Tinggi satu ikon | 44px |

Jadi **muat 2 ikon lagi**, bukan tak terbatas. Ikon ke-18 dan seterusnya akan
meluber ke area kaki tanpa gulir dan tanpa galat — persis kelas cacat yang
berulang di proyek ini: bukan rusak, cuma tak terlihat.

Angka itu juga untuk layar 960px. Jendela yang lebih pendek (bilah bookmark,
laptop 768px) punya ruang lebih sedikit — ambangnya bisa 1 ikon atau nol.

**Empat halaman yang direncanakan** (chart PAPAN, penyaring fundamental,
backtesting, bandarmologi) berarti kelebihan ±2 ikon.

> **Update 17 Agu 2026** — Grafik Emiten (ikon `GRF`) sudah ditambahkan (chart
> PAPAN tahap 3). Terukur ulang di 1536×960 lewat posisi ikon terakhir
> sungguhan (bukan tinggi kotak `.dasbor-rail-list`, yang ternyata kotak flex
> tetap — tidak tumbuh mengikuti isi): sisa ruang sesudah ikon ke-16 **≈52,6px**,
> muat **1 ikon lagi**, bukan 2. Tiga sisa (penyaring fundamental, backtesting,
> bandarmologi) tetap kelebihan ±2 — jalan keluarnya (`overflow-y:auto` atau
> submenu) masih backlog, belum dikerjakan sesi ini.

Dua jalan, keputusan Johan:

1. **Asuransi murah, sekarang**: `overflow-y: auto` pada `.dasbor-rail-list`
   (gutter 2px sudah jadi aturan bawaan `.lantai`, jangan tulis ulang — dan
   **jangan menyetel `scrollbar-width`/`scrollbar-color`**, sejak Chrome 121
   itu membatalkan seluruh aturan `::-webkit-scrollbar`). Satu baris, membeli
   waktu, tak mengubah tampilan selama ikonnya masih muat.
2. **Kelompokkan**: chart PAPAN + penyaring + backtesting satu keluarga —
   "alat analisa lawan data PAPAN sendiri" — satu pintu di rel, tiga tab di
   dalamnya. Rel tumbuh 1, bukan 3.

Yang belum diputuskan juga: `CHT` sudah dipakai widget TradingView, jadi chart
PAPAN belum punya singkatan. Tiga huruf berhenti membedakan di jumlah segini.


---

## Audit 18 item lama — 17 Agu 2026

Johan meminta review dari awal: mana yang sudah selesai. Tiap baris diperiksa
langsung ke kode dan (untuk yang menyangkut skema) ke basis data live, **bukan
ke berkas ceklist ini** — berkas ceklist bukan bukti bahwa kodenya ada.

**Hasil: 12 SELESAI · 5 SEBAGIAN · 1 BELUM · 1 DIPARKIR.**

### Selesai, terbukti

| # | Bukti |
|---|---|
| 108 | `ihsg_harian.json` n=8.849, ruas `buka` 8.849/8.849 terisi, 1990-04-06 → 2026-08-14 |
| 109b | `exportPeta.ts` cuma `exportEmiten()` + `exportInvestor()`; mode "seluruh dataset" tak ada lagi |
| 128 | `fraksiHarga.ts:14` merujuk Kep-00055/BEI/03-2023, ada berkas ujinya |
| 139 | `PenjagaHalaman.tsx` — `children` tak pernah di-mount kalau ditolak (bukan ditutup CSS) |
| 143 | `rencana-berjalan.md:624` keputusan opsi A |
| 137 | Trigger `setoran_kabari_kurasi` → `kabari_hasil_kurasi()`, diperiksa lewat `pg_get_functiondef` |
| 142 | `setoran_status_check` = `menunggu/revisi/disetujui/dihapus` — `ditolak` sudah tak ada |
| 127 | `palet.py:145` `@font-face` data URI + `build.py:801` menunggu `document.fonts.status` |
| 124 | `IndeksDunia.tsx:41` array RENTANG + judul dinamis |
| 132 | `SeasonalityKomparasi.tsx` 101 baris, terpasang di `Seasonality.tsx:271` |
| 138 | Kolom `setoran.dimuat` + tombol "Di edisi" + `build.py:837` benar-benar memfilter |
| 122 | `ohlc/` 963 berkas (962 sukses + `_gagal.json`), 37,3 MB, BBCA 2021-08-09 → 2026-08-14 |
| 131b | `SeasonalityHarian.tsx:57` mendukung satu emiten, bukan cuma IHSG |

### Sebagian — dan apa persisnya yang tersisa

| # | Sudah | Belum |
|---|---|---|
| 144 | Lapis TEKS: label "Broker Summary" di UI, entri glosarium menjelaskan istilah keliru | Lapis DATA masih `orderbook`: constraint `setoran_jenis_check`, tipe `JenisSetoran`, tabel `contoh_orderbook`, pola path storage `{TICKER}-orderbook.ext` |
| 99 | Panel lengkap: kuartal/tahunan × laba rugi/neraca/arus kas | Cakupan data 646/959. Kodenya sendiri mengakui di `stockDetailData.ts:348` |
| 123 | Skema siap: `umumkanFitur()`, RLS `untuk IS NULL`, lonceng merender generik | `umumkanFitur(` **tak dipanggil di mana pun** — tak ada pemicu, tabel `notifikasi` 0 baris |
| 107 | Badge % (`TopStocks.tsx:218`), klik ke chart (`:141`) | "Bar tembus" tak ada — tapi memang sudah dipisah jadi #145, bukan utang #107 |
| — | ~~Skrip panen XBRL resmi IDX belum ada~~ — **sudah ada sejak 17 Agu**: `scripts/panen_keuangan_idx.py`, 943 berkas (`1e4a40be`). Namanya bukan `panen_lapkeu_idx.py` seperti direncanakan | — |

### Belum & diparkir

- **#130** divergensi tiga lapis — **tak ada jejak sama sekali** di `app/src`
  (grep `divergensi`/`stochastic` kosong; satu-satunya kecocokan "divergensi
  asing" itu konsep lain). `docs/spek-indikator.md` baru spek. Butuh indikator
  (termasuk Stochastic) lebih dulu.
- **#129** bandarmologi — diparkir atas keputusan Johan. Penghalangnya tetap
  sama: `GetBrokerSummary` mengabaikan `stockCode`, hasilnya selalu level pasar.

### Temuan yang mengubah rencana

Panen ulang `fetch_keuangan.py` untuk 313 emiten yang kurang **mengembalikan
"kosong" untuk semuanya** — bukan "gagal (rate limit)", melainkan yfinance
memang tak punya laporan keuangan untuk emiten-emiten itu. Artinya celah
646→959 **tidak bisa ditutup lewat yfinance sama sekali**, dan XBRL resmi IDX
bukan sekadar sumber yang lebih baik — ia satu-satunya jalan untuk 313 emiten
itu.

---

## Audit ulang 18 Agu 2026 — daftarnya melenceng ke DUA arah

Diperiksa langsung ke kode, data, dan `git log`, **bukan ke centang berkas ini**.
Patokan bukti: rutenya terdaftar, fungsinya diekspor **dan dipanggil**, berkas
datanya ada **dan tidak kosong**. Uji: `392/392 vitest hijau`.

### Arah pertama — ditandai ☐ padahal sudah jadi

**Lima selesai penuh:**

| Item | Bukti |
|---|---|
| **B2** broker summary ke JSON | `scripts/fetch_broker_summary.py`; 753 `bs_YYMMDD.json` (2023-06-15→2026-08-14); dibaca `brokerHarian.ts:84` |
| **B4** Pasar NEGO / Bandar Flow | `flowNego.ts` + tab NEGO & Flow `BrokerSummary.tsx:254-255`; `flowNego.test.ts` |
| **Chart 3** lilin+volume+zoom | rute `/grafik` `App.tsx:113`; `3d47eca5`, `57555f33`, `f03be621` |
| **A3** panen XBRL resmi IDX | `panen_keuangan_idx.py`; 943 berkas, **nol kosong**; `1e4a40be` + `bde4b97e` |
| **#161** pesan galat unggah | `71733906` |

**Enam lagi sebagian besarnya sudah jalan** dan ditandai ☐ tanpa keterangan:
C2 (tujuh indikator + dua pola + template), C4 (heatmap sektor), C7 (flow level
pasar), #166 (Bulanan sudah murni agregat), #171 (imbuhan dilepas), #172 (aspek
sudah bercabang lima).

### Arah kedua — lebih berbahaya: ditandai ☑ padahal mati

| Item | Apa yang sebenarnya terjadi |
|---|---|
| **#123** badge/notifikasi fitur baru — ☑ di tabel "gelombang kedua" | `umumkanFitur()` ada di `lib/notifikasi.ts:57` dan **tak dipanggil dari mana pun**. Skema, RLS, dan lonceng hidup; pemicunya tidak. Sudah tertulis di audit 17 Agu, tapi centangnya tak pernah dicabut — jadi daftarnya menyebut "selesai" untuk fitur yang tak pernah bisa menyala |
| **#144** sweep orderbook → broker summary — ☑ | Lapis DATA masih `orderbook`: `lib/contohOrderbook.ts` masih membaca tabel `contoh_orderbook`, tipe `JenisSetoran` masih hidup di `supabaseEdisi.ts`. Yang selesai cuma lapis teks |

Pelajarannya sama untuk keduanya: **"berkasnya ada" bukan bukti.** Yang
membuktikan sebuah fitur hidup adalah ada yang **memanggilnya**.

### Yang belum punya baris sama sekali di daftar ini

- **`ohlc/` sudah sampai 2026-08-18, `data-idx/json/index.json` berhenti di
  2026-08-14.** Halaman yang membaca lilin harian tahu dua hari bursa yang
  belum diketahui sisa dasbor. Tercatat di `rencana-berjalan.md` sebagai "perlu
  diputuskan" tapi tak pernah jadi baris backlog — jadi tak ada yang
  mengantrekannya. Dua jalan: panen harian menyusul, atau `/grafik` dibatasi
  mengikuti `index.json`.
- **`docs/jejak-permintaan.md` bagian "Chart PAPAN sendiri" masih menandai
  tahap 4 (indikator baku) ☐** padahal sudah rilis (`5bdc09b8`). Bukan
  wewenang berkas ini untuk memperbaikinya — dicatat supaya tak dipakai sebagai
  patokan.

### Usulan yang menunggu jawaban Johan (jangan dikerjakan sebelum dijawab)

1. **Naikkan sisa C2 ke tier Ringan?** Yang tersisa cuma Stochastic, VWAP,
   StochRSI, dan Williams %R — dan kerangkanya (instans berparameter, legenda,
   pane) sudah berdiri, jadi biayanya sekarang setara item tier Ringan, bukan
   tier Besar. Kalau naik, ia langsung membuka **#130** (Stochastic itu lapis 2,
   satu-satunya penghalang tersisa) **dan** C3. Urutan ringan→mahal itu perintah
   Johan, jadi pemindahannya juga harus dari Johan.
2. **#170 K4/K6/K7** tetap menunggu — pertanyaannya di
   `docs/spek-kendali.md` bagian "Yang TIDAK dikerjakan".
3. **#168** cara scraping arsip berita — tetap menunggu pembahasan.
