# Rencana Refactor React — IDXMI + Arus Pasar

> ⚠️ **Antrean pindah ke `docs/antrean.md` (20 Agu 2026).** §9 "Backlog ide"
> dan temuan #15/#17/#18/#19 (dua dari tiganya ternyata sudah selesai saat
> dicoba ulang) sudah dipindah ke sana. **"Ada backlog?" dijawab dari
> `docs/antrean.md`**, bukan dari §9 di bawah — berkas ini tetap dibaca untuk
> rencana arsitektur & Papan Pekerjaan Fase 5.

> Disusun 2026-08-10, direvisi 2026-08-10 (arsitektur hibrida), direvisi lagi 2026-08-10
> (cakupan login diperjelas — lihat §1a).
> Status: **Fase 0-3 selesai** (scaffold+auth+routing · mesin skor TS paritas Python ·
> template PDF ter-port ke komponen React, pratinjau di `/admin/edisi/ujicoba` ·
> kotak masuk unggah screenshot di `/admin/upload`, tabel `edisi` siap diisi Claude Code).
> Fase 3 sempat dibangun sebagai form input manual 30+ field lalu dikoreksi — bertentangan
> dengan arsitektur §3 (web = wadah, Claude Code = otak); diganti kotak masuk sederhana.
> Keputusan user: login **admin tunggal**; mesin analisa utama **Claude Code** (web = kotak masuk
> + arsip + rak terbitan); API vision menjadi **opsional**, bukan jalur utama.

## 1. Kenapa refactor

- `index_live.html` = 6.043 baris satu file, 11 menu, routing `sw()` manual — sudah melewati batas nyaman vanilla.
- Tiga kemampuan baru tidak mungkin di situs statis murni: **login**, **upload PDF → analisa otomatis**, **export PDF dari aplikasi**.

## 1a. Cakupan login — dasbor tetap publik

**Login TIDAK menggerbangi dasbor.** Seperti `index_live.html` lama (publik, siapa saja bisa
lihat, cuma telat/tak terawat), 11 menu dasbor di React tetap **publik tanpa login** — itu
prinsip yang dibawa masuk dari produk lama, bukan dibuang. Login cuma gerbang kecil ke fitur
yang genuinely baru: **upload screenshot & kelola edisi Arus Pasar**.

```
"/"        publik  — dasbor (kosong sampai Fase 5, lalu diisi 11 menu)
"/login"   publik  — form masuk, cuma dipakai admin
"/admin"   terkunci — upload & kelola edisi (Fase 3/4)
```

Konsekuensi: fase 5 (migrasi 11 menu) menaruh view-nya di bawah `/` (publik), **bukan**
di bawah `/admin`. `ProtectedRoute` hanya membungkus rute upload/kelola edisi.

## 2. Stack tujuan

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | React + Vite + TypeScript | Stack terbukti di proyek SAKTI (`kemampuan-stack.md`); pola siap pakai |
| Auth | Supabase Auth, satu akun admin | MCP Supabase sudah terhubung; email+password cukup, tanpa manajemen user |
| Database | Supabase Postgres | Edisi, emiten, baris flow, skor — menggantikan JSON file |
| Storage | Supabase Storage | PDF/screenshot upload admin |
| Mesin analisa | **Sesi Claude Code** (manual / `/schedule`) | Transkripsi vision + narasi + rakit PDF; konteks metodologi utuh, masuk langganan. Cadangan opsional (fase 6): Edge Function → Claude API `claude-sonnet-5`, ~$1–11/bulan tergantung 3–20 emiten/hari |
| Skor | Port `arus-pasar/build.py` → modul TS | Deterministik, mudah diuji; SATU sumber kebenaran (Python dipensiun setelah paritas terbukti) |
| Export PDF | CSS print (`@page A4`) + `window.print()` | Template A4 sudah print-ready; nol server, nol biaya. Headless render server-side hanya kalau butuh otomasi penuh |
| Hosting | Tetap GitHub Pages (SPA statis) | Backend seluruhnya di Supabase; tidak perlu pindah hosting |

## 3. Alur yang disepakati (hibrida: web = wadah, Claude Code = otak)

```
HP admin → upload screenshot ke web (Supabase Storage), kapan saja
   ↓
Sesi Claude Code — manual, atau terjadwal via /schedule:
   tarik file dari Storage → transkripsi (vision sesi, masuk langganan)
   → tampilkan draf angka ke admin → koreksi → SETUJUI
   → mesin skor → narasi analisa (kualitas sesi penuh: METODOLOGI-ANALISA.md,
     kamus broker, riwayat edisi) → rakit PDF
   → unggah PDF + data edisi balik ke web sebagai edisi terbit
```

Alasan memilih ini di atas Edge Function + API vision: kualitas narasi setara edisi manual
(konteks metodologi utuh, model sesi), nol biaya API, satu otak analisa — bukan dua
implementasi yang harus dijaga paritasnya. Trade-off yang diterima: analisa butuh sesi
Claude Code hidup (manual/terjadwal), tidak bisa dipicu dari tombol di web.

Aturan integritas §8 tetap berlaku: tidak ada angka hasil baca mesin masuk terbitan
tanpa persetujuan admin; komponen hilang → penanda gap + penalti skor.

### Standar upload (wajib, supaya transkripsi konsisten)

| Berkas | Standar |
|---|---|
| Orderbook (Stockbit) — **wajib** | Tab ORDERBOOK · Net ON · tanggal terlihat · top-10 beli & jual utuh · slider Broker Action terlihat |
| Chart (TradingView) — opsional | Timeframe 1D · EMA50 + Pivot Points · label pivot/harga kanan terbaca · rentang ≥6 bulan · ekspor PNG |
| Penamaan | `TICKER_YYYY-MM-DD_*` (pola yang sudah dipakai) |

### Mitigasi chart tidak diupload

1. **Utama — hitung sendiri (tanpa browser):** EMA50 dan Pivot Points klasik
   (`P=(H+L+C)/3`, `R1=2P−L`, `S1=2P−H`, dst. dari bar sebelumnya) dihitung dari OHLC
   yfinance; chart digambar mesin render PDF yang sudah ada. Edisi tetap lengkap.
2. **Opsional — remote Chrome → TradingView:** buka TradingView via Claude in Chrome
   (login + template indikator user), tangkap layar. Dipakai hanya bila user ingin chart
   bersumber TradingView persis; fallback, bukan jalur utama.

Orderbook tidak punya mitigasi otomatis — broker summary per-saham tidak tersedia gratis
(METODOLOGI §10); tanpa orderbook → blok FLOW DATA GAP + penalti skor (§8).

## 4. Skema data awal (Supabase)

```
edisi        (id, kode, tanggal, status draf|terbit, ihsg_context jsonb)
emiten_edisi (id, edisi_id, ticker, ohlc jsonb, pivot jsonb, ema50,
              label, arah, flow_kelas, narasi jsonb, skor jsonb,
              slider_pct, sumber_upload_path)
flow_baris   (id, emiten_edisi_id, sisi B|S, kode_broker, nilai_juta,
              lot, avg, confidence, dikoreksi bool)
peran_broker (kode, peran ritel|scalper|institusi, catatan)
```

RLS: semua tabel hanya `authenticated` (admin tunggal). Bucket storage privat.

## 5. Yang dibawa, bukan ditulis ulang

| Aset sekarang | Nasib di React |
|---|---|
| `arus-pasar/template.html` (CSS nota riset) | Port **byte-per-byte** ke komponen (workflow §169) — desain sudah disetujui, jangan didesain ulang diam-diam |
| `arus-pasar/build.py` (skor + format angka id-ID) | Port ke TS + unit test paritas: input sama → skor sama persis |
| `METODOLOGI-ANALISA.md` | Acuan tetap; label, peran broker, aturan §8 jadi konstanta TS |
| 11 menu `index_live.html` | Migrasi per-view, satu view satu commit (pola hemat.md §14) |
| `data/*.json` (1.054 file) | Tetap dilayani statis untuk view lama; view baru pakai Supabase. Migrasi data lama ke DB = nanti, bukan prasyarat |
| GitHub Actions fundamental | Jalan terus tanpa perubahan |

## 6. Urutan fase (tiap fase = bisa dipakai, bukan setengah jadi)

| Fase | Isi | Bukti selesai |
|---|---|---|
| 0 | Scaffold Vite+React+TS + Supabase project + auth admin | Login/logout jalan; route `/admin` terlindungi |
| 1 | Modul skor TS + test paritas vs build.py | 3 emiten edisi ujicoba → angka identik |
| 2 | Port template Arus Pasar → komponen + export print CSS | PDF hasil print ≡ AP-100826-E01 (diff visual) |
| 3 | Kotak masuk — unggah screenshot ke Storage per tanggal/ticker, daftar tunggu di `/admin` | Upload dari HP tersimpan rapi per tanggal; **bukan** form input manual — rakit edisi tetap tugas Claude Code (fase 4) |
| 4 *(backlog — dikerjakan setelah fase 5)* | **Integrasi Claude Code sebagai mesin analisa** — alur tarik-file dari Storage, transkripsi+verifikasi, hitung pivot/EMA sendiri saat chart absen, unggah PDF terbit balik; lalu otomasi via `/schedule` | Satu siklus penuh: upload malam → agen pagi → draf → koreksi → edisi tayang di web |
| 5 *(sedang dikerjakan)* | Migrasi 11 view dashboard lama (`index_live.html`) ke React, per view/file/commit, di bawah `/` publik | Tiap view: verifikasi 3 viewport (aturan §175) |

### Fase 5 — detail (dipetakan 2026-08-10)

`index_live.html` (6.042 baris): tidak ada URL routing, navigasi murni toggle panel via `sw(id)`.
11 menu: Indeks Dunia, Top Stocks, Top Broker, Sektor & Indeks, Chart, Stock Detail,
Peta Investor, Broker Summary (Alpha), Kalkulator JIA (4 sub-tab), Changelog, Kritik & Saran.

**Prasyarat (dibangun sekali, dipakai semua menu):** Sidebar/MobileNav + router (react-router
path per menu, bukan `sw()` panel-toggle — shareable URL, konsisten pola `ProtectedRoute` yang
sudah ada), ThemeContext (light/dark, port dari `[data-theme]` CSS var index_live.html),
format-utils (`fN/fp/cls/bdg/fmtNF`), komponen Kalender (week-strip + grid bulan + jam sesi
bursa), wrapper Chart.js (dependency baru, sebelumnya CDN).

**Urutan migrasi (mudah → kompleks/berisiko):**
1. Kritik & Saran — statis murni
2. Changelog — statis, sekalian satukan duplikasi dengan popup "What's New"
3. Kalkulator JIA — form-state + `localStorage`, independen dari data harian
4. Indeks Dunia → Top Stocks → Top Broker → Sektor & Indeks — 4 menu berbagi satu objek data `D`
   dari `data/index.json` + `data/{tanggal}.json`; migrasi `world` dulu untuk menetapkan pola
5. Chart — bungkus widget TradingView pihak ketiga (`useEffect`+cleanup)
6. Broker Summary (Alpha) — modul terisolasi tapi datanya hardcode di JS, perlu keputusan pindah ke `data/*.json`
7. Stock Detail — logic valuasi (Graham/NCAV/DDM/Relative) harus presisi sama
8. Peta Investor — **paling berisiko**: payload 590 KB, D3 force-graph, 3 sub-view

Catatan porting: Broker Summary data hardcode & folder `data/cal_index.json` tak terpakai —
diputuskan saat sampai gilirannya, bukan sekarang. Import ESM "Motion" di index_live.html tidak
pernah dipakai (dead code) — diabaikan.

Desain shell: 3 opsi arah visual diajukan 2026-08-10 (Institusional Bersatu / Terminal Data /
IDXMI Disempurnakan) — user pilih **Opsi C, IDXMI Disempurnakan**: identitas teal/dark dasbor
lama dipertahankan, cuma dirapikan (kartu, spacing, tipografi), bukan diganti total.

### Papan Pekerjaan (format baku `kemampuan-workflow.md` §174, dipasang 2026-08-10)

> Ceklist ad-hoc lama (kolom # | Menu | Status | Catatan) diganti tabel 9-kolom baku
> per koreksi user — lihat baris #14. Kolom: **Tugas · Asal perintah · Halaman ·
> Komponen (file:baris) · Sebelumnya · Jadi (sesudah) · Alasan · Status & bukti · Changelog**.

| # | Tugas | Asal perintah | Halaman | Komponen (`file:baris`) | Sebelumnya | Jadi (sesudah) | Alasan | Status & bukti | Changelog |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Prasyarat shell + migrasi Indeks Dunia | "lanjut migrasi 11 menu dashboard itu dari 1 file html di pecah-pecah kan?" | `/` | `IndeksDunia.tsx`, `DasborLayout.tsx`, `useChartJs.ts` | 11 menu cuma ada di `index_live.html` (6042 baris), navigasi `sw()` panel-toggle, bukan route | Sidebar/MobileNav/router/ThemeContext/format-utils/Kalender/Chart.js wrapper + Indeks Dunia jadi pola referensi di `/` | `index_live.html` lewat batas nyaman vanilla; integrasi (Fase 4) di-backlog dulu | Selesai — verifikasi 2 viewport OK | Added |
| 2 | Migrasi Top Stocks/Top Broker/Sektor + fix warna | (lanjutan urutan migrasi Fase 5) | `/stocks` `/broker` `/sector` | `SektorIndeks.tsx:142` | Kolom "Hari Ini" tabel sektor hardcode class `red` (bug asli `index_live.html:2973`, ikut ter-port) | `cls(s.d)` — merah/hijau kondisional sesuai tanda | Bug data finansial (arah salah tampil), bukan pilihan desain | Selesai — verifikasi 2 viewport OK | Fixed |
| 3 | Migrasi Kalkulator JIA (4 sub-tab) | (lanjutan urutan migrasi Fase 5) | `/kalkulator` | `KalkulatorJia.tsx` + `kalkulator/{AvgDown,ProfitAra,RiskReward,Dividen}.tsx` | Form kalkulator cuma di panel toggle `index_live.html` | 4 sub-tab React + localStorage persist | Independen dari data harian, migrasi lebih awal per urutan risiko | Selesai — 4 formula diverifikasi manual (1 kasus floating-point 12 vs 13 dikonfirmasi BUKAN bug) | Added |
| 4 | Migrasi Chart + fix crash heatmap StrictMode | (lanjutan urutan migrasi Fase 5) | `/chart` | `ChartIndeks.tsx:84`, `index.html:8` | Heatmap crash `Cannot read properties of null (reading 'querySelector')` — cleanup `container.innerHTML=''` race vs StrictMode double-invoke | Guard `if (!container \|\| container.childElementCount > 0) return`, cleanup function dihapus | React 18/19 StrictMode dev double-invoke bikin script vendor jalan setelah container dibersihkan | Selesai — diverifikasi navigate-away/back, console bersih | Fixed |
| 5 | Migrasi Broker Summary (Alpha) + fix `fmtLot` | (lanjutan urutan migrasi Fase 5) | `/broker-summary` | `brokerSummaryFormat.ts:19` | `fmtLot()` tak handle negatif — Foreign Net negatif tampil raw `-206582700 lot` | `Math.abs` + prefix tanda, pola sama sibling `fmtB` | Bug format, ketauan saat verifikasi live | Selesai — BS_DATA byte-verified round-trip Python, verifikasi 2 viewport OK | Fixed |
| 6 | Migrasi Stock Detail + fix 2 bug fundamental | (lanjutan urutan migrasi Fase 5) | `/stock-detail` | `KolomKuartalan.tsx:98,183-185,196`; `KolomLaporan.tsx:76` | (a) `rev_yoy/gp_yoy/ni_yoy/dividend_yield` sudah skala persen tapi dikali 100 lagi; (b) Total Debt selalu "—" (baca field `lq_debt`/`total_debt` yang tak pernah ada) | (a) hapus `*100` ekstra (`payout_ratio` tetap, genuinely fraksi); (b) baca `lq_total_debt` (field asli) | Field salah nama & double-scale, ketauan cross-check live BBCA vs 5 model valuasi | Selesai — 5 model valuasi (Graham Classic/Growth/NCAV/Relative/DDM) match manual persis | Fixed |
| 7 | Migrasi Peta Investor (D3 force-graph) | "suruh agent lain kerjakan fase 5 yang belum selesai" | `/peta-investor` | `PetaInvestor.tsx`, `graphRender.ts`, `petaInvestorData.ts` | Menu terakhir belum dimigrasi; shape `data/investor_map.json` (590KB) diasumsikan salah (field `type`/`lf` country-code yang ternyata tak ada) | Derive CORP/IND/OTH dari field `cls` asli; search+focused view+By Stock/By Investor paginasi 20/halaman | Field data nyata beda dari asumsi kode lama | Selesai — verifikasi live search "BBCA" → data KSEI real (PT DWIMURIA 54.94%) | Added |
| 8 | Hapus menu Changelog, pindah ke docs statis | keputusan sesi sebelumnya, dieksekusi sbg bagian urutan Fase 5 | (dihapus dari nav) | `menu.ts`, `App.tsx`, `docs/CHANGELOG.md` | Changelog jadi salah satu 11 menu + popup "What's New" duplikat | `MENU_ITEMS` 10 entri; riwayat v1.0–v4.9 dipindah verbatim ke `docs/CHANGELOG.md`; CSS `.cl-*`/`#cl-overlay` dihapus | Tak perlu jadi menu interaktif, cukup dokumen statis | Selesai — route lama sudah tak ada | Removed |
| 9 | Matikan halaman maintenance GitHub Pages | "karena repo github ini under maintenance terus bisa bantu off kan?" + "lanjut push, tapi kerjaan sebelumnya di lanjutkan" | jiakbar.github.io (repo root) | `index.html` (commit `f066203`, 6026 baris) | Commit `94f6eff` menukar `index.html` root jadi placeholder "Sedang Dalam Pemeliharaan"; GH Action harian cuma sentuh `data/` | `cp index_live.html index.html`, commit+push `origin/main` | Placeholder ketinggalan tak sengaja, bukan maintenance beneran (dikonfirmasi GH Action tak pernah tulis HTML) | Selesai — commit `f066203`, diverifikasi live | Fixed |
| 10 | Demo PDF real ARCI (transkripsi → skor → PDF) | "coba ada data baru lagi buat PDF lagi" | (preview sementara, sudah dihapus) | `edisi-arci-live-demo.json`, `PreviewDemoSementara.tsx` (keduanya dihapus) | Belum ada bukti pipeline transkripsi→skor→PDF jalan dengan data user nyata (cuma fixture 3-emiten Fase 2) | PDF ARCI real (skor 77/100 TINGGI Accumulation), lalu view+route+fixture dihapus total | User minta bukti visual, bukan klaim pipeline jalan | Selesai — screenshot dikirim via SendUserFile, artifact dibongkar lagi | (kosong) |
| 11 | Demo PDF real DSSA (kasus skor rendah + `pivot_ragu`) | "buatkan PDF nya hasilnya seperti apa" + "mana hasil pdf nya dari DSSA?" | (preview sementara, sudah dihapus) | `edisi-dssa-live-demo.json`, `ohlc-dssa-live-demo.json` (dihapus) | Cuma 1 contoh (ARCI, sinyal kuat) — belum terbukti mesin bisa keluarin skor rendah kalau data memang lemah | PDF DSSA (skor 42/100 EKSTREM, Rotation/netral); `pivot_ragu:["P","R1","R2"]` trigger anotasi "verifikasi: P, R1, R2" | User minta data kedua untuk uji beda profil sinyal | Selesai — dikirim via SendUserFile, artifact dibongkar lagi | (kosong) |
| 12 | Dokumentasi metodologi sumber angka `slider_pct` | "apakah bisa membuat .meter + slider_pct?" + "dari mobile atau data dari desktop?" | (dokumen) | `METODOLOGI-ANALISA.md` (subsection baru) | Tak ada aturan tertulis apakah posisi meter boleh dari data agregat Stockbit sendiri, dan beda mobile/desktop pengaruh atau tidak | `slider_pct` (posisi) boleh dari data agregat Stockbit manapun (tabel BY/SL identik mobile/desktop); `flow_kelas` (label teks) wajib dari tabel broker mentah + kamus peran broker | Stockbit tak tau klasifikasi ritel/institusi/scalper milik proyek ini | Selesai — dicontohkan pakai nilai demo ARCI(86)/DSSA(58) | (kosong) |
| 13 | Simpan memory override 2-viewport proyek ini | "Khusus di IDX Trading gak perlu 3 viewport cukup desktop dan mobile tidak perlu yang 32 inch" | (memory lintas sesi) | `memory/viewport-2-layar-saja.md` | Aturan global wajib 3 viewport berlaku semua proyek tanpa kecuali | Proyek ini override — laptop+mobile saja, drop 32"; disimpan permanen (feedback-type) | Permintaan eksplisit & sadar user, ditandai jangan digeneralisasi | Selesai — file tertulis + terindeks `MEMORY.md` | (kosong) |
| 14 | Papan Pekerjaan §174 — backfill sesi + pasang mulai sekarang | "kmu lupa ya seharusnya setiap task ada papan progress loh sudah ada di kemampuan core dan workflow" | `docs/RENCANA-REFACTOR-REACT.md` | section ini (dulu "Ceklist progres Fase 5") | Papan progres ad-hoc cuma kolom # \| Menu \| Status \| Catatan — tak sesuai format baku §174 | Diganti tabel 9-kolom baku, backfill baris 1-13, dipakai mulai balasan ini | Koreksi user — konvensi sudah ada di basis pengetahuan pribadi | Selesai — dokumen ini | (kosong) |
| 15 | **[ANTRE]** Perjelas `Chart.tsx` PDF Arus Pasar | "kerjakan semuanya, di chart PDF itu perlu di perbaiki supaya lebih jelas" | PDF Arus Pasar (bukan dashboard React) | `arus-pasar/Chart.tsx` — sudah dibaca, belum diubah | Label pivot (R3/R1/P/R2/S1/S2/S3) nempel tepi kanan chart, kurang jelas terbaca | *(dugaan)* pindah label ke luar area chart, atau opsi lain setelah diagnosa | *(dugaan)* kepadatan label vs lebar chart A4 | **ANTRE, belum dikerjakan** | — |
| 16 | Artifact reimagined 2 opsi, 10 halaman, terang+gelap | "buatkan artifact reimagined dari semua page yang sudah refactor ke react, biar tidak generic ai, termasuk icon, sidebar, kolom, dropdown, dll … warna jangan selalu hijau, bisa pakai referensi refero juga pokoknya design sesuai dengan trading saham" + "kalau token mu cukup buatkan 2 opsi dong, bisa light dan dark theme" | 10 halaman dasbor (mockup, belum kode React) | artifact `lantai-bursa-reimagined.html`, `lembar-riset-reimagined.html` | Dasbor live masih Opsi C lama (teal/dark dipoles), dinilai user "AI Slop"; artifact 3-opsi sebelumnya tak pernah dipilih | **Opsi A "Lantai Bursa"** (ink-navy + amber terminal, rail kode ticker, papan split-flap, pita kurs) & **Opsi B "Lembar Riset"** (kertas kerja analis, biru tinta `#23408E`, kolom margin bernomor, garis rangkap dua angka final, tab lembar di bawah) — keduanya nol hijau/teal sebagai warna chrome | Warna hijau/merah dikunci jadi semantik data saja (aturan Cash App di Referensi Refero); disiplin app-chrome & pembatasan radius/bayangan dari Attio | Selesai — 2 artifact terbit, verifikasi laptop `1536x960` + telepon `412x915` di kedua tema, console bersih, `scrollWidth == clientWidth` | Added |
| 16b | Opsi B: bilah bawah diganti sidebar | "kok downbar bukan sidebar, tapi tetep bingung juga" | 10 halaman Opsi B | `lembar-riset-reimagined.html` — blok `.tabbar` | Navigasi tab lembar di sisi bawah, 10 item harus digulir di layar lebar | Sidebar tegak bernomor 01–10 (senapas kolom margin buku besar); bilah bawah tinggal untuk telepon | Tab bawah taruhan lemah untuk 10 menu di layar lebar; identitas kertas kerja tak bergantung padanya | Selesai — verifikasi laptop terang, `scrollWidth == clientWidth` | Changed |
| 16c | **Opsi C "Ruang Arsip"** — dasbor disusun ulang menurut asal-usul & umur data | "buatkan opsi C jika kondisi nya refactor-redesign-reimagined dari tema aslinya gmn tuh? misal indeks dunia ada tanggal isinya terkait data IDX Statistik, lalu stock detail ini hasil dari fetch yahoo tapi masih gagal, peta investor bisa di ambil dari konsentrasi di web IDX dan kalkulator itu bonus" | 10 halaman + halaman Arus Pasar | artifact `ruang-arsip-reimagined.html` | A & B menyusun menu menurut TOPIK dan menampilkan angka basi seolah angka hari ini; kegagalan ruas tampil sebagai "—" | Menu dikelompokkan menurut SUMBER (Statistik IDX · Yahoo · KSEI · penyedia luar · tertanam di kode · dibuat sendiri · tanpa data); tiap halaman dibuka kartu sumber bercap; status dihitung dari umur DIBANDING irama wajar; angka basi diarsir; ruas gagal menyebut berkas & baris penyebabnya | Empat sumber data punya irama berbeda — menilai semuanya dengan ukuran "hari ini" salah; sebaliknya kegagalan senyap (lihat #19) tak akan pernah terlihat kalau tidak dijadikan elemen tampilan | Selesai — verifikasi laptop terang + telepon gelap, console bersih, nol scroll horizontal | Added |
| 17 | **[TEMUAN]** Data harian IDX beku 66 hari | (terungkap saat menyiapkan #16c) | 4 menu: Ringkasan, Saham, Broker, Sektor | `data/ds_260605.json` — berkas terakhir; `.github/workflows/update.yml` | Berkas harian terakhir 5 Juni 2026; commit terakhir yang menyentuh `data/ds_*` tertanggal 6 Juni; alur dijadwalkan tiap hari bursa | *(belum diperbaiki)* perlu telusur kenapa `download_idx.py` berhenti memanen PDF dari idx.co.id | Alur memakai `continue-on-error: true` pada langkah unduh, jadi kegagalan tak pernah menggagalkan proses | **BELUM DIPERBAIKI — perlu diagnosa** | — |
| 18 | **[TEMUAN]** `price_perf` kosong di 957 dari 957 berkas | (terungkap saat menyiapkan #16c) | Detail Emiten — panel Kinerja Harga | `scripts/fetch_fundamental.py:287-290` | `hist = t.history(period="1y")` melempar galat, ditangkap `except Exception: hist, pp = None, {}` sehingga `price_perf` selalu `{}` dan alur tetap melapor berhasil | *(belum diperbaiki)* penangkap galat perlu mencatat sebab dan menghitung ulang, bukan menelan diam-diam | Persis keluhan user "fetch yahoo tapi masih gagal"; ruas lain dari `info` terisi 955/957 sehingga kegagalan tak kentara | **BELUM DIPERBAIKI — akar sudah dipastikan** | — |
| 19 | **[TEMUAN]** `investor_map.json` tanpa alur pembaruan | (terungkap saat menyiapkan #16c) | Peta Investor / Kepemilikan | `data/investor_map.json` (590 KB, 6 Juni 2026) | Tidak ada workflow yang menyentuh berkas ini; sekali unggah manual | *(belum diputuskan)* panen berkala konsentrasi kepemilikan dari web IDX/KSEI | Berumur 65 hari — masih wajar untuk data kuartalan, tapi tanpa alur ia akan diam-diam menua terus | **BELUM DIPERBAIKI — belum mendesak (irama kuartalan)** | — |
| 26 | Kanvas digambar sebelum tata letak siap | (temuan saat verifikasi #25) | Semua halaman berkanvas | `lantai-bursa-reimagined.html` — `draw()` | `getBoundingClientRect().width` sempat 0 saat menggambar, `canvas.width` jadi 1 lalu diregangkan CSS — grafik Peta Investor tampil sebagai balok amber melintang | Penjaga di `draw()`: kalau lebar kanvas <2px, tunda ke `requestAnimationFrame` berikutnya | Ditahan di satu tempat supaya berlaku semua grafik, bukan ditambal per-grafik | Selesai — `canvas.width` 972/1695 di laptop, 961 di telepon | Fixed |
| 25 | Laci menu telepon: 10 menu terjangkau + tombol tema | "perlu buat hamburger menu nih utk mobile" | Semua halaman, telepon | `.laci`, `#btnLaci`, `#laciList` | Bilah bawah cuma memuat 5 dari 10 menu; sisanya (Detail Saham, Peta Investor, Kalkulator, Kritik Saran) tak terjangkau sama sekali dari telepon | Tombol keenam "MENU" membuka laci berisi 10 menu bernama penuh + tombol tema; tombol MENU ikut menyala saat menu di luar bilah bawah sedang aktif | Laci adalah bentuk telepon dari rail kiri — tema tetap "di sidebar" sesuai #24, dan pengguna tak kehilangan jejak posisi | Selesai — 10 item, uji pilih Peta Investor: view berganti, laci tertutup, MENU menyala | Added |
| 24 | Tombol tema pindah ke kaki sidebar | "ganti tombol temanya disini saja" (menunjuk titik hijau di kaki rail) | Semua halaman | `.rail-foot`, `.js-tema` | Tombol tema menempel di bilah pita atas, sempat menggencet teks berjalan | Duduk di kaki rail di bawah titik status; di telepon pindah ke laci. Dua tombol, satu fungsi `setTema`, label disinkronkan bersama | Kontrol global tempatnya di sidebar, bukan di jalur data berjalan | Selesai — verifikasi laptop + telepon, kedua tema | Changed |
| 23 | Peringkat YTD: kanvas batang tegak → daftar batang mendatar | "informasi seperti ini sulit dibaca, ubah chartnya" + "warna font harus support dark dan light mode" | Indeks Dunia | `#rankYtd`, `.rk-*` (kanvas `cvYtdRank` dihapus) | 35 label negara diputar 60° di kanvas sampai bertumpuk tak terbaca; warna teks digambar manual sehingga rawan tak ikut tema | Daftar HTML 3 kolom: nomor peringkat, nama lurus, batang divergen dari sumbu nol proporsional, nilai kanan; Indonesia disorot merah di peringkat 35 | Teks HTML ikut token tema otomatis, bisa disalin, terbaca pembaca layar — masalah warna tema selesai di akarnya, bukan ditambal per-label | Selesai — 35 baris, uji tema terang & gelap, nol scroll horizontal | Changed |
| 22 | Lencana "PITA KURS" dihapus, pita berjalannya dipertahankan | "Pita kurs dihapus << teks nya saja tapi informasi yang bergerak tidak perlu di hapus karena ganggu baca" | Semua halaman Opsi A — bilah atas | `lantai-bursa-reimagined.html` — `.tape-badge` | Lencana tetap "PITA KURS" duduk di ujung kiri bilah; teks berjalan lewat tepat di sampingnya sehingga tumpang tindih dan sempat terbaca kacau (sudah ditambal `z-index` + wadah `overflow:hidden`, tapi penghalangnya masih ada) | Lencana teks dibuang; pita berjalan tetap ada dan memakai lebar penuh | Lencana statis di jalur teks bergerak itu penghalang baca, bukan penanda yang berguna — isinya sudah jelas dari bentuknya | **BACKLOG** — mengoreksi kesepakatan sebelumnya yang sempat berbunyi "hapus seluruh pita kurs" | — |
| 21 | **[BACKLOG]** Yahoo `^JKSE` sebagai sumber cadangan IHSG | "jadikan backlog" (atas rangkuman: perbaiki bug `t.history()` dulu, baru Yahoo masuk akal; sekarang pakai `index.json`) | Ringkasan / Indeks Dunia — grafik IHSG tahun berjalan | `data/index.json` (sumber terpilih sekarang); calon: `scripts/fetch_fundamental.py` | Grafik YTD di mockup masih garis karangan; sumber nyata belum disambungkan | **Sekarang**: pakai `data/index.json` — 93 hari bursa, 7 Jan–5 Jun 2026, nol tanggal bolong, sudah dimuat `useDataHarian` jadi nol permintaan jaringan tambahan. **Cadangan**: `^JKSE` via yfinance, hanya SETELAH #18 beres | Yahoo satu-satunya jalan dapat angka lebih segar dari 5 Juni selama alur PDF IDX mati (#17), tapi jalurnya `t.history()` — panggilan yang persis sedang rusak (#18), jadi menyambungkannya sekarang cuma memindahkan kegagalan | **BACKLOG — bergantung pada #18** | — |
| 20 | Terapkan opsi terpilih ("Lantai Bursa") ke kode React | (lanjutan #16/#16c) | `/` (seluruh dasbor, 10 view + shell) | `app/src/dasbor/lantai.css`, `app/src/dasbor/dasbor.css` (dihapus Task 13), seluruh `views/dasbor/**` + `components/dasbor/**` | Shell + 10 view gaya lama, token+kelas di `dasbor.css` | Opsi A "Lantai Bursa" (ink-navy+amber, rail kode ticker, papan split-flap) diterapkan penuh — 13 task berurutan (`docs/superpowers/plans/2026-08-11-migrasi-artifact-react.md`): Fondasi token (T1) → 10 view (T2-T12, Peta Investor paling berisiko) → Changelog admin + hapus `dasbor.css` (T13). `dasbor.css` dipindah ke `lantai.css` (shell rail/topbar/kaki/laci + util `.red/.green/.muted/.bdg/.bchip/.divider/.board-tbl-wrap/.r/.chart-wrap` + subset `.fd-*`/`.rr-bar-*` yang masih dipakai; `.pi-*` Peta Investor direscope `.dasbor-shell .pi-` → `.lantai .pi-` + alias 5 token lama→baru per suplemen Task 12; kelas terbukti mati — `bs-*`, kalender/kalkulator lama, toggle TV lama, `.card/.ct/.rank/.rk1-3` — dibuang) | Mockup (T16/16c) sudah disetujui user; T13 mengeksekusi keputusan itu ke kode | Selesai — `npm --prefix app run build` sukses; 10 halaman publik + `/admin/changelog` diverifikasi 2 viewport (laptop 1440×900, mobile 412×900) × 2 tema (computed-style pixel-check, bukan cuma visual), lihat `.superpowers/sdd/task-13-report.md` | Changed |
| 28 | Changelog admin terkunci + hapus `dasbor.css` (Task 13, tugas terakhir) | `.superpowers/sdd/task-13-brief.md` + suplemen | `/admin/changelog` (baru); seluruh dasbor publik (dampak hapus `dasbor.css`) | `views/admin/ChangelogAdmin.tsx` (baru), `App.tsx`, `vite.config.ts` (`server.fs.allow`), `dasbor/lantai.css`, `dasbor/dasbor.css` (dihapus), `components/dasbor/DasborLayout.tsx` | Changelog cuma dokumen statis `docs/CHANGELOG.md`; `dasbor.css` masih diimpor `DasborLayout.tsx` bersama `lantai.css` | `ChangelogAdmin.tsx` membaca `docs/CHANGELOG.md?raw` langsung (satu sumber kebenaran), dipasang di `/admin/changelog` (bukan menu publik — rail tetap 10 menu); `dasbor.css` dihapus SETELAH grep menyeluruh (bukan cuma grep string tetap brief asli) menemukan sisa dependensi jauh lebih luas dari dugaan awal (shell rail/topbar/kaki/laci TIDAK PERNAH dimigrasi ke `.lantai` di Task 1-12 — sengaja, per comment Task 1 "padanannya sudah ada di dasbor.css" — dan util `.red/.green/.muted/.bdg/.bchip/.divider/.board-tbl-wrap/.r/.chart-wrap` + subset `.fd-*`/`.rr-bar-*` masih dipakai ~semua view); semuanya dipindah verbatim ke `lantai.css` (bukan ditulis ulang) sebelum file dihapus | Brief asli Task 13 cuma menduga sisa dependensi = `.pi-*` (ditemukan Task 12); pengecekan menyeluruh (bukan asumsi "10 view sudah `.lantai`" = aman hapus) adalah instruksi eksplisit suplemen Task 13 dan mencegah regresi total pada shell dasbor (rail/topbar/pita kurs/bilah mobile) yang akan terjadi kalau brief diikuti apa adanya | Selesai — build sukses, 10 halaman + admin changelog + route-guard `/admin/changelog`→`/login` diverifikasi; detail lengkap `.superpowers/sdd/task-13-report.md` | Added |
| 17 | **[BACKLOG]** Catat bug clipping tabel >7 emiten | "backlog dlu" | PDF Arus Pasar | `arus-pasar/cetak.css` (`.ap-cetak .page`) | `height:296mm; overflow:hidden` — ditemukan bakal motong diam-diam tabel Ringkasan Edisi/Peringkat Peluang | Dicatat di §9 Backlog, 2 opsi fix diajukan | User minta ditunda, bukan prioritas saat ditemukan | Dicatat, belum di-fix (lihat §9) | — |
| 18 | **[BACKLOG]** Backup harian folder screenshot upload | "setiap hari folder2 itu harus dibackup ke folder backup data lain, karena hasil gambar nya dari screenshot semua yakan" | (infra, bukan UI) | *(belum ada — mekanisme belum ditentukan)* | Tak ada backup otomatis bucket Supabase `screenshots` | Dicatat di §9 Backlog; mekanisme (cron? sinkron Drive/lokal?) belum diputuskan | Screenshot manual = tak reproducible kalau hilang, beda dari `data/*.json` | Dicatat, belum didesain (lihat §9) | — |
| 27 | Broker Summary gaya "Lantai Bursa" (Task 10 restyle) + verifikasi sumber ringkasan broker harian IDX | `.superpowers/sdd/task-10-brief.md` (sesi restyle "Lantai Bursa" terpisah, lihat `docs/superpowers/plans/2026-08-11-migrasi-artifact-react.md`) | `/broker-summary` | `BrokerSummary.tsx`, `broker-summary/{Inventory,Quadrant,Nego,Flow}.tsx`; baru: `scripts/cek_broker_summary.py`; dihapus: `components/dasbor/BsDatePicker.tsx` | Kelas lama `bs-*`/`dasbor.css`; pemilih tanggal (`BsDatePicker`) tampak seperti kalender hidup padahal data tertanam cuma 3 hari (2026-06-02..04), tak pernah diperbarui | **Verifikasi dulu** (`scripts/cek_broker_summary.py`, Playwright): kedua endpoint kandidat `GetBrokerSummary`/`GetStockSummary` diblokir Cloudflare — HTTP 403 "Attention Required" (bukan 404/tidak-ada, halaman utama `ringkasan-perdagangan` sendiri berhasil dimuat) → cabang "diblokir", **reskin saja, TIDAK pindah ke data live**. Kartu → `.grid3`+`.vcard` (`.v-num`/`.v-note`); tab → `.tabs`+`.tab`; tabel → `.tbl`+`.bchip` (kode broker)+`.bar-tr`/`.bar-fl` (batang nilai); pemilih tanggal dicopot, diganti chip tetap `Data contoh 02 Jun – 04 Jun 2026 · tidak diperbarui` di `.panel-h`; `from`/`to` sekarang konstan (dulu state, tidak pernah benar-benar dipakai user menyempit rentang) | Kejujuran status data di layar — pola sama dgn temuan #17/#18 (data basi jangan tampil seolah segar). Step 4a rencana (`BsDatePicker` → re-export `Kalender`) DIBATALKAN: bukan cuma jadi tak perlu setelah pemilihnya dicopot, tapi juga interface tak cocok — `Kalender` butuh `TanggalIndex[]` (harga IHSG asli per tanggal) + pilih SATU tanggal, BSM butuh rentang 3-hari tetap tanpa harga indeks; brief sendiri menginstruksikan batal-dan-backlog kalau begini, bukan paksa ubah interface `Kalender` yang dipakai 4 view lain | Selesai — `npm --prefix app run build` sukses (tsc bersih); verifikasi 2 viewport (laptop 1536×960, mobile 412×915 — proyek override `memory/viewport-2-layar-saja.md`) × 2 tema, `scrollWidth==clientWidth` di semua tab (Inventory/Kuadran/NEGO/Flow), Foreign Net negatif `-206.6M lot` tampil merah `.dn` (fmtLot papan #5 tidak mundur) | Changed |

**Fase 5 selesai — 11/11 menu live**, verified laptop+mobile (proyek ini pakai 2 viewport — lihat
`memory/viewport-2-layar-saja.md`). **Redesign "Lantai Bursa" (T16/16c → T1-T13) juga selesai** —
baris #20 & #28: 10 view + shell dasbor publik + halaman baru `/admin/changelog` semuanya di
token/kelas `.lantai`, `dasbor.css` lama sudah dihapus. Antrean nyata sekarang: baris #15
(`Chart.tsx` label pivot PDF Arus Pasar) dan §9 Backlog ide. Fase 4 (integrasi Claude Code)
tetap di-backlog di belakangnya.

### Status backlog B1–B4 (spec §8, `docs/superpowers/specs/2026-08-11-migrasi-artifact-react-design.md`)

Dicatat ulang di sini per instruksi Task 13 — keempatnya diputuskan user 11 Agustus 2026
sebagai "di luar cakupan rencana implementasi", TIDAK dikerjakan sepanjang Task 1-13, dan
migrasi "Lantai Bursa" (baris #20/#28) TIDAK mengubah status ini:

| # | Pertanyaan | Perilaku sekarang (tidak berubah oleh T1-13) |
|---|---|---|
| B1 | Pemilih periode 1B/3B: tabel sektor saja atau ikut tabel indeks? | Tetap tabel sektor saja (`SektorIndeks.tsx`, dikonfirmasi ulang Task 7) |
| B2 | Kalender: panel tetap atau dropdown? | Tetap panel (`Kalender.tsx`, direstyle token `.lantai` di Task 7b/7c — bentuknya tak berubah) |
| B3 | Rentang tanggal — aturan agregasi per menu? | Belum dikerjakan; tetap pilih tanggal tunggal |
| B4 | Kolom Δ peringkat vs hari bursa sebelumnya (Top Broker/Top Stocks)? | Belum dikerjakan |

B3 & B4 masih menunggu keputusan muat berkas `ds_*.json` tambahan (lihat spec §8) — tidak
tersentuh migrasi CSS Task 13, murni backlog fitur data.

### Verifikasi sumber Broker Summary (Task 10, dicatat ulang di sini per instruksi Task 13)

Baris #27 (tabel di atas): endpoint kandidat `GetBrokerSummary`/`GetStockSummary` idx.co.id
diblokir Cloudflare (HTTP 403 "Attention Required", diverifikasi Playwright via
`scripts/cek_broker_summary.py`) — **bukan** 404/tak-ada; halaman utama `ringkasan-perdagangan`
sendiri berhasil dimuat. Keputusan: reskin tampilan ke token `.lantai` saja, data tetap
tertanam 3 hari (`brokerSummaryData.ts`, 2026-06-02..04), **tidak** pindah ke sumber live. Task
13 tidak mengubah keputusan ini — `.chart-wrap`/`.bchip` yang dipindah ke `lantai.css` murni
CSS, bukan sumber data.

| 6 *(opsional)* | Edge Function + API vision — hanya bila butuh analisa terpicu dari web tanpa sesi Claude Code | Upload di web → draf angka tanpa Claude Code |

Fase 4 versi lama (Edge Function vision) turun jadi fase 6 opsional — digantikan integrasi
Claude Code yang kualitas analisanya setara edisi manual dan tanpa biaya API. Fase 6 baru
dipertimbangkan kalau alur terjadwal terasa kurang (mis. butuh hasil instan dari tombol web).

## 7. Biaya & risiko

- **Kuota usage langganan**: mesin analisa di sesi Claude Code memakai jatah langganan —
  20 emiten/hari ≈ 40 gambar ≈ 90rb token input per siklus; muat, tapi pantau sisa kuota.
- **Claude API vision (fase 6 opsional)**: ~1.500–2.800 token/gambar; ~$1,2/bulan (3 emiten/hari,
  Sonnet 5 intro) s.d. ~$11/bulan (20 emiten/hari). Butuh API key prabayar terpisah dari langganan.
- **Supabase free tier**: cukup besar untuk admin tunggal; risiko pause 7 hari idle → mitigasi cron ping.
- **Akurasi vision**: angka mirip (8 vs 6, koma) — mitigasi confidence + UI koreksi (§3).
- **Paritas skor**: penyimpangan TS vs Python = kredibilitas — mitigasi test fase 1.

## 8. Belum diputuskan (tidak memblokir fase 0–3)

- Nama repo/URL produk (`idx-dashboard` tetap? subdomain Arus Pasar?)
- Draf narasi otomatis (AI tulis paragraf) — nice-to-have fase 4+, bukan inti
- Migrasi data historis 1.054 JSON ke Postgres

## 9. Backlog ide (dicatat 2026-08-10, belum dieksekusi)

- **Cover PDF Arus Pasar (`HalamanSampul.tsx`) perlu desain baru** — saat ini cuma daftar isi
  teks (kode emiten + label + skor) di atas warna teal polos. User: "bukan memunculkan daftar
  isi tapi cover" — perlu elemen visual (ikon dll), bukan cuma tabel teks.
- **Blok IHSG/Net Foreign Buy dipindah ke ATAS cover**, saat ini di bagian paling bawah —
  user nilai kurang menarik di posisi sekarang. Rencana: bikin artifact mockup dulu (opsi
  layout) sebelum eksekusi, sama seperti pola redesign Login sebelumnya.
- **Label pivot (R3/R1/P/R2/S1/S2/S3) di chart emiten (`Chart.tsx`)** — posisinya saat ini
  nempel di tepi kanan chart, kurang jelas. Opsi: pindah ke LUAR area chart, atau dihilangkan
  sama sekali kalau tetap berantakan.
- **Sumber chart candlestick** — saat ini cuma OHLC+EMA50+Pivot Points (data yfinance, minim
  indikator). Rencana ke depan: pakai chart dari Stockbit supaya bisa nampilin banyak indikator
  teknikal & mendukung analisa lebih dalam. Indikator yang mau ditambah akan diperinci nanti.
- **Nama produk "Arus Pasar" dipertanyakan ulang** — user belum yakin ini nama final, perlu
  dipikirkan lagi (mirip pertanyaan nama repo di §8).
- **BUG laten — tabel Ringkasan Edisi & Peringkat Peluang terpotong diam-diam di >~7 emiten.**
  `app/src/arus-pasar/cetak.css` — `.ap-cetak .page { height: 296mm; overflow: hidden }` (fixed A4,
  kelebihan konten dipotong tanpa jejak, bukan lanjut halaman baru). `HalamanRingkasan.tsx` &
  `HalamanPeringkat.tsx` render SEMUA emiten edisi dalam satu tabel di satu halaman itu — dites cuma
  3 emiten (fixture Fase 2), belum pernah dites 10-20 emiten (skala yang direncanakan sejak awal).
  Halaman lain (cover/band/per-emiten) aman, kontennya tidak bertambah seiring jumlah emiten.
  Perlu keputusan desain sebelum fix: (1) lepas `overflow:hidden`+fixed height khusus 2 halaman ini,
  tabel pecah ke beberapa lembar A4 + `thead` repeat per lembar, ATAU (2) pagination React — potong
  emiten jadi grup per-N, render beberapa blok `.page` berturut.
- **Manajemen file screenshot — backup harian.** Folder upload screenshot (bucket Supabase
  `screenshots`, per tanggal) perlu dibackup harian ke folder/storage backup terpisah, karena
  isinya murni hasil screenshot manual (tidak reproducible kalau hilang, beda dari `data/*.json`
  yang bisa di-generate ulang). Mekanisme belum diputuskan (cron job? sinkron ke Google
  Drive/folder lokal?). User juga menyebut ada "2 jenis orderbook" di folder data emiten
  lokalnya (di luar repo, path belum dikonfirmasi) — perlu klarifikasi lanjut apa bedanya
  sebelum ini didesain.
- **Palet warna Arus Pasar (teal #0B4F4A) mirip identitas proyek SAKTI** — user tegur "fanatik
  hijau". Saat nama produk dipikirkan ulang, palet warna ikut dievaluasi juga — jangan otomatis
  reuse teal/hijau lagi tanpa mikir opsi lain.
- **Cakupan periode edisi Arus Pasar** — saat ini murni harian (daily). Rencana berkembang ke
  edisi mingguan (weekly) & bulanan (monthly), bukan cuma daily. Belum ada desain/skema untuk
  ini — dampak ke skema data `edisi` Supabase & mesin skor perlu dipikirkan saat digarap.
- **Broker Summary — sambungkan ke sumber harian IDX kalau nanti tersedia.** Task 10 (restyle
  "Lantai Bursa") memverifikasi `GetBrokerSummary`/`GetStockSummary` idx.co.id lewat Playwright —
  keduanya diblokir Cloudflare (403). Kalau di masa depan endpoint ini kebuka (WAF berubah, atau
  ditemukan endpoint lain yang balikin 88 broker), Broker Summary bisa naik kelas dari data
  tertanam 3-hari (2026-06-02..04) jadi harian — TAPI itu ubah bentuk datanya (per-broker
  akumulasi lot/hari, bukan snapshot statis), jadi reskin ulang tab-tabnya kemungkinan perlu
  diulang, bukan cuma ganti sumber data di belakang kelas yang sama.
- **Kalau nanti mau pemilih tanggal-hidup balik ke Broker Summary** — jangan re-export
  `Kalender.tsx` (dicoba Task 10, dibatalkan): `Kalender` butuh `TanggalIndex[]` (perlu harga
  IHSG asli per tanggal, tak ada di `BS_DATA`) dan modelnya pilih SATU tanggal, sedangkan BSM
  butuh pilih RENTANG (from/to) dari himpunan tanggal terbatas. Perlu komponen picker sendiri
  (mis. bangun ulang `BsDatePicker` versi Lantai) kalau data sumbernya sudah harian beneran.
