# Riset #217 — Backtest fitur broker + baseline manusia

Sumber perintah: `spek_bt_broker.md` (#217). Repo kerja `C:/tmp/wt-213` (worktree terpisah, nol commit/push, nol jaringan). Mesin: `scripts/riset/bt_broker.py`, `scripts/riset/bt_manusia.py` — keduanya IMPOR APA ADANYA `simulasi_trade`/`ringkas_trades`/`tulis_hasil`/`universe_partanggal`/`ihsg_return` dari `bt_papan.py` (mesin sudah ada, satu definisi return & biaya).

## A. Fitur broker — metode

Data: `data-idx/json/broker_tahunan/<KODE>/<TAHUN>.json`, papan REGULER,
SEMUA investor, GROSS. Kelompok broker STATIS (salinan kode->kelompok dari
`app/src/lib/dasbor/kelompokBroker.ts` KURASI). Per (emiten,tanggal): lima
angka — `net_nonritel` (asing+bumn+smart), `net_asing`, `net_ritel`, `gross`,
`top3_beli_share`.

Fitur (dari bar <= t saja, kausal): `rasio_{nonritel,asing,ritel}_N` untuk
N={5,10,20} = jumlah net N-hari / jumlah gross N-hari, dalam [-1,1], NaN
kalau ada bar tanpa broker di jendela atau jumlah gross jendela = 0.

Universe: `rank_lik <= 150` (trailing 60 bar, anti-bias, `universe_partanggal`
bt_papan.py). Ambang sinyal = desil teratas (quantile 0,9) rasio LINTAS
EMITEN per tanggal, dihitung HANYA dari populasi di dalam universe.

Aturan sinyal (ditetapkan sebelum hasil dilihat, tak diubah sesudahnya):
- S1: rasio_nonritel_N desil teratas DAN rasio_ritel_N < 0
- S2: rasio_asing_N desil teratas
- S3: rasio_nonritel_N desil teratas DAN close > ema20

Satu posisi per emiten pada satu waktu (sinyal diabaikan selama posisi
masih terbuka). Masuk open_h1. Keluar: h5, h20, tp_sl (level = harga
masuk, sl_pct = 1,5x ATR14% dihitung dari bar SEBELUM sinyal, horizon 20
bar). Biaya dijalankan dua kali: 0,0 (keputusan #93) dan 0,004 (0,4%
roundtrip) — keduanya dilaporkan. 27 varian (S1-3 x N{5,10,20} x
keluar{h5,h20,tp_sl}).

Pembanding acak: per varian per tahun, jumlah trade sama dengan real,
entri = (emiten di universe, tanggal) acak seragam dalam tahun itu, keluar
sama, 20 ulangan (`random.Random(217)`), dilaporkan rata-rata & p95 profit
factor.

Walk-forward: tahun uji 2018-2026. Untuk tahun Y, pilih di antara 27 varian
yang PF-nya tertinggi pada tahun Y-1 (syarat n >= 30 trade dalam sampel);
hasil varian itu di tahun Y dicatat sebagai "luar sampel". Tabel lengkap
27 varian per tahun (dalam sampel) disertakan di bawah supaya pemilihan
bisa diperiksa ulang.

## A.1 Walk-forward — biaya 0,0

| Tahun | Varian terpilih (dari tahun sebelumnya) | n | Win rate | Profit factor | Ekspektansi (rata2 return) | PF acak rata2 | PF acak p95 | IHSG tahun itu |
|---|---|---|---|---|---|---|---|---|
| 2018 | broker-s3-n5-h20 | 386 | 41.7% | 0.822 | -0.90% | 0.945 | 1.091 | -2.3% |
| 2019 | broker-s1-n20-h20 | 291 | 35.7% | 0.566 | -3.02% | 0.692 | 0.922 | 1.9% |
| 2020 | broker-s3-n5-h5 | 587 | 47.7% | 1.235 | 0.64% | 1.081 | 1.289 | -4.8% |
| 2021 | broker-s3-n10-tp_sl | 408 | 28.9% | 1.195 | 0.75% | 1.068 | 1.373 | 7.8% |
| 2022 | broker-s3-n20-h20 | 273 | 45.1% | 1.138 | 0.58% | 0.749 | 0.908 | 2.8% |
| 2023 | broker-s1-n20-h20 | 320 | 41.9% | 1.198 | 0.96% | 0.839 | 1.075 | 6.2% |
| 2024 | broker-s3-n10-tp_sl | 420 | 30.5% | 1.069 | 0.23% | 0.939 | 1.158 | -3.3% |
| 2025 | broker-s3-n20-h20 | 270 | 48.5% | 1.412 | 1.83% | 1.738 | 2.086 | 20.7% |
| 2026 | broker-s3-n5-h20 | 259 | 38.2% | 0.592 | -3.61% | 0.626 | 0.723 | -26.4% |

**Vonis kriteria (PF luar sampel > 1,3 di >=3 dari 5 tahun 2022-2026 DAN > p95 acak): GAGAL** — 0 dari 5 tahun (2022-2026) memenuhi kedua syarat sekaligus.

## A.1 Walk-forward — biaya 0,004

| Tahun | Varian terpilih (dari tahun sebelumnya) | n | Win rate | Profit factor | Ekspektansi (rata2 return) | PF acak rata2 | PF acak p95 | IHSG tahun itu |
|---|---|---|---|---|---|---|---|---|
| 2018 | broker-s3-n5-h20 | 386 | 41.5% | 0.755 | -1.30% | 0.878 | 1.106 | -2.3% |
| 2019 | broker-s1-n20-h20 | 291 | 35.4% | 0.526 | -3.42% | 0.609 | 0.803 | 1.9% |
| 2020 | broker-s3-n5-h5 | 587 | 46.3% | 1.082 | 0.24% | 0.990 | 1.250 | -4.8% |
| 2021 | broker-s3-n10-tp_sl | 408 | 28.7% | 1.085 | 0.35% | 0.904 | 1.166 | 7.8% |
| 2022 | broker-s3-n20-h20 | 273 | 43.6% | 1.040 | 0.18% | 0.649 | 0.752 | 2.8% |
| 2023 | broker-s1-n20-h20 | 320 | 41.6% | 1.110 | 0.56% | 0.736 | 0.855 | 6.2% |
| 2024 | broker-s3-n10-h20 | 357 | 42.3% | 0.922 | -0.38% | 0.833 | 1.007 | -3.3% |
| 2025 | broker-s3-n5-h20 | 481 | 44.5% | 1.891 | 4.07% | 1.663 | 1.916 | 20.7% |
| 2026 | broker-s3-n5-h20 | 259 | 37.5% | 0.559 | -4.01% | 0.641 | 0.840 | -26.4% |

**Vonis kriteria (PF luar sampel > 1,3 di >=3 dari 5 tahun 2022-2026 DAN > p95 acak): GAGAL** — 0 dari 5 tahun (2022-2026) memenuhi kedua syarat sekaligus.

## A.2 Tabel lengkap 27 varian per tahun (dalam sampel)

Sumber angka: `data-idx/json/bt/broker-*.json` (biaya 0,0; biaya 0,004 diturunkan dari trade yang sama, return dikurangi 0,004 flat). n = jumlah trade dengan tanggal sinyal di tahun itu; PF = profit factor.

### Biaya 0,0

| Varian | 2016 (n/pf) | 2017 (n/pf) | 2018 (n/pf) | 2019 (n/pf) | 2020 (n/pf) | 2021 (n/pf) | 2022 (n/pf) | 2023 (n/pf) | 2024 (n/pf) | 2025 (n/pf) | 2026 (n/pf) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| broker-s1-n10-h20 | 384/2.14 | 366/1.06 | 389/0.87 | 400/0.68 | 391/0.99 | 473/1.00 | 466/0.96 | 472/1.20 | 445/1.01 | 456/1.51 | 314/0.55 |
| broker-s1-n10-h5 | 653/1.55 | 620/0.89 | 646/0.92 | 706/0.85 | 689/0.91 | 827/0.98 | 809/1.06 | 821/1.04 | 834/1.06 | 814/1.33 | 587/0.91 |
| broker-s1-n10-tp_sl | 492/1.75 | 467/1.13 | 504/0.77 | 554/0.71 | 546/1.21 | 627/1.03 | 590/0.95 | 596/1.18 | 569/1.06 | 574/1.36 | 467/0.70 |
| broker-s1-n20-h20 | 245/2.13 | 254/1.28 | 260/1.05 | 291/0.57 | 253/0.80 | 330/1.27 | 319/1.18 | 320/1.20 | 312/1.14 | 298/1.30 | 218/0.59 |
| broker-s1-n20-h5 | 514/1.61 | 515/0.90 | 515/0.99 | 616/0.70 | 547/0.80 | 710/1.03 | 706/1.06 | 713/1.10 | 710/1.04 | 678/1.17 | 497/0.84 |
| broker-s1-n20-tp_sl | 351/1.70 | 348/1.06 | 362/1.03 | 444/0.54 | 412/1.04 | 459/1.29 | 447/1.14 | 446/1.36 | 435/1.12 | 419/1.21 | 361/0.91 |
| broker-s1-n5-h20 | 543/1.96 | 514/1.41 | 530/0.78 | 549/0.72 | 555/1.25 | 647/0.98 | 644/0.84 | 650/1.13 | 611/1.01 | 647/1.98 | 418/0.72 |
| broker-s1-n5-h5 | 817/1.37 | 801/1.15 | 820/0.95 | 867/0.87 | 892/0.93 | 1032/1.05 | 1028/0.98 | 1032/1.02 | 1057/1.02 | 1070/1.37 | 759/0.84 |
| broker-s1-n5-tp_sl | 650/1.54 | 640/1.29 | 661/0.78 | 708/0.73 | 730/1.29 | 790/1.02 | 796/0.96 | 797/1.19 | 781/1.07 | 797/1.67 | 599/0.85 |
| broker-s2-n10-h20 | 464/2.24 | 442/1.36 | 490/0.95 | 480/0.61 | 452/1.08 | 467/1.03 | 475/0.93 | 450/1.04 | 412/1.06 | 409/1.35 | 287/0.71 |
| broker-s2-n10-h5 | 875/1.57 | 835/1.19 | 906/0.87 | 914/0.82 | 884/0.92 | 916/0.95 | 920/1.02 | 871/0.91 | 835/0.96 | 820/1.09 | 602/0.85 |
| broker-s2-n10-tp_sl | 618/1.81 | 588/1.38 | 674/0.91 | 677/0.67 | 642/1.24 | 634/1.00 | 612/0.97 | 604/1.14 | 546/1.03 | 549/1.13 | 440/0.93 |
| broker-s2-n20-h20 | 328/1.86 | 319/1.44 | 359/0.71 | 347/0.52 | 335/0.99 | 342/1.10 | 343/1.04 | 321/0.83 | 302/0.93 | 293/1.52 | 200/0.60 |
| broker-s2-n20-h5 | 739/1.34 | 720/1.08 | 800/0.87 | 798/0.66 | 778/1.01 | 788/0.98 | 789/0.97 | 756/0.84 | 751/1.11 | 725/1.11 | 520/0.73 |
| broker-s2-n20-tp_sl | 459/1.63 | 473/1.18 | 540/0.76 | 547/0.63 | 523/1.08 | 512/0.95 | 483/1.01 | 482/0.96 | 428/0.96 | 425/1.31 | 361/0.71 |
| broker-s2-n5-h20 | 636/1.99 | 602/1.32 | 655/0.87 | 640/0.60 | 593/1.15 | 643/1.05 | 637/0.81 | 602/1.04 | 574/1.02 | 572/1.71 | 392/0.70 |
| broker-s2-n5-h5 | 1071/1.50 | 1042/1.11 | 1113/0.89 | 1104/0.77 | 1049/1.06 | 1115/0.96 | 1102/1.01 | 1075/1.02 | 1027/0.98 | 1031/1.17 | 715/0.83 |
| broker-s2-n5-tp_sl | 803/1.62 | 800/1.32 | 861/0.89 | 849/0.64 | 801/1.24 | 835/0.95 | 780/0.98 | 755/1.06 | 721/1.00 | 736/1.31 | 548/0.88 |
| broker-s3-n10-h20 | 309/2.55 | 285/1.23 | 316/0.84 | 319/0.67 | 305/1.76 | 344/1.14 | 356/0.91 | 358/1.45 | 357/1.00 | 375/1.59 | 218/0.36 |
| broker-s3-n10-h5 | 507/1.73 | 464/1.13 | 510/0.84 | 523/0.84 | 502/1.26 | 559/1.16 | 567/1.07 | 590/1.17 | 643/1.01 | 638/1.37 | 410/0.71 |
| broker-s3-n10-tp_sl | 367/2.02 | 328/1.38 | 380/0.93 | 379/0.75 | 354/1.95 | 408/1.19 | 415/0.86 | 410/1.48 | 420/1.07 | 448/1.41 | 303/0.59 |
| broker-s3-n20-h20 | 232/2.44 | 223/1.28 | 238/0.90 | 244/0.70 | 213/1.43 | 268/1.35 | 273/1.14 | 260/1.20 | 267/1.16 | 270/1.41 | 166/0.42 |
| broker-s3-n20-h5 | 454/1.94 | 422/1.10 | 449/0.97 | 461/0.99 | 429/1.09 | 517/1.01 | 526/1.09 | 524/1.06 | 556/1.00 | 545/1.24 | 358/0.75 |
| broker-s3-n20-tp_sl | 293/2.09 | 272/1.25 | 305/0.97 | 303/0.88 | 263/1.46 | 329/1.29 | 337/0.98 | 324/1.31 | 329/1.03 | 345/1.26 | 233/0.82 |
| broker-s3-n5-h20 | 403/2.17 | 369/1.85 | 386/0.82 | 397/0.72 | 374/1.88 | 422/1.05 | 440/0.95 | 449/1.45 | 443/1.16 | 481/2.03 | 259/0.59 |
| broker-s3-n5-h5 | 595/1.46 | 567/1.21 | 569/0.91 | 610/1.02 | 587/1.23 | 631/1.02 | 669/1.03 | 698/1.18 | 746/1.05 | 761/1.44 | 483/0.73 |
| broker-s3-n5-tp_sl | 455/1.74 | 434/1.53 | 436/0.93 | 466/0.75 | 435/1.85 | 475/1.18 | 505/0.96 | 512/1.45 | 524/1.11 | 562/1.83 | 351/0.86 |

### Biaya 0,004

| Varian | 2016 (n/pf) | 2017 (n/pf) | 2018 (n/pf) | 2019 (n/pf) | 2020 (n/pf) | 2021 (n/pf) | 2022 (n/pf) | 2023 (n/pf) | 2024 (n/pf) | 2025 (n/pf) | 2026 (n/pf) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| broker-s1-n10-h20 | 384/1.96 | 366/0.96 | 389/0.80 | 400/0.63 | 391/0.94 | 473/0.93 | 466/0.88 | 472/1.11 | 445/0.93 | 456/1.41 | 314/0.52 |
| broker-s1-n10-h5 | 653/1.31 | 620/0.73 | 646/0.78 | 706/0.73 | 689/0.81 | 827/0.83 | 809/0.90 | 821/0.89 | 834/0.90 | 814/1.15 | 587/0.81 |
| broker-s1-n10-tp_sl | 492/1.57 | 467/1.00 | 504/0.69 | 554/0.64 | 546/1.12 | 627/0.94 | 590/0.85 | 596/1.07 | 569/0.95 | 574/1.25 | 467/0.64 |
| broker-s1-n20-h20 | 245/1.95 | 254/1.15 | 260/0.97 | 291/0.53 | 253/0.75 | 330/1.18 | 319/1.08 | 320/1.11 | 312/1.05 | 298/1.21 | 218/0.55 |
| broker-s1-n20-h5 | 514/1.38 | 515/0.74 | 515/0.84 | 616/0.61 | 547/0.70 | 710/0.89 | 706/0.89 | 713/0.93 | 710/0.89 | 678/1.00 | 497/0.75 |
| broker-s1-n20-tp_sl | 351/1.52 | 348/0.94 | 362/0.93 | 444/0.49 | 412/0.96 | 459/1.17 | 447/1.02 | 446/1.23 | 435/1.01 | 419/1.10 | 361/0.83 |
| broker-s1-n5-h20 | 543/1.79 | 514/1.29 | 530/0.72 | 549/0.67 | 555/1.19 | 647/0.91 | 644/0.77 | 650/1.05 | 611/0.93 | 647/1.84 | 418/0.68 |
| broker-s1-n5-h5 | 817/1.14 | 801/0.96 | 820/0.81 | 867/0.75 | 892/0.82 | 1032/0.90 | 1028/0.83 | 1032/0.87 | 1057/0.87 | 1070/1.19 | 759/0.76 |
| broker-s1-n5-tp_sl | 650/1.38 | 640/1.14 | 661/0.70 | 708/0.66 | 730/1.19 | 790/0.93 | 796/0.87 | 797/1.08 | 781/0.97 | 797/1.54 | 599/0.79 |
| broker-s2-n10-h20 | 464/2.04 | 442/1.23 | 490/0.88 | 480/0.56 | 452/1.03 | 467/0.95 | 475/0.85 | 450/0.96 | 412/0.96 | 409/1.25 | 287/0.67 |
| broker-s2-n10-h5 | 875/1.30 | 835/0.97 | 906/0.74 | 914/0.69 | 884/0.81 | 916/0.81 | 920/0.85 | 871/0.76 | 835/0.79 | 820/0.94 | 602/0.76 |
| broker-s2-n10-tp_sl | 618/1.61 | 588/1.21 | 674/0.82 | 677/0.59 | 642/1.15 | 634/0.90 | 612/0.87 | 604/1.02 | 546/0.91 | 549/1.03 | 440/0.86 |
| broker-s2-n20-h20 | 328/1.70 | 319/1.29 | 359/0.65 | 347/0.47 | 335/0.93 | 342/1.01 | 343/0.95 | 321/0.76 | 302/0.84 | 293/1.40 | 200/0.57 |
| broker-s2-n20-h5 | 739/1.12 | 720/0.88 | 800/0.73 | 798/0.56 | 778/0.90 | 788/0.84 | 789/0.81 | 756/0.70 | 751/0.92 | 725/0.96 | 520/0.66 |
| broker-s2-n20-tp_sl | 459/1.44 | 473/1.03 | 540/0.67 | 547/0.56 | 523/0.99 | 512/0.86 | 483/0.91 | 482/0.85 | 428/0.85 | 425/1.18 | 361/0.65 |
| broker-s2-n5-h20 | 636/1.81 | 602/1.20 | 655/0.80 | 640/0.55 | 593/1.08 | 643/0.96 | 637/0.75 | 602/0.95 | 574/0.93 | 572/1.59 | 392/0.66 |
| broker-s2-n5-h5 | 1071/1.25 | 1042/0.90 | 1113/0.75 | 1104/0.65 | 1049/0.94 | 1115/0.82 | 1102/0.85 | 1075/0.86 | 1027/0.83 | 1031/1.02 | 715/0.73 |
| broker-s2-n5-tp_sl | 803/1.44 | 800/1.16 | 861/0.80 | 849/0.57 | 801/1.15 | 835/0.86 | 780/0.88 | 755/0.94 | 721/0.89 | 736/1.20 | 548/0.81 |
| broker-s3-n10-h20 | 309/2.32 | 285/1.10 | 316/0.77 | 319/0.61 | 305/1.65 | 344/1.06 | 356/0.83 | 358/1.34 | 357/0.92 | 375/1.49 | 218/0.34 |
| broker-s3-n10-h5 | 507/1.46 | 464/0.92 | 510/0.72 | 523/0.71 | 502/1.09 | 559/0.99 | 567/0.91 | 590/0.99 | 643/0.85 | 638/1.18 | 410/0.63 |
| broker-s3-n10-tp_sl | 367/1.82 | 328/1.21 | 380/0.84 | 379/0.68 | 354/1.78 | 408/1.08 | 415/0.76 | 410/1.33 | 420/0.95 | 448/1.29 | 303/0.54 |
| broker-s3-n20-h20 | 232/2.24 | 223/1.15 | 238/0.83 | 244/0.65 | 213/1.34 | 268/1.25 | 273/1.04 | 260/1.11 | 267/1.06 | 270/1.31 | 166/0.39 |
| broker-s3-n20-h5 | 454/1.67 | 422/0.88 | 449/0.83 | 461/0.84 | 429/0.95 | 517/0.87 | 526/0.92 | 524/0.90 | 556/0.85 | 545/1.07 | 358/0.67 |
| broker-s3-n20-tp_sl | 293/1.89 | 272/1.09 | 305/0.87 | 303/0.80 | 263/1.33 | 329/1.18 | 337/0.87 | 324/1.18 | 329/0.92 | 345/1.14 | 233/0.75 |
| broker-s3-n5-h20 | 403/1.97 | 369/1.67 | 386/0.75 | 397/0.66 | 374/1.76 | 422/0.98 | 440/0.87 | 449/1.33 | 443/1.07 | 481/1.89 | 259/0.56 |
| broker-s3-n5-h5 | 595/1.23 | 567/0.99 | 569/0.77 | 610/0.86 | 587/1.08 | 631/0.89 | 669/0.88 | 698/1.00 | 746/0.90 | 761/1.26 | 483/0.64 |
| broker-s3-n5-tp_sl | 455/1.56 | 434/1.35 | 436/0.83 | 466/0.67 | 435/1.70 | 475/1.08 | 505/0.85 | 512/1.30 | 524/1.00 | 562/1.67 | 351/0.79 |

## A.3 Durasi & cakupan

- Emiten OHLCV: 963, rank universe maksimum: 150 (tak perlu diturunkan ke 100 — durasi jauh di bawah 40 menit).
- Durasi `--resmi`: 50.8 detik (~0.85 menit).
- Log: lihat `log` di keluaran JSON (tidak disalin penuh ke sini).

## B. Baseline manusia

Sumber pilihan: `arus-pasar/edisi/*.json` (kecuali `_tahan.json`, tanggal +
`emiten[].ticker`) digabung dengan `data-idx/json/tinjauan_deepdive.json`
`terbitan[]` (kode, tanggal), dedup (kode,tanggal): **81 pilihan
unik**, 0 dilewati (kode/tanggal tak ada di data OHLCV).

Mesin sama (simulasi_trade, masuk open_h1, keluar h5/h20/tp_sl 1,5x ATR14%,
horizon 20). Pembanding acak: universe rank<=150, TANGGAL SAMA dengan pilihan
manusia (bukan tanggal acak), emiten acak seragam, 20 ulangan.

**Catatan jujur: n = 81 (Agustus 2026 saja) — baseline informal,
BUKAN bukti kuat.** Rentang waktu terlalu pendek untuk menyimpulkan keunggulan
atau kelemahan kurasi manusia dibanding acak.

### Biaya 0,0

| Model keluar | n | Win rate | Profit factor | Ekspektansi | PF acak rata2 | PF acak p95 |
|---|---|---|---|---|---|---|
| h5 | 81 | 55.6% | 2.191 | 3.13% | 1.504 | 2.782 |
| h20 | 70 | 47.1% | 1.444 | 2.03% | 1.753 | 3.073 |
| tp_sl | 81 | 42.0% | 1.571 | 2.27% | 1.712 | 3.444 |

### Biaya 0,004

| Model keluar | n | Win rate | Profit factor | Ekspektansi | PF acak rata2 | PF acak p95 |
|---|---|---|---|---|---|---|
| h5 | 81 | 54.3% | 1.973 | 2.73% | 1.407 | 1.911 |
| h20 | 70 | 45.7% | 1.341 | 1.63% | 1.314 | 1.969 |
| tp_sl | 81 | 40.7% | 1.444 | 1.87% | 1.444 | 2.348 |

## Catatan penutup

Angka di atas apa adanya, tak ditafsirkan lebih jauh dari yang tertulis.
Aturan sinyal S1-S3, ambang desil, dan kriteria vonis ditetapkan di
`spek_bt_broker.md` SEBELUM run ini dijalankan, dan tidak diubah sesudah
angka terlihat.
