# Pipeline Data IDX Statistik — Peta Lengkap

> Ditulis 13 Agustus 2026 setelah diagnosa gap data 2 bulan (Jun–Agu).
> Satu halaman ini menjawab: data datang dari mana, diolah apa, jalan otomatisnya gimana,
> dan apa yang harus dicek kalau data berhenti update.

## Sumber data & alirannya

| Sumber | Alat fetch | Frekuensi | Output mentah | Parser | Output JSON |
|---|---|---|---|---|---|
| idx.co.id — Daily Statistics (`ds_*.pdf`) | `scripts/download_idx.py` (Playwright) | Tiap hari bursa, terbit sore/malam | `data-idx/daily/` (gitignore) | `scripts/parse_idx_pdf.py` | `data-idx/json/ds_*.json` + `index.json` |
| idx.co.id — Weekly Statistics (`ws_*.pdf`, tab "Mingguan") | sama, `--jenis mingguan`/`semua` | Tiap Jumat | `data-idx/weekly/` (gitignore) | `scripts/parse_idx_weekly.py` | `data-idx/json/ws_*.json` + `index_weekly.json` |
| Yahoo Finance — fundamental 959 emiten | `scripts/fetch_fundamental.py` (yfinance 0.2.66) | Bulanan (CI) | — | (langsung JSON) | `data-idx/json/fundamental/` |
| Yahoo Finance — OHLC utk bulletin | `arus-pasar/fetch_ohlc.py` | Per edisi bulletin | — | (langsung JSON) | `arus-pasar/cache/ohlc-*.json` |
| Orderbook Stockbit (arus broker per emiten) | **manual** — transkripsi tangkapan layar | Per edisi bulletin | `arus-pasar/edisi/*.json` | `arus-pasar/build.py` | `keluaran/*.html` + `*.pdf` (otomatis, Playwright print) |
| idx.co.id — Broker Summary (endpoint `GetBrokerSummary`, agregat 88 broker) | `scripts/fetch_broker_summary.py` (fetch dari dalam page — Cloudflare tolak TLS non-browser) | Harian (`--hari N` utk backfill; riwayat endpoint sampai Agu 2023) | — | (langsung JSON) | `data-idx/json/broker/bs_*.json` + `index.json` |
| idx.co.id — daftar resmi emiten (endpoint `GetStockSummary`, 963+ saham) | `scripts/sinkron_emiten.py` (fetch dari dalam page, sama pola Cloudflare) | Harian (lewat `JALANKAN_OTOMATIS.bat`) | — | (langsung JSON, lalu diff) | `data-idx/json/daftar_emiten.json` + panen `fundamental/<TICKER>.json` baru |
| IDX Pengumuman Bursa — "Pemegang Saham di atas 1% (KSEI)" | `scripts/fetch_investor_map.py` (cari pengumuman mundur 240 hari → download lamp1 → parse PDF koordinat) | Bulanan tak beraturan; **berhenti terbit sejak 8 Juni 2026** — jalankan ulang berkala, otomatis nangkep begitu terbit lagi | `data owner/*.pdf` | (built-in) | `data-idx/json/investor_map.json` + `.meta.json` |

Konsumen JSON: React app (`app/`, fetch `/data-idx/json/...`) dan situs statis `index.html`/`index_live.html`.

## Jalur otomatis — dua lapis

**Lapis 1 (utama): PC lokal — `JALANKAN_OTOMATIS.bat`.**
Download harian+mingguan → parse keduanya → commit `data-idx/json/` → push.
Daftarkan sekali ke Windows Task Scheduler (perintah `schtasks` ada di komentar file bat itu, jalan tiap hari kerja 18:30 WIB). IP rumahan tidak diblokir IDX.

**Lapis 2 (cadangan): GitHub Actions — `.github/workflows/update.yml`.**
Cron harian 20:00 WIB. **Sering diblokir idx.co.id** (IP datacenter — inilah penyebab
gap data Jun–Agu 2026: `Page.goto` timeout, dan dulu step download di-`continue-on-error`
sehingga run tampak hijau padahal nol data). Sekarang: script exit≠0 saat scrape gagal
total → run MERAH jujur; bursa libur tetap exit 0. Kalau Actions kebetulan lolos blokir,
dia commit data sendiri — aman ganda dengan lapis 1 karena parser skip file yang sudah ada
dan commit kosong tidak terjadi (`git diff --staged --quiet`).

`update-fundamental.yml` (bulanan) memakai Yahoo, bukan idx.co.id — blokirnya beda rezim;
sudah dipasang retry backoff + gerbang gagal-massal (>30% dari ≥100 ticker → exit 1,
tidak commit data bolong).

### Field fundamental (per emiten, `data-idx/json/fundamental/<TICKER>.json`)

Sejak Agu 2026 diperluas selevel "Key Stats" Stockbit (semua null bila sumber tak ada;
±9 request Yahoo per ticker, tidak bertambah dari versi lama):

- **Valuasi**: `pe`, `forward_pe`, `ps`, `pb`, `ev_ebitda`, `ev_ebit` (kini benar-benar
  EV/EBIT TTM, dulu alias ev_ebitda), `peg`, `earn_yield`, `enterprise_value`, `market_cap`.
- **Per saham**: `eps`, `eps_fwd`, `rev_ps`, `cash_ps`, `bv`, `fcf_ps`, `shares_outstanding`
  (alias `shares`), `free_float_pct` (alias `float_pct`).
- **Solvabilitas**: `current_ratio`, `quick_ratio`, `der`(%), `lq_total_debt`, `lq_cash`,
  `interest_coverage` (EBIT/|beban bunga| TTM), `lev_q` (aset/ekuitas), `altman_z`
  (Z" emerging market: 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·BVE/TL).
- **Profitabilitas & manajemen**: `gpm/opm/npm/ebitda_margin`, `roa`, `roe`,
  `roic` (NOPAT/(ekuitas+utang−kas), tax efektif fallback 22%), `roce` (EBIT/(TA−CL)).
- **Efisiensi**: `receivables_turnover`, `inventory_turnover`, `asset_turnover`,
  `days_sales_outstanding`, `days_inventory`, `days_payables`, `cash_conversion_cycle`
  (bank/finansial: sebagian null — tanpa inventory/COGS, wajar).
- **Growth YoY** (kuartal vs kuartal thn lalu): `rev_yoy`, `ni_yoy`, `gp_yoy`.
- **Dividen**: `dividend`, `dividend_yield`, `payout_ratio`, `ex_dividend_date`,
  `div_history` (≤6 tahun terakhir, ex_date+amount), `ddm_g_rate`, `div_years`.
- **Laporan ringkas (grup)**: `income_ttm{revenue,gross_profit,ebitda,net_income}`,
  `balance_q{cash,total_assets,total_liabilities,working_capital,common_equity,lt_debt,
  st_debt,total_debt,net_debt,total_equity}`, `cashflow_ttm{cfo,cfi,cff,capex,fcf}` —
  nilai identik dgn field datar `ttm_*`/`lq_*` (referensi, bukan hitung ulang).
- **Kuartalan mini**: `quarterly{tahun:{Qn:{revenue,net_income}}}` maks 12 kuartal
  (tabel per kuartal; seri penuh tetap di `q_revenue`/`q_net_income`/`q_eps` dll).
- **Price performance**: `price_perf` kini sampai `1y/3y/5y` (`*_pct/_low/_high`),
  dari SATU call `history(period="5y")`.
- **Skor**: `f_score` (Piotroski 0–9, tahunan t vs t−1; komponen tanpa data = 0),
  `f_score_n` (jumlah komponen yang benar-benar terhitung, maks 9).

Emiten pelapor-USD (`financial_currency: "USD"`): nilai absolut dikonversi ke IDR
pakai kurs `ds_*.json` terbaru; rasio dihitung dari laporan se-mata-uang (tak dikonversi).

## Sinkron emiten baru (deteksi IPO)

Daftar emiten yang muncul di app (autocomplete, Stock Detail) berasal dari
`data-idx/json/fundamental/index.json`, dibangun dari file yang pernah dipanen
`fetch_fundamental.py`. Saham IPO baru (mis. BACH, Agu 2026) tidak otomatis
muncul di situ sampai dipanen manual — `scripts/sinkron_emiten.py` menutup gap
ini: ambil daftar resmi seluruh saham IDX (`GetStockSummary`, 963+ saham) →
diff dgn `index.json` → ticker yang belum ada dipanen otomatis lewat
`fetch_fundamental.py <TICKER> ...` (CLI itu sudah menerima ticker spesifik
sbg argumen positional, jadi tidak perlu flag baru). Ticker yang IPO-nya
terlalu baru untuk dikenal Yahoo Finance (`.JK` belum terindeks — cth. GOTOM
per Agu 2026) dilewati dan dicatat di log, bukan ditulis sbg file kosong;
akan otomatis kepanen begitu Yahoo mengindeksnya (di run berikutnya, endpoint
IDX tetap melaporkannya sbg "belum ada di database").

Dijalankan tiap hari sbg langkah `[4/5]` di `JALANKAN_OTOMATIS.bat`, tidak
menghentikan pipeline kalau gagal (data harian/mingguan tetap ter-commit).

## Kalau data berhenti update, cek berurutan

1. `gh run list --workflow=update.yml --limit 5` — merah semua? Berarti IDX blokir runner; pastikan Task Scheduler lokal jalan (`schtasks /Query /TN "IDX-Update"`).
2. Jalankan manual `JALANKAN_OTOMATIS.bat` — lihat step mana yang gagal.
3. Scrape gagal dari lokal juga? Struktur halaman IDX mungkin berubah (tab "Harian/Mingguan" atau selector `a[href*='.pdf']`) — cek `scripts/download_idx.py` bagian `TAB_LABEL`/`_kumpul_link`.
4. Fundamental bolong? Cek run `update-fundamental.yml`; rate limit Yahoo di runner adalah tersangka pertama (lihat retry log).

## Batasan yang diketahui

- Rincian per-broker-per-saham TIDAK tersedia gratis di IDX (route `GetBrokerSummaryDetail` dkk = 503; yang ada agregat per broker — sama isi xlsx "Ringkasan Broker" manual, kini otomatis). `GetStockSummary` kini dipanen (`sinkron_emiten.py`) tapi baru utk daftar kode+nama saham (deteksi IPO) — OHLC hariannya (Open/High/Low/Close/Volume per saham per endpoint ini) belum dipakai. `GetIndexSummary` (45 indeks) masih belum dipanen.
- `investor_map.json` paling segar = data 29 Mei 2026 — sumbernya sendiri (pengumuman 1% KSEI) berhenti terbit sejak 8 Juni; bukan keterbatasan harvester. File lama pra-harvester ternyata korup ±1.138 baris (BBRI/TLKM/AMAN kehilangan pemegang mayoritas) — sudah pulih.
- Pola akses endpoint IDX WAJIB `page.evaluate(fetch)` dari dalam halaman idx.co.id — `pg.request.get` (pola `cek_broker_summary.py` lama) sekarang kena 403 Cloudflare.

- `ws_260102.pdf` 403 dari sisi IDX (satu file lama, dibiarkan).
- Halaman weekly PDF 2 (grafik), 6 (obligasi outstanding), 10 (appendix) sengaja tidak diparse — layout tidak stabil; detail di docstring `parse_idx_weekly.py`.
- Data orderbook bulletin tetap manual by design (tidak ada API publik orderbook per broker; fabrikasi = data palsu).
- Angka IHSG di sampul bulletin masih hardcode di `build.py` — kandidat perbaikan berikutnya (ambil dari `data-idx/json/ds_<tanggal>.json`).
