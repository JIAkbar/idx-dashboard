Dari sesi AI Skill (Fable), atas perintah Johan 23 Agu 2026: *"bisa kerjain artifact tadi ke PAPAN skrg?"* · *"tab page lot sizing itu sudah di wakili kalkulator kita"* · *"Konversi kurs dong dan send message, jadi buatkan spec dulu biar di kerjakan oleh Sesi Papan Trading"*. Spek di bawah; sumber kebenaran tetap `docs/referensi_idx-statistik.md` (section "Prototipe Dev — Kuli Papan & Neo Papan" = peta tab → sumber + tabel "Kalau direalisasikan"; "Keputusan arah" J13 = konversi kurs). Prototipe yang dicontoh: `data ide/dev-kuli-neo-papan.html` (buka di browser; desktop & ponsel), logika/rumus di `data ide/dev-kuli-neo-papan.template.html`, cara membaca arsip di `data ide/bangun_data_dev.py`.

## Tugas A — menu Dev + dua halaman

1. Menu **Dev** di sidebar (setelah Baca) berisi **Kuli Papan** dan **Neo Papan**.
2. **Kuli Papan** = dua kalkulator:
   - Target Realistis (adimollogy/buruhIHSG): `Jumlah papan = (Offer − Bid) ÷ Tick + 1`; `Rata per papan = (Total Bid + Total Offer) ÷ Jumlah papan`; `Terdorong HIGH = Buy Lot ÷ Rata`, `LOW = HIGH ÷ 2`; `Baseline = 5% × Buy Avg`; `Target = Buy Avg + Baseline + (Terdorong × Tick)`. Uji: contoh DEWA di `Kuli Papan.pdf` harus keluar 41 papan · 133.024,37 · 7/3,5 · 26,35 · Rp 570,86 / 588,37. Nilai awal: Buy Avg & Buy Lot dari broker terpilih hari terakhir (marketdetectors REGULER·ALL·GROSS), Bid/Offer dari antrean penutupan IDX GetStockSummary (level terbaik saja — Total Bid/Offer lot tetap **input manual** berlabel jelas; orderbook penuh tidak ada sumber gratis), tick dari fraksi harga IDX.
   - PBV Band: `Harga wajar = BVPS × rata-rata P/B tahunan 2019→`; MOS 10–80%; status UNDER/OVER. BVPS/PBV/PE kini dari `keystats_stockbit/<K>.json`, P/B tahunan dari `valuasi_historis.json`. Riwayat perhitungan di localStorage.
3. **Neo Papan = 8 tab** — **Lot Sizing TIDAK ikut** (keputusan Johan: sudah diwakili halaman Kalkulator): Transaction Chart, Inventory Chart, Compare Inventory, Broker Stalker, Balance Position, Seasonality, Rotation Chart, Sector/Index Activity. Tiap tab punya kotak "Sumber:" seperti prototipe; Rotation & Activity tulis di layar bahwa itu turunan (RRG normalisasi z, bukan JdK; "Activity" definisi PAPAN).
4. Data dibaca per halaman dari JSON proyek (bukan ditanam seperti artifact), satu sumber kanonik per dataset (Matriks sumber C):
   - candle/volume/asing/seasonality/rotation/activity: `data-idx/json/ohlcv_stockbit/<K>.json` (17 kolom chartbit) + `IHSG.json`; money flow asing = `foreignbuy − foreignsell`.
   - broker harian 12 varian: `_arsip-mentah/broker-harian/<K>/<tgl>[.varian].json` (REGULER ALL GROSS = `<tgl>.json`, FOREIGN = `.asing.json`); tipe broker dari ruas `type`; Stalker = Σ bval/sval per broker pada jendela N hari bursa (kalender global), ALL & FOREIGN.
   - Balance Position: `data-idx/json/kepemilikan/<K>.json` (KSEI 22 kolom, 79 bulan) — tulis di layar cakupan scripless saja (BBCA 42,55% dari tercatat).
   - sektor/indeks: `emiten_sektor.json` + `info_stockbit/<K>.json` (`indexes`).
5. Kejujuran cakupan: broker 2026 baru 292 emiten (runner paralel 44 masih berjalan, PID 50000, log `logs/backfill_2026_semua_12varian.log`) — emiten yang arsipnya belum ada/belum lengkap **ditandai** (pola `cakupan` di prototipe), bukan diam-diam kosong. Kartu TOP1/3/5 memakai ruas `percent` top-N Stockbit yang bisa >100% (ruas ❓ Kamus ruas) — beri catatan, jangan dinormalkan sendiri.

## Tugas B — J13: konversi kurs untuk pelapor USD di `valuasi_historis.json`

Keputusan Johan: 100 emiten pelapor USD (termasuk BUMI, TPIA) yang sekarang dilewati `scripts/hitung_valuasi_historis.py` (komentar "3. Mata uang", baris 49–50) **dikonversi ke rupiah**, bukan dilewati.

1. Ruas `kurs_laporan` XBRL **tidak bisa dipakai**: kosong untuk pelapor USD (BUMI: `kurs_laporan: None`), dan untuk pelapor IDR skalanya tidak konsisten (BBCA: 13.882,5 di 2019 vs 0,016095 di 2024). Perlu sumber kurs per tanggal. Kandidat (inventaris — pilih lewat tabel, bukan tebakan): (a) BI JISDOR harian (resmi, 2013→); (b) Yahoo `IDR=X` harian (gratis, infra panen Yahoo sudah ada); (c) `KURS_USD_IDR`/`get_latest_kurs()` di `fetch_fundamental.py` — hanya kurs kini, **tidak sah** untuk tahun buku lampau.
2. Usulan cara (PSAK 10/IAS 21): ekuitas → BV memakai kurs penutupan tanggal neraca; laba bersih → EPS memakai kurs rata-rata tahun buku. Baris hasil konversi membawa `mata_uang: "USD"`, `kurs`, `sumber_kurs`, dan antarmuka menulis "dikonversi dari USD @ kurs …".
3. **Prasyarat sebelum `valuasi_historis.json` ditulis ulang** (klausul 3b): tabel pembanding BUMI & TPIA per tahun buku 2019–2025 — P/B & P/E hasil konversi (JISDOR vs Yahoo `IDR=X`) berdampingan, diuji silang ke PBV/PE keystats Stockbit kini — tunjukkan ke Johan, tunggu keputusannya, baru tulis. Sumber kurs yang dipilih + tanggal verifikasi dicatat di referensi (section sumber baru "Kurs USD/IDR" dengan kamus ruas).
4. Simpan kurs yang dipakai sebagai dataset sendiri (`data-idx/json/kurs_usdidr.json` atau sejenis) supaya halaman lain bisa membaca sumber yang sama — jangan hard-code di skrip.

## Tugas C — uji & dokumentasi

- Uji tampilan dua viewport (desktop 1920×1080, ponsel 412×915 — konvensi Johan untuk PAPAN), tema terang & gelap, bukti tangkapan layar.
- Tambah baris `docs/jejak-permintaan.md` (10 kolom) per tugas; perbarui peta halaman → sumber di `docs/referensi_idx-statistik.md` (dua halaman baru + berkas yang dibacanya + kurs), bangun ulang HTML: `python "C:/1-Johan/10. Pengembangan/AI Skill/00 - Dokumentasi/build_html.py" --proyek docs/referensi_idx-statistik.md`.
- Catatan cakupan yang bukan bagian tugas ini (jangan dikerjakan diam-diam): broker 2017–2019 untuk 27 emiten lama (mis. BUMI) baru 3 varian (reguler, asing, nego) — 9 varian lain belum dipanen; runner 2026 belum selesai.

Jangan push git, jangan sentuh `docs/backlog-edisi.md`, jangan ganti sumber/jahit angka tanpa keputusan Johan.
