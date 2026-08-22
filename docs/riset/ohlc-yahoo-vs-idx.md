# OHLC Yahoo vs IDX — sapuan 1,16 juta pasangan (22 Agu 2026)

Lahir dari cek silang `panen_broker_harian.py`: Σ lot beli Stockbit × 100
untuk BUMI 21 Agu = 6.243.279.400 lembar, OHLC kita bilang 1.948.312.104.
IDX `GetStockSummary` tanggal itu menjawab **6.243.279.400** — persis Stockbit
sampai lembar terakhir. Yang salah Yahoo, dan Yahoo adalah sumber
`data-idx/json/ohlc/*.json` (`panen_ohlc.py`).

Arsip payload IDX ada di `_arsip-mentah/asing/<tahun>/<YYYYMMDD>.json.gz`
(1.732 hari bursa, 2 Jan 2020 – 21 Agu 2026), jadi sapuannya nol jaringan.

## Hasil

| | Pasangan | % |
|---|---|---|
| Dibandingkan (emiten × hari, keduanya punya volume) | 1.160.735 | 100 |
| Sama (selisih ≤ 0,5%) | 1.039.684 | 89,57 |
| Beda, **penyesuaian berantai** — rasio yang sama pada ≥ 5 hari emiten itu (split/reverse/rights oleh Yahoo; IDX mentah) | 113.989 | 9,82 |
| Beda, **galat satu hari** — rasio yang tak berulang | 7.062 | 0,61 |
| — di antaranya meleset > 2× atau < 0,5× | 767 | 0,07 |

Pilahan penyebab atas yang beda: faktor bulat 2–25 (split/reverse) 3,82% ·
harga & volume disesuaikan berlawanan 1,25% · Yahoo = reguler + non-reguler
hanya 0,02% · sisanya rasio pecahan (rights/bonus, atau galat).

Galat satu hari per tahun: 2020 1 · 2021 11 · 2022 1.907 · 2023 2.947 ·
2024 1.057 · 2025 903 · 2026 (s.d. 21 Agu) 236.

Hari terburuk: **23 Mei 2025 — 752 emiten salah sekaligus** (Yahoo cacat
sehari penuh), 5 Jun 2024 (173), 18 Nov 2024 (169), 30 Des 2022 (135).

Close pun beda > 0,5% pada 93.192 pasangan (8,0%) — itu penyesuaian
aksi korporasi Yahoo, bukan galat; IDX menyimpan harga mentah.

## Artinya

1. **Dua sumber, dua konvensi.** Yahoo menyesuaikan riwayat untuk aksi
   korporasi (bagus untuk grafik kontinu), IDX mentah (bagus untuk
   mencocokkan ke arus broker, yang juga mentah). Mengganti satu dengan yang
   lain secara buta memutus kontinuitas split — RAJA, MLPT, CLEO, PTRO, SAMF,
   MSIN masing-masing > 1.100 hari terpengaruh.
2. **Yahoo punya galat sungguhan** ~0,6% hari-emiten, termasuk hari cacat
   massal. RVOL, VolVal, screener kandidat, dan kalibrasi prob.py membaca
   angka ini apa adanya.
3. **Stockbit GROSS = IDX reguler, tepat.** Diuji DSSA/BBCA/GOTO/WBSA 21 Agu,
   BUMI 19–21 Agu, semuanya 1,0000 terhadap IDX (bukan terhadap Yahoo).

## Pilihan pondasi (keputusan Johan, belum diambil)

| | A · Tetap Yahoo + tambal | B · IDX jadi sumber bar sejak 2020 |
|---|---|---|
| Cara | Tiap hari, N bar terakhir ditimpa dari payload IDX yang sudah diunduh untuk `asing/` (nol jaringan tambahan); riwayat lama dibiarkan | `ohlc/*.json` dibangun ulang dari 1.732 payload IDX; Yahoo hanya untuk pra-2020; penyesuaian aksi korporasi **kita sendiri** lewat `ListedShares`/`Previous` |
| Menutup | Galat hari-hari terbaru (yang dipakai screener) | Seluruh 0,6% galat + kecocokan 1:1 dengan broker harian |
| Risiko | Riwayat lama tetap memuat 7.062 galat; beda konvensi di sambungan bar lama-baru | Harus membangun lapisan penyesuaian split/rights sendiri, dan menyapu semua pembaca OHLC (aturan CLAUDE.md: ruas hulu berubah → regresi seluruh berkas) |
| Ukuran kerja | Kecil, satu skrip + satu langkah workflow | Besar — ini "rombak total" yang disebut Johan |

Rekomendasi: **A sekarang** (murah, menutup yang dibaca screener tiap hari),
**B** dijadwalkan sebagai proyek pondasi terpisah sesudah halaman broker.
