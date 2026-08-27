Dari sesi AI Skill (Fable), 25 Agu 2026 — SPEK: pola RBS, pola Gap, dan panen intraday rutin. Asal perintah Johan: *"buatkan dan analisakan … jadikan pola di chart"* · *"jadi RBS pola sendiri, Gap itu juga pola sendiri ya jangan di campur"* · *"panen intraday rutin masukkan ke spek juga"*. Dasar: backtest `riset_rbs_gap_hasil.md` (100 emiten terlikuid, chartbit murni 2018–2026) + endpoint intraday yang terpecahkan 25 Agu (`docs/riset/stockbit-inventaris-endpoint.md`). STATUS: menunggu review akhir Johan sebelum dikirim.

# 1 · Pola RBS (berdiri sendiri)

- **Algoritme v1** (teruji): pivot high 5 bar kiri-kanan → level = klaster pivot ±1,5%, ≥2 sentuhan, 120 bar, belum ditutup di atasnya → breakout close > level+1% → retest ≤40 bar ke pita ±1,5% → bertahan (close ≥ level) → konfirmasi close ≥ level+2% ≤3 bar.
- **Gambar di Grafik Emiten/Chart** (toggle "RBS" sendiri): garis level per status — merah putus (resistance + titik sentuhan) → kuning putus (tembus, tunggu retest) → hijau solid (support sah) → abu redup (gagal); segitiga kuning di bar breakout, hijau di bar konfirmasi; **badge ujung kanan** `RBS <level> · <status>`, hover = tanggal pivot/breakout/retest + saran SL level−3% + angka backtest. Maksimal 3 level aktif terdekat digambar; sisanya daftar panel.
- **Ruas kartu**: `rbs_status` (resistance/breakout/retest/sah/gagal), `rbs_level`, `rbs_jarak_pct`.
- **Angka backtest yang wajib tampil di Metodologi**: 617 breakout → 79% retest → 71% bertahan; H+20 setelah retest ±0%; trade SL level−3%: 52% kena SL, yang lolos median +3,89% (72% menang). Label UI: "pola deskriptif teruji — bukan sinyal beli".

# 2 · Pola Gap (berdiri sendiri — JANGAN dicampur dengan RBS)

- **Algoritme v1** (teruji): gap naik = open ≥ high(t−1) + max(2 tick, 1%); gap turun cermin; terisi = low kembali ≤ high(t−1) (naik) / high ≥ low(t−1) (turun).
- **Gambar** (toggle "Gap" sendiri): **kotak zona berarsir** antara high kemarin ↔ open hari gap — kuning selama terbuka (memanjang ke kanan), berhenti & meredup abu saat terisi; badge `GAP +x% · belum terisi / terisi N hari`, hover = tanggal, ambang, statistik.
- **Ruas kartu**: `gap_up_pct`, `gap_down_pct`, `gap_belum_terisi`.
- **Angka backtest wajib tampil**: 3.897 gap naik; 80% terisi ≤5 hari, 88% ≤20 hari; beli di open hari gap median −0,71% (29% hijau); konfirmasi volume tidak menolong. Label sama: bukan sinyal beli; kegunaan = zona level & target gap-fill.

# 3 · Panen intraday rutin (ketetapan Johan 25 Agu: masuk spek)

Endpoint (terpecahkan, dicatat di inventaris): `GET exodus.stockbit.com/chartbit/{kode}/price/intraday?from=<epoch TERBARU>&to=<epoch TERLAMA>&limit=0` → **bar 1 menit**: {datetime, unix_timestamp, open, high, low, close, volume, lot, value, frequency, foreign_buy, foreign_sell}, jam 08:58–16:14. **Server hanya menyimpan ±90 hari** (lebih tua → HTTP 400) — data yang tidak dipanen hilang selamanya; karena itu rutin.

1. **Skrip** `scripts/panen_intraday_stockbit.py` (pola panen yang sudah ada: `token_segar()` ber-lock, User-Agent sama, jeda 0,3–0,4 s, paralel ≤44):
   - Sekali jalan: per emiten 1 panggilan `from=now, to=now−7 hari` (tumpang-tindih 7 hari menutup hari terlewat); gabung-dedup per `unix_timestamp` ke arsip.
   - **Run perdana: backfill penuh 90 hari** (to = now−90 hari) — selamatkan jendela yang masih ada; ±962 panggilan ≈ 15–20 menit; taksiran ±8–12 jt bar.
2. **Penyimpanan — jangan jutaan berkas kecil** (pelajaran broker-harian): `_arsip-mentah/intraday/<KODE>/<YYYY-MM>.json.gz` — satu berkas per emiten per bulan (±8–9 rb bar, gz ±50–80 KB) → ±11,5 rb berkas/tahun, ±1 GB/tahun gz. Tidak pernah masuk git.
3. **Jadwal**: rantai panen sore SETELAH tutup pasar (≥16:30) — jangan pernah menulis bar hari berjalan saat sesi (aturan integritas arsip di referensi). Kalau sehari terlewat, tumpang-tindih 7 hari menutupnya.
4. **Agregasi timeframe**: lib murni `agregasiBar(menit, tf)` untuk 5m/15m/30m/1H/2H/4H (jam sesi IDX: 09:00–11:30, 13:00–15:50 [Jumat 14:00–15:50]; bar 08:58 & pasca-15:50 = lelang pembuka/penutup, gabungkan ke bar sesi terdekat dan catat aturannya di Metodologi). Chart pakai timeframe pilihan; RBS/Gap jalan di bar hasil agregasi (mesin bebas timeframe).
5. **Kejujuran & kamus**: tambah section sumber "chartbit intraday" di `docs/referensi_idx-statistik.md` + kamus ruas 12 ruas; ❓ yang harus diuji dan dicatat: `foreign_buy/foreign_sell` per menit terlihat 0 pada bar hari berjalan — uji pada hari yang sudah tutup, kalau tetap 0 berarti ruas kosong di tingkat menit (tulis apa adanya). Batas backtest intraday = 90 hari — statistik pola intraday BELUM sekuat harian; tulis di UI.
6. **Win rate / statistik intraday**: baru dihitung setelah arsip terkumpul ≥ 60 hari; jangan mengklaim angka harian berlaku untuk intraday.

# 4 · BT Papan — Backtest Papan (ide Johan 25 Agu: *"perlu ada BT Papan … untuk ujicoba screener berapa keberhasilannya … dari 100 emiten yang liquid"*)

Laboratorium uji: setiap preset/pola diadu ke riwayat chartbit, hasilnya rapor angka — melembagakan backtest manual `riset_rbs_gap.py` jadi halaman.

1. **Rumah**: halaman baru `/bt-papan` di grup **DEV**. Isi menu Dev setelah semua spek ini dikerjakan (ketetapan Johan 25 Agu): Kuli Papan · Neo Papan · **Harian Papan** · **Jago Papan** · **BT Papan** — semuanya di Dev dulu, naik ke grup produksi (PASAR/ANALISA) setelah matang.
2. **Masukan uji**: (a) strategi = preset dari `presetScreener.ts` (Scalping/Swing/Whale-1/2/3) ATAU pola (RBS retest-sah, Gap varian) ATAU kombinasi filter manual; (b) semesta = top-N likuiditas (50/100/200, bawaan 100); (c) periode (bawaan 2018→); (d) model eksekusi: masuk di **open H+1** (bawaan, jujur — sinyal baru terbaca setelah tutup) atau close hari sinyal; keluar: horizon H+1/H+5/H+20 atau TP/SL preset; (e) biaya: fee+slippage bawaan 0,3% pulang-pergi, bisa diubah, selalu tampil.
3. **Anti-bias (wajib, beda dari riset manualku)**: peringkat likuiditas dihitung **per tanggal sinyal** (rata-rata value 60 hari SEBELUM tanggal itu), bukan dari daftar top-100 hari ini — menghapus bias survivorship; emiten delisting tetap ikut selama datanya ada. Hasil run TIDAK bisa diedit (berkas hasil beku + hash parameter).
4. **Keluaran**: win rate, median & rata-rata return, distribusi (histogram), profit factor, max drawdown per trade, jumlah sinyal per tahun, rincian per tahun & per tier likuiditas, pembanding IHSG periode sama, dan **tabel semua trade — kalah ditampilkan sama besar dengan menang**.
5. **Mesin**: `scripts/riset/bt_papan.py` — membaca `ohlcv_stockbit/` (+ ruas kartu untuk preset), menulis `data-idx/json/bt/<strategi>-<hash-parameter>.json` + `bt/index.json`; halaman memilih run yang tersedia. Run baru dijalankan dari CLI/rantai panen (tidak ada server-side compute di Vercel). Intraday menyusul setelah arsip intraday ≥60 hari (jangan mengklaim lebih awal).
6. **Kaitan Win Rate harian** (Tugas C spek preset): BT Papan = uji MUNDUR (simulasi riwayat, berlabel backtest); tab Riwayat & Win Rate = rapor MAJU (rekomendasi live yang dibekukan). Dua-duanya tampil, tidak dicampur — beri label jelas.

# Uji & dokumentasi (semua tugas)

- Dua viewport (1920×1080, 412×915), tema terang & gelap, tangkapan layar.
- Uji angka: deteksi RBS/Gap di 3 emiten × timeframe harian dicocokkan dengan hitungan skrip riset; agregasi 1m→1H diuji Σvolume = Σvolume menit.
- `docs/jejak-permintaan.md` per tugas; referensi + HTML dibangun ulang; perubahan parameter apa pun = entri Metodologi + referensi.
- Jangan push git; jangan ganggu runner panen broker yang sedang jalan; token hanya lewat `token_segar()`.
