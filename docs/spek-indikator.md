# Spesifikasi C2 — Indikator per emiten versi PAPAN

Diminta Johan 17 Agustus 2026 setelah menunjukkan panduan SPLE *"Modal —
Analisa Teknikal (3 Grup)"*: **"ini kita kembangkan versi kita yang lebih
sempurna"**.

Acuan pembanding: `docs/riset/sple/metodologi-sple-info.md`. Yang ditiru
**strukturnya** — tiga grup memang cara orang membaca chart. Yang diperbaiki
isinya.

---

## Kenapa versi kita bisa lebih baik — satu sebab, bukan banyak

**Mereka punya ~114 hari riwayat. Kita punya 5 tahun** (962 emiten, `ohlc/`).

Seluruh keunggulan di dokumen ini turun dari satu fakta itu, dan mereka sendiri
menuliskan akibatnya dengan jujur di panduannya:

> "Keterbatasan EMA150/EMA200: histori data baru ~114 hari. Untuk EMA150/200
> sisa bobot dari titik awal itu masih signifikan: **EMA150 ≈21,9%** dan
> **EMA200 ≈32,0%** dari nilainya saat ini masih 'nempel' ke harga hari pertama
> data."
>
> "SMA150/SMA200 **SENGAJA TIDAK dibuat** — dipaksakan dengan data 114 hari
> akan menghasilkan angka yang **salah total**."

Jadi di sisi mereka: EMA200 tercemar sepertiga, SMA200 tak ada sama sekali. Di
sisi kita keduanya sah tanpa catatan kaki.

**Aturan yang lahir dari situ** — dan ini yang membuat "lebih sempurna" bukan
sekadar "lebih banyak":

> Indikator yang datanya **tidak cukup TIDAK DITAMPILKAN**, dan alasannya
> disebut di tempat ia seharusnya muncul.

Mereka memilih menampilkan EMA200 yang 32% tercemar, lalu menjelaskan
keterbatasannya **di halaman panduan terpisah** — yang tak dibaca orang saat
sedang melihat angkanya. Kita memilih sebaliknya: angka yang belum sah tidak
muncul, dan tempatnya diisi keterangan kenapa. Sejalan dengan janji yang sudah
tertulis di Beranda: *"yang belum kami punya kami sebut belum punya"*.

---

## Grup 1 — Momentum Oscillator

| Indikator | Parameter | Catatan |
|---|---|---|
| RSI | 14 | <30 oversold · >70 overbought · 30–70 netral. **Sudah ada** di `lib/radar/`, belum pernah ditampilkan per emiten |
| **Stochastic** | %K 14, %D 3, perataan 3 | **Belum ada — wajib.** Ini lapis kedua #130 divergensi (keputusan Johan 17 Agu) |
| StochRSI | 14/14/3/3 | Mentah 0–1 plus %K/%D ter-smooth. Bedanya dari Stochastic biasa: masukannya RSI, bukan harga |
| Williams %R | 14 | <−80 oversold · >−20 overbought |

**Yang ditambahkan dari mereka: Stochastic klasik.** Panduan mereka hanya punya
StochRSI. Untuk deteksi divergensi, Stochastic atas harga lebih lazim dan lebih
mudah ditelusuri pembaca — dan itu yang diminta Johan untuk #130.

## Grup 2 — Moving Average

| Jenis | Periode | Di SPLE | Di PAPAN |
|---|---|---|---|
| SMA | 5, 10, 20, 50, 100 | ada | ada |
| SMA | **150, 200** | **tak ada** (data kurang) | **ada, sah** |
| EMA | 5, 9, 13, 21, 50, 100 | ada | ada |
| EMA | **150, 200** | ada tapi **21,9% / 32,0% tercemar** | **ada, bersih** |

Penyajian: posisi harga terhadap tiap MA (di atas = bullish, di bawah =
bearish), plus **golden cross / death cross** 50–200 yang di sisi mereka
mustahil dihitung.

## Grup 3 — Trend & Volatilitas

| Indikator | Parameter | Catatan |
|---|---|---|
| ATR | 14 | Rata-rata rentang harian dalam rupiah; dipakai juga untuk lebar zona |
| MACD | 12/26/9 | Line, Signal, Histogram. **Sudah ada** di `lib/radar/` |
| Bollinger Band | 20, 2σ | %B (posisi harga 0–1) dan Bandwidth (<8 squeeze, >30 volatil) |
| Wyckoff Phase | — | Akumulasi → Markup Awal → Markup → Konsolidasi → Markdown Awal → Markdown |
| **OBV** | — | **Tambahan kita** — On-Balance Volume |
| **VWAP** | harian & rentang | **Tambahan kita** — harga rata-rata tertimbang volume |

**Kenapa dua tambahan itu berbasis volume:** keputusan #130 menempatkan volume
sebagai **pengesah** divergensi. Kalau volume cuma jadi batang di bawah chart,
lapis ketiga itu tak punya alat ukur. Tiga grup mereka tak punya satu pun
indikator berbasis volume.

## Grup 4 — Harmonic Pattern

Ditiru dengan **dua koreksi** dari hasil riset:

1. **Butterfly pakai standar Carney: AD/XA 1,27–1,618.** Panduan mereka sendiri
   tidak konsisten — bagian Modal menulis 127–161,8%, bagian Screener menulis
   1,27–1,42.
2. **BC/AB wajib divalidasi 0,382–0,886 lebih dulu**, sebelum rasio pola dicek.
   Tanpa itu muncul "pola" berrasio 4,8× dan 7,4× — mustahil secara definisi.
   Itu bug yang mereka perbaiki sendiri: 34 pola turun jadi 17 yang sah.

Pivot: zigzag ayunan minimal 3%. Kita punya 5 tahun, jadi jendela deteksinya
tak perlu dipaksa ke 108 hari seperti mereka.

---

## Aturan penyajian — berlaku untuk seluruh grup

1. **Tiap indikator menyebut PERIODE DATA yang dipakainya.** "EMA200 dari 1.243
   hari bursa" — pembaca bisa menilai sendiri kualitas angkanya.
2. **Yang datanya kurang tidak ditampilkan**, diganti keterangan kenapa. Jangan
   ikuti pola "tampilkan dulu, jelaskan di panduan".
3. **Level harga apa pun lewat `keFraksi()`.** Level yang tak jatuh di tick tak
   bisa dipesan — temuan riset: `fast_sl: 8701` di sisi mereka bukan harga sah
   di BEI.
4. **Bukan sinyal beli/jual.** Indikator disajikan sebagai ukuran, bukan
   perintah. Tak ada "STANCE" seperti punya mereka.
5. **Ambang dikalibrasi dari data kita sendiri** kalau memungkinkan — persis
   cara ambang narasi harian dihitung dari 2.409 hari bursa, bukan diambil dari
   buku.

## Tempat & urutan

Ini isi **C2 (urut 13)** di `ceklist-backlog.md`, dan ia membuka dua pekerjaan
sesudahnya: **Chart dasar (urut 14)** dan **#130 divergensi (urut 17)** yang
menuntut Stochastic + volume.

Rumusnya ditaruh di `app/src/lib/indikator/` sebagai **fungsi murni** — bisa
diuji tanpa chart, dan dipakai ulang screener (urut 15) tanpa menyalin.
