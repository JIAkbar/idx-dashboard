

## Prototipe Dev — Kuli Papan & Neo Papan (artifact, 23 Agu 2026)

Asal: Johan 23 Agu 2026 — *"bantu saya buatan artifact dari 2 page baru untuk Papan Trading, dimana buat menu Baru dengan nama Dev dimana 2 ada page baru, pertama Kuli Papan, kedua Neo Papan, bahan nya ada di … data ide, coba pelajari buat artifactnya, analisa kebutuhan data nya baru bangun dari data stockbit"*. Bahan: `data ide/Kuli Papan.pdf` (kalkulator Target Realistis — formula adimollogy & buruhIHSG, dan PBV Band), `data ide/Neo Papan.pdf` (12 halaman referensi NeoBDM). Berkas: `data ide/dev-kuli-neo-papan.html` (mandiri, 6,6 MB, data tertanam) + artifact privat (tautan di CLAUDE.md AI Skill). Pemadat data: skrip `bangun_data_dev.py` (scratchpad sesi AI Skill; salinan di `data ide/bangun_data_dev.py`). Uji tampilan: desktop 1920×1080 dan ponsel 412×915 (dua viewport, sesuai arahan Johan untuk proyek ini).

### Peta halaman prototipe → sumber

| Halaman / tab | Data tertanam yang dibaca | Sumber asal | Jahitan? | Catatan kejujuran |
|---|---|---|---|---|
| Kuli Papan · Target Realistis | `broker[K][tgl].a.b` (buy avg & lot per broker, hari terakhir), `bidoffer[K]` (Bid/Offer/volume penutupan), tick dari close | Stockbit marketdetectors REGULER·ALL·GROSS; IDX GetStockSummary arsip 21 Agu | tidak | Total Bid/Offer lot = input manual (orderbook Stockbit Pro paywall); nilai awal hanya antrean penutupan level terbaik. Rumus direkonstruksi penuh dan mereproduksi contoh DEWA (41 papan · 133.024,37 · 7/3,5 · 26,35 · Rp 570,86 / 588,37) |
| Kuli Papan · PBV Band | `fund[K]` (BVPS, PBV, PE dari keystats; P/B tahunan 2019→ dari `valuasi_historis`; harga close) | Stockbit keystats + IDX XBRL (valuasi_historis) + chartbit | tidak | PBV band rata-rata = mean P/B tahunan 2019–2025 (valuasi_historis); BVPS keystats ≠ bv yfinance (2.193,77 vs 2.201,51 BBCA) — keduanya ditampilkan asalnya |
| Neo · Transaction Chart | `ohlcv[K]` (12 kolom), `ohlcv[IHSG]`, `broker[K].a.p` (partisipasi tipe), `broker[K].a.d` (bandar_detector ringkas) | Stockbit chartbit + marketdetectors | tidak | money flow asing = `foreignbuy − foreignsell` chartbit (rupiah, resmi) |
| Neo · Inventory Chart | `broker[K]` harian (25 broker teratas/sisi) | Stockbit marketdetectors | tidak | broker di luar 25 besar per hari dihitung 0 — versi produksi baca daftar penuh |
| Neo · Compare Inventory | sama | sama | tidak | — |
| Neo · Broker Stalker | `stalker.all/foreign[N][K][broker]` = Σ bval/sval/lot jendela N hari bursa global; `cakupan` per emiten | Stockbit marketdetectors GROSS ALL & FOREIGN, semua emiten berarsip (155 saat dibuat; bertambah seiring run 2026) | tidak | emiten dengan arsip < N hari ditandai; **angka AK+BK 5 hari mereproduksi tangkapan layar NeoBDM 14–21 Agu** (BBRI 495,5 B, AMMN 286,7 B, TPIA −210,8 B, BMRI −166,2 B, …) |
| Neo · Balance Position | `ksei[K]` 22 kolom × 79 bulan | KSEI Balancepos | tidak | cakupan scripless saja (BBCA 42,55% dari tercatat) ditulis di layar; lonjakan Okt 2021 BBCA = pemecahan saham 1:5 |
| Neo · Seasonality | `seasonality[K]` (hari kerja & bulan, 12 tahun) | dihitung dari chartbit riwayat penuh | tidak | IHSG Stockbit mulai 1997-07 |
| Neo · Rotation Chart | `rotation.periode[N][sektor]` (RS-Ratio, RS-Momentum, z-score, mingguan) | indeks sektor rata-rata setara dari 962 emiten chartbit + `emiten_sektor` IDX-IC vs IHSG | ⚙️ turunan | pendekatan RRG (normalisasi z), bukan rumus JdK — ditulis di layar |
| Neo · Sector / Index Activity | `activity.sektor/indeks` (porsi nilai transaksi, MA-20) | chartbit value 962 emiten + `emiten_sektor` + `info_stockbit.indexes` | ⚙️ turunan | definisi "Activity" milik PAPAN, bukan NeoBDM — ditulis di layar; pola (Energi/Barang Baku/Keuangan dominan) konsisten dengan tangkapan layar NeoBDM |
| Neo · Lot Sizing | close terakhir `ohlcv[K]` | chartbit | tidak | kalkulator murni |

Yang sengaja tidak ada: login/subscription/streaming NeoBDM, intraday, orderbook, Done Detail (butuh data done-trade per transaksi yang tidak dipanen), Market Summary/Home (sudah ada di PAPAN).
