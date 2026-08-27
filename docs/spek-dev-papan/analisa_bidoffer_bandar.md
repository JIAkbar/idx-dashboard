# Analisa mendalam — "Private Class BIDOFFER Bandar" (Abdullah Ali Akbar), 20 halaman

Untuk Johan, 25 Agu 2026 (sesi AI Skill). Perintah: *"masih ada lagi coba analisa secara mendalam file Private Class BIDOFFER Bandar Juli - Abo di … data ide"*. Semua klaim di bawah diuji ke arsip chartbit/marketdetectors kita, bukan dinilai dari kesan.

## Isi materi (3 bagian)

| Bagian | Halaman | Inti |
|---|---|---|
| 1 · Introduction | 2–6 | Definisi bid/offer/orderbook/tradebook; "bandar = lot besar freq kecil, ritel = lot kecil freq besar"; **Rules of Thumb**: Total Offer > 3× Total Bid = siap naik; volume buyer > 3× seller di tradebook = "ketimpangan volume"; studi kasus CUAN & DKFT |
| 2 · Target Market Makers (TMM) | 7–13 | Rumus target harga: **TMM = (Vb ÷ Vt) × Ht + Hm** — Vb volume lot buyer tradebook, Vt rata-rata lot per tick di orderbook, Ht fraksi harga per tick, Hm harga saat spike pertama. Versi swing: Vb = lot broker top-1..5 broksum, Vt = (total bid + total offer) ÷ 2, Hm = avg price top buyer broksum. Studi kasus MBMA, PTRO, RAJA |
| 3 · Flow / Bandarmologi | 14–20 | Siklus pasar 4 fase (Akumulasi → Mark Up → Distribusi → Mark Down); cara membaca fase dari **broker summary** (akumulasi: beli terkonsentrasi di sedikit broker, jual tersebar; distribusi kebalikannya); bandar memakai 3–8 sekuritas sekaligus; studi kasus TPIA/BREN "road to MSCI" 2023–2024; **Rules of Thumb harian** (hal 20) |

## Verifikasi rumus TMM ke contoh materinya sendiri

| Kasus | Vb | Vt | Ht | Hm | TMM hitung | Angka di slide |
|---|---|---|---|---|---|---|
| PTRO | 31.000 | 1.500 | 10 | 2.600 | **2.806,7** | 2.806 ✅ |
| RAJA | 47.000 | 2.500 | 10 | 2.310 | **2.498,0** | 2.500 ✅ |
| RAJA (2) | 387.000 | 25.000 | 5 | 1.565 | **1.642,4** | 1.645 ✅ |
| MBMA (akumulasi) | 665.000 | 33.500 | 2 | 408 | **447,7** | 460 ⚠️ (slide memakai Vb lain / pembulatan) |

Rumusnya konsisten — dan **strukturnya sama persis dengan Kuli Papan** yang sudah kita bangun: `Target = Buy Avg + Baseline + (Terdorong × Tick)` dengan `Terdorong = Buy Lot ÷ Rata per papan`. Bedanya hanya baseline 5% dan sumber "rata per papan". Jadi TMM = varian rumus yang sudah ada di prototipe Dev kita.

## Uji klaim ke data kita

**1. "Value emiten 8–10% dari value IHSG = valid bermain" (hal 20).** Bisa dihitung: Σ value 962 emiten = value IHSG chartbit, rasio **1,00** di 6 hari terakhir — jadi "value IHSG" memang total nilai transaksi pasar, dan porsi tiap emiten bisa kita hitung tepat.

**2. Backtest aturan hal 20** (2025-01 → 2026-08, semua emiten, horizon H+5):

| Saringan | n | Median H+5 | Menang |
|---|---|---|---|
| Semua hari-emiten (pembanding) | 320.309 | +0,00% | 43% |
| Value ≥ 8% nilai IHSG | 452 | −0,63% | 44% |
| + net foreign buy ≥ 10% value | 98 | −0,87% | 44% |

Artinya: aturan "ramai + asing beli besar" **tidak memberi keunggulan H+5** di data 20 bulan terakhir — bahkan sedikit lebih buruk dari rata-rata pasar. Sampelnya kecil (98), jadi bukan vonis final, tapi cukup untuk menolak klaim "valid layak dihold berhari-hari" tanpa syarat lain.

## Yang BISA kita bangun dari materi ini

| Konsep | Data kita | Catatan |
|---|---|---|
| Fase Akumulasi/Distribusi dari broker summary (hal 16) | ✅ **sudah ada** — `bandar_detector` (accdist, top1/3/5/10, total_buyer/seller) + tabel broker 6 varian | Persis definisi materi: konsentrasi beli sedikit broker vs jual tersebar = `top3_pct` tinggi + `number_broker_buysell` negatif. Ini sudah jadi **preset Whale-2** |
| Jejak "3–8 sekuritas milik satu bandar" (hal 15, 18) | ✅ bisa — korelasi net beli antar broker sepanjang waktu per emiten | **Fitur baru yang belum ada di spek mana pun**: cari kelompok broker yang net-nya bergerak bersamaan → "klaster bandar" |
| Timeline fase per emiten (hal 17–18, gaya TPIA road-to-MSCI) | ✅ bisa — arsip broker harian 2017–2026 + accdist harian | Halaman "Riwayat Fase Bandar": pita berwarna 4 fase di bawah chart + daftar broker dominan tiap fase |
| Porsi value emiten terhadap pasar (hal 20) | ✅ ada (rasio 1,00 terverifikasi) | Ruas `porsi_value_pasar` |
| Net foreign ≥ 10–15% value (hal 20) | ✅ ada | Ruas `porsi_net_asing` — sudah teruji **tidak beredge sendirian** |
| TMM swing (Vb dari broksum top-1..5, Hm = avg price) | ✅ ada semua ruasnya | Varian rumus untuk Kuli Papan |

## Yang TIDAK bisa (batas jujur)

- **Seluruh Bagian 1 dan TMM daytrade bergantung pada orderbook + tradebook real-time** (lot per tick, bid/offer piramida, haka/buki per menit). Kita **tidak punya** dua-duanya: orderbook penuh hanya di Stockbit Pro (berbayar), tradebook per transaksi tidak dipanen. Yang kita punya: antrean penutupan level terbaik dari IDX (satu titik) dan bar 1 menit intraday (o/h/l/c/volume/freq — tanpa sisi beli/jual per transaksi).
- Konsekuensi: "ketimpangan volume 3×", "Total Offer > 3× Total Bid", "Vt rata-rata lot per tick" **tidak bisa dihitung otomatis** — hanya bisa diisi manual pemakai (persis seperti Kuli Papan sekarang) atau didekati kasar dari bar menit (mis. proksi tekanan: candle menit hijau berturut + lonjakan freq).
- Klaim studi kasus di materi tidak bisa diaudit ulang: semuanya tangkapan layar orderbook intraday masa lalu.

## Usulan (belum jadi spek, menunggu keputusanmu)

1. **Kuli Papan ditambah mode "TMM"** — rumus materi ini sebagai alternatif rumus adimollogy yang sudah ada; input Vt/Ht/Hm/Vb manual, plus versi swing yang bisa **diisi otomatis** dari broksum (Vb = Σ lot top-5 buyer, Hm = avg price top buyer). Murah, langsung bisa.
2. **Halaman/tab "Fase Bandar"** (di Jago Papan atau Neo Papan): pita 4 fase per emiten dari accdist + konsentrasi broker, sepanjang 2017–2026. Ini yang paling bernilai — materi mengajarkan cara bacanya, dan **kita punya datanya 10 tahun** sedangkan materi hanya mengajarkan cara manual per emiten.
3. **Klaster bandar**: deteksi 3–8 broker yang net-nya bergerak bersamaan di satu emiten (korelasi net harian, jendela 60 hari). Baru — dan hanya mungkin karena arsip broker kita lengkap.
4. **Jangan** menjanjikan fitur orderbook/tradebook real-time. Tulis batas ini di Metodologi.

Semua yang di atas bisa diuji lewat **BT Papan** begitu dibangun — termasuk aturan hal 20 yang barusan gagal uji.


---

> **⚠️ KOREKSI LINTAS-SPEK 26 Agu 2026 — kedalaman arsip OHLCV.**
> Beberapa spek di folder ini menulis OHLCV harian "2017–2026" (≈10 tahun). **Itu SALAH — understated.** Terukur langsung dari `ohlcv_stockbit/`:
> IHSG **1997-07-01** · ASII **2000-10-17** · BUMI **2003-01-01** · BBCA & TLKM **2004-01-02** · SIDO 2013-12-18 (tanggal IPO-nya) — semua sampai 2026-08-21.
> Jadi OHLCV = **20–30 tahun** untuk emiten lama, bukan 10. Angka "2017" itu tercampur dari **lantai BROKER** (yang benar pun **2016-01-04**, terbukti lewat uji 2015 yang nihil).
> **Yang benar: OHLCV ≈ 1997/2000-an→2026 (per emiten, sejak IPO) · BROKER 2016→2026 · INTRADAY 1m ±90 hari (panen rutin sejak 26 Agu 2026).**
> Dampak: Seasonality boleh memakai 20+ tahun (bukan 10), backtest BT Papan punya sampel jauh lebih panjang, dan klaim "menang telak atas riwayat pesaing" justru lebih kuat dari yang tertulis.
