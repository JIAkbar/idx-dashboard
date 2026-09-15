# Pembanding tiga rumus floor broker (antrean #202)

Diukur 15 Sep 2026 malam oleh agen tanpa mengubah kode; dijalankan ulang Papan, hasil identik. Skrip pengukur di scratchpad sesi, bukan di repo.

## Keputusan Johan — satu rumus (15 September 2026)

Johan, 15 Sep 2026 sekitar 21:22 WIB di sesi pengawas, diteruskan dengan sidik PGW-0915-JOHAN-202-R2: *"R2 saja, jendela ditulis di samping angkanya"*.

- **Rumus tunggal:** harga rata-rata beli broker = Σ nilai beli ÷ (Σ lot beli × 100) atas seluruh hari dalam jendela. Dihitung satu fungsi bersama `hargaRata` (`app/src/lib/dasbor/brokerEmiten.ts:53`), dipakai `agregatBroker` (Aliran Dana), `hitungPosisiBroker` (Neo Inventory), dan `posisiBroker` (Trader Papan).
- **Alasan:** R2 satu-satunya yang merangkum seluruh pembelian di jendela. R1 (beli termurah satu hari ≥1.000 lot) dan R3 (harga pasar terendah pada hari broker net beli) sama-sama nilai satu hari, dan dengan jendela bawaan Aliran Dana *Hari Ini* R1 praktis sama dengan harga beli hari itu.
- **Yang tidak ditampilkan lagi:** panel "Floor price per broker" di Aliran Dana (R1) dan kolom "Termurah" di Trader Papan (R3). Fungsinya tetap di kode (`floorPriceBroker`, ruas `floor` di `traderPapan.ts`); menghapusnya butuh baris antrean terpisah.
- **Jendela tetap per halaman, ditulis di samping angka:** Aliran Dana = rentang aktif (tanggal dan jumlah hari bursa), Neo Inventory = 126 hari bursa terakhir, Trader Papan = rentang pilihan (jumlah hari di kepala kolom, tanggal di baris ringkas atasnya). Menyamakan jendela bukan bagian keputusan ini.

# Ukur tiga rumus "harga rata-rata/floor broker" — PAPAN

Perintah menjalankan ulang (dari folder `app/`):

```
npx vite-node "C:/Users/Johan/AppData/Local/Temp/claude/C--1-Johan-10--Pengembangan-IDX-Statistik--claude-worktrees-artifact-react-migration-c789ac/75a683d6-803d-4335-8426-5ff9ad855bb2/scratchpad/u202/ukur.ts"
```

Fungsi hitungnya diimpor langsung (dynamic import) dari `app/src/lib/dasbor/brokerEmiten.ts`,
`posisiBroker.ts`, `whalesPapan.ts`, `traderPapan.ts` — tidak ada rumus yang ditulis ulang di
skrip ini. Data dibaca langsung dari `data-idx/json/broker_tahunan/<KODE>/<TAHUN>.json` (bukan
`fetch`, karena ketiga fungsi hitung sendiri murni/tanpa jaringan; hanya `muatRentang`/hook React
di sekitarnya yang butuh `fetch`/peramban, dan itu diganti loader `fs` di skrip ini).

## (a) Definisi tiga rumus

1. **Rumus 1 — `floorPriceBroker`** (`app/src/lib/dasbor/brokerEmiten.ts:255-271`, dipanggil
   `Overview.tsx:82` dengan `minLot=1000`, tab Overview `/broker-summary-v2`): untuk tiap broker,
   HARI TUNGGAL dengan harga rata-rata BELI (beli_nilai ÷ (beli_lot×100)) TERENDAH, di antara
   hari-hari yang beli_lot broker itu hari ITU ≥ 1.000 lot. Bukan rata-rata tertimbang jendela —
   satu hari terbaik saja. Sisi BELI kotor saja (bukan net), pasar reguler saja.

2. **Rumus 2 — `hitungPosisiBroker` field `floor`** (`app/src/lib/dasbor/posisiBroker.ts:49-82`,
   baris 71, dipanggil `InventoryTab.tsx:194` tab Inventory "Posisi 6 Bulan" `Neo Papan`): rata-rata
   TERTIMBANG harga BELI broker itu atas SELURUH hari dalam jendela — Σbeli_nilai ÷ (Σbeli_lot×100) —
   tanpa syarat lot minimum, dan memakai hari net-beli MAUPUN net-jual sekaligus (gross beli
   dijumlah apa adanya). Pasar reguler saja.

3. **Rumus 3 — `posisiBroker` (traderPapan.ts), dua ruas berbeda** (`app/src/lib/dasbor/traderPapan.ts:123-222`,
   dipanggil `TraderPapan.tsx:154/157` halaman Trader Papan):
   - field `floor` (baris 175): MINIMUM dari harga rata-rata **PASAR** hari itu (`h.avg`, rata-rata
     transaksi SEMUA investor hari itu — BUKAN harga milik broker itu sendiri), diambil hanya dari
     hari-hari broker itu net-BELI (net lot > 0) dalam jendela. Definisi berbeda dari rumus 1 & 2:
     "murah" di sini harga pasar hari itu, bukan harga eksekusi broker.
   - field `avgBeli` (baris 190): rata-rata TERTIMBANG harga BELI broker itu atas seluruh hari
     jendela — Σbeli_nilai ÷ (Σbeli_lot×100) — **rumus IDENTIK dengan rumus 2**, beda cuma nama
     ruas & halaman. Dipakai sebagai uji silang: kalau jendelanya SAMA PERSIS, rumus 2 dan
     `avgBeli` rumus 3 wajib berselisih ~0%.

   Berkas ini juga mengimpor tipe `HariBroker` dari `whalesPapan.ts` (BUKAN dari `brokerEmiten.ts`
   — dua tipe berbeda nama sama), jadi loader di skrip ini memakai `dariBerkasTahunan()` (whalesPapan.ts)
   untuk membentuk input rumus 3, bukan `irisHari()` yang dipakai rumus 1 & 2.

## (c) Tanggal akhir data yang dipakai per emiten

- BBCA: hari terakhir arsip broker = 2026-09-15 (2580 hari bursa total di arsip)
- BBRI: hari terakhir arsip broker = 2026-09-15 (2580 hari bursa total di arsip)
- BMRI: hari terakhir arsip broker = 2026-09-15 (2580 hari bursa total di arsip)
- TLKM: hari terakhir arsip broker = 2026-09-15 (2580 hari bursa total di arsip)
- ASII: hari terakhir arsip broker = 2026-09-15 (2580 hari bursa total di arsip)

## (b) Tabel emiten × broker × rumus

Kolom `selisih% R2 vs R1` dan `selisih% R3floor vs R1` menjawab permintaan tugas. Kolom
`R3avgBeli` dan `selisih% R3avgBeli vs R2` ditambahkan sebagai uji silang (lihat definisi rumus 3
di atas) — bukan diminta eksplisit, tapi menjelaskan kenapa rumus 2 dan 3 kadang sangat dekat.

| Emiten | Broker | Jendela | Jendela R1 (dari→sampai) | Jendela R2 | Jendela R3 | R1 floor | R2 floor | R3 floor | R3 avgBeli | Δ% R2 vs R1 | Δ% R3floor vs R1 | Δ% R3avgBeli vs R2 |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| BBCA | YU | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 6.430 | 6.191 | 5.663 | 6.344 | -3.7% | -11.9% | +2.5% |
| BBCA | BK | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 6.436 | 6.123 | 5.663 | 6.306 | -4.9% | -12.0% | +3.0% |
| BBCA | CC | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 6.427 | 6.053 | 5.663 | 6.259 | -5.8% | -11.9% | +3.4% |
| BBCA | OD | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 6.435 | 6.166 | 5.674 | 6.307 | -4.2% | -11.8% | +2.3% |
| BBCA | DX | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 6.430 | 6.122 | 5.674 | 6.292 | -4.8% | -11.8% | +2.8% |
| BBCA | YU | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.919 | 6.156 | 4.924 | 6.156 | +25.1% | +0.1% | +0.0% |
| BBCA | BK | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.917 | 6.040 | 4.924 | 6.040 | +22.8% | +0.1% | +0.0% |
| BBCA | CC | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.930 | 6.014 | 4.924 | 6.014 | +22.0% | -0.1% | +0.0% |
| BBCA | OD | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.924 | 6.121 | 4.995 | 6.121 | +24.3% | +1.4% | +0.0% |
| BBCA | DX | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.924 | 6.115 | 4.924 | 6.115 | +24.2% | +0.0% | +0.0% |
| BBRI | RX | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 3.337 | 3.136 | 2.699 | 3.067 | -6.0% | -19.1% | -2.2% |
| BBRI | DR | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 3.346 | 3.084 | 2.696 | 3.018 | -7.8% | -19.4% | -2.1% |
| BBRI | ZP | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 3.341 | 3.086 | 2.733 | 3.047 | -7.6% | -18.2% | -1.3% |
| BBRI | YP | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 3.339 | 3.107 | 2.696 | 2.979 | -7.0% | -19.3% | -4.1% |
| BBRI | XC | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 3.338 | 3.091 | 2.696 | 2.988 | -7.4% | -19.2% | -3.3% |
| BBRI | RX | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.633 | 3.119 | 2.699 | 3.119 | +18.5% | +2.5% | +0.0% |
| BBRI | DR | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.642 | 3.057 | 2.650 | 3.057 | +15.7% | +0.3% | +0.0% |
| BBRI | ZP | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.658 | 3.067 | 2.688 | 3.067 | +15.4% | +1.1% | +0.0% |
| BBRI | YP | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.661 | 3.069 | 2.650 | 3.069 | +15.4% | -0.4% | -0.0% |
| BBRI | XC | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.650 | 3.058 | 2.650 | 3.058 | +15.4% | -0.0% | +0.0% |
| BMRI | XL | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.356 | 4.310 | 3.823 | 4.200 | -1.0% | -12.2% | -2.6% |
| BMRI | SQ | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.351 | 4.324 | 3.823 | 4.199 | -0.6% | -12.1% | -2.9% |
| BMRI | BB | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.357 | 4.374 | 3.952 | 4.308 | +0.4% | -9.3% | -1.5% |
| BMRI | YP | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.355 | 4.333 | 3.823 | 4.195 | -0.5% | -12.2% | -3.2% |
| BMRI | BQ | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.354 | 4.317 | 3.823 | 4.216 | -0.8% | -12.2% | -2.4% |
| BMRI | XL | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 3.781 | 4.275 | 3.776 | 4.275 | +13.1% | -0.1% | +0.0% |
| BMRI | SQ | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 3.775 | 4.291 | 3.823 | 4.291 | +13.7% | +1.3% | +0.0% |
| BMRI | BB | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 3.750 | 4.354 | 3.776 | 4.354 | +16.1% | +0.7% | +0.0% |
| BMRI | YP | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 3.763 | 4.285 | 3.776 | 4.285 | +13.9% | +0.3% | +0.0% |
| BMRI | BQ | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 3.789 | 4.297 | 3.776 | 4.297 | +13.4% | -0.3% | +0.0% |
| TLKM | AK | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 2.697 | 2.797 | 2.412 | 2.599 | +3.7% | -10.6% | -7.1% |
| TLKM | CC | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 2.701 | 2.833 | 2.366 | 2.593 | +4.9% | -12.4% | -8.5% |
| TLKM | YU | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 2.704 | 2.811 | 2.366 | 2.580 | +3.9% | -12.5% | -8.2% |
| TLKM | BK | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 2.698 | 2.766 | 2.366 | 2.581 | +2.5% | -12.3% | -6.7% |
| TLKM | RX | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 2.699 | 2.868 | 2.426 | 2.579 | +6.3% | -10.1% | -10.1% |
| TLKM | AK | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.370 | 2.758 | 2.412 | 2.758 | +16.4% | +1.8% | +0.0% |
| TLKM | CC | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.380 | 2.805 | 2.366 | 2.805 | +17.8% | -0.6% | +0.0% |
| TLKM | YU | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.361 | 2.783 | 2.366 | 2.783 | +17.9% | +0.2% | +0.0% |
| TLKM | BK | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.355 | 2.739 | 2.366 | 2.739 | +16.3% | +0.5% | +0.0% |
| TLKM | RX | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2.360 | 2.827 | 2.426 | 2.827 | +19.8% | +2.8% | +0.0% |
| ASII | YU | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.921 | 5.194 | 4.580 | 4.857 | +5.6% | -6.9% | -6.5% |
| ASII | KZ | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.933 | 5.240 | 4.548 | 4.857 | +6.2% | -7.8% | -7.3% |
| ASII | YP | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.920 | 5.262 | 4.548 | 4.870 | +7.0% | -7.6% | -7.4% |
| ASII | DR | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.921 | 5.340 | 4.613 | 4.897 | +8.5% | -6.3% | -8.3% |
| ASII | NI | bawaan | 2026-09-15→2026-09-15 | 2026-03-03→2026-09-15 | 2026-06-16→2026-09-15 | 4.901 | 5.206 | 4.548 | 4.885 | +6.2% | -7.2% | -6.2% |
| ASII | YU | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.434 | 5.160 | 4.418 | 5.160 | +16.4% | -0.4% | +0.0% |
| ASII | KZ | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.434 | 5.208 | 4.418 | 5.208 | +17.4% | -0.4% | +0.0% |
| ASII | YP | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.413 | 5.203 | 4.548 | 5.203 | +17.9% | +3.1% | +0.0% |
| ASII | DR | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.529 | 5.266 | 4.613 | 5.266 | +16.3% | +1.8% | +0.0% |
| ASII | NI | disamakan | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 2026-03-17→2026-09-15 | 4.443 | 5.174 | 4.418 | 5.174 | +16.4% | -0.6% | -0.0% |

## (d) Ringkasan

Jendela **bawaan** (tiap rumus pakai jendela bawaan HALAMANNYA sendiri — R1 1 hari, R2 ≈126 hari
bursa, R3 91 hari kalender mundur) — beda di sini gabungan efek RUMUS dan JENDELA:

- **Δ R2 vs R1, jendela bawaan**: median |selisih%| = 4.9 · maksimum |selisih%| = 8.5 · kosong/n-a = 0/25
- **Δ R3floor vs R1, jendela bawaan**: median |selisih%| = 12.0 · maksimum |selisih%| = 19.4 · kosong/n-a = 0/25

Jendela **disamakan** (ketiganya dipaksa 6 bulan kalender terakhir sampai hari terakhir arsip) —
beda di sini murni efek RUMUS, jendelanya sama:

- **Δ R2 vs R1, jendela disamakan**: median |selisih%| = 16.4 · maksimum |selisih%| = 25.1 · kosong/n-a = 0/25
- **Δ R3floor vs R1, jendela disamakan**: median |selisih%| = 0.4 · maksimum |selisih%| = 3.1 · kosong/n-a = 0/25
- **Δ R3avgBeli vs R2 (uji silang, dua rumus identik)**: median |selisih%| = 0.6 · maksimum |selisih%| = 10.1 · kosong/n-a = 0/50

**Kasus kosong/NaN/nol** (dari 50 baris total, 5 emiten × 5 broker × 2 jendela):
- Rumus 1 (floorPriceBroker) kosong: 0 baris — broker itu tak pernah beli ≥1.000 lot
  dalam satu hari pun di jendela tersebut (paling sering di jendela bawaan 1-hari).
- Rumus 2 (hitungPosisiBroker.floor) kosong: 0 baris — broker itu beliLot=0 di seluruh jendela
  (cuma jual, atau sama sekali tak muncul).
- Rumus 3 floor kosong: 0 baris — broker itu tak pernah net-beli sehari pun di jendela itu.
- Rumus 3 avgBeli kosong: 0 baris — sama seperti Rumus 2, beliLot=0 di seluruh jendela.

Tidak ditemukan NaN (pembagian dijaga null kalau penyebutnya nol di ketiga fungsi aslinya).
