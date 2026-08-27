# Spek Adopsi Custom Chart → Chart PAPAN (audit lengkap Fable, 26 Agu 2026)

**Sumber**: `_raw_chart_findings.md` (raw), `audit_chart_custom.md`, `audit_tradersaham.md`, `audit_whales_id.md`, `adendum_rapor_badge.md`, `pengantar_pembagian_kerja.md`. Semua kode dicek langsung di `app/src` (grep/find), bukan diasumsikan dari teks audit.

**Catatan viewport (wajib dibaca sebelum QA apa pun di spek ini)**: aturan global proyek AI Skill menetapkan 3 titik verifikasi (1920×1080 · 1536×960×1.25 · 412×915×2.625). Proyek PAPAN sejauh ini memakai **Kriteria Terima 6 butir dengan 2 viewport (1920 desktop + 412 mobile) + tema terang/gelap** — konflik ini sudah dilaporkan ke Johan 25 Agu 2026 dan **belum diputuskan**. Spek ini mengikuti aturan PAPAN yang berlaku (2 viewport) sampai ada keputusan eksplisit; jangan diam-diam pilih 3 viewport tanpa konfirmasi.

---

## 0. Ringkas verdict

| # | Fitur | Verdict | Ref |
|---|---|---|---|
| A1 | Engine chart (canvas dua-lapis dari nol) | **SKIP — sudah ada substrat, adaptasi pola di atasnya** | §1 |
| A2 | DPR-aware rendering | **IMPROVE** — verifikasi & seragamkan, bukan bangun baru | §1, §6 |
| A3 | Crosshair bebas + readout snap + sinkron antar-pane | **ADOPSI** (native ke lightweight-charts, tinggal wire) | §1 |
| A4 | Header O/H/L/C/V + %chg ala Mirae | **ADOPSI** (cek existing dulu) | §1 |
| A5 | Toggle magnet opsional | **SKIP untuk sekarang** — nilai rendah | §3 |
| B1 | 16 indikator on-chart/pane dari audit (rumus baku) | **ADOPSI** — kemungkinan besar sudah ada di registry 366 | §2 |
| B2 | Batas keras 3 pane aktif | **SKIP batasnya** — PAPAN bebas, soft-warning saja | §2 |
| B3 | Preset Standar/Momentum/Volatil | **ADOPSI**, komposisi didefinisikan sendiri | §3 |
| B4 | Toolbar (TF, dropdown indikator, bar-terakhir, Bersihkan, fullscreen, zoom/pan/reset) | **ADOPSI**, sebagian sudah ada | §3 |
| C1 | Pivot Points klasik (P/R1-3/S1-3) | **ADOPSI** — rumus baku, portir dari modul lain (bukan port kode, kode hitungnya tak ditemukan) | §4.1 |
| C2 | CPR + klasifikasi Lebar/Sempit + Posisi + Relasi (6 kelas) | **ADOPSI**, baru total di PAPAN | §4.2 |
| C3 | R:R Setup otomatis | **ADOPSI** | §4.3 |
| C4 | Pola candlestick — Marubozu | **ADOPSI, TERVERIFIKASI** dari sumber | §4.4 |
| C4b | Pola candlestick — Doji/Hammer/Shooting Star/Spinning Top/Engulfing/Harami | **ADOPSI SEBAGAI EKSTENSI PAPAN** — **BELUM DIKONFIRMASI** ada di tradersaham, jangan diklaim "replikasi" | §4.4 |
| C5 | Volume Surge (VPA) | **ADOPSI** — kode `cariLonjakanVolume` sudah ada | §4.5 |
| C6 | Kinerja multi-horizon + proksimitas breakout | **ADOPSI**, tak butuh badge (data murni) | §4.6 |
| C7 | Gating data jujur, generik di semua panel | **ADOPSI WAJIB**, prasyarat bukan fitur | §4.7 |
| D1 | Panel indikator teknikal Tier 1 (RSI/ATR/Stoch/MTF verdict) | **ADOPSI** — fondasinya sudah ada (`skorTeknikal.ts`), sambungkan jangan bangun kedua | §5.1 |
| D2 | Broker-flow label deskriptif (Big/Mild Acc/Dist) | **ADOPSI Tier 1**, ambang **belum dikalibrasi** | §5.2 |
| D3 | TA+Flow Confluence skor 0–100 | **TIER 2 — DIKUNCI** di belakang BT Papan + BadgeRapor, tidak boleh tampil tanpanya | §5.3 |
| E1 | Avg-broker-price line overlay | **ADOPSI** — data `average` per broker sudah ada di 12 varian | §6 |
| E2 | Bubble broker outlier z-score, versi HARIAN | **ADOPSI** — sumber whales.id, versi jam tak bisa | §6 |
| E3 | VWAP anchored | **ADOPSI sebagian** (VWAP ya, CVD/delta sejati tidak) | §6 |
| F1 | TradingView embed | **SKIP TEGAS** — dilarang aturan substrat | §7 |
| F2 | Footprint intraday per broker, orderbook heatmap, replay tick | **SKIP TEGAS** — data tidak kita miliki | §7 |
| F3 | CVD/volume-delta sejati, area breakdown per rentang harga | **SKIP TEGAS** — data tidak kita miliki | §7 |

---

## 1. Arsitektur render

### 1.1 Keputusan mendasar — rekonsiliasi wajib

Audit `audit_chart_custom.md` merekomendasikan "Canvas 2D dua-lapis (base+overlay) dibangun sendiri", karena tradersaham memang begitu (bukan library). **Tapi PAPAN sudah punya substrat resmi**: `app/src/views/dasbor/GrafikEmiten.tsx`, dibangun di atas `lightweight-charts@5.2.1` + `lightweight-charts-drawing` (68 alat gambar) + `lightweight-charts-indicators` (registry 366 rumus via `katalogIndikator.ts`). Ini terverifikasi nyata di kode (`import {...} from 'lightweight-charts'`, `package.json`).

`pengantar_pembagian_kerja.md` butir 1 eksplisit: **WAJIB memakai komponen chart existing PAPAN, DILARANG menambah library/engine chart baru tanpa keputusan tertulis Johan.**

**Keputusan**: seluruh bagian §1 di bawah adalah **pola yang diadaptasi di atas `lightweight-charts` yang sudah ada**, bukan instruksi membangun canvas dari nol. Kebetulan lightweight-charts sendiri secara internal sudah pakai arsitektur canvas berlapis (base series + crosshair pane terpisah) — jadi niat "dua-lapis" dari tradersaham **sudah otomatis terpenuhi oleh library**, tinggal pastikan konfigurasi API-nya (bukan kode canvas manual) disetel sesuai target di bawah.

**Dual-engine positioning (keputusan eksplisit)**: Custom Chart tradersaham = referensi pola UX, `lightweight-charts` = satu-satunya engine PAPAN. TradingView-embed = Tier 3, terlarang tanpa keputusan Johan (lihat §7).

### 1.2 DPR-aware rendering — IMPROVE, bukan bangun baru

- Sumber (tradersaham) DPR ~0.75 (kabur) — jangan ditiru.
- Dua pola sudah eksis di PAPAN untuk kasus lain: `bandingEmiten.ts:575` — **benar**, `Math.min(3, Math.max(1, Math.round(devicePixelRatio)))` (clamp 1–3 + round). `WhalesPapan.tsx:78` — **salah/tidak aman**, `const dpr = window.devicePixelRatio || 1` (raw, tanpa clamp/round — berisiko kanvas raksasa di layar DPR tinggi).
- **Kerjakan**: pastikan `GrafikEmiten.tsx` (lightweight-charts otomatis mengelola DPR internal via opsi chart, cross-check dokumentasi versi 5.2.1) memakai pola `bandingEmiten.ts` sebagai acuan kalau ada override manual — jangan contoh `WhalesPapan.tsx`. Verifikasi tajam di kedua viewport (1920 + 412) × tema terang/gelap (§8).

### 1.3 Crosshair, header, panes tersinkron

- **Crosshair bebas + readout snap**: lightweight-charts native mendukung mode crosshair (`Normal`/`Magnet`) — pemetaan pola tradersaham (garis-H bebas ikut Y kursor, garis-V snap ke bar) = mode `Normal` bawaan library, tinggal dikonfirmasi aktif di `GrafikEmiten.tsx`.
- **Toggle magnet opsional** (snap-ke-OHLC): SKIP untuk rilis ini — nilai-informasi rendah dibanding effort, tidak masuk daftar prioritas Tier 1/2 manapun di audit sumber.
- **Header O/H/L/C/V + %chg ala Mirae**, ikut bar hover (default = bar terakhir): cek dulu apakah legend/crosshair-move-handler `GrafikEmiten.tsx` sudah setara sebelum membangun ulang — kalau belum, tambahkan via `subscribeCrosshairMove` (API lightweight-charts).
- **Panes tersinkron satu crosshair-X**: native ke lightweight-charts multi-pane (harga+volume+indikator berbagi time-scale) — tinggal pastikan semua pane baru (§4) didaftarkan ke chart instance yang sama, bukan chart terpisah.
- **Interaksi** (wheel-zoom anchor-kursor, drag-pan, dblclick-reset): sebagian besar native ke lightweight-charts (`handleScroll`/`handleScale` options) — verifikasi konfigurasi aktif, bukan implementasi manual.

---

## 2. Roster indikator — dari OHLCV (16 disebut eksplisit di audit sumber, header sumber menulis "18" tanpa rekonsiliasi — **diskrepansi ini tidak diselesaikan di sini**, jangan tulis ulang angka "18" sebagai fakta tanpa audit-live susulan)

Semua **100% terhitung dari OHLCV chartbit kita** (open/high/low/close/volume harian 2017–2026, 962 emiten; intraday 1m untuk TF<harian) — nol data baru dibutuhkan. **Status di PAPAN**: registry `lightweight-charts-indicators` sudah berisi 366 rumus (superset besar) — sebelum membangun ulang salah satu di bawah, **cross-check nama-persis di `katalogIndikator.ts` dulu**, jangan asumsikan "sudah ada" tanpa verifikasi baris registry.

### On-chart (overlay harga, tidak dibatasi jumlah)

| Indikator | Formula ringkas | Default | Kepercayaan |
|---|---|---|---|
| EMA | `EMA_t = close_t·k + EMA_{t-1}·(1-k)`, `k=2/(n+1)` | EMA20 & EMA50 | ✓konfirmasi periode |
| MA (SMA) | `Σclose / n` | MA20 | konvensi |
| BOLL (Bollinger) | mid=MA20; upper/lower=`MA20 ± 2·stdev20` | n=20, dev=2 | konvensi |
| SAR (Parabolic) | iteratif `SAR_t = SAR_{t-1} + AF·(EP-SAR_{t-1})` | AF 0.02/0.02/max 0.2 | konvensi |
| BBI | `(MA3+MA6+MA12+MA24)/4` | — | konvensi |

### Pane (bawah) — **tanpa batas keras jumlah** (lihat §2.1)

| Indikator | Formula ringkas | Default | Kepercayaan |
|---|---|---|---|
| VOL | bar volume + MA(volume) | VOL 5/10/20 | ✓konfirmasi |
| RSI | `100-100/(1+RS)` | RSI14 | ✓konfirmasi |
| MACD | DIF=EMA12−EMA26; DEA=EMA9(DIF); histogram=`DIF−DEA` | 12,26,9 | periode ✓konfirmasi; **multiplier histogram (×1 vs ×2) = konvensi, verifikasi nilai piksel ke live sebelum hardcode ×2** |
| KDJ | Stoch %K/%D + %J=3K−2D | 9,3,3 | **konvensi standar KDJ — jangan disamakan dengan "Stochastic(14,3,3)" panel TA terpisah (§5.1), itu indikator beda dengan default beda** |
| WR (Williams %R) | `(HH_n−close)/(HH_n−LL_n)·-100` | n=14 | konvensi |
| CCI | `(TP−MA(TP,n))/(0.015·MeanDev)` | n=20 | konvensi |
| MTM (Momentum) | `close_t−close_{t-n}` | n=10 | konvensi |
| ROC | `(close_t−close_{t-n})/close_{t-n}·100` | n=12 | konvensi |
| OBV | kumulatif volume bertanda arah close | — | konvensi |
| DMI/ADX | +DI/−DI dari directional movement, ADX=smoothed DX | n=14 | **konvensi standar industri — ATR14 terkonfirmasi di panel TA terpisah (§5.1) TIDAK membuktikan default DMI/ADX chart ini; verifikasi live sebelum build** |
| TRIX | rate-of-change EMA tiga-lapis | n=12 | konvensi |

Default aktif saat chart dibuka: **EMA + VOL + RSI** (✓konfirmasi — ini juga jadi basis preset "Standar", §3.2).

### 2.1 Batas jumlah pane — IMPROVE, jangan tiru batas 3

Tradersaham keras membatasi 3 pane. Cek kode PAPAN: `DaftarInstans.tsx` mengelola pane lewat **indeks dinamis** (`chart.panes()`), tidak ditemukan batas struktural. **Keputusan**: PAPAN tidak hard-cap. State-management pane ke-4+: tambahkan ke daftar instans seperti biasa; beri **soft-warning UX** (bukan blocking) kalau pane aktif >5 ("kepadatan layar tinggi, pertimbangkan kurangi indikator"). Ini keunggulan disengaja atas sumber — catat di halaman Metodologi.

### 2.2 Periode indikator editable — sudah lebih baik, tidak perlu kerja

Sumber: periode FIXED, tanpa input inline sama sekali. PAPAN: `ModalSetelanInstans.tsx` sudah punya tab **Inputs** dengan `SpekParam` bertipe int/float/bool/color, min/max per-instans, draf+cancel. **Tidak perlu dibangun** — cukup dicatat sebagai keunggulan terdokumentasi di Metodologi, dan pastikan tiap indikator baru di atas (kalau memang belum ada di registry 366) didaftarkan dengan `SpekParam` yang benar, bukan hardcode periode.

---

## 3. Toolbar & interaksi & preset

### 3.1 Elemen toolbar

| Elemen | Status di PAPAN | Aksi |
|---|---|---|
| TF Daily/Weekly/Monthly | **Sudah ada, lebih lengkap** (`kerangkaWaktu.ts`: D/W/M + 5m/15m/30m/1h/4h) | Tidak ada kerja tambahan |
| TF intraday <harian | Sudah ada jalur (chartbit-intraday 1m, ±90 hari) | Pastikan resample 30m/1h/4h dari 1m dilakukan konsisten (server atau klien — putuskan satu tempat, jangan dobel) |
| Dropdown/pemilih indikator | Existing via `katalogIndikator.ts`/`DaftarInstans.tsx` | Cross-check 16 nama indikator §2 ada di daftar pilih |
| Marker "bar terakhir" | Baru, murah | Highlight visual bar paling kanan |
| Tombol "Bersihkan" (reset indikator) | Baru | Reset daftar instans ke kosong/preset default via `DaftarInstans.tsx` |
| Fullscreen | Baru, trivial | — |
| Wheel-zoom (anchor kursor) / drag-pan / dblclick-reset | Native lightweight-charts, verifikasi opsi aktif | §1.3 |
| Header O/H/L/C/V + %chg | §1.3 | — |
| Panes tersinkron | §1.3 (native) | — |
| Toggle magnet | **SKIP** | §1.3 |

### 3.2 Preset (3 tombol)

Komposisi sumber tak terbaca DOM secara pasti kecuali "Standar" (dikonfirmasi = default aktif EMA+VOL+RSI). PAPAN mendefinisikan sendiri, dicatat eksplisit di Metodologi sebagai bundle PAPAN — **bukan** klaim replikasi 1:1 tradersaham untuk Momentum/Volatil:

- **Standar** (✓konfirmasi dari default) = EMA + VOL + RSI
- **Momentum** (usul PAPAN) = EMA + VOL + MACD + KDJ
- **Volatil** (usul PAPAN) = BOLL + SAR + VOL + ATR/DMI

Mekanisme: tombol preset mengganti seluruh daftar instans `DaftarInstans.tsx` sekaligus (bukan menambah di atas yang ada) — konfirmasi perilaku ini eksplisit saat implementasi (append vs replace), tulis test-case di §8.

---

## 4. Panel analitik

Sumber data seluruh §4: **OHLCV chartbit kita**, dihitung dari **bar final tutup pasar** — jangan pernah dari bar hari berjalan (foreignbuy/sell hari berjalan basi sampai tutup, marketdetectors kosong sampai tutup — dikonfirmasi arsip proyek). Notasi: bar `t` = sesi terakhir tutup. `H,L,C,O` = high/low/close/open bar `t`. `V_t` = volume bar `t`.

### 4.1 Pivot Points klasik

```
P  = (H + L + C) / 3
R1 = 2P − L        S1 = 2P − H
R2 = P + (H − L)   S2 = P − (H − L)
R3 = H + 2(P − L)  S3 = L − 2(H − P)
```

**Status kode**: `Pivot` interface (`P/R1-3/S1-3`) sudah ada di `lib/skor/types.ts`, tapi **fungsi penghitungnya tidak ditemukan di TS manapun** — nilainya kemungkinan dihasilkan pipeline Python dan disimpan statis di `arus-pasar/edisi/*.json`, dibaca oleh `HalamanEmiten.tsx`/`Chart.tsx`. **Kerjakan**: implementasikan rumus di atas sebagai fungsi TS baru yang dinamis untuk emiten/tanggal apa pun dari OHLCV chartbit — **bukan** "portir kode existing" (kodenya tidak ada untuk diportir), portir hanya interface tipe + rumus standar (sudah ✓konfirmasi cocok exact ke angka live: P 10.117, R1 10.458, S1 9.908 pada AADI). Taruh di `GrafikEmiten.tsx` (bukan hanya `arus-pasar/`).

### 4.2 Central Pivot Range (CPR)

```
BC = (H + L) / 2
TC = 2P − BC
```
(kalau `BC > TC` setelah dihitung, tukar label supaya `TC` selalu batas atas)

**Lebar Band**: `LebarBand = |TC−BC|`, `LebarBand % = LebarBand/P × 100%`.

**Klasifikasi Lebar/Sempit** — persentil relatif riwayat emiten sendiri (bukan ambang tetap lintas-emiten):
- Median `LebarBand %` 60 sesi terakhir emiten sama (`m60`).
- **Sempit**: `< 0.7×m60` (potensi trending-day). **Lebar**: `> 1.3×m60` (potensi range-day). **Normal**: di antaranya.
- Gating: riwayat `<30` sesi → fallback ambang tetap `<0.5%` Sempit / `>1.2%` Lebar, label `(ambang default, riwayat kurang)`.

**Posisi harga** (pakai `Close` bar `t`, PAPAN tidak punya feed real-time):
- `Close > TC` → Di Atas CPR. `Close < BC` → Di Bawah CPR. Selainnya → Di Dalam CPR.

**Relasi vs sesi lalu** (bandingkan `(TC,BC)` hari ini vs `(TC_prev,BC_prev)` bar `t−1`) — **6 kelas lengkap, semua wajib diimplementasi**:

| Kelas | Syarat | Bias |
|---|---|---|
| Higher Value | `BC ≥ TC_prev` | Bullish kuat |
| Lower Value | `TC ≤ BC_prev` | Bearish kuat |
| Outside Value | `TC>TC_prev` dan `BC<BC_prev` | Volatilitas naik, potensi reversal |
| Inside Value | `TC<TC_prev` dan `BC>BC_prev` | Volatilitas turun, konsolidasi |
| Overlapping Higher | overlap ada, `P>P_prev` | Bullish ringan |
| Overlapping Lower | overlap ada, `P≤P_prev` | Bearish ringan |

**BadgeRapor**: kelas Relasi (6) dan kelas Posisi (3) = sinyal terpisah. `WIN` = kelas bullish diikuti `Close_{t+H}>Close_{t+1 open}` (entry H+1 open, horizon default H+5); kelas bearish dibalik. Kunci `bt/index.json`: `pivot_cpr.relasi_<kelas>`, `pivot_cpr.posisi_<kelas>` — satu key per kelas, jangan digabung. **Tunduk gerbang Diamond** (lihat §5.0).

### 4.3 R:R Setup (turunan §4.1, tanpa input tambahan)

```
Target   = R1
StopLoss = S1
Reward % = (R1 − Close) / Close × 100%
Risk   % = (Close − S1) / Close × 100%
x        = Reward% / Risk%
```
Tampil: `"Risk : Reward = 1 : x"` (mis. `Reward% 2.0 / Risk% 3.3` → `x≈0.6` → `"1 : 0.6"`, cocok contoh live). Formula tunggal ini — **jangan tulis versi "dibalik" ambigu**, satu rumus saja.

**BadgeRapor**: three-way outcome — Target dulu / SL dulu / tidak keduanya sampai H habis. **Tie-break wajib**: bar dengan `High_t≥Target` DAN `Low_t≤SL` di hari sama (tak bisa dipastikan urutannya dari OHLCV harian; intraday 1m cuma ±90 hari, jauh dari cukup untuk backtest 9 tahun) → **default konservatif: hitung sebagai LOSS**, dan tandai kasus ini di `n` sebagai `ambigu_sama_hari` **terpisah** dari `n` total (jangan diam-diam mendilusi win rate). Kunci: `bt/index.json` → `rr_setup.target_before_stop` (horizon H+5/H+10/H+20). Rekomendasi tampil: agregat lintas-emiten default, drill-down per-emiten kalau `n` emiten sendiri ≥100. **Tunduk gerbang Diamond**.

### 4.4 Pola Candlestick (bar terakhir)

Notasi: `Body=|C−O|`, `Range=H−L`, `UpperWick=H−max(O,C)`, `LowerWick=min(O,C)−L`, `IsBullish=C>O`.

**Terverifikasi di sumber (1 pola)**:

| Pola | Aturan | Bias |
|---|---|---|
| Marubozu (Bull/Bear) | `Body≥0.9×Range` | Bull kalau `IsBullish`, else Bear |

**Ekstrapolasi PAPAN, BELUM DIKONFIRMASI ada di tradersaham (8 pola)** — raw findings hanya menyebut "deteksi pola bar terakhir dari bentuk bodi & ekor" (implikasi **satu bar**), tanpa daftar eksplisit. Dicek silang ke `audit_chart_custom.md`/`audit_tradersaham.md`/`audit_whales_id.md` — **tidak satupun** menyebut Doji/Hammer/Shooting Star/Spinning Top/Engulfing/Harami. 4 pola single-bar berikut masih konsisten skop "bar terakhir" sumber; 4 pola dua-bar (Engulfing/Harami) **kontradiktif** dengan deskripsi sumber ("bar terakhir" = singular):

| Pola | Aturan | Bias | Kelas |
|---|---|---|---|
| Doji | `Body≤0.1×Range` | Netral/reversal-warning | single-bar |
| Hammer | `LowerWick≥2×Body`, `UpperWick≤0.3×Body`, body di sepertiga atas | Bullish (kuat jika setelah downtrend N bar) | single-bar |
| Shooting Star | `UpperWick≥2×Body`, `LowerWick≤0.3×Body`, body di sepertiga bawah | Bearish (kuat jika setelah uptrend) | single-bar |
| Spinning Top | `Body≤0.3×Range`, kedua wick `≥Body` tapi tak ekstrem | Netral, ragu | single-bar |
| Bullish/Bearish Engulfing | bodi hari ini membungkus bodi kemarin, arah berlawanan | Sesuai arah | **dua-bar — [BELUM DIKONFIRMASI DI SUMBER]** |
| Bullish/Bearish Harami | bodi hari ini di dalam bodi kemarin, arah berlawanan | Sesuai arah (lemah) | **dua-bar — [BELUM DIKONFIRMASI DI SUMBER]** |

**Sebelum rilis**: audit ulang live tradersaham (ganti tanggal/emiten sampai ketemu tiap pola) untuk konfirmasi apakah UI-nya genuinely mendeteksi pola dua-bar. Kalau tidak sempat, boleh tetap dibangun (candlestick generik computable & berguna) tapi **jangan diklaim "replikasi tradersaham"** — tulis "ekstensi PAPAN di luar yang teramati di tradersaham" di Metodologi.

Prioritas cek match: kalau >1 pola dua-bar match, Engulfing menang atas Harami (sinyal lebih kuat). Label akhir: `"<Nama Pola> <emoji arah> — <deskripsi 1 baris>"`.

**Perbedaan kelas dari `polaKlasik.ts`**: `polaKlasik.ts` PAPAN sudah punya 16 pola chart klasik (Double Top, H&S, flag, dst — multi-bar/zigzag-pivot-based), **beda kelas total** dari pola candlestick 1–2 bar di atas. Jangan tumpang tindih penamaan di UI.

**Ambang wajib dikalibrasi** lewat BT Papan sebelum rilis publik (angka di atas estimasi literatur standar, belum diuji ke data IDX kita).

**BadgeRapor wajib per-pola** (bukan agregat — win rate Marubozu ≠ Doji secara alami). Kunci: `bt/index.json` → `candlestick.<nama_pola_snake_case>`, tiap key beberapa horizon (H+1/H+5). WIN = entry open H+1, arah `Close_{t+H}` searah bias. **Tunduk gerbang Diamond**.

### 4.5 Volume Surge (VPA)

```
MA20_Vol = rata-rata V dari t−20 s.d. t−1   (TIDAK termasuk V_t)
Surge %  = (V_t − MA20_Vol) / MA20_Vol × 100%
```

Klasifikasi (ambang awal, **perlu kalibrasi BT** — sama seperti §4.4):
- `≥100%` Sangat Tinggi · `50–100%` Tinggi (cocok contoh live "+50% Volume Tinggi") · `−30%..50%` Normal · `≤−30%` Rendah.

**Status kode**: `grafikEmiten.ts` → `cariLonjakanVolume` sudah ada dengan `ParamLonjakanVolume` (periode/ambang/ambangKuat) — **tinggal wire jadi badge di panel chart**, jangan tulis ulang logikanya.

**BadgeRapor**: "Volume Tinggi/Sangat Tinggi pada bar bullish diikuti kenaikan H+N" — dipecah per kombinasi `{klasifikasi volume}×{arah bar t}` (VPA klasik: volume = konfirmasi bukan prediksi arah sendirian). Kunci: `bt/index.json` → `volume_surge.<kelas>_<arah>`. **Tunduk gerbang Diamond**.

### 4.6 Kinerja Harga Multi-Horizon & Proksimitas Breakout

Return historis (fakta masa lalu, bukan prediksi — pakai sesi bursa bukan hari kalender):
```
Return_1D = (C_t−C_{t-1})/C_{t-1}×100%
Return_1W = (C_t−C_{t-5})/C_{t-5}×100%    (5 sesi)
Return_1M = (C_t−C_{t-21})/C_{t-21}×100%  (21 sesi)
Return_3M = (C_t−C_{t-63})/C_{t-63}×100%  (63 sesi)
```

Jarak ke level kunci (turunan §4.1/§4.2):
```
Jarak_R1/S1/TC/BC % = (Level − C_t) / C_t × 100%
```

**Tidak butuh BadgeRapor** — Return historis = fakta murni, Jarak-ke-level sudah diwakili badge §4.1/§4.3. Panel murni pelaporan angka, sesuai adendum "halaman data murni tidak diberi badge".

### 4.7 Gating Data Jujur — WAJIB di seluruh §4, prasyarat bukan panel

Banner **di atas seluruh grup panel** (satu tempat baca), format persis pola live:

> **"Periode `{N}` sesi belum cukup untuk: {daftar metrik gagal syarat}. Perpanjang rentang tanggal."**

| Metrik | Bar minimum | Catatan |
|---|---|---|
| Pivot & CPR (level) | 2 | Nyaris tak pernah gagal |
| Relasi CPR vs sesi lalu | 3 | |
| Klasifikasi Lebar/Sempit | 30 | `<30` → fallback ambang tetap, label `(ambang default, riwayat kurang)` — **bukan gate total** |
| R:R Setup | 2 | |
| Candlestick 1-bar | 1 | Marubozu/Doji/Hammer/Shooting Star/Spinning Top |
| Candlestick 2-bar | 2 | Engulfing/Harami |
| Volume Surge | 21 | `<21` → **gate total**, jangan tampilkan MA20 parsial |
| Return 1D/1W/1M/3M | 2/6/22/64 | |

Metrik gagal syarat → **jangan tampilkan angka apa pun** (bukan "0.0%"/"−"), placeholder `"— (butuh {minimum} sesi, tersedia {N})"`, masuk daftar banner. Ini pola generik **wajib direplikasi ke tiap panel/indikator yang butuh histori panjang** di seluruh spek ini — bukan sekali pasang di satu tempat.

---

## 5. TA + Flow Confluence & Verdict panel

### 5.0 Prinsip pembeda Tier 1 vs Tier 2

| | Tier 1 — Indikator & Broker Flow | Tier 2 — Confluence |
|---|---|---|
| Apa | Pembacaan langsung 1 indikator (RSI=73, Big Accumulation) | Skor 0–100 hasil jumlah-bobot banyak sinyal |
| Sumber kebenaran | Rumus matematika baku, tampil tanpa backtest | Kombinasi+bobot = klaim performa implisit, wajib BT Papan |
| Framing | Deskriptif ("RSI 73 — jenuh beli"), bukan rekomendasi aksi | Skor + label KONFLUENSI + BadgeRapor lengkap, tanpa badge = tidak tampil |
| Gerbang Diamond | **Perlu konfirmasi Johan** — draft mengasumsikan tidak kena (fakta matematika, bukan "rapor fitur"), tapi `adendum_rapor_badge.md` tidak eksplisit mengecualikan level komponen. **Jangan implementasi sebelum dikonfirmasi.** | **Ya, wajib**, sama seperti seluruh keluaran rapor fitur |
| Gate BT Papan | Tidak wajib untuk tampil sendiri, tapi wajib diuji satu-satu **sebelum** jadi input skor Tier 2 | Wajib — skor final baru tampil setelah ≥1 run `bt_papan.py` mencakup kombinasi bobot |

### 5.1 Panel Indikator Teknikal (Verdict) — Tier 1

| Indikator | Rumus/sumber | Ambang label |
|---|---|---|
| MA verdict | EMA20 vs harga (pakai nilai sama dengan §2 chart, **jangan hitung ulang**) | "Di atas EMA20"/"Di bawah EMA20" |
| RSI(14) | Wilder standar | >70 Overbought · <30 Oversold · else Netral |
| ATR(14) | Average True Range | Angka mentah, tanpa label kualitatif |
| Stochastic(14,3,3) | %K periode14, %D SMA3(%K), smoothing3 | >80 Overbought, <20 Oversold, else Netral |
| Multi-Timeframe D/W | Resample harian→mingguan (close=Jumat/hari bursa terakhir), ulangi RSI/MA | Verdict D & W berdampingan, **tidak** digabung otomatis (itu baru di §5.3) |

**Status kode**: `skorTeknikal.ts` (SSS Score D/W/M, kloning metode Technical Rating, 18/26 komponen) **sudah ada** dan dipakai di Screener. **Cek dulu** apakah sudah tersambung sebagai panel di `GrafikEmiten.tsx` — kalau belum, **sambungkan**, jangan bangun mesin verdict kedua yang beda metode (2 sumber kebenaran teknikal = risiko inkonsistensi).

**Gating**: RSI/Stoch/ATR → 14+ bar; MTF Weekly → minimal **11 minggu** (≈55 sesi bursa, sesuai ambang live tradersaham) sebelum verdict Weekly tampil. Emiten IPO 2026 (7 emiten baru, per riwayat panen 26 Agu) = test-case wajib untuk gate ini (§8).

**Framing keras**: label kualitatif = deskripsi kondisi, bukan instruksi ("RSI 73 — jenuh beli", bukan "SELL SEKARANG"). Warna boleh (merah Overbought/hijau Oversold), teks tetap netral. Konsisten pola badge RBS/Gap yang sudah ada.

### 5.2 Broker Flow ringkas — Tier 1 (label) vs Tier 2 (klaim)

**Definisi lengkap dari sumber** (`audit_tradersaham.md`, Tier 1): rumus = **directionality (net÷gross) + z-score volume** — **dua faktor**, bukan satu. Draft sebelumnya menyederhanakan ke directionality saja tanpa menyebut z-score; **spek final memasukkan keduanya**:

```
directionality = net_value / gross_value   (per broker, window default 5 hari bursa)
z_score_volume = (vol_broker_t − mean(vol_broker, 20)) / stdev(vol_broker, 20)
```

**[AMBANG BELUM DIKALIBRASI — isi setelah BT Papan komponen ini jalan]** — 5 label di bawah dari kombinasi directionality+z-score, **jangan sajikan sebagai tabel final sebelum kalibrasi**:

| Label | Arah kasar (belum final) |
|---|---|
| Big Accumulation | net-buy dominan, directionality tinggi & konsisten, z-score tinggi |
| Mild Accumulation | net-buy dominan, directionality/z-score rendah |
| Netral | tak dominan |
| Mild Distribution | net-sell dominan, directionality/z-score rendah |
| Big Distribution | net-sell dominan, directionality tinggi & konsisten, z-score tinggi |

**Boleh tampil Tier 1** (fakta deskriptif tentang perilaku broker minggu ini) — **sampai** dipasangkan dengan klaim implikasi harga ("Big Acc → harga naik") atau dipakai sebagai komponen skor §5.3, yang jadi klaim prediktif dan wajib BT Papan+BadgeRapor+Diamond penuh (sesuai roadmap Broker Summary v2 di `spek_preset_winrate_rekap.md` — bukan diduplikasi di sini, hanya dikonfirmasi konsisten).

### 5.3 TA + Flow Confluence 0–100 — Tier 2 penuh, DIKUNCI BadgeRapor

Audit tradersaham menampilkan "32/100 KONFLUENSI SELL" sebagai angka tunggal meyakinkan — penjumlahan-berbobot dari sinyal §5.1/§5.2 yang belum tentu terbukti masing-masing. **PAPAN tidak boleh menampilkan angka komposit tanpa jalur pembuktian di belakangnya.**

```
skor_confluence = Σ (bobot_i × sinyal_i)   untuk komponen aktif
```

- Bobot awal **wajib** dari hasil BT Papan per-komponen, bukan tebakan. Komponen tanpa hasil BT → **dikeluarkan eksplisit** dari skor (bukan diberi bobot 0 diam-diam), UI tampilkan alasan ("RSI belum diuji BT — tidak ikut skor").
- **Tombol "tune" (bobot manual)** boleh diadopsi sebagai sandbox eksplorasi — hasilnya **tidak pernah** tampil dengan BadgeRapor "resmi", tandai visual beda jelas: "Skor kustom (belum teruji)" vs "Skor Papan (BT: n=…)". Konsisten `adendum_rapor_badge.md`: badge hanya membaca berkas beku, tidak ada jalur edit dari UI.
- Skor default (bukan tune manual) hanya tampil kalau ada entri `bt/index.json` untuk strategi "beli/jual berdasar skor ≥/≤ ambang X, tahan H+N": `win % · horizon · n · rentang data`, warna hijau≥55%/abu 45–55%("belum terbukti unggul")/merah<45%, cap "sampel kecil" n<100.
- Belum pernah diuji sama sekali → **jangan tampilkan angka**, placeholder `"Confluence — belum diuji BT Papan"` + tombol "uji strategi ini di BT Papan" (pola sama Screener preset di `adendum_rapor_badge.md`).
- Label kualitatif (KONFLUENSI SELL/BUY/NETRAL) hanya muncul **bersamaan** dengan BadgeRapor, tidak pernah sendirian.
- **Gerbang Diamond aktif penuh** (`raporDiamondOnly`).

**Dilarang eksplisit**: skor tanpa BadgeRapor; bobot dari intuisi tanpa hasil BT per-komponen; menyamakan "belum diuji" dengan skor netral 50 (itu menyembunyikan ketidakpastian sebagai kepastian palsu — komponen belum-teruji harus **dikeluarkan**, bukan diberi nilai tengah).

### 5.4 Peta data & dependency

| Kebutuhan | Sumber |
|---|---|
| RSI/MA/ATR/Stoch/MTF | `ohlcv_stockbit/<KODE>.json` — 963/963 emiten lengkap |
| Broker flow directionality+z-score | `_arsip-mentah/broker-harian/` (varian GROSS harian, kanonik per Matriks Sumber `referensi_idx-statistik.md`) |
| Hasil BT per-komponen & skor komposit | `data-idx/json/bt/<strategi>-<hash>.json` + `bt/index.json`, mesin `scripts/riset/bt_papan.py` — **dependency wajib duluan** dari §1 Master Dispatch |

**Urutan kerja**: BT Papan harus ada sebelum §5.3 tampil apa pun selain placeholder. §5.1 dan §5.2 (label deskriptif) bisa paralel, tak menunggu BT.

---

## 6. Pemetaan ke PAPAN & IMPROVE

Fondasi PAPAN nyata (dicek kode): `GrafikEmiten.tsx` + `lightweight-charts`, `kerangkaWaktu.ts` (5m–M), `polaKlasik.ts` (16 pola multi-bar, mesin backtest sendiri `backtest-pola-klasik.ts`), `strukturPasar.ts` (swing/patahan/PRZ), `grafikEmiten.ts`→`cariLonjakanVolume`, `skorTeknikal.ts` (SSS Score), `ModalSetelanInstans.tsx` (periode editable), pola gating jujur lazim di `PanelAliranAsing.tsx`/`PanelBreadth.tsx`/`bedahEmiten.ts`/`emaWatchlist.ts`. **Belum ada**: CPR, R:R-setup panel chart, confluence, pivot dinamis di `GrafikEmiten.tsx`.

### 6.1 Di mana PAPAN sudah/bisa melebihi tradersaham

| Dimensi | tradersaham | PAPAN nyata | Kesimpulan |
|---|---|---|---|
| Jumlah indikator | 16-18 tipe fixed | Registry 366 rumus | **Menang ~20×**, sudah terpasang — cross-check nama, jangan bangun ulang |
| Periode indikator | FIXED, tak ada input | `ModalSetelanInstans.tsx` — editable per-instans | **Sudah lebih baik**, tak perlu kerja |
| Batas pane | Keras 3 | Indeks dinamis, tak ada batas struktural | Biarkan bebas, soft-warning >5 |
| DPR/ketajaman | ~0.75 (buram) | `bandingEmiten.ts` sudah clamp+round benar; `WhalesPapan.tsx` **belum** (raw dpr, TIDAK aman) | Wajib pastikan `GrafikEmiten.tsx` ikut pola `bandingEmiten.ts`, bukan `WhalesPapan.tsx` |
| Kedalaman historis | ~6 bulan (sering gating) | 2017–2026, 962 emiten | Menang telak, indikator EMA200/return 1Y jarang gate |
| Timeframe | D/W/M saja | D/W/M + 5m/15m/30m/1h/4h | Lebih lengkap |
| BadgeRapor / win-rate | **Tidak ada sama sekali** — confluence 92/100 tanpa bukti | Adendum BadgeRapor mengikat SEMUA fitur PAPAN | **Pembeda struktural terbesar** — tiap panel baru (§4/§5) WAJIB lahir dengan BadgeRapor menempel, bukan ditempel belakangan |
| Tema terang/gelap | Tak terverifikasi fokusnya | `GrafikEmiten.tsx` sudah `useTheme()` | Wajib panel baru ikut kontrak tema, jangan hardcode warna |
| Gating data jujur | Ada (pola dicontohkan) | Sudah konvensi baku lintas-modul PAPAN | Bukan meniru — panel baru cukup ikut konvensi rumah sendiri |
| Foreign flow | Estimasi dari harga closing | Angka asing **resmi** langsung dari chartbit (foreignbuy/foreignsell) | Sudah lebih baik — tulis di Metodologi, jangan tiru cara estimasi mereka |

### 6.2 Tabel pemetaan fitur → komponen PAPAN (ringkas dari §0, item baru yang belum tercakup)

| Fitur | Komponen PAPAN | Sumber data |
|---|---|---|
| CPR+klasifikasi | Panel baru di sisi `GrafikEmiten.tsx` | OHLCV chartbit |
| R:R Setup | Panel kecil `GrafikEmiten.tsx` atau kalkulator ke-4 **Kuli Papan** | Pivot (turunan OHLCV) |
| Candlestick 1-2 bar | Panel baru, **beda kelas** dari `polaKlasik.ts` (16 pola multi-bar) | OHLCV chartbit |
| Return multi-horizon+gating | Portir pola gating existing (`PanelAliranAsing.tsx` dkk) ke panel Teknikal | OHLCV chartbit |
| Avg-broker-price line | Overlay `GrafikEmiten.tsx` | `average` per broker per hari, broker summary 12 varian |
| Bubble broker outlier (z-score, harian) | Overlay `GrafikEmiten.tsx` atau Broker Summary v2 | **Sumber: whales.id** (§audit_whales_id.md kesimpulan) — **bukan** "Tier 1 tradersaham", Tier tradersaham tak memuat fitur ini |
| VWAP anchored | `katalogIndikator.ts` (cek rumus VWAP di 366 dulu) | OHLCV chartbit/intraday 1m — CVD tetap tidak bisa (tanpa sisi beli/jual per transaksi) |

---

## 7. SKIP tegas

- **TradingView embed** — substrat sudah final `lightweight-charts`; dependensi pihak ketiga baru dilarang tanpa keputusan tertulis Johan (`pengantar_pembagian_kerja.md` butir 1).
- **Footprint intraday per broker** (per level harga, agresif/pasif) — data tidak kita miliki. Marketdetectors Stockbit = harian, tanpa level harga, tanpa pemisahan agresif/pasif. Inti nilai jual whales.id dari rekaman running-trade+orderbook per broker — kelas data yang tidak dipanen dan tidak tersedia publik.
- **Heatmap orderbook historis + ladder + Replay** — butuh snapshot orderbook penuh (whales.id: `obData[]` zlib per jam); kita hanya punya antrean penutupan IDX 1 titik.
- **CVD/volume-delta sejati** — bar 1 menit chartbit punya OHLC+volume+freq tapi tanpa sisi beli/jual per transaksi. VWAP tetap bisa, CVD tidak.
- **Area breakdown per rentang harga (drag-select)** — butuh data per level harga, tidak ada. Per rentang tanggal tetap bisa (sudah tercakup broker summary biasa).
- **Net Flow Foreign "estimasi dari harga closing"** ala tradersaham/whales.id — **tidak perlu ditiru**, kita punya angka asing resmi per hari langsung dari chartbit, lebih baik dari estimasi mereka. Tulis keunggulan di Metodologi.
- **Peta Investor graph, UBO AI-text, SID/holder>1% bulanan** — butuh panen sumber baru (PDF IDX/KSEI) belum kita miliki; masuk backlog panen data, bukan spek chart Teknikal ini.
- **GEM SCORE komposit / tier Diamond ala tradersaham** — skor gabungan tanpa bukti win rate. Kalau dibangun, hanya setelah komponen lolos BT Papan satu-satu (§5.3) + wajib BadgeRapor — jangan tiru cara mereka menyembunyikan metodologi skor.

---

## 8. Kriteria Terima per fitur + urutan kerja

### 8.1 Kriteria Terima 6 butir (wajib, dari `pengantar_pembagian_kerja.md`, lahir dari insiden Whales Papan: "selesai + direview" tapi candle rusak, kotak tak interaktif, angka tak cocok, library baru ditempel, default hilang, akar: reviewer tak pernah buka halaman)

1. **Substrat dikunci** — semua fitur §0 dibangun sebagai penambahan ke `GrafikEmiten.tsx`/`katalogIndikator.ts`/`DaftarInstans.tsx` existing. Dilarang library/engine baru tanpa keputusan tertulis Johan.
2. **Verifikasi visual di browser** — chrome-devtools MCP, screenshot **2 viewport** (1920 desktop + 412 mobile, per catatan konflik di pembuka dokumen) × tema terang/gelap, dibandingkan berdampingan dengan mockup/acuan. Candle harus terlihat candle.
3. **Interaktivitas diklik nyata** — tiap elemen baru (toggle preset, dropdown indikator, tombol Bersihkan, panel CPR expand, dsb) diuji klik via chrome-devtools, hasil perubahan diverifikasi.
4. **Angka dicocokkan ke arsip** — minimal 1 emiten × 1 tanggal per fitur baru (pivot, CPR, R:R, volume surge, avg-broker-line) dihitung manual dari arsip (`ohlc/`, `broker_harian/`), dicocokkan persis ke tampilan layar.
5. **Default state dites eksplisit** — TF bawaan, preset bawaan (Standar), horizon bawaan panel baru — di-assert saat halaman pertama dibuka, bukan diasumsikan dari kode.
6. **Laporan agent wajib memuat**: model yang dipakai, bukti lulus butir 1–5 (screenshot/angka) per fitur. Tanpa bukti = laporan ditolak.

### 8.2 Uji regresi tambahan khusus §5 (Confluence)

1. **Gating jujur**: emiten IPO 2026 (bar<55) → banner MTF Weekly muncul, bukan angka palsu. Emiten riwayat lengkap (BUMI/ANTM/TLKM) → semua indikator normal.
2. **Framing deskriptif**: RSI>70 → teks "jenuh beli", bukan "Sell"/"Beli" di label indikator tunggal manapun.
3. **Confluence tanpa BT**: kosongkan `bt/index.json` untuk kombinasi tertentu → skor tidak tampil, placeholder "belum diuji BT Papan" + tombol uji.
4. **Confluence dengan BT + n kecil**: entri n<100 → cap "sampel kecil" tampil di BadgeRapor.
5. **Tune sandbox**: ubah bobot manual → skor berubah TAPI label/warna visual beda dari skor default (tidak menimpa BadgeRapor resmi).
6. **Gerbang Diamond**: akun non-Diamond → §5.3 (dan klaim prediktif §5.2 lapis kedua) tersembunyi/terkunci. §5.1 dan §5.2 label deskriptif murni — **tunggu konfirmasi Johan** (§5.0) apakah ikut terkunci atau tidak sebelum implementasi final.
7. **Tie-break R:R same-day**: buat kasus sintetis `High≥Target` dan `Low≤SL` di bar sama → hasil harus LOSS + masuk `ambigu_sama_hari`, bukan diam-diam dihitung WIN.

### 8.3 Urutan kerja (murah→mahal, prioritaskan yang sudah ada kodenya)

1. **Verifikasi & sambungkan yang sudah ada tapi terpisah**: portir formula Pivot Points ke `GrafikEmiten.tsx` (interface saja, hitung baru — §4.1); cek `skorTeknikal.ts` sudah tersambung sebagai panel chart atau baru Screener (§5.1); cek DPR `GrafikEmiten.tsx` vs `bandingEmiten.ts`/`WhalesPapan.tsx` (§1.2/§6.1); cross-check 16 nama indikator §2 vs registry 366.
2. **Bangun murni turunan OHLCV, murah**: CPR (§4.2), R:R Setup (§4.3), jarak ke level kunci (§4.6), tombol bar-terakhir/Bersihkan (§3.1), 3 preset (§3.2), Volume Surge wiring (§4.5).
3. **Bangun butuh broker summary, sedang**: avg-broker-line overlay, bubble broker outlier harian (§6.2).
4. **Candlestick**: Marubozu dulu (terverifikasi), 4 pola single-bar lain, baru Engulfing/Harami dengan label eksplisit "ekstensi PAPAN" (§4.4) — audit-live susulan sebelum klaim "replikasi".
5. **Tier 2 — uji BT Papan dulu**: komponen confluence satu-satu, baru gabung skor (§5.3). Dependency: `bt_papan.py` mesin harus ada duluan.
6. **Terakhir, di semua fitur di atas**: pasang BadgeRapor (adendum wajib) sebelum dianggap selesai — bukan ditempel belakangan.

---

> **⚠️ KOREKSI LINTAS-SPEK 26 Agu 2026 — kedalaman arsip OHLCV.**
> Beberapa spek di folder ini menulis OHLCV harian "2017–2026" (≈10 tahun). **Itu SALAH — understated.** Terukur langsung dari `ohlcv_stockbit/`:
> IHSG **1997-07-01** · ASII **2000-10-17** · BUMI **2003-01-01** · BBCA & TLKM **2004-01-02** · SIDO 2013-12-18 (tanggal IPO-nya) — semua sampai 2026-08-21.
> Jadi OHLCV = **20–30 tahun** untuk emiten lama, bukan 10. Angka "2017" itu tercampur dari **lantai BROKER** (yang benar pun **2016-01-04**, terbukti lewat uji 2015 yang nihil).
> **Yang benar: OHLCV ≈ 1997/2000-an→2026 (per emiten, sejak IPO) · BROKER 2016→2026 · INTRADAY 1m ±90 hari (panen rutin sejak 26 Agu 2026).**
> Dampak: Seasonality boleh memakai 20+ tahun (bukan 10), backtest BT Papan punya sampel jauh lebih panjang, dan klaim "menang telak atas riwayat pesaing" justru lebih kuat dari yang tertulis.
