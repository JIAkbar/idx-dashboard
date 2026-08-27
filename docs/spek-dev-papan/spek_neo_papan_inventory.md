# SPEK NEO PAPAN — INVENTORY CHART & COMPARE INVENTORY (REVISI) — 26 Agu 2026

> Bagian dari revisi halaman **Neo Papan** (`NeoPapan.tsx`, 8 tab, sudah ada — ini REVISI 2 tab, bukan bangun baru). Semua klaim kode di bawah diverifikasi langsung ke `app/src` sesaat sebelum ditulis (lihat kutipan file:baris tiap klaim).

---

## 0. Ringkas gap — sekarang vs target NeoBDM

| | **Sekarang** (`InventoryTab.tsx`/`CompareTab.tsx`) | **Target** |
|---|---|---|
| Chart harga | ❌ tidak ada sama sekali | Candle harian + volume |
| Chart broker | Chart.js `line`, kumulatif Rp saja, top-5/top-5 **tetap** dari **seluruh** jendela arsip | Kumulatif Rp **atau** Lot, jendela ikut DATE RANGE, broker **bisa dipilih manual** + preset |
| Kontrol | Cuma `kode` (dari NeoPapan.tsx level atas) | STOCK UNIVERSE·TICKER·DATE RANGE·VALUE·preset broker·Add broker·INVESTOR TYPE |
| Compare | Dua pasang `<select>` tanggal, **tanpa chart** | Dua chart candle berdampingan dengan **brush seret** (arsir) |
| Investor type | Tidak ada (data cuma 1 varian: ALL/GROSS/REGULER) | Foreign/Domestic/All — **GAP DATA**, lihat §5 |

---

## 1. Keputusan pustaka chart — pindah ke `lightweight-charts`

**Rekomendasi: pindah kedua tab dari Chart.js ke `lightweight-charts` + primitive. Migrasi kecil, bukan besar.**

Alasan (ladder "dependency yang sudah terpasang menang atas yang baru"):
- `lightweight-charts@5.2.1` **sudah** jadi dependency proyek (`app/package.json`), dan **sudah** dipakai untuk persis bentuk chart ini — candle + overlay garis + brush seret nilai (bukan piksel) — di `GrafikEmiten.tsx` dan `WhalesPapan.tsx`. Chart.js **tidak punya** plugin candlestick terpasang (`grep chartjs.*financial` → nihil di `package.json`); menambahnya berarti dependency baru untuk sesuatu yang sudah bisa dikerjakan pustaka yang sudah ada.
- Klaim lama "Transaction Chart pakai candle" itu **tidak akurat** — `TransaksiTab.tsx:9-11` sendiri berkomentar jujur: garis harga tutup, "proyek belum punya plugin candlestick Chart.js". Inventory & Compare butuh candle SUNGGUHAN (overlay kumulatif broker di atasnya baru bermakna kalau harga terlihat sebagai lilin, bukan garis) — momentum yang pas untuk pindah, bukan menambal Chart.js.
- Brush seret nilai (bukan piksel) yang diminta Compare Inventory **sudah ada polanya**: `lib/dasbor/seleksiAreaChart.ts` — kotak disimpan sebagai `{t0,t1,harga0,harga1}`, dipetakan ulang tiap frame lewat `timeScale().timeToCoordinate()`/`series.priceToCoordinate()`, jadi otomatis ikut zoom/pan. Untuk Compare kita cuma butuh **pita waktu** (bukan kotak harga×waktu) → primitive baru yang LEBIH SEDERHANA dari `SeleksiAreaChart` (§4.2), bukan lebih rumit.
- Ongkos migrasi: 2 komponen, ~150–200 baris tiap satu (pola sama `WhalesPapan.tsx` bagian chart-mount, sudah ada contoh jadi). Tidak ada perubahan data/lib — `kumulatifBroker`/`topNet`/`agregasiBroker` dipakai apa adanya, cuma konsumennya (rendering) yang berganti pustaka.

**Yang TETAP di Chart.js** (di luar cakupan revisi ini, disebut supaya jelas batasnya): RotasiTab (scatter RRG), ActivityTab (garis persentase), BalanceTab (bar bertumpuk) — bukan chart harga, Chart.js wajar untuk bentuk itu, jangan ikut diseragamkan.

---

## 2. Revisi `lib/dasbor/neoPapan.ts` — perluasan kecil, bukan tulis ulang

Fungsi yang **sudah ada, dipakai apa adanya**: `agregasiBroker`, `avgHarga`, `topNet`, `kumulatifBroker` (`neoPapan.ts:16-58`).

Perluasan yang dibutuhkan (semua aditif — parameter opsional dengan default = perilaku lama, jadi `neoPapan.test.ts` yang sudah ada tidak perlu diubah):

```ts
// kumulatifBroker: tambah mode Lot di samping Nilai (bawaan tetap 'nilai')
export function kumulatifBroker(
  hariUrut: string[], hari: Record<string, HariBroker>, kodeBroker: string[],
  metrik: 'nilai' | 'lot' = 'nilai',
): { tanggal: string[]; seri: Array<{ broker: string; nilai: number[] }> }
// byKode.set(kode, metrik === 'lot' ? b.beliLot - b.jualLot : b.beliNilai - b.jualNilai)

// topNet: tambah opsi urut-by-lot untuk preset TOP_5_*_LOT_C20 (bawaan tetap net Rp)
export function topNet(
  agg: AgregatBroker[], n: number, metrik: 'nilai' | 'lot' = 'nilai',
): { pembeli: AgregatBroker[]; penjual: AgregatBroker[] }
// key = metrik === 'lot' ? (a.beliLot - a.jualLot) : a.net
```

**Windowing (C20 dsb.) TIDAK butuh perubahan lib** — `agregasiBroker(hari, tanggal)` sudah menerima daftar tanggal apa pun; jendela-N-hari cukup `tanggal.slice(-20)` di level komponen, pola yang sama sudah dipakai `StalkerTab.tsx:39` (`stalkerAgregasi(peta, dipilih, n)` dengan `n` dari chip 1/2/3/5/10/20/60).

**DATE RANGE (2W/1M/3M/6M/YTD/1Y) TIDAK butuh fungsi baru** — `bersama.tsx` sudah punya `RentangNp`/`potongRentang` (dipakai `TransaksiTab.tsx`), cuma set nilainya kurang 2 opsi:

```ts
// bersama.tsx — tambah 'b2mgg' & 'b6' & 'b12' di samping b1/b3/ytd/semua
export type RentangNp = 'b2mgg' | 'b1' | 'b3' | 'b6' | 'ytd' | 'b12' | 'semua'
```
`potongRentang` menerima `T extends {t:string}`; `tanggal: string[]` broker dipotong dengan cara yang sama tanpa fungsi kembar:
```ts
potongRentang(tanggal.map((t) => ({ t })), rentang).map((x) => x.t)
```

---

## 3. Inventory Chart

### 3.1 Kontrol toolbar

| Kontrol | Sumber | Catatan |
|---|---|---|
| STOCK UNIVERSE | — | **Diusulkan DIHILANGKAN.** Neo Papan adalah halaman per-emiten (satu `kode` untuk seluruh 8 tab, `NeoPapan.tsx:40-41`), bukan screener — tidak ada daftar "universe" yang perlu difilter sebelum memilih ticker. NeoBDM memakainya karena Inventory Chart mereka berdiri sendiri lintas-emiten; di sini kontrol itu tidak bermakna, menambahnya cuma kotak kosong. |
| TICKER | `NeoPapan.tsx:40-54` — input teks + submit, sudah dipakai bersama 8 tab | pakai apa adanya, tidak perlu duplikat di dalam tab |
| DATE RANGE | `RentangNp` (§2, diperluas) — 2M/1B/3B/6B/YTD/1T/Semua | default **1B** (`b1`), sama seperti tab lain |
| VALUE (Value\|Lot) | baru — toggle 2 tombol | menentukan `metrik` yang dikirim ke `kumulatifBroker`/`topNet`, dan label sumbu-kiri |
| Preset broker | baru — 2 chip, lihat §3.2 | mengisi seleksi broker otomatis; tetap bisa diedit manual sesudahnya |
| Add broker… | `components/dasbor/DropdownMulti.tsx` — **sudah dipakai** persis untuk kasus ini di `StalkerTab.tsx:93` (`opsiBroker` dari `kodeBrokerUnik`) | reuse komponen yang sama, isi opsi dari `kodeBrokerUnik([kode → data])` |
| INVESTOR TYPE | ❌ **GAP DATA**, lihat §5 | render dengan `disabled` + tooltip, JANGAN dipetakan ke apa pun sampai datanya ada |

### 3.2 Definisi preset broker (operasional, **diusulkan** — bukan dikutip dari source NeoBDM, sourcenya tidak publik)

- **`TOP_5_NB_LOT_C20`** — Top-5 **N**et **B**uyer per **Lot**, jendela **C**andle **20** hari bursa terakhir dari akhir DATE RANGE terpilih. Hitung: `agg = agregasiBroker(hari, tanggal.slice(-20))`, lalu `topNet(agg, 5, 'lot').pembeli`.
- **`TOP_5_NS_LOT_C20`** — sama, sisi **N**et **S**eller: `topNet(agg, 5, 'lot').penjual`.
- Memilih preset lain (bukan default C20) di luar cakupan revisi ini — kalau nanti diminta, cukup ganti `20` jadi parameter chip (pola `PERIODE` di `StalkerTab.tsx:8`), tidak perlu lib baru.
- **Default saat tab dibuka**: preset `TOP_5_NB_LOT_C20` ∪ `TOP_5_NS_LOT_C20` — mendekati perilaku LAMA (`InventoryTab.tsx:27-28`, top-5/top-5) tapi sekarang C20+Lot secara eksplisit, bukan diam-diam "seluruh jendela + Nilai".

### 3.3 Chart

`lightweight-charts`, pola persis `GrafikEmiten.tsx`/`WhalesPapan.tsx` (kutip §1):
- **Pane 0**: `CandlestickSeries` (harga, dari `muatOhlcv(kode)`, dipotong `potongRentang(bars, rentang)`) + `HistogramSeries` volume di `priceScaleId:'vol'`, `scaleMargins:{top:.82,bottom:0}` — identik pola `vol` yang sudah ada (`GrafikEmiten.tsx:1040-1041`).
- **Overlay broker**: satu `LineSeries` per broker terpilih, ditambahkan pada **`priceScaleId:'left'`** (skala kiri bawaan lightweight-charts — pustaka native, bukan trik) supaya candle (kanan, `right` bawaan) dan kumulatif broker (kiri, Rp/Lot) tidak berbagi skala. `data: kumulatifBroker(...).seri` di-`zip` ke `{time, value}` (pola yang sudah dipakai di `grafikEmiten.ts:189/312` untuk buang titik non-angka).
- Warna garis: `warnaBrokerCanvas(kode)` (`kelompokBroker.ts`, **dipakai apa adanya** — sudah dipakai `InventoryTab.tsx:39` versi Chart.js). Solid untuk net-buyer, `lineStyle: LineStyle.Dashed` untuk net-seller (ganti dari `borderDash` Chart.js, semantik sama, `LineStyle` sudah diimpor proyek — `GrafikEmiten.tsx:6`).
- **Label kode broker di ujung garis**: `createPriceLine({ price: nilaiTerakhirSeri, title: kode, color: warna })` pada tiap `LineSeries` — API bawaan lightweight-charts, pola yang sama sudah dipakai `GrafikEmiten.tsx:2915-2920` (garis leher). Tidak perlu primitive custom untuk ini.
- Volume di bawah, sama seperti sekarang tapi lewat `HistogramSeries` bukan `type:'bar'` Chart.js.

### 3.4 Panel kanan

Pertahankan bentuk tabel yang **sudah benar** (`InventoryTab.tsx:72-88`), sesuaikan isinya:
- Daftar Net Buy / Net Sell terpisah (dua blok, pola `StalkerTab.tsx` `Tabel` komponen — **reuse pola yang sama**, bukan tulis ulang).
- Kolom **BROKER · CUM · NET 1D · BAVG · SAVG** — `CUM` dari `agregasiBroker(...).net` (atau lot bila mode Lot), `NET 1D` = beli−jual **hari terakhir dalam DATE RANGE** (baris tunggal `hari[tanggalAkhir]`, bukan agregat — field baru, kecil: `hari[tanggalAkhir]?.broker.find(b=>b.kode===kode)`), `BAVG`/`SAVG` dari `avgHarga` (**sudah ada**, dipakai apa adanya).
- Tanggal terpilih untuk kolom `NET 1D`: default tanggal terakhir DATE RANGE; klik titik pada chart (`chart.subscribeClick`, API bawaan) memindahkan tanggal terpilih — nice-to-have, bukan blocking untuk revisi ini.

---

## 4. Compare Inventory

### 4.1 Tata letak

Dua chart candle **berdampingan**, LEFT & RIGHT — **chart yang SAMA** (rentang harga & waktu penuh identik di keduanya, disinkron), bedanya cuma **pita arsir** yang menandai periode A (kiri) / periode B (kanan). Ini yang membuat "Left: …(24d) Right: …(60d)" bisa tumpang tindih rentangnya sendiri-sendiri sambil tetap membandingkan candle yang sama — bukan dua chart dengan sumbu waktu terpisah.

- Sinkron zoom/pan: `chartKiri.timeScale().subscribeVisibleLogicalRangeChange((r) => chartKanan.timeScale().setVisibleLogicalRange(r))` dan sebaliknya — pola bawaan lightweight-charts untuk chart kembar, dipakai lintas proyek pihak lain untuk kasus identik ("compare two ranges on one series"), tidak perlu ditemukan sendiri.
- Kedua chart pakai `muatOhlcv(kode)` yang **sama satu fetch** (bukan dua kali) — `bars` dibagi via `useMemo`, cuma instance chart-nya dua.

### 4.2 Primitive baru — `seleksiRentangChart.ts`

**Lebih sederhana dari `SeleksiAreaChart`** (§1) — pita hanya perlu waktu, tidak perlu harga:

```ts
// lib/dasbor/seleksiRentangChart.ts — pola sama SeleksiAreaChart, tanpa sumbu harga
export interface RentangNilai { t0: string; t1: string }

export class SeleksiRentangChart implements IPanePrimitive<Time> {
  // ambilWarna, chart, mintaGambar — identik SeleksiAreaChart
  setRentang(r: RentangNilai | null): void
  // renderer(): x0/x1 dari timeScale().timeToCoordinate() SAMA seperti
  // SeleksiAreaChart §keX; y0=0, y1=bitmapSize.height (BUKAN dari
  // series.priceToCoordinate — itu bedanya) → mengisi tinggi pane penuh.
}
```
- Satu instance per chart (`pane0.attachPrimitive(seleksiKiri)` di chart LEFT dengan warna A, `seleksiKanan` di chart RIGHT dengan warna B) — **atau** kedua pita digambar di **kedua** chart sekaligus (dua instance tiap chart) kalau Johan mau A dan B kelihatan bersisian di satu chart juga; default spek ini: pita A cuma di chart kiri, pita B cuma di chart kanan (sesuai deskripsi acuan "arsir kiri = periode A, arsir kanan = periode B").
- Interaksi seret: pola `pointerdown/pointermove/pointerup` **sama persis** `WhalesPapan.tsx` (`seretRef`, penjaga seret<4px = klik), dikonversi lewat `timeScale().coordinateToTime()` — sudah dipakai, bukan ditemukan baru.
- Klik pada chart LEFT hanya mengatur pita A (state `rentangA`); klik chart RIGHT hanya pita B. Nilai awal: replikasi bawaan lama (`CompareTab.tsx:19-28`, separuh-awal/separuh-akhir jendela arsip) supaya tab tidak kosong sebelum pemakai menyeret sendiri.

### 4.3 Panel bawah — tabel & header

Pertahankan bentuk & rumus tabel **sudah benar** (`CompareTab.tsx:35-48`, `agregasiBroker` dua kali + gabung by kode) — sumber datanya kini `tanggal.filter(t => t>=rentangA.t0 && t<=rentangA.t1)` menggantikan `rentangKiri`/`rentangKanan` lama (nama variabel disesuaikan, logika sama).

- **Header**: `Left: {rentangA.t0}→{rentangA.t1} ({hitungHariBursa} d)  Right: {rentangB.t0}→{rentangB.t1} ({hitungHariBursa} d)` — hitung hari = `rentang*.length` dari filter di atas (sudah tersedia, tidak perlu fungsi baru).
- **Tabel**: `BROKER · LEFT(CUM/BAVG/SAVG) · RIGHT(CUM/BAVG/SAVG) · CHANGE FROM A (%) · TOTAL` — kolom `CHANGE FROM A` = `pct((netB-netA)/|netA|*100)`, **sudah ada persis** sebagai kolom "Perubahan" (`CompareTab.tsx:90`), cuma diganti nama header. Baris **Total** baru (Σ tiap kolom numerik, `<tfoot>`) — tidak ada di kode lama, tambahan kecil.
- **Tombol Clear**: `setRentangA(null); setRentangB(null)` → kembali ke nilai bawaan (separuh-awal/separuh-akhir), sama pola `resetBatas()` di `WhalesPapan.tsx:138-143`.

---

## 5. GAP DATA — INVESTOR TYPE (Foreign/Domestic/All)

**Tidak bisa dibangun dari data yang sudah dipanen ke `data-idx/json/`.** `muatBrokerHarian` (`neoPapanData.ts:71-89`) membaca `broker_harian/${kode}.json`, dan tipe `BarisBroker` (`neoPapanData.ts:54`) cuma punya `{kode, beliLot, beliNilai, jualLot, jualNilai}` — **satu varian** (ALL investor × GROSS × REGULER), bukan 12 varian (papan × investor × transaksi) yang arsip mentahnya ada di `_arsip-mentah/broker-harian/`. Belum ada langkah build yang mem-parse varian FOREIGN dari arsip mentah ke `data-idx/json/`.

Sesuai aturan Kejujuran Inventaris: kontrol INVESTOR TYPE dirender **`disabled`** dengan tooltip "Data broker per tipe investor belum dipanen ke format halaman — hanya varian ALL yang tersedia", opsi default terkunci **All**. **Bukan keputusan "tidak perlu"** — ini keputusan Johan: apakah 12-varian broker (sudah ada di arsip mentah 2020-2026, sebagian 2017-2019 cuma 3 varian per catatan referensi IDX) layak masuk antrean build-ke-JSON. Di luar cakupan revisi tampilan ini.

---

## 6. Uji terima

1. **Garis kumulatif dicocokkan manual ke arsip**: ambil 1 broker, 1 rentang tanggal, jumlah manual `Σ(beliNilai−jualNilai)` dari `broker_harian/<KODE>.json` mentah, cocokkan ke titik terakhir garis kumulatif di chart (mode Nilai) — dan ulangi mode Lot dengan `Σ(beliLot−jualLot)`.
2. **Brush LEFT/RIGHT diuji klik nyata** (bukan asumsi kode benar): seret pita A di chart kiri, seret pita B di chart kanan, verifikasi tabel di bawah berubah sesuai rentang baru — dites lewat `chrome-devtools` MCP dengan klik+drag sungguhan, bukan hanya baca kode.
3. **Brush tetap menempel saat zoom/pan**: setelah pita A dikunci, zoom/geser chart kiri — pita harus tetap di tanggal yang sama (posisi piksel boleh berubah, rentang tanggal tidak) — ini pola uji yang sama yang sudah dipakai `SeleksiAreaChart` (§8.2 `spek_whales_papan.md`).
4. **CHANGE FROM A dihitung ulang manual**: ambil 2-3 baris broker dari tabel, hitung `(netB-netA)/|netA|*100` di luar aplikasi (kalkulator/spreadsheet), cocokkan ke kolom.
5. **2 viewport** (1920 & 412, terang+gelap) — layout toolbar Inventory (7 kontrol) tidak boleh terpotong di 412px; dua chart Compare berdampingan **wajib bertumpuk vertikal** di 412px (bukan dipaksa muat 2 kolom sempit) — beri breakpoint eksplisit, uji nyata bukan asumsi CSS.
6. **INVESTOR TYPE terkunci**: verifikasi kontrol benar-benar `disabled` (bukan cuma keliatan abu-abu tapi tetap bisa diklik) dan tooltip terbaca.
