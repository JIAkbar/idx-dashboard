# Cakupan Tanya PAPAN — ronde 2 (16 Agu 2026)

Dipicu laporan Johan: pengunjung mengetik **"benefit nya"** (maksudnya
keuntungan jadi kontributor) dan panel Tanya PAPAN membalas "Belum bisa saya
jawab". Ronde 1 (dokumentasi di komentar `pengetahuan.test.ts`) sudah menutup
9 dari 20 pertanyaan yang gagal saat itu; ronde ini mengulang metode yang
sama — ukur dulu dengan `cariPengetahuan()`, jangan menebak — dengan daftar
pertanyaan yang lebih luas.

## Metode

Untuk tiap pertanyaan, panggil `cariPengetahuan(pertanyaan)` langsung (bukan
lewat UI) dan catat mana yang mengembalikan `null`. Skrip pengukurannya
sempat ditulis sebagai tes sementara di `pengetahuan.test.ts`, dijalankan
lewat `npx vitest run`, lalu dibongkar jadi baterai permanen (`describe`
"ronde 2") begitu semua lubang tertutup.

## Daftar 70 pertanyaan

Kategori wajib sesuai brief: manfaat/kewajiban kontributor & pembekuan akun,
kuota/jenjang/kredit, privasi, kesegaran data, cara baca tiap halaman menu
(15 halaman di `menu.ts`), istilah pasar pemula, dan batas kemampuan
(ramalan, rekomendasi, saham gorengan) — plus 2 pertanyaan di luar topik
sebagai penjaga arah sebaliknya (harus TETAP `null`).

Daftar lengkap dan hasil akhirnya ada di
`app/src/lib/dasbor/pengetahuan.test.ts`, describe block
`cariPengetahuan — baterai cakupan ronde 2 (laporan "benefit nya")`.

## Hasil

| | Sebelum | Sesudah |
|---|---|---|
| Total pertanyaan diuji | 70 | 70 |
| Gagal (`null`) | 25 (36%) | 2 (3%) |
| — di antaranya di luar cakupan (BENAR `null`) | 2 | 2 |
| **Lubang nyata** | **23** | **0** |

23 pertanyaan yang gagal sebelum perbaikan:

- `keuntungan kontributor apa`, `kewajiban kontributor apa saja` — belum ada
  entri "manfaat jadi kontributor" sama sekali; kata "untung"/"manfaat"/
  "benefit" tak muncul di kunci mana pun.
- `nama saya muncul di edisi tidak` — entri `kredit-setoran` sudah ada,
  kuncinya cuma tak menjangkau kata "muncul".
- 6 pertanyaan privasi (`data saya disimpan buat apa`, `siapa yang bisa
  lihat setoran saya`, dll) — belum ada entri privasi sama sekali.
- 6 pertanyaan kesegaran data (`data ini update jam berapa`, `seberapa baru
  datanya`, dll) — belum ada entri jadwal pembaruan data sama sekali.
- 4 pertanyaan halaman menu (`broker paling aktif halaman mana`, `cara baca
  chart gimana`, `forum buat apa`, `kritik saran kirim kemana`) — entrinya
  ada, kuncinya sempit (mis. `halaman-chart` cuma kena frasa "halaman chart"
  atau "apa itu chart", bukan kata "chart" sendirian).
- 2 pertanyaan batas kemampuan (`ramalan harga besok naik atau turun`, `apa
  itu saham gorengan`) — `bukan-saran-investasi` belum menjangkau kata
  "ramalan" atau "gorengan".
- 2 pertanyaan sumber data (`kenapa harga buka kosong`, `laporan keuangan
  dari mana`) — entrinya ada, kuncinya butuh kata "data" yang tak selalu
  diketik orang.

## Perbaikan

Sesuai prioritas di brief — perlebar dulu, baru tambah entri:

**Entri baru (3)** — sourced dari `docs/rencana-berjalan.md` bagian
"Keputusan yang sudah diambil" dan `docs/PIPELINE-DATA.md`:

1. `manfaat-kontributor` — jenjang lebih tinggi membuka kuota & fitur
   bertahap, kredit ikut setoran disetujui.
2. `privasi-kontributor` — identitas penyetor tak terlihat kontributor
   lain (sumber: baris "Identitas penyetor" di tabel keputusan); isi data
   pribadi/setoran orang lain sengaja tak dibuka lewat Tanya PAPAN.
3. `kesegaran-data` — jadwal pembaruan otomatis (proses utama ~18:30 WIB,
   cadangan ~20:00 WIB, sumber `docs/PIPELINE-DATA.md`), bukan real-time.

**Kunci diperlebar (9 entri)**: `cara-jadi-kontributor` (+kewajiban),
`kredit-setoran` (+muncul edisi), `sumber-data` (+laporan keuangan),
`sumber-data-peran` (+harga buka kosong), `halaman-top-broker` (+broker
paling aktif), `halaman-chart` (+chart), `halaman-forum` (+forum),
`halaman-feedback` (+kritik saran), `bukan-saran-investasi` (+prediksi,
saham gorengan, ramalan harga).

Tiap kunci baru dicek dulu tidak beririsan dengan kunci entri lain yang
sudah ada (grep manual), supaya tak mengulang jebakan "apa itu papan
pencatatan" dari ronde 1.

## Verifikasi

`npx tsc -b` bersih, `npx vitest run` — 265 tes lulus (28 berkas), termasuk
40 tes di `pengetahuan.test.ts` (baterai ronde 1 + ronde 2, keduanya
dipertahankan permanen).
