Dari sesi AI Skill (Fable), atas perintah Johan 24 Agu 2026: *"coba analisa lebih dalam gmn ini kalau di terapin di Papan"* → *"ok susun jadi spec lengkap, dan dimana page yang cocok di pasang itu"*. Rujukan produk pembanding: pesan WhatsApp SPLE (preset Scalping SLIS + "Review Win Rate Rekomendasi" sore, backtest mereka baru MA100). Sumber kebenaran data: `docs/referensi_idx-statistik.md` (Matriks kanonik, Kamus ruas, J14). Jangan push git; angka ambang di spek ini = usulan awal — perubahan rumus/ambang setelah rilis dicatat di referensi.

# Spek — Preset Screener, Jejak Rekomendasi & Win Rate, Rekap Sore

## Penempatan halaman (keputusan desain)

| Fitur | Rumah | Alasan |
|---|---|---|
| Preset Screener | **halaman `/screener` yang sudah ada (grup ANALISA)** — mode baru "Preset" di atas filter manual: tab `Scalping` · `Swing` · `Manual (yang sekarang)` | Screener sudah punya filter likuiditas + tabel hasil + tautan ke Kartu Analisa; preset = bundel filter bernama + skor, bukan halaman baru. Menu tidak bertambah |
| Riwayat & Win Rate | **tab ke-4 di halaman Screener yang sama**: `Riwayat & Win Rate` | review menempel pada yang direview; pemakai melihat preset dan rapor menang-kalahnya di satu tempat |
| Rekap Sore | **halaman `/bulletin` (Bulletin Arus Pasar, grup BACA)** — section/edisi baru "Rekap Preset Harian"; generator ikut pipeline panen sore | arus-pasar sudah punya pipeline edisi + template; rekap = konten editorial harian, bukan alat analisa |
| Kartu hasil per emiten | pakai **Kartu Analisa** yang ada (`/kartu`, `kartu/<K>.json` — sudah punya ATR/RSI/StochRSI/MA/support-resistance) | jangan bangun kartu kedua; preset hanya menambah ruas yang kurang |

## Tugas A — mesin indikator (perluasan `scripts/riset/kartu_analisa.py`, bukan skrip baru)

Semua dihitung dari chartbit `ohlcv_stockbit/<K>.json` (17 kolom) + marketdetectors GROSS. Tambahkan ke `kartu/<K>.json` (atau berkas samping `kartu/teknikal/<K>.json` kalau ukurannya membengkak — putuskan dari ukuran nyata):

1. `ma5, ma20, ma50, ma100, ma150, ma200` — SMA close. Riwayat chartbit 2003→ jadi MA150/MA200 langsung bisa (SPLE baru MA100).
2. `bb20`: mid = MA20, atas/bawah = ±2σ(close,20); `posisi_bb` = (close − mid) ÷ (2σ) (−1…+1; ≥0,8 = "menempel band atas").
3. `ichimoku`: tenkan 9, kijun 26, senkou A/B (26/52, digeser 26), `di_atas_kumo` boolean.
4. `regresi60`: kemiringan & garis tengah regresi linear close 60 hari; `posisi_regresi` = (close − tengah) ÷ σ residu.
5. `freq` harian (sudah di chartbit), `ukuran_order` = lot ÷ freq (lot/transaksi — kecil = ritel/scalper), `peringkat_value`, `peringkat_volume`, `peringkat_freq` (dari 962 emiten hari itu).
6. `porsi_asing` = (foreignbuy + foreignsell) ÷ (2 × value); `net_asing_rp` = fb − fs; label F/D persis gaya SPLE: `F {x}% : D {100−x}%` — **eksak, bukan taksiran**.
7. Ruas bandar dari berkas broker GROSS hari itu: `bandar_top1_kode`, `bandar_top1_avg` (= `netbs_buy_avg_price` net buyer nilai terbesar), `bandar_top3_avg` (rata-rata tertimbang nilai), `label_accdist` NET dengan ambang terbukti ±6/±12,5/±20 pada percent NET (Kamus ruas). Ini pengganti "Estimasi Avg Bandar" SPLE — angka eksak per broker, sebut kodenya.
8. `wyckoff_fase` (opsional, boleh fase 2): aturan eksplisit — contoh awal: volume hari ≥ 2× MA20 volume + close > MA20 + accdist NET ∈ {Big/Normal Acc} → "Markup (aturan PAPAN)"; selalu berlabel "tafsiran aturan PAPAN", bukan fakta.

Uji: nilai MA/BB/RSI dicek silang minimal 3 emiten × 3 tanggal terhadap hitungan manual; `bandar_top1_avg` dicek ke berkas mentah.

## Tugas B — preset (bundel saringan + skor)

Konfigurasi di satu berkas (`app/src/lib/dasbor/presetScreener.ts`) supaya ambang gampang diubah dan tercatat di git. Ambang awal (usulan — tandai di UI "ambang v1"):

- **Scalping**: `peringkat_value ≤ 50` · `freq ≥ 10.000` · `ukuran_order ≤ p25` pasar · `ma5 > ma20` · `posisi_bb ≥ 0,5` · `label_accdist ∈ {Big Acc, Normal Acc}` · close ≥ Rp50 (hindari gocap mati). Skor = jumlah kriteria terpenuhi + bobot accdist.
- **Swing**: `close > ma20 > ma50` · `di_atas_kumo` · `posisi_regresi ≥ 0` · `net_asing_rp 5 hari > 0` ATAU akumulasi bandar 5 hari > 0 · likuiditas tier atas (pakai `TINGKAT_LIKUIDITAS` yang ada).
- Kartu hasil menampilkan ruas seperti pesan SPLE (harga, value/volume + peringkat, freq, ukuran order, F/D, avg bandar top1/top3 EKSAK + kode broker, MA/BB/Ichimoku/regresi, label accdist) + **Area Entry / TP / SL**:
  - Entry = rentang [low hari itu, close].
  - TP1/TP2 = **rumus Target Realistis Kuli Papan** (papan terdorong × tick, low & high) dipanggil dari lib yang sama — satu rumus dua halaman, jangan duplikat; fallback ATR: TP1 = close + 1×ATR14, TP2 = close + 2×ATR14 bila data papan kurang.
  - SL = min(low 5 hari, close − 1,5×ATR14), dibulatkan ke fraksi harga IDX.
  - Semua bertanda "alat bantu edukasi, bukan rekomendasi investasi" (disclaimer yang sudah dipakai Kuli Papan).

## Tugas C — jejak rekomendasi + Win Rate (tab `Riwayat & Win Rate`)

1. Generator sore menulis **`data-idx/json/rekomendasi/<YYYY-MM-DD>.json`** (ikut git — kecil):
   `{tanggal, preset, dibangun, saham:[{kode, close, entry:[lo,hi], tp1, tp2, sl, skor, ringkas:{freq, ukuran_order, fd, bandar_top1_kode, bandar_top1_avg, label_accdist}}]}` + `index.json` daftar tanggal. Sekali ditulis TIDAK diedit (kejujuran backtest); koreksi = berkas koreksi terpisah.
2. Perhitungan win rate (lib murni + uji unit, rumus kompatibel SPLE supaya bisa dibandingkan head-to-head):
   - **Intraday (Open vs High) H+1**: menang bila `high(H+1) > open(H+1)` — persis definisi SPLE (longgar; tulis definisinya di UI).
   - **Close-to-Close H+1**: menang bila `close(H+1) > close(H)`; tampilkan juga rata-rata %.
   - **TP/SL H+5**: urutan kejadian pakai data harian (high ≥ TP1 sebelum low ≤ SL — kalau dua-duanya kena di hari yang sama, hitung "tak tentu", jangan diklaim menang).
   - Tabel per tanggal + agregat per preset (7/30/90 hari) + **daftar kalah ditampilkan sama besar dengan daftar menang**.
3. Backtest mundur: karena chartbit 2003→, generator bisa dijalankan untuk tanggal lampau (mis. 2024→) untuk mengisi rapor awal — tapi berkasnya ditandai `"backtest": true` dan dipisah visual dari rekomendasi live (backtest bisa bias survivorship daftar emiten hari ini; tulis peringatan ini di UI).

## Tugas D — Rekap Sore (Bulletin)

- Skrip `scripts/riset/rekap_preset.py` dijalankan di rantai panen sore (setelah chartbit + broker hari itu masuk): tulis `rekomendasi/<tgl>.json` (C.1) + render teks rekap gaya pesan SPLE (ringkas per saham + review win rate kemarin) ke `arus-pasar`/section Bulletin. Distribusi WhatsApp di luar cakupan (manual copy).
- Wajib memuat blok "Review kemarin" (win rate + saham yang gagal) — meniru kejujuran SPLE, jangan hanya yang menang.

## Batas & kejujuran

- Tidak ada intraday/orderbook — entry/TP/SL dihitung dari data harian + antrean penutupan; tulis di UI.
- Label tafsiran (Wyckoff, "Ritel Agresif", accdist) selalu berlabel "aturan PAPAN v1" dengan tautan Metodologi yang menjelaskan rumusnya.
- Tiap perubahan ambang/rumus = entri di halaman Metodologi + referensi (`docs/referensi_idx-statistik.md`) + baris `docs/jejak-permintaan.md`.
- Sumber per kartu/tab pakai kotak "Sumber:" seperti Broker Summary v2.

## Uji & dokumentasi

- Uji tampilan dua viewport (desktop 1920×1080, ponsel 412×915), tema terang & gelap, bukti tangkapan layar.
- Uji angka: 3 emiten × 3 tanggal untuk indikator; 1 tanggal penuh untuk preset (daftar hasil dicek manual); win rate dicek terhadap hitungan tangan untuk 1 tanggal.
- Update `docs/referensi_idx-statistik.md`: peta halaman → sumber (Screener mode Preset, tab Riwayat, Bulletin Rekap; berkas `kartu/` ruas baru + `rekomendasi/`), lalu bangun ulang HTML (`python "C:/1-Johan/10. Pengembangan/AI Skill/00 - Dokumentasi/build_html.py" --proyek docs/referensi_idx-statistik.md`); baris `docs/jejak-permintaan.md` per tugas.
