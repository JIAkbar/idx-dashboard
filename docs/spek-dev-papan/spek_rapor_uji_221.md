# Spek halaman Rapor Uji (#221 opsi a)

Tujuan (Johan 22 Sep 2026): *"hasil dari benchmark data bukan hanya data
angan-angan"*. Halaman ini menilai pilihan dan sinyal PAPAN SESUDAH kejadian,
dibandingkan dengan pilihan acak pada tanggal yang sama dan IHSG. Uji ke
depan: sinyal mesin dicatat pada hari terjadinya dan catatan lama TIDAK PERNAH
ditulis ulang, jadi hasilnya tidak bisa disetel sesudah angka terlihat.

## 1. Skrip `scripts/riset/rapor_uji.py` (Python `C:\Python314\python.exe`)
Impor apa adanya dari `bt_papan.py` (`muat_emiten`, `muat_ihsg`,
`simulasi_trade`, `universe_partanggal`, `deteksi_rbs`, `ParamRBS`),
`bt_indikator.py` (`sinyal`, `_df` untuk OBV), `bt_manusia.py`
(`muat_pilihan_manusia`). Jangan ubah berkas yang diimpor.

- `--catat`: ambil tanggal bar terakhir T dari OHLC. Untuk universe rank
  likuiditas trailing 60 bar <= 150 pada T, catat sinyal OBV harian dan RBS
  (definisi sama dengan bt_papan `rbs-tpsl`, deteksi yang konfirmasinya jatuh
  di T) ke `data-idx/json/rapor_uji/log_sinyal.json`:
  `{"versi":1,"mulai":"<T pertama>","catatan":[{"tanggal":T,"kode":..,"sumber":"obv"|"rbs","dicatat":"<YYYY-MM-DD hari jalan>"}]}`.
  Idempoten: kalau T sudah ada di log, tidak menambah apa pun. Tidak pernah
  menghapus atau mengubah baris lama. Tak ada sinyal = tetap tulis penanda
  hari itu di `hari_tercatat` supaya "nol sinyal" beda dari "tak dicatat".
- `--nilai`: tulis `data-idx/json/rapor_uji.json`:
  - `diperbarui`, `data_per` (tanggal bar terakhir)
  - `sumber`: tiga kelompok — `redaksi` (muat_pilihan_manusia: edisi harian +
    Deep Dive), `obv`, `rbs` (dari log). Tiap kelompok: `n_total`,
    `n_selesai_h5`, `n_selesai_h20`, dan untuk h5 dan h20 masing-masing:
    `win_rate`, `pf`, `rata`, `median`, `acak_p50_pf`, `acak_p95_pf`,
    `acak_rata`, `ihsg_rata`. Masuk open H+1, keluar close H+5 / H+20
    (`simulasi_trade` model keluar `h5`/`h20`), biaya 0.
  - Acak: untuk tiap pilihan, emiten acak seragam dari universe pada tanggal
    yang sama, keluar sama, 200 ulangan (`random.Random(221)` supaya stabil; semula 20, dinaikkan 23 Sep karena p95 dari 20 angka goyang: 2,13 vs 2,78 antar-benih).
  - `pilihan`: 60 terbaru semua sumber: `tanggal, kode, sumber, masuk, h5, h20,
    status` (status: `menunggu` bila bar belum cukup).
  - `riset`: salin `data-idx/json/bt_riset/ringkas.json` bila ada (ditulis
    riset #221 lain), selain itu `null`.
- `--uji`: uji bawaan sintetis tanpa data nyata (idempotensi `--catat`,
  status menunggu, pf/acak dari data rekaan).

## 2. Halaman `/rapor-uji`
- `app/src/lib/dasbor/raporUji.ts`: tipe + `muatRaporUji()` (lewat `urlData`
  dari `lib/dasbor/baseData.ts`, pola sama dengan `berkasRekam.ts`) +
  `vonis(kelompok, horizon)` yang mengembalikan kalimat:
  n selesai < 30 -> "Belum bisa disimpulkan: baru {n} pilihan selesai."
  pf > acak_p95 -> "Lebih baik dari 95% pilihan acak di tanggal yang sama."
  pf > acak_p50 -> "Di atas rata-rata acak, tapi belum melewati batas keberuntungan."
  selain itu -> "Tidak lebih baik dari pilihan acak."
  Win rate hanya dicetak dalam persen bila n >= 20 (samakan dengan
  `MIN_SAMPEL_PERSEN` di berkasRekam.ts; impor konstanta itu).
  + `raporUji.test.ts` untuk vonis dan ambang.
- `app/src/views/dasbor/RaporUji.tsx` (+ `RaporUji.css` untuk penempatan saja):
  ikuti sistem tata C+A, percontohan `HarianPapan.tsx`: `.vhead` h1 "Rapor Uji"
  + `span.sub` "Pilihan dan sinyal PAPAN dinilai sesudah kejadian, dibandingkan
  dengan pilihan acak dan IHSG" (tanpa CatatanCakupan: isinya soal cakupan broker, tak relevan di sini). Isi:
  1. Tiga kartu `.panel` (Redaksi · Sinyal OBV · Sinyal RBS): angka utama PF
     H+5, baris kecil win rate/rata-rata/median, pembanding acak p50/p95 dan
     IHSG, lalu kalimat `vonis`. Pil H+5/H+20 (`.chip-t`) mengganti horizon.
  2. Tabel pilihan terbaru di `.board-tbl-wrap` (kelas kanonis tabel lebar).
  3. Kartu "Riset formula" dari `riset` bila ada: vonis per arah apa adanya;
     bila null: "Riset lanjutan sedang berjalan."
  4. Catatan metode singkat: masuk harga buka hari berikut, keluar harga tutup
     hari ke-5/ke-20, tanpa biaya transaksi, sinyal mesin dicatat sejak
     {mulai} dan tak pernah diubah.
  Warna: hijau/merah hanya untuk return naik/turun. Harga lewat `keFraksi()`
  bila hasil hitungan. Tanggal lewat `lib/tanggalBursa.ts` bila perlu hitung.
  DILARANG di teks layar: nama berkas, jalur data, nama fungsi/ruas mentah.
- Rute di `app/src/App.tsx` (lazy, pola rute `/winrate`):
  `<PenjagaHalaman kunci="rapor-uji">`.
- `PETA_MENU_KUNCI` (`app/src/lib/aksesHalaman.ts`): `'rapor-uji': 'rapor-uji'`.
- Menu (`app/src/lib/dasbor/menu.ts`): `{ id:'rapor-uji', path:'/rapor-uji',
  label:'Rapor Uji', kode:'RPU', tabLabel:'Rapor Uji', induk:'/screener',
  grup:'peluang', ... }` mengikuti bentuk item `jago-papan`; perbarui jumlah di
  `menu.test.ts` (+1, beri komentar).
- Baris Supabase `akses_halaman` dikerjakan pemanggil, bukan kamu.

## 3. Verifikasi
`python scripts/riset/rapor_uji.py --uji`, lalu `--catat` dan `--nilai`
sungguhan (cetak ringkasan), `cd app && npx tsc -b --force`,
`npx vitest run src/lib/dasbor/raporUji.test.ts src/lib/dasbor/menu.test.ts`,
dan sapuan kebocoran:
`grep -niE 'getstocksummary|chartbit|keystats|foreignbuy|data-idx/json|[.]json' app/src/views/dasbor/RaporUji.tsx`
-> hanya boleh di string fetch, bukan teks JSX.
