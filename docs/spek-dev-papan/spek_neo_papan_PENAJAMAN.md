# PENAJAMAN SPEK NEO PAPAN §2–§8 — 26 Agu 2026 (Fable, pengawas)

> Johan: *"lanjutkan neo papan tab lainnya"* · *"pertajam spec Neo Papan intinya"*.
> Ini **bukan spek baru** — ini penajaman `spek_neo_papan_revisi.md` untuk tab §2–§8, dibuat setelah aku **mengukur premis datanya langsung**. Tiga premis di spek asli ternyata meleset, dan salah satunya membuat sebuah fitur yang tadinya dianggap "bohong" ternyata **bisa dibangun jujur**. Baca ini bersama spek asli; kalau bertentangan, **yang ini menang** (lebih baru + terukur).

---

## 🔴 PENAJAMAN 1 — Broker Stalker: preset "60d" TIDAK perlu dibuang, cukup dialihkan sumbernya

**Spek asli bilang**: preset "60d" bohong karena data hanya jendela 20 hari geser → sarannya membuang preset panjang.
**Terukur (26 Agu)**: benar bahwa `broker_harian/<KODE>.json` = `jendela_hari: 20` (BBCA: 2026-07-27 → 2026-08-24, 20 hari). **Tapi ada sumber kedua yang terlewat**: `broker_tahunan/<KODE>/<TAHUN>.json` berisi **150 hari untuk 2026** (2026-01-02 → 2026-08-24), dan tahun 2020–2026 tersedia. Isinya lebih kaya: tiap hari punya `ringkas` (`n_beli`, `n_jual`, `total_lot`, `total_nilai`, `avg`, `top1_pct`, `top3_pct`, `top5_pct`, `accdist`, `cocok_volume`) + larik `broker`.

**Jadi yang benar**:
- Preset **Today/2d/3d/5d/10d/20d** → boleh dari `broker_harian` (cepat, berkas kecil).
- Preset **60d dan rentang bebas** → **WAJIB dari `broker_tahunan`** (dan menyeberang tahun bila rentangnya melintasi Januari). Fungsi `muatRentang` di `brokerEmiten.ts` sudah melakukan persis ini — **pakai ulang, jangan tulis pemuat kedua**.
- **Tambahkan preset yang tak dimiliki NeoBDM**: 1 tahun, YTD, dan rentang tanggal bebas hingga 2020. Ini keunggulan nyata kita (NeoBDM berhenti di 60d) dan ongkosnya nol karena datanya sudah ada.
- **Aturan jujur**: bila rentang yang diminta melampaui data yang ada untuk emiten itu, tampilkan rentang **sebenarnya** yang terpakai di judul tabel (NeoBDM sudah benar melakukan ini: "Stalking Net Buy from 14 Aug 2026 to 21 Aug 2026"). Jangan tampilkan label "60d" kalau yang terhitung 20 hari — itu justru cacat yang spek asli maksud.

---

## 🔴 PENAJAMAN 2 — Sector/Index Activity: mode "Index" TIDAK BISA dibangun apa adanya

**Terukur**: `index.json` **bukan** deret indeks sektor. Isinya kalender tanggal + IHSG saja (`{stem, date_iso, date_id, date_raw, ihsg, ihsg_pct, trading_day}`). Di `ohlcv_stockbit/` hanya ada `IHSG.json` — **tidak ada** LQ45, IDX30, KOMPAS100, ISSI, JII70, GOCAP, U100/U200/U500.

Ini **konsisten** dengan keputusan sesi Papan menyembunyikan LQ45/IDX30 di RRG. Konsekuensi untuk Activity:
- **Mode Sektor**: ✅ BISA — agregat emiten per sektor (`emiten_sektor.json` + `pilihKandidatSektor`), **tertimbang kapitalisasi dengan bobot hari sebelumnya** (pola yang sudah dipakai RRG — samakan, jangan bikin metode kedua).
- **Mode Indeks**: ❌ **TIDAK BISA sebagai indeks resmi.** Dua pilihan jujur, pilih salah satu dan tulis di UI:
  1. **Hilangkan mode Indeks** (paling jujur, paling murah), atau
  2. Bangun sebagai **"padanan indeks"** dari daftar konstituen yang kita punya — TAPI hanya kalau daftar konstituen LQ45/IDX30 memang ada di arsip. **Cek dulu**; kalau tidak ada, jangan mengarang keanggotaan indeks. Keanggotaan indeks berubah tiap periode rebalance, dan menebaknya menghasilkan angka yang salah secara diam-diam.
- Apa pun pilihannya, definisi "Activity" wajib ditulis operasional: *porsi nilai transaksi grup terhadap total pasar, rata-rata bergerak N hari* (`porsiBergerak` sudah ada) — bukan istilah kabur.

---

## ✅ PENAJAMAN 3 — Balance Position: data kita COCOK PERSIS dengan NeoBDM (ini kabar terbaik)

**Terukur**: `kepemilikan/<KODE>.json` punya **22 kolom** — `lembar_tercatat`, `harga`, lalu **9 tipe investor × 2 sisi** + total:

| Kode | Arti | | Kode | Arti |
|---|---|---|---|---|
| IS | asuransi | | MF | reksa dana |
| CP | korporasi | | SC | sekuritas |
| PF | dana pensiun | | FD | yayasan |
| IB | bank | | OT | lainnya |
| ID | perorangan | | | |

Sisi `lokal_*` dan `asing_*`, plus `lokal_total`/`asing_total`. Satuan **lembar**. Sumber: *KSEI Balancepos (Kepemilikan Efek Lokal-Asing), akhir bulan*. Rentang **20 bulan**: 2024-12-30 → 2026-07-31.

**Ini padanan SATU-LAWAN-SATU dengan legenda NeoBDM** (Foreign/Lokal × lainnya, yayasan, sekuritas, reksadana, individual, bank, dapen, korporat, asuransi). Tidak ada yang perlu dikarang.

**Rumus % scripless terpecahkan dan TERBUKTI**:
```
scripless% = (lokal_total + asing_total) ÷ lembar_tercatat × 100
```
Uji ke NeoBDM: **AADI = 100,0%** — persis angka di judul tangkapan layar NeoBDM ("AADI | Balance Position Analysis [100.0% scripless]"). Pembanding lain (2026-07-31): BBCA 42,6%, BUMI 100,0%, TLKM 47,9%.

**Kewajiban kejujuran yang justru dibuktikan angka ini**: BBCA hanya **42,6%** scripless. Artinya bar kepemilikan BBCA **hanya mewakili 42,6% saham tercatat** — porsi asing 68,9% itu **porsi dari yang tercatat di KSEI**, BUKAN dari seluruh saham beredar. Kalau ini tidak ditulis, pembaca akan menyimpulkan "asing menguasai 69% BBCA", dan itu salah. Tampilkan % scripless di judul (seperti NeoBDM) **dan** beri keterangan sekali di panel.

Bar persentase 100% di bawah (NeoBDM punya) = komposisi relatif terhadap total KSEI — jelaskan bedanya dengan bar atas (lembar absolut).

---

## Penajaman ringkas tab lain

**§7 Seasonality** — `musimanHari`/`musimanBulan` sudah ada. Yang wajib ditambah: **n per sel** (berapa sampel di balik tiap persen) dan **BadgeRapor**, karena ini klaim prediktif. Sel dengan n kecil (mis. < 8 tahun) diberi tanda; jangan mewarnai hijau pekat sesuatu yang berdasar 3 sampel. NeoBDM menampilkan "last 12 years" — kita punya 10 tahun harian (2017–2026), jadi **tulis apa adanya berapa tahun yang benar-benar dipakai**, jangan meniru angka 12.

**§8 Transaction Chart** — label NeoBDM (Retail/Institution/Zombie) **tidak bisa dipenuhi**: kita punya asing vs domestik (dari `foreignbuy/foreignsell` harian) dan kategori broker hasil klasifikasi perilaku. Pilih padanan yang jujur, beri nama sendiri, dan jangan memakai kata "Zombie" hanya karena NeoBDM memakainya. Rumus Participation wajib dijaga tidak melebihi 100% (spek asli sudah menandai bug ini).

**§3–§4 Inventory & Compare** — tetap seperti spek asli: pindah ke lightweight-charts, brush pakai ulang `seleksiAreaChart.ts`. Tambahan dari penajaman 1: pemilih rentang Inventory boleh sampai **1 tahun / YTD** karena `broker_tahunan` memang menyediakannya.

---

## Urutan yang kusarankan (termurah-berdampak dulu)

1. **Balance Position** — datanya cocok satu-lawan-satu, rumus scripless sudah terbukti. Paling cepat jadi, paling kecil risikonya.
2. **Broker Stalker** — routing sumber (`broker_harian` ≤20d, `broker_tahunan` >20d) + kolom turunan + urut/filter/paginasi.
3. **Seasonality** — tinggal tambah n + BadgeRapor + label tahun jujur.
4. **Inventory** → **Compare** (migrasi chart, paling berat).
5. **Activity** — setelah keputusan mode Indeks (hilangkan vs padanan).
6. **Transaction Chart** — terakhir, karena butuh keputusan penamaan kategori.

Kriteria Terima tetap 6 butir + khusus per tab di spek asli. Yang tak boleh dilewat: **angka dicocokkan manual ke arsip** minimal satu emiten per tab, dan **uji visual dua viewport + tema**.


---

> **⚠️ KOREKSI LINTAS-SPEK 26 Agu 2026 — kedalaman arsip OHLCV.**
> Beberapa spek di folder ini menulis OHLCV harian "2017–2026" (≈10 tahun). **Itu SALAH — understated.** Terukur langsung dari `ohlcv_stockbit/`:
> IHSG **1997-07-01** · ASII **2000-10-17** · BUMI **2003-01-01** · BBCA & TLKM **2004-01-02** · SIDO 2013-12-18 (tanggal IPO-nya) — semua sampai 2026-08-21.
> Jadi OHLCV = **20–30 tahun** untuk emiten lama, bukan 10. Angka "2017" itu tercampur dari **lantai BROKER** (yang benar pun **2016-01-04**, terbukti lewat uji 2015 yang nihil).
> **Yang benar: OHLCV ≈ 1997/2000-an→2026 (per emiten, sejak IPO) · BROKER 2016→2026 · INTRADAY 1m ±90 hari (panen rutin sejak 26 Agu 2026).**
> Dampak: Seasonality boleh memakai 20+ tahun (bukan 10), backtest BT Papan punya sampel jauh lebih panjang, dan klaim "menang telak atas riwayat pesaing" justru lebih kuat dari yang tertulis.
