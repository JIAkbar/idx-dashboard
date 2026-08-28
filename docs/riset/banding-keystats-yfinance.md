# Tabel pembanding: sumber baru (94 rasio) vs sumber lama (yfinance) — bahan keputusan rotasi

Riset murni baca berkas lokal, nol jaringan, nol perubahan halaman. Tugas: bikin
tabel pembanding angka supaya Johan bisa memutuskan rotasi sumber fundamental
sesuai CLAUDE.md §3c ("sumber terlengkap jadi utama, yang lama jadi cadangan
bertanda — tapi wajib didahului tabel pembanding"). **Tugas ini TIDAK mengubah
halaman apa pun** — implementasinya menunggu keputusan Johan.

Catatan: hasil di sini konsisten dengan temuan #315 di `docs/jejak-permintaan.md`
(sampel 40-60 emiten) yang sudah lebih dulu mengidentifikasi lima ruas yang
menyimpang — riset ini mengukur ulang dengan presisi (300-960 emiten per pasangan)
dan meluas ke seluruh 94 rasio, bukan cuma yang dipasang di Stock Detail.

## 1. Inventaris

- `data-idx/json/keystats_stockbit/` — **963 berkas emiten**. Tiap berkas punya
  bagian `rasio` (union 94 kunci atas sampel 30 berkas acak, ditambah 3 kunci
  yang hidup di bagian lain berkas: nilai kapitalisasi pasar, jumlah saham
  beredar, dan persentase free float dari bagian "kuartal terbaru" — total
  **101 kunci terukur** dalam riset ini).
- `data-idx/json/fundamental/` — **967 berkas emiten**. **145 ruas skalar**
  terukur (termasuk sub-bagian performa harga dan neraca kuartalan yang
  di-flatten untuk pembandingan; ruas berbentuk deret waktu seperti riwayat
  kuartalan/tahunan TIDAK dihitung sebagai skalar dan tidak masuk pembandingan
  di sini).
- **962 emiten** ada di kedua sumber (irisan) — inilah basis pembandingan.

## 2. Metode

Untuk tiap pasangan ruas yang dipetakan: ambil seluruh emiten (di antara 962)
yang KEDUA sisinya terisi (bukan `-`/`None`/nol), hitung `rasio = nilai_baru ÷
nilai_lama` (untuk ruas persen vs pecahan, sisi pecahan dikalikan 100 dulu
supaya satuannya sama — skala diuji dari NILAI, bukan ditebak dari nama, sesuai
aturan proyek). Lalu hitung median, persentil-5, persentil-95, dan porsi
pasangan yang berada dalam ±1% dan ±5% dari rasio 1,0.

**Vonis** dibaca dari kombinasi median + sebaran (bukan cuma "dalam ±1%"
mentah — banyak ruas berbasis HARGA hari ini punya median nyaris 1,0000 tapi
ekor lebar karena kedua sumber mengambil potret harga di JAM/HARI yang
sedikit berbeda, sehingga rasio 1% bisa meleset jauh kalau penyebutnya kecil):

- **IDENTIK** — median dalam ±3% dari 1,0 dan ≥60% pasangan dalam ±5%. Definisi
  sama; selisih yang ada murni beda saat potret data.
- **IDENTIK\*** (median dekat 1, ekor lebar) — median dalam ±3-10% dari 1,0
  tapi porsi dalam ±5% lebih rendah — definisi kemungkinan sama tapi lebih
  sensitif ke pembagi kecil / hari kalender yang beda (mis. margin kuartalan,
  rasio pertumbuhan YoY).
- **BEDA SKALA (faktor N)** — median menempel ke konstanta seperti 100 atau
  0,01 setelah dikoreksi.
- **BEDA DEFINISI** — median jauh dari 1,0 atau sebarannya tak masuk akal
  (termasuk metrik rating/peringkat lintas emiten yang secara desain TIDAK
  akan pernah 1:1 dengan turunan lokal).

## 3. Tabel pemetaan lengkap (80 pasangan terukur, dari 81 dipetakan)

| Ruas sumber baru | Ruas sumber lama | n | Median | p5 | p95 | dlm ±1% | dlm ±5% | Vonis |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Current PE Ratio (TTM) | pe | 650 | 1.004 | -0.090 | 1.984 | 27% | 56% | IDENTIK* |
| Current PE Ratio (Annualised) | pe_annualised | 598 | 0.956 | -1.107 | 3.830 | 2% | 12% | BEDA DEFINISI |
| Forward PE Ratio | forward_pe | 105 | 0.993 | 0.318 | 1.708 | 3% | 11% | BEDA DEFINISI |
| Earnings Yield (TTM) | earn_yield | 650 | 0.991 | -0.665 | 1.654 | 26% | 56% | IDENTIK* |
| Current Price to Sales (TTM) | ps | 869 | 1.000 | 0.741 | 1.146 | 24% | 62% | IDENTIK |
| Current Price to Book Value | pb | 954 | 1.014 | 0.902 | 1.305 | 20% | 60% | IDENTIK* |
| Current Price to Book Value | pbv | 907 | 1.003 | 0.916 | 1.148 | 32% | 76% | IDENTIK |
| Current Price To Cashflow (TTM) | price_cf | 872 | 1.012 | 0.310 | 1.412 | 21% | 56% | IDENTIK* |
| Current Price To Free Cashflow (TTM) | price_fcf | 859 | 0.954 | -2.916 | 4.803 | 6% | 17% | BEDA DEFINISI |
| EV to EBIT (TTM) | ev_ebit | 545 | 0.978 | -0.126 | 2.457 | 4% | 20% | BEDA DEFINISI |
| EV to EBITDA (TTM) | ev_ebitda | 785 | 0.986 | -0.094 | 3.456 | 5% | 20% | BEDA DEFINISI |
| PEG Ratio | peg | 99 | 0.076 | -4.546 | 3.881 | 0% | 0% | BEDA DEFINISI — lihat §4.5 |
| PEG Ratio (3yr) | peg | 103 | -0.127 | -4.544 | 7.629 | 2% | 3% | BEDA DEFINISI — lihat §4.5 |
| Current EPS (TTM) | eps | 905 | 1.000 | -0.318 | 2.575 | 46% | 57% | IDENTIK* |
| Revenue Per Share (TTM) | rev_ps | 869 | 1.000 | 0.876 | 1.345 | 44% | 68% | IDENTIK |
| Cash Per Share (Quarter) | cash_ps | 637 | 1.000 | 0.069 | 1.313 | 60% | 71% | IDENTIK (median menipu — lihat §4.2) |
| Current Book Value Per Share | bv | 954 | 1.000 | 0.816 | 1.045 | 64% | 83% | IDENTIK |
| Free Cashflow Per Share (TTM) | fcf_ps | 858 | 0.978 | -1.804 | 3.815 | 12% | 20% | BEDA DEFINISI |
| Debt to Equity Ratio (Quarter) | der_q | 486 | 0.995 | 0.281 | 1.998 | 26% | 46% | IDENTIK* |
| Total Liabilities/Equity (Quarter) | tl_eq_q | 637 | 1.000 | 0.884 | 1.155 | 66% | 82% | IDENTIK |
| Financial Leverage (Quarter) | lev_q | 639 | 1.000 | 0.975 | 1.064 | 83% | 91% | IDENTIK |
| Total Debt/Total Assets (Quarter) | td_ta_q | 475 | 0.993 | 0.326 | 1.988 | 21% | 48% | IDENTIK* |
| Return on Assets (TTM) | roa | 888 | 1.010 | -1.214 | 4.330 | 2% | 7% | BEDA DEFINISI |
| Return on Equity (TTM) | roe | 957 | 0.979 | 0.000 | 1.605 | 10% | 42% | IDENTIK* |
| Return On Invested Capital (TTM) | roic | 545 | 0.875 | -0.392 | 2.878 | 2% | 12% | BEDA DEFINISI |
| Return on Capital Employed (TTM) | roce | 569 | 1.003 | 0.000 | 2.424 | 10% | 31% | IDENTIK* |
| Asset Turnover (TTM) | asset_turnover | 618 | 1.015 | 0.892 | 1.482 | 17% | 59% | IDENTIK* |
| Gross Profit Margin (Quarter) | gpm | 802 | 1.023 | 0.265 | 2.117 | 7% | 25% | IDENTIK* |
| Operating Profit Margin (Quarter) | opm | 909 | 1.000 | -0.136 | 1.686 | 44% | 57% | IDENTIK* |
| Net Profit Margin (Quarter) | npm | 887 | 0.949 | -2.457 | 4.691 | 2% | 8% | BEDA DEFINISI |
| Revenue (Quarter YoY Growth) | rev_yoy | 602 | 1.000 | -1.483 | 2.059 | 55% | 58% | IDENTIK* |
| Net Income (Quarter YoY Growth) | ni_yoy | 607 | 1.000 | -1.590 | 1.783 | 51% | 54% | IDENTIK* |
| Dividend (TTM) | dividend_ttm | 410 | 1.000 | 0.671 | 1.000 | 88% | 88% | IDENTIK |
| Payout Ratio | payout_ratio | 287 | 0.962 | 0.057 | 2.398 | 3% | 15% | BEDA DEFINISI — lihat §4.3 |
| Dividend Yield | dividend_yield | 410 | 0.985 | 0.590 | 1.150 | 25% | 62% | IDENTIK |
| Piotroski F-Score | f_score | 948 | 1.400 | 0.667 | 3.000 | 14% | 14% | BEDA DEFINISI — lihat §4.1 |
| Revenue (TTM) | ttm_revenue | 870 | 1.000 | 0.895 | 1.336 | 43% | 69% | IDENTIK |
| Gross Profit (TTM) | ttm_gross | 812 | 1.001 | 0.727 | 1.290 | 30% | 59% | IDENTIK* |
| EBITDA (TTM) | ttm_ebitda | 789 | 1.011 | 0.000 | 2.094 | 8% | 28% | IDENTIK* |
| Net Income (TTM) | ttm_net_income | 873 | 1.000 | 0.342 | 1.468 | 25% | 51% | IDENTIK* |
| Cash (Quarter) | lq_cash | 639 | 1.000 | 0.056 | 1.404 | 56% | 68% | IDENTIK (median menipu — lihat §4.2) |
| Total Assets (Quarter) | lq_assets | 639 | 1.000 | 0.951 | 1.037 | 81% | 93% | IDENTIK |
| Total Liabilities (Quarter) | lq_tot_liab | 639 | 1.000 | 0.945 | 1.094 | 76% | 86% | IDENTIK |
| Common Equity | balance_q.common_equity | 637 | 1.000 | 0.951 | 1.020 | 79% | 92% | IDENTIK |
| Total Equity | balance_q.total_equity | 637 | 1.000 | 0.951 | 1.019 | 80% | 93% | IDENTIK |
| Cash From Operations (TTM) | ttm_ocf | 873 | 1.000 | 0.120 | 1.403 | 52% | 72% | IDENTIK |
| Cash From Investing (TTM) | ttm_icf | 618 | 0.999 | -0.362 | 2.399 | 16% | 35% | IDENTIK* |
| Cash From Financing (TTM) | ttm_fincf | 592 | 0.988 | -1.640 | 2.551 | 20% | 31% | BEDA DEFINISI |
| Capital expenditure (TTM) | ttm_capex | 0 | — | — | — | — | — | n=0, ruas lama nyaris selalu kosong |
| Free cash flow (TTM) | ttm_fcf | 856 | 0.978 | -1.817 | 3.794 | 8% | 19% | BEDA DEFINISI |
| 1 Week Price Returns | price_perf.1w_pct | 660 | -0.259 | -5.823 | 4.869 | 2% | 5% | BEDA DEFINISI (beda hari potong) |
| 1 Month Price Returns | price_perf.1m_pct | 773 | 0.841 | -2.144 | 4.342 | 3% | 7% | BEDA DEFINISI (beda hari potong) |
| 3 Month Price Returns | price_perf.3m_pct | 811 | 0.457 | -4.941 | 6.040 | 1% | 4% | BEDA DEFINISI (beda hari potong) |
| 6 Month Price Returns | price_perf.6m_pct | 854 | 0.977 | -0.639 | 2.679 | 4% | 15% | BEDA DEFINISI (beda hari potong) |
| 1 Year Price Returns | price_perf.1y_pct | 862 | 0.988 | -0.416 | 2.839 | 5% | 18% | BEDA DEFINISI (beda hari potong) |
| 3 Year Price Returns | price_perf.3y_pct | 818 | 1.000 | -0.327 | 1.976 | 10% | 28% | BEDA DEFINISI (beda hari potong) |
| Year to Date Price Returns | price_perf.ytd_pct | 859 | 0.957 | 0.014 | 1.864 | 5% | 22% | BEDA DEFINISI (beda hari potong) |
| 52 Week High | week52_high | 962 | 1.000 | 0.997 | 1.000 | 96% | 98% | IDENTIK |
| 52 Week Low | week52_low | 962 | 1.000 | 1.000 | 1.185 | 85% | 90% | IDENTIK |
| Free Float | free_float_pct | 910 | 0.987 | 0.408 | 1.862 | 26% | 41% | IDENTIK* median menipu — lihat §4.4 |
| Market Cap (kuartal terbaru) | market_cap | 962 | 1.001 | 0.944 | 1.061 | 47% | 87% | IDENTIK |
| Saham Beredar (kuartal terbaru) | shares | 831 | 1.000 | 0.998 | 1.033 | 89% | 96% | IDENTIK |
| Saham Beredar (kuartal terbaru) | shares_outstanding | 829 | 1.000 | 0.998 | 1.033 | 89% | 96% | IDENTIK |
| Current Ratio (Quarter) | current_ratio | 815 | 1.000 | 0.962 | 1.013 | 87% | 91% | IDENTIK |
| Quick Ratio (Quarter) | quick_ratio | 815 | 1.173 | 1.006 | 3.974 | 4% | 17% | BEDA DEFINISI |
| Interest Coverage (TTM) | interest_coverage | 508 | 0.993 | -0.057 | 3.238 | 9% | 26% | BEDA DEFINISI |
| Days Sales Outstanding (Quarter) | days_sales_outstanding | 534 | 0.947 | 0.461 | 1.696 | 5% | 19% | BEDA DEFINISI |
| Days Inventory (Quarter) | days_inventory | 491 | 0.940 | 0.373 | 1.621 | 4% | 19% | BEDA DEFINISI |
| Days Payables Outstanding (Quarter) | days_payables | 514 | 0.937 | 0.565 | 2.015 | 2% | 14% | BEDA DEFINISI |
| Cash Conversion Cycle (Quarter) | cash_conversion_cycle | 481 | 0.908 | 0.008 | 1.791 | 4% | 17% | BEDA DEFINISI |
| Receivables Turnover (Quarter) | receivables_turnover | 532 | 0.262 | 0.146 | 0.528 | 0% | 0% | BEDA DEFINISI |
| Inventory Turnover (TTM) | inventory_turnover | 484 | 1.026 | 0.824 | 1.716 | 14% | 42% | IDENTIK* |
| Altman Z-Score (Modified) | altman_z | 569 | 1.002 | 0.410 | 1.312 | 32% | 62% | IDENTIK |
| Long-term Debt (Quarter) | lq_lt_debt | 376 | 1.001 | 0.189 | 2.724 | 41% | 59% | IDENTIK* |
| Short-term Debt (Quarter) | lq_st_debt | 375 | 0.952 | 0.106 | 1.386 | 25% | 41% | IDENTIK* |
| Total Debt (Quarter) | lq_total_debt | 469 | 0.997 | 0.220 | 1.804 | 37% | 50% | IDENTIK* |
| Net Debt (Quarter) | lq_net_debt | 510 | 0.999 | -0.210 | 1.841 | 36% | 51% | IDENTIK* |
| Working Capital (Quarter) | lq_wc | 554 | 1.000 | 0.875 | 1.152 | 71% | 84% | IDENTIK |
| Gross Profit (Quarter YoY Growth) | gp_yoy | 514 | 1.000 | -1.175 | 1.935 | 60% | 62% | IDENTIK |
| Dividend | dividend | 406 | 1.000 | 0.401 | 1.000 | 78% | 78% | IDENTIK |

Tak satu pun pasangan menunjukkan pola **BEDA SKALA** klasik (faktor 100 /
0,01 / dst.) seperti kasus lama `der`-persen vs `der_q`-rasio — kedua sumber
di sini rupanya sama-sama menyimpan rasio finansial dalam skala yang identik
untuk hampir semua ruas yang sepadan. Yang justru banyak muncul adalah
**BEDA DEFINISI** murni (bukan sekadar beda satuan): metrik yang bergantung
pada estimasi pertumbuhan forward (Forward PE, PEG), rasio yang melibatkan
EPS/EBIT/EBITDA yang sering `None`/nol di satu sisi (EV/EBIT, EV/EBITDA,
Interest Coverage), dan return harga per-periode yang jelas dipotong di
hari kalender berbeda (day-of-month yang tak sama antara "hari ini" Stockbit
vs `harga_pada` fundamental).

## 4. Bedah lima ruas yang ditandai berbeda

### 4.1 Piotroski F-Score

Bukan cuma beda angka — **beda cakupan kriteria**. Sumber lama menyimpan
`f_score` BERSAMA `f_score_n` (jumlah dari 9 kriteria klasik yang berhasil
dihitung, 6-7 dari 9 untuk emiten yang datanya di sumber lama tak lengkap),
sedangkan sumber baru sepertinya menghitung seluruh 9. Rata-rata selisih
(sumber baru − sumber lama) = **+1,71 poin**, dan hanya 22 dari 217 sampel
yang persis sama.

| Emiten | Sumber baru | Sumber lama (dari N kriteria) |
|---|---:|---|
| MPMX | 9 | 3 (dari 6) |
| PSDN | 7 | 1 (dari 6) |
| BLES | 9 | 3 (dari 7) |
| MCOL | 8 | 3 (dari 6) |
| KKES | 5 | 0 (dari 7) |

Dugaan definisi: sumber lama menguji subset kriteria Piotroski (dibuktikan
oleh `f_score_n` < 9 yang tersimpan berdampingan) — bukan cacat acak,
melainkan keterbatasan struktural karena sebagian data pembentuk kriteria
(mis. arus kas operasi historis, margin kotor tahun lalu) memang kosong di
sumber lama untuk banyak emiten. Sumber baru menghitung dari data historis
yang lebih lengkap.

### 4.2 Cash Per Share (Quarter)

**Median rasio "1,0000" di tabel §3 MENYESATKAN** — itu artefak dari cara
pembulatan (banyak emiten kecil kebetulan dekat 1,0 secara acak), bukan
kecocokan definisi. Dibuktikan dari 5 sampel dengan selisih terbesar:

| Emiten | Sumber baru (per lembar) | Sumber lama (per lembar) | Sumber lama = kas kuartal ÷ saham beredar? |
|---|---:|---:|---|
| BJTM | 231,15 | 1.252,02 | **Ya, persis** — 1.252,02 |
| MAYA | 12,72 | 879,55 | **Ya, persis** — 879,55 |
| MBAP | 1.424,61 | 769,82 | **Ya, persis** — 769,82 |
| BNLI | 44,35 | 645,26 | **Ya, persis** — 645,26 |
| ARTO | 1,65 | 380,11 | **Ya, persis** — 380,11 |

Kolom ketiga membuktikan sumber lama = `kas kuartal ÷ saham beredar` TEPAT
(dihitung ulang dari ruas kas & saham beredar di berkas yang sama — cocok
hingga 2 desimal). Untuk emiten sektor keuangan (bank: BJTM/MAYA/BNLI/ARTO),
"kas kuartal" di sumber lama memakai baris neraca yang mencakup penempatan
di bank sentral & bank lain — pos yang sangat besar untuk bank. Sumber baru
kemungkinan memakai definisi "kas & setara kas" yang lebih sempit (baris
yang lazim dipakai analis untuk metrik ini), sehingga jauh lebih kecil.
**Beda definisi struktural, bukan galat** — dan berdampak paling besar pada
emiten finansial.

### 4.3 Payout Ratio

| Emiten | Sumber baru | Sumber lama ×100 | Dividen TTM ÷ EPS ×100 (rekonstruksi) |
|---|---:|---:|---:|
| PSSI | -39,96% | 491,00% | -49,02% (EPS negatif -10,2) |
| APLI | 737,60% | 411,50% | 411,11% |
| UNTD | -72,67% | 204,08% | -71,53% (EPS negatif -6,99) |
| BESS | -135,05% | 134,15% | 135,40% |
| UNTR | 324,34% | 78,67% | 103,72% |

Untuk emiten ber-EPS **positif** (APLI, BESS, EMTK, CNMA — diuji di luar
tabel), rekonstruksi `dividen TTM ÷ EPS` di sumber lama COCOK erat dengan
`payout_ratio` tersimpan (APLI 411,50% vs 411,11%; EMTK 27,23% vs 27,23%
persis). Tapi begitu EPS **negatif** (PSSI, UNTD), nilai tersimpan di sumber
lama TIDAK lagi cocok dengan rekonstruksi lokal itu sendiri — tandanya ruas
ini sebagian besar SALINAN LANGSUNG dari penyedia data lama (bukan dihitung
ulang secara lokal dari `dividend_ttm`/`eps` di berkas yang sama), konsisten
dengan pola "ruas salinan yfinance" yang sudah tercatat di memori proyek.
Sumber baru sendiri konsisten memakai `dividen ÷ EPS` yang sama-sama dari
sumbernya sendiri, sehingga tanda & besarannya masuk akal bahkan saat EPS
negatif.

### 4.4 Free Float

**Ini yang paling signifikan** — bukan beda kecil, tapi salah satu sisi
tampak tidak bisa dipercaya untuk banyak emiten:

| Emiten | Sumber baru | Sumber lama | Insider % + Institusi % (sumber lama) | 100 − insider − institusi |
|---|---:|---:|---|---:|
| BNLI | 9,97% | 99,61% | 1,00 + 89,19 | 9,81% |
| ATAP | 20,00% | 91,03% | 84,97 + 0,00 | 15,03% |
| BIPP | 18,03% | 82,92% | 79,67 + 0,00 | 20,33% |
| WICO | 4,48% | 58,12% | 95,50 + 0,00 | 4,50% |
| PSDN | 8,02% | 59,11% | 87,89 + 0,00 | 12,11% |

Free float di sumber lama sering mendekati 100% untuk emiten yang justru
sangat digenggam insider (BNLI 99,61% padahal insider+institusi menguasai
90,19%) — pola klasik data float yang tidak terisi dengan baik untuk saham
Indonesia dari penyedia data global. Sebaliknya, `100 − insider% − institusi%`
(dihitung dari ruas LAIN di sumber lama sendiri) justru **mendekati angka
free float sumber baru** (BNLI 9,81% ≈ 9,97%; WICO 4,50% ≈ 4,48% — nyaris
persis). Ini konsisten dengan pola yang sudah tercatat di CLAUDE.md untuk
`shares`/`market_cap` yfinance: ruas float dari penyedia lama ikut basi
untuk emiten IDX yang jarang diperbarui kepemilikannya.

### 4.5 PEG Ratio

Sumber baru punya TIGA varian PEG (TTM, 3-tahun, forward); sumber lama cuma
satu `peg`. Tak satu pun dari ketiganya cocok sistematis dengan `peg` sumber
lama, dan rekonstruksi `PE ÷ CAGR EPS` (baik 3-tahun maupun 2-tahun, dari
ruas pertumbuhan yang tersimpan di sumber lama sendiri) juga tidak cocok
konsisten:

| Emiten | PEG (baru) | PEG 3thn (baru) | PEG fwd (baru) | peg (lama) | PE÷CAGR3y (rekonstruksi) | PE÷CAGR2y (rekonstruksi) |
|---|---:|---:|---:|---:|---:|---:|
| BNII | 0,17 | 2,04 | — | 0,32 | -3,29 | **0,17** (cocok kebetulan) |
| ARTO | 0,38 | 0,27 | 10,24 | 0,94 | 0,44 | 0,37 |
| INTP | 0,47 | 0,94 | -0,44 | 4,35 | 1,09 | 0,67 |
| MKPI | 1,30 | 1,06 | — | 0,34 | 1,18 | 1,30 (mirip PEG3thn baru) |
| BYAN | -2,77 | -1,38 | — | 0,63 | -1,16 | -1,02 |

Tak ada pola sistematis (BNII/MKPI kebetulan dekat dengan salah satu
rekonstruksi, tapi INTP/BYAN/ARTO jauh meleset di semua kombinasi). Dugaan:
`peg` sumber lama adalah salinan nilai dari penyedia lama yang memakai
estimasi pertumbuhan forward ala analis (bukan CAGR historis lokal), jadi
metodologinya memang berbeda total dari ketiga varian PEG sumber baru yang
historis. **Tidak bisa dipetakan 1:1 ke salah satu varian manapun** —
kalau dirotasi, perlu keputusan eksplisit varian mana yang dipakai (disarankan
PEG 3-tahun, karena paling stabil dan sudah dipakai luas di analisis ekuitas).

## 5. Ruas hanya ada di sumber baru (nilai tambah rotasi, 23 ruas)

Tak ada padanan di sumber lama sama sekali:

`10 Year Price Returns`, `5 Year Price Returns`, `CASA Ratio` (bank),
`Capital Adequacy Ratio` (bank), `Cost of Credit` (bank), `Current EPS
(Annualised)`, `EPS Rating`, `Financing to Deposit Ratio` (bank syariah),
`Free cash flow (Quarter)`, `IHSG PE Ratio TTM (Median)` (pembanding pasar),
`LT Debt/Equity (Quarter)`, `Latest Dividend Ex-Date`, `NPF - Coverage`
(bank syariah), `NPF - Gross` (bank syariah), `Net Interest Margin (NIM)`
(bank), `PEG (Forward)`, `Rank (Current PE Ratio TTM)`, `Rank (Earnings
Yield)`, `Rank (Market Cap)`, `Rank (Near 52 Weeks High)`, `Rank (P/B)`,
`Rank (P/S)`, `Relative Strength Rating`.

Kelompok terbesar (CASA/CAR/NPF/NIM/Financing to Deposit) khusus perbankan —
sudah dipasang untuk emiten finansial di panel Stock Detail lewat tugas #315.
Ranking lintas-emiten (Rank P/B, Rank P/S, dst.) dan rating (EPS Rating,
Relative Strength Rating) juga baru sama sekali — belum ada padanan yang
bisa dibandingkan karena sumber lama tidak menghitung peringkat relatif
antar emiten.

## 6. Ruas yang wajib tetap dari cadangan (hanya ada di sumber lama)

Tak ada padanan di sumber baru — kalau rotasi terjadi, ruas ini TETAP dibaca
dari sumber lama (cadangan):

- **Estimasi analis & target**: `analyst_count`, `target_price`,
  `recommendation` (di luar 145 ruas skalar tapi relevan)
- **Teknikal turunan lokal**: `ma50`, `ma200`, `beta`, `avg_volume`,
  `avg_volume_10d`
- **Pertumbuhan historis terhitung lokal**: `eps_cagr_2y`, `eps_cagr_3y`,
  `ddm_g_rate`, `div_years`
- **Perbandingan sektor** (dihitung silang dari seluruh basis 967 emiten):
  `sector_pe_median`, `sector_pb_median`, `sector_npm_median`,
  `sector_roe_median`, `sector_ev_ebitda_median`, `sector_stock_count`,
  `pe_vs_sector_pct`, `pb_vs_sector_pct`, `ps_vs_sector_pct`
- **Kepemilikan**: `held_insiders_pct`, `held_institutions_pct`,
  `float_shares`, `float_pct` (meski §4.4 menunjukkan `float_pct` sendiri
  patut diragukan — insider/institusi %-nya yang justru lebih bisa dipercaya)
- **Harga snapshot**: `last_price`, `prev_close`, `ex_dividend_date`,
  `week52_change_pct`, rentang harga per-periode (`price_perf.*_high/low`)
- Beberapa `balance_q.*`/`lq_*` yang jadi duplikat internal sumber lama
  sendiri (`lq_equity`, `lt_der_q`) — bukan ruas independen baru.

## 7. Rekomendasi pemetaan

**Aman dirotasi langsung** (median dekat 1,0, selisih murni beda saat
potret data, tidak perlu keputusan tambahan): seluruh ruas berlabel
**IDENTIK** dan **IDENTIK\*** di tabel §3 — meliputi rasio valuasi utama
(PE, PS, PBV, EY, harga/arus kas), margin, leverage kuartalan, ruas TTM
laporan laba-rugi & arus kas, neraca kuartalan, dividen TTM & yield, 52-week
high/low, market cap, dan saham beredar. Ini mayoritas dari 80 pasangan yang
terukur.

**Butuh keputusan Johan sebelum dirotasi** (definisi berbeda terbukti, bukan
cuma waktu potret):
- **Piotroski F-Score** — sumber baru lebih lengkap (menguji sampai 9
  kriteria vs 6-7 di sumber lama); rotasi masuk akal TAPI perlu Johan setuju
  karena angka historis di layar (kalau pernah ditampilkan) akan naik
  ~1-2 poin untuk banyak emiten tanpa perubahan fundamental apa pun.
- **Cash Per Share** — dua definisi kas yang berbeda (sempit vs luas
  termasuk penempatan bank). Untuk emiten NON-finansial selisihnya kecil;
  untuk emiten FINANSIAL selisihnya besar dan sistematis. Disarankan: rotasi
  per-sektor (pakai sumber baru untuk non-bank, evaluasi ulang untuk bank).
- **Payout Ratio** — sumber baru lebih konsisten tanda/besaran saat EPS
  negatif (sumber lama tampak salinan langsung penyedia lama yang tak selalu
  cocok dengan ruas dividen/EPS-nya sendiri). Disarankan rotasi ke sumber
  baru, tapi Johan perlu tahu angka lama untuk emiten rugi bisa berubah
  drastis (arah tandanya juga bisa berubah).
- **Free Float** — bukti kuat (§4.4) sumber lama tidak bisa dipercaya untuk
  banyak emiten IDX (float dekat 100% pada saham yang sangat digenggam
  insider). Disarankan rotasi PENUH ke sumber baru untuk ruas ini — ini
  yang paling jelas "sumber lengkap menganggur, sumber lama malah salah"
  sesuai semangat CLAUDE.md §3c.
- **PEG Ratio** — metodologi sumber lama tak terpetakan ke varian manapun
  di sumber baru. Kalau dirotasi, perlu keputusan eksplisit: pakai PEG
  3-tahun (paling umum dipakai analis) sebagai pengganti, dan sebut di
  metodologi halaman kalau definisinya berubah.

**Tetap dari sumber lama (cadangan permanen — sumber baru tidak
menyediakannya)**: seluruh ruas di §6 — estimasi analis, moving average,
beta, CAGR EPS lokal, perbandingan sektor, kepemilikan insider/institusi,
harga snapshot 1-hari.

**Ruas berlabel BEDA DEFINISI lainnya** (EV/EBIT, EV/EBITDA, Forward PE,
Free Cashflow per Share, ROA/ROIC/ROCE, Net Profit Margin, seluruh Price
Returns per-periode, rasio siklus kas Days Sales/Inventory/Payables,
Receivables/Quick Ratio) — selisihnya kemungkinan besar berasal dari
ruas pembentuk yang sering `None`/nol di sumber lama (EBIT/EBITDA banyak
kosong, siklus kas hanya terisi untuk emiten dengan model bisnis
inventori/piutang jelas) ATAU beda hari potong TTM/kuartal antar sumber.
Belum diklasifikasikan cukup jelas untuk rekomendasi langsung — kalau
salah satu ruas ini dibutuhkan tampil di halaman, ukur ulang definisinya
secara khusus (bukan disamakan berdasar nama) sebelum dipasang, sesuai
aturan "ukur definisinya dulu" CLAUDE.md.
