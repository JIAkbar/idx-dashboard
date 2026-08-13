# Alur Bulletin Arus Pasar — Harian → Mingguan → Bulanan

> Ditulis 13 Agustus 2026. Satu halaman: dari screenshot orderbook sampai PDF terbit,
> termasuk aturan duplikat dan dua jalur transkripsi (nol biaya vs berbayar).

## Alur harian (per edisi)

```
1. Pilih 5-10 emiten, screenshot orderbook Broker Summary Stockbit
2. Upload di /admin (tanggal + ticker + gambar) — tersimpan ke Supabase sebagai arsip/bukti
3. TRANSKRIPSI ke edisi/<tanggal>.json — pilih salah satu jalur:
   a. NOL BIAYA (rekomendasi): buka sesi Claude Code, minta "olah upload hari ini"
      — Claude baca screenshot langsung (termasuk langganan, tanpa biaya API terpisah),
      draft blok beli/jual dibuatkan, KAMU VERIFIKASI, baru disahkan ke edisi JSON.
   b. SCRIPT API (opsional, ~$0,01-0,03/gambar): arus-pasar/transkrip_orderbook.py
      — buat hari tanpa sesi Claude; draft ke arus-pasar/draft/, tetap wajib verifikasi.
   c. MANUAL murni: ketik sendiri (jalur awal, tetap valid).
4. python arus-pasar/fetch_ohlc.py <tanggal>     (OHLC otomatis dari Yahoo)
5. python arus-pasar/build.py <tanggal>          (skor + HTML + PDF otomatis)
```

**Aturan duplikat dalam 1 hari:** 1 ticker = 1 entri per edisi. Upload ulang ticker yang
sama = revisi — data TERAKHIR yang dipakai, file lama tetap di arsip upload (jejak audit).
Chart TradingView yang ikut diupload = dokumentasi; chart di PDF digambar dari data OHLC,
bukan dari gambar.

## Mingguan — `build_weekly.py <awal> <akhir>`

Gabung semua edisi harian dalam rentang. Emiten yang dibahas berulang muncul SEKALI di
ranking (posisi = kemunculan terakhir) dengan **progresi skor lintas hari** ("Sen 67 →
Rab 59 → Jum 70") di sampul, tabel ringkasan, dan halaman detailnya. 20+ pick aman
(tabel pecah otomatis). Kode edisi: `AP-W<ddmmyy>-E01`.

## Bulanan — `build_monthly.py <YYYY-MM>`

Naik satu level dari gabungan: **scorecard**. Selain rekap semua pick sebulan
(dedupe + progresi per minggu), tiap pick DIEVALUASI terhadap harga aktual sesudahnya
(dari cache OHLC): capai target? kena invalidation? masih berjalan? Ringkasan bulanan =
berapa % pick yang tercapai — akuntabilitas analisa, bukan cuma kumpulan ide.

## Kenapa data orderbook tetap lewat screenshot

Rincian per-broker-per-saham TIDAK tersedia via API publik mana pun (endpoint detail
IDX = 503, sudah diverifikasi). Screenshot Stockbit adalah satu-satunya sumber — maka
transkripsi (jalur a/b/c) selalu ada langkah verifikasi manusia: angka salah lebih
buruk daripada kosong.

## Vonis label per emiten (pelajaran edisi AP-130826)

Label halaman ("Bullish — Uji Pivot R1", "Bearish — Distribusi ke Ritel") WAJIB ditulis
per emiten dari pembacaan utuh: kualitas arus broker (siapa yang beli/jual, bukan cuma
netnya), struktur tren (posisi vs EMA50/200), lokasi tutup dalam rentang hari, dan
anomali (mis. akumulasi saat pasar merah). Mesin aturan komposit hanya BASELINE/fallback —
jangan pernah menerbitkan edisi yang semua labelnya keluaran generator (gejalanya: semua
halaman berbunyi sama, mis. "Uji Support S1" seragam).
