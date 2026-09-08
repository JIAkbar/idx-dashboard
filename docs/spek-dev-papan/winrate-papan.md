# Spek — Halaman "Winrate PAPAN" (per emiten, semua saham)

> **Keputusan Johan 8 Sep 2026 13:3x (antrean #93):** *"biaya transaksi atau fee di abaikan di semua page gak perlu di hiraukan yang penting sistem dlu, kecuali fraksi harga sudah jelas ada aturan dari BEI"* — semua angka "sesudah biaya" di spek ini dibaca sebagai **biaya 0** (parameter tetap ada, diisi 0); pembulatan target/batas ke fraksi BEI tetap berlaku. Label halaman: "ekspektansi (fee diabaikan, fraksi BEI)".

**Asal:** Johan, 8 Sep 2026 12:4x (sesi pengawas), verbatim: *"artifact nya bagus nih untuk BNBR kalau dijadikan page Winrate sistem Papan, tapi perlu di improve lagi re-layouting lagi dan diterapkan di semua saham serta ambil dari data selama ini bisa cek data per 10, 20, 60, 120, 200 hari dan kalau ada teknikal lagi lebih bagus, kmu pengawas coba kirim spec nya tapi jadikan artifact dulu misal saham BNBR dan saham ARCI"*.
**Antrean:** #91 (DIUSULKAN — eksekusi menunggu kata pemicu Johan).
**Contoh tayangan (artifact):** https://claude.ai/code/artifact/809b7c98-f78c-4404-9d28-1a3b077f2918 — BNBR dan ARCI dari data nyata, angka 120 sinyal identik dengan kartu rencana dagang.
**Skrip riset pengawas (baca-saja, boleh dipakai sebagai acuan):** scratchpad pengawas `winrate_demo.py` — mengimpor `atr_persen`, `level`, `telusuri` dari `scripts/riset/rencana_saham.py` dan menguji kesamaan hasil per horizon (assert).

## 1. Tujuan satu kalimat

Satu halaman per emiten (880 emiten `rencana_saham.json`) yang menjawab: *kalau aturan rencana dagang PAPAN diterapkan pada saham ini, seberapa sering menang, berapa ekspektansinya sesudah biaya, pada horizon berapa, dan pada kondisi teknikal apa* — dengan kejujuran penyebut dan n efektif.

## 2. Aturan yang diuji (tidak diubah)

Persis `scripts/riset/rencana_saham.py`: sinyal = tiap hari bursa; target 1 = tutup + 1×ATR14 (median rentang harian %), batas = min(tutup − 1,5×ATR, terendah 5 hari), keduanya ke fraksi bursa; hari sinyal tak dinilai; target dan batas tersentuh di hari yang sama = kalah; menggantung dinilai pada tutup akhir jendela; biaya 0,40% pulang-pergi. Perluasan: horizon **[5, 10, 20, 60, 120, 200]** dan dua jendela sinyal: **120** (angka kartu) dan **500** (jendela stabil).

## 3. Data yang dibangun (batch panen, nol jaringan)

Skrip baru `scripts/riset/winrate_emiten.py` (memakai fungsi rencana_saham, bukan menyalinnya):

| Berkas | Isi | Ukuran |
|---|---|---|
| `data-idx/json/winrate/<KODE>.json` | per horizon × jendela: menang, kalah, gantung, n, nEfektif (= n ÷ horizon), winRate, winRateSemua, ekspektansi, ekspektansiBiaya, rataMenang, rataKalah, rataGantung, medianBarKe; `returnMentah` per horizon (750 hari: winRate>0, median, p25, p75, nEfektif); `saringan` h20 + h60 (13 kondisi × ringkasan yang sama + n); `barBeku` per tahun; `teknikal` hari ini (MA20/50/200, RSI14, rentang 52 minggu); rujukan `rencana` (harga, areaBeli, tp1, tp2, sl, rr, atrPct) | ±4 KB × 880 |
| `data-idx/json/winrate/index.json` | distribusi pasar per horizon: n emiten, median/p25/p75 win rate dan ekspektansi, % ekspektansi positif; persentil tiap emiten (winRate, eks) per horizon; `dibangun`, `kelasBukti: REKONSTRUKSI`, `biayaPct` | ±150 KB |

Saringan teknikal (dihitung di hari sinyal, dari OHLC + gudang Stockbit): RSI14 Wilder (<30 · 30–70 · >70); posisi terhadap MA20·50·200 (di atas semua · campuran · di bawah semua); volume vs rata 20 hari (>1,5× · normal · <0,5×); arus asing 5 hari (`foreignbuy − foreignsell` dari `ohlcv_stockbit`, net beli · net jual/nol); ATR terhadap median jendela. Tahap 2 (opsional, sesudah halaman tayang): kondisi pola dari arsip `bt/` (RBS, gap, breakout) — butuh penanda sinyal per hari, belum ada.

Biaya: `telusuri` untuk 6 horizon × 2 jendela × 880 emiten. Terukur pengawas: BNBR + ARCI < 1 s per emiten; pasar 915 emiten × 2 horizon × 120 sinyal ≈ 4 s. Perkiraan batch penuh (500 sinyal, 6 horizon, 13 saringan) ≈ 5–10 menit satu utas; masuk PanenSore sesudah turunan lain dan ke daftar `git add` (pola #90). Uji unit: hasil `winrate_emiten` untuk 120 sinyal h5/h10/h20 harus identik dengan `jejak` di `rencana_saham.json` (bukti dua mesin satu angka).

## 4. Halaman `/winrate` (rute baru, induk Riset; terkunci login seperti Grafik)

Tata letak mengikuti artifact (dasbor, bukan artikel): 2–3 kolom di 1536, 1 kolom di 412, semua tabel dalam wadah gulir mendatar.

1. **Kepala:** pencarian emiten kanonis (`StockAutocomplete`), "Data per <tanggal>", `nBar sejak <mulai>`, harga; pil **Jendela sinyal** (120 · 500).
2. **KPI (4 tile):** win rate 20 hari (tuntas) + penyebut penuh; ekspektansi sesudah biaya 20 hari; ekspektansi 60 hari; persentil pasar (eks + win rate).
3. **Tabel lima/enam horizon:** menang · kalah · gantung · win rate · penyebut penuh · ekspektansi sesudah biaya (angka + bar bertanda) · rata menang · rata kalah · n efektif (⚠ bila < 5). Baris 20 hari disorot.
4. **Dua kolom:** *Beli lalu tahan* (return mentah per horizon: positif %, median, p25–p75, n efektif) dan *Pembanding pasar* (median, p25–p75, persentil emiten, % emiten positif) — dua kalimat pembaca di bawah tiap tabel.
5. **Saringan teknikal:** pil horizon 20 · 60; 13 baris kondisi dengan n, win rate, ekspektansi (bar), rata menang/kalah; baris n < 30 redup; lencana *terbaik*/*terburuk* hanya untuk n ≥ 30.
6. **Dua kolom:** *Rencana berjalan* (dari `rencana_saham.json`) dan *Posisi teknikal hari ini* (MA20/50/200 di atas/di bawah, RSI14, rentang 52 minggu dengan penanda).
7. **Dua kolom:** *Bar beku per tahun* (8 tahun terakhir, porsi ≥ 50% merah) dan *Biaya nyata* (fraksi harga bursa → satu tick dalam %, peringatan bila ≥ 0,9%).
8. **Yang tidak ada di data** (statis, jujur): rekonstruksi bukan sinyal terbit; slippage; win rate per pola; horizon 120/200 pada 120 sinyal.
9. **Kaki:** sumber berkas, `kelasBukti`, "bukan rekomendasi beli/jual"; tautan ke Metodologi (bagian baru "Winrate" — kamus istilah: penyebut penuh, n efektif, gantung).

Warna dan tipe: token PAPAN apa adanya (tangga navy, amber hanya penyorot/pil aktif, hijau/merah semantik), Plus Jakarta Sans + IBM Plex Mono untuk angka (`tabular-nums`). Tidak ada palet baru.

## 5. Kriteria terima

- Angka 120 sinyal h5/h10/h20 di `/winrate` identik dengan kartu rencana dagang emiten yang sama (uji unit + cek tangan BNBR: 67,0 / 59,2 / −0,250 di h10).
- 880 emiten terbuka lewat pencarian; emiten tanpa data (< 300 bar berisi) menampilkan alasan, bukan "—" tanpa keterangan.
- 1536 dua/tiga kolom rapi; 412 satu kolom, nol luber, tabel bergulir; kedua tema lolos AA (angka semantik hijau/merah di atas `--bg1`).
- `cek_kesegaran.py` mengenal `winrate/index.json`; PanenSore membangunnya dan meng-commit-nya (pola #80/#90).
- Metodologi memuat definisi penyebut penuh, n efektif, gantung, dan kelas bukti REKONSTRUKSI.
- Referensi proyek: peta halaman → sumber (`winrate/`, `ohlc/`, `ohlcv_stockbit/`, `rencana_saham.json`) + kamus ruas berkas `winrate/<KODE>.json`.

## 6. Ukuran & urutan

Sedang-besar: skrip + batch (1 hari), halaman + uji tampilan (1 hari), metodologi + referensi (½ hari). Urutan sesudah kata pemicu Johan: skrip + uji kesamaan → batch penuh → halaman → PanenSore/CI → docs.

## 7. Temuan riset yang layak diketahui (dari contoh)

- Pasar (915 emiten, 120 sinyal): median win rate 20 hari 63,9% (p25 56,0 · p75 71,1), median ekspektansi sesudah biaya −0,22%; hanya **43,6%** emiten positif di 20 hari, **29,8%** di 60 hari. Win rate tinggi adalah sifat aturan (target dekat, batas jauh), bukan keunggulan emiten.
- BNBR: negatif di semua horizon pada 500 sinyal; hanya kondisi *di bawah MA20·50·200* (+1,31%, n 98) dan *volume > 1,5×* (+0,11%, n 73) yang positif di 20 hari; 2019–2021 hampir seluruhnya bar beku; fraksi Rp 1 di harga 100 = 1% per tick.
- ARCI: positif di semua horizon (500 sinyal, h20 win rate 76,7%, +1,64%); terbaik *di atas MA20·50·200* (+2,85%, n 175) dan *ATR di atas median* (+2,49%); *RSI < 30* justru buruk (n 10, tidak dipercaya).
