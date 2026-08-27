> ⚠️ **KOREKSI PENTING (26 Agu 2026) — spek yang berlaku = `audit_chart_custom_LENGKAP.md`.**
> Berkas ini benar soal SITUS tradersaham (chart mereka hand-rolled Canvas 2D, bukan library). TAPI rekomendasi "bangun Canvas 2D dua-lapis sendiri" **KELIRU untuk konteks PAPAN**: verifikasi kode 26 Agu membuktikan PAPAN SUDAH memakai **lightweight-charts@5.2.1** + `lightweight-charts-drawing` + `lightweight-charts-indicators` (registry 366 rumus) di `app/src/views/dasbor/GrafikEmiten.tsx`. Aturan substrat = pakai/kembangkan itu, JANGAN bangun engine baru. Arsitektur "dua-lapis" sudah otomatis dipenuhi lightweight-charts secara internal — yang perlu cuma menyetel API-nya (crosshair Normal, `subscribeCrosshairMove` untuk header, multi-pane sinkron). Detail lengkap + rumus + verdict ada di `audit_chart_custom_LENGKAP.md`.

---

Dari sesi AI Skill (Fable), 26 Agu 2026 — **AUDIT TEKNIS Custom Chart tradersaham** (permintaan Johan: "pastikan chart custom ini canvas nya pakai apa, kok lebih interaktif — garis putih di kursor tidak melekat pada candle tapi membaca candle"). Diinspeksi via chrome-devtools di halaman `stock-profiler?tab=technical` (AADI), toggle Custom Chart aktif.

# Jawaban langsung
**Bukan library chart apa pun.** Terdeteksi di `window`: TradingView=false, LightweightCharts=false, klinecharts=false, echarts=false, Highcharts=false, Chart.js=false, uPlot=false, d3=false. Satu-satunya lib grafik ada `ApexCharts` — itu hanya untuk sparkline/kartu kecil, BUKAN chart utama. **Chart utama = Canvas 2D digambar tangan sendiri (custom renderer).**

# Kenapa terasa "halus & interaktif" — arsitektur DUA LAPIS CANVAS
Per pane (harga, volume, RSI) ada **dua elemen `<canvas>` bertumpuk** di satu wrapper `position:absolute`, keduanya `z-index:2`:
- **Canvas BASE (bawah)** — menggambar candle + MA/EMA + grid + sumbu. Digambar ULANG **hanya** saat data/zoom/pan/indikator berubah. Berat tapi jarang.
- **Canvas OVERLAY (atas)** — menggambar **crosshair (garis putih) + label sumbu + tooltip/readout**. Digambar ulang **tiap `mousemove`** (via `requestAnimationFrame`), dan hanya meng-`clearRect` lapisan tipis ini — base tidak tersentuh.

Efeknya: gerak crosshair 60fps mulus karena tiap frame cuma menghapus+menggambar garis, bukan ratusan candle. Inilah rahasia "lebih interaktif" dibanding menggambar semua di satu canvas.

# Kenapa garis putih "tidak melekat candle tapi membaca candle" — CROSSHAIR BEBAS + READOUT SNAP
- **Garis horizontal** mengikuti **Y kursor persis** (bebas) → menampilkan **harga-di-kursor** pada label sumbu kanan (tag harga yang menyorot mengikuti kursor, bukan harga candle). Karena itu garisnya tidak menempel ke high/low/close candle.
- **Garis vertikal + readout** melakukan **snap ke indeks bar terdekat**: dari X kursor dihitung `barIndex = round((mouseX - plotLeft) / barWidth)`, lalu tanggal bar tampil di sumbu X (terbukti: label "2026-03-17" muncul di sumbu saat kursor di tengah) dan **O/H/L/C/V di header ikut bar itu**. Jadi angka "membaca candle" walau garisnya bebas.
- Ringkas: **magnet OFF untuk garis, ON untuk data**. (TradingView menyebutnya crosshair "normal" vs "magnet"; di sini garis normal, tapi tooltip selalu bar-snapped.)

# Detail piksel & DPR (untuk implementor PAPAN)
- Ukuran contoh: CSS 1237×364, backing store `canvas.width/height` 928×273 → rasio ~0.75. Artinya mereka men-set backing store < CSS (kemungkinan efek zoom/skala). **Rekomendasi PAPAN LEBIH BAIK**: set backing store = `Math.round(cssW * devicePixelRatio)` dan `ctx.scale(dpr,dpr)` supaya candle tajam di layar HiDPI (jangan tiru rasio 0.75 mereka yang malah menurunkan ketajaman).
- Header O/H/L/C/V + perubahan% ala Mirae ada di atas chart, ikut bar hover (default = bar terakhir).
- Toggle **TradingView vs Custom Chart**: mereka menyediakan dua-duanya; Custom Chart = renderer sendiri (yang ini). Timeframe Daily/Weekly/Monthly, preset indikator Standar/Momentum/Volatil, tombol "Bersihkan".

# ==== SPEK untuk PAPAN (chart custom sendiri — WAJIB, konsisten aturan substrat) ====
Bangun komponen chart PAPAN sebagai **Canvas 2D dua-lapis** (base + overlay), BUKAN lightweight-charts/TradingView (aturan substrat: pakai/kembangkan kanvas PAPAN sendiri; insiden Whales Papan = jangan tempel library baru).

Kontrak komponen:
1. **Dua canvas bertumpuk** per pane: `<canvas base>` (candle/MA/EMA/grid/axis) + `<canvas overlay>` (crosshair/label/tooltip). Overlay `pointer-events` menangkap mousemove; base hanya redraw saat data/zoom/pan/indikator berubah.
2. **DPR-aware**: backing store = `cssPx * devicePixelRatio`, `ctx.scale(dpr,dpr)`. Candle tajam di 3 ukuran layar (uji wajib desktop 1920 + mobile 412 + tema terang/gelap).
3. **Crosshair bebas + readout snap**: garis-H ikut Y kursor (label harga-di-kursor sumbu kanan), garis-V + header O/H/L/C/V + label tanggal sumbu-X snap ke `barIndex` terdekat. Sertakan toggle magnet (opsional) untuk versi menempel-ke-OHLC.
4. **Panes tersinkron**: harga + volume + RSI berbagi sumbu-X & crosshair X yang sama (satu overlay controller).
5. **Header ala Mirae**: O/H/L/C/V + %chg mengikuti bar hover (default bar terakhir).
6. **Indikator on-chart** (EMA/MA/BOLL/SAR/BBI) di base layer; **pane** (VOL/RSI/MACD/KDJ/WR/CCI) sebagai canvas base tambahan. Preset Standar/Momentum/Volatil.
7. **Interaksi**: wheel = zoom sumbu-X (anchor di kursor), drag = pan, dblclick = reset. Semua hanya redraw base saat berhenti (debounce) + overlay tiap frame.
8. **Sumber data**: OHLCV chartbit kita (harian; intraday 1m dari endpoint intraday yang sudah dispek bila TF < harian). Semua indikator dihitung di klien dari bar (transparan, bisa diuji).
9. **Panel samping "TA + Flow Confluence"** (opsional, sudah dianalisa di audit_tradersaham): skor gabungan HANYA bila komponennya lolos BT Papan; jangan tiru angka komposit tanpa bukti.

Verdict: **ADOPSI arsitektur dua-lapis canvas + crosshair bebas/readout-snap.** Ini menjawab "chart halus" yang Johan suka, dan bisa dibangun penuh dari data kita tanpa library pihak ketiga.
