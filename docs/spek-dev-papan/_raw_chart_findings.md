# TEMUAN MENTAH — Custom Chart tradersaham (audit live Fable, 26 Agu 2026, halaman stock-profiler?tab=technical, emiten AADI)
(Inspeksi chrome-devtools di Chrome asli Johan/login. Ini bahan mentah untuk spek; jangan diringkas hilang.)

## DUA ENGINE CHART (toggle)
- **Custom Chart** = renderer Canvas 2D tangan sendiri (BUKAN library — TradingView/lightweight-charts/klinecharts/echarts semua false; ApexCharts hanya sparkline kartu kecil). Dua canvas bertumpuk per pane (base candle jarang-redraw + overlay crosshair tiap mousemove). Crosshair: garis putih bebas ikut Y kursor (label harga-di-kursor sumbu kanan), garis-V + header O/H/L/C/V + tanggal snap ke barIndex terdekat (magnet-off garis / magnet-on data). DPR mereka ~0.75 (PAPAN sebaiknya cssPx×dpr).
- **TradingView** = widget TradingView asli di-embed (badge "TRADINGVIEW POWERED", toolbar TV sendiri: 1m/30m/1h/D, tombol "Indicators" = katalog indikator TV penuh). Toggle "Open in TradingView" buka di TV.com. → Untuk PAPAN: bangun Custom Chart sendiri; embed TradingView = Tier 3 (jangan, dependensi pihak ketiga).

## ROSTER INDIKATOR CUSTOM CHART (18 tipe) + constraint "maks 3 pane"
DI CHART (aktif default): **EMA** (Exponential MA, on-chart/harga; header EMA(20,50) → EMA20 & EMA50) · **VOL** (Volume, pane; VOL(5,10,20) = MA volume 5/10/20) · **RSI** (pane; RSI(14)).
TAMBAH INDIKATOR:
- On-chart (harga/overlay): **MA** (Moving average) · **BOLL** (Bollinger bands) · **SAR** (Parabolic SAR) · **BBI** (Bull & bear index).
- Pane (bawah): **MACD** (default 12,26,9 — DIF/DEA + histogram, terverifikasi render) · **KDJ** (stochastic) · **WR** (Williams %R) · **CCI** · **MTM** (Momentum) · **ROC** (Rate of change) · **OBV** (On balance volume) · **DMI** (DMI/ADX) · **TRIX**.
- **Batas: maksimal 3 pane aktif** bersamaan (VOL+RSI+MACD = 3). On-chart overlay tak dibatasi.
- Periode indikator tampaknya default tetap (tidak ada input inline user; EMA 20/50, VOL 5/10/20, RSI 14, MACD 12/26/9, ATR 14, Stoch 14,3,3).

## PRESET (3, tombol toolbar): **Standar · Momentum · Volatil** — bundle indikator siap-pakai (Standar=EMA+VOL+RSI; Momentum≈+MACD/Stoch/RSI; Volatil≈+BOLL/ATR/SAR — komposisi persis di canvas, tak terbaca DOM; PAPAN bebas definisikan bundle sendiri).

## TOOLBAR CHART (Custom mode): toggle TradingView/Custom · TF **Daily/Weekly/Monthly** · **Indikator** (dropdown roster) · preset Standar/Momentum/Volatil · **"bar terakhir"** (marker bar terakhir) · **"Bersihkan"** (reset indikator) · **"Open in TradingView"** · **fullscreen**. Header O/H/L/C/V + %chg ala Mirae (ikut bar hover, default bar terakhir). Interaksi: wheel zoom, drag pan (standar).

## PANEL ANALITIK (kanan + bawah chart — semua dari data IDX, independen engine)
### LEVEL PIVOT & CPR — "Sesi Berikutnya" (proyeksi pivot sesi depan)
- Pivot klasik: R3 11.008 · R2 10.667 · R1 10.458 · **P 10.117** · S1 9.908 · S2 9.567 · S3 9.358. (rumus pivot standar: P=(H+L+C)/3, R1=2P−L, S1=2P−H, dst.)
- **CENTRAL PIVOT RANGE (CPR)**: TC 10.183 · Pivot 10.117 · BC 10.050 · **Lebar Band 133 (1.30%)** → klasifikasi lebar CPR **"Lebar"/"Sempit"** (CPR sempit = potensi trending-day; lebar = range-day).
- **POSISI HARGA**: "Di Atas CPR — cari peluang long / buy on dip ke TC." (klasifikasi: Di Atas / Di Dalam / Di Bawah CPR).
- **RELASI VS SESI LALU**: "Higher Value — CPR naik penuh di atas CPR kemarin — bias bullish kuat." (klasifikasi CPR standar: Higher Value / Lower Value / Overlapping Higher / Overlapping Lower / Inside / Outside.)

### R:R SETUP: R:R 1 : 0.6 · Target(R1) 10.458 (+2.0%) · Stop Loss(S1) 9.908 (−3.3%). (auto dari pivot: target=R1, SL=S1.)

### POLA CANDLESTICK (Daily Bar): deteksi pola bar terakhir dari bentuk bodi & ekor. Contoh: **"Bullish Marubozu ⚡ — Tekanan beli dominan tanpa perlawanan seller."** (deteksi pola candle otomatis.)

### VOLUME SURGE (VPA): **+50% · "Volume Tinggi"** = volume sesi terakhir vs rata-rata 20 hari.

### KINERJA HARGA & PROKSIMITAS BREAKOUT (Multi-Horizon):
- HISTORIKAL RETURN %: 1D +4.6% · 1W +8.8% · 1M +16.1% · 3M − (data kurang).
- JARAK LEVEL KUNCI: Jarak ke R1 (Breakout) +2.0% · ke S1 (Defense) −3.3% · ke TC (Atas CPR) −0.7% · ke BC (Bawah CPR) −2.0%.

### TA + FLOW CONFLUENCE (skor gabungan 0–100): **32/100 "KONFLUENSI SELL"**. Gabung BROKER FLOW (Mild Distribution) + TEKNIKAL MOMENTUM (Overbought/Sell) dengan pembobotan ("bias broker mild → bobot diturunkan"). Ada tombol "tune" (bobot bisa disetel). → Tier 2 PAPAN: uji komponen di BT Papan dulu.

### INDIKATOR TEKNIKAL (verdict panel): Overbought/Sell. MULTI-TIMEFRAME D/W (gating jujur: "Butuh minimal 11 minggu data untuk MTF; tersedia 6"). Moving Average (EMA20 9.340). RSI(14) 73 Overbought. **Volatilitas ATR(14) 302**. **Stochastic (14,3,3) %K89 %D87 Overbought**.

### Gating data jujur (banner atas): "Periode 21 sesi belum cukup untuk: Return 3M, Multi-Timeframe, Moving Average (EMA50). Perpanjang rentang tanggal." → pola kejujuran WAJIB ditiru PAPAN.
