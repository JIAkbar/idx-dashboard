# Perbaikan edisi — temuan dari terbitan 17 Agu 2026

Enam edisi sempat terbit lalu **ditarik seluruhnya** hari itu juga. Johan:

> *"ini yang saya maksud kenapa langsung live, supaya ada evaluasi nya"*

Itu poin yang perlu dicatat sebagai metode, bukan sekadar peristiwa: **tujuh
cacat di bawah tak satu pun muncul saat memeriksa JSON.** Semuanya baru
terlihat setelah jadi PDF dan dibaca sebagai produk. Memeriksa data bukan
pengganti melihat hasil akhirnya.

## Yang harus diperbaiki sebelum terbit lagi

| # | Temuan | Kutipan Johan |
|---|---|---|
| 1 | **Catatan kaki menyebut `pcd.py`** — nama berkas skrip internal bocor ke produk | *"hilangkan yang berahasa .py bahaya karena rahasia dapur kita"* |
| 2 | **Sumber menyebut Yahoo Finance** — dihapus dari semua edisi | *"sumber: Yahoo Finance di hapus saja dari semua itu"* |
| 3 | **Hak cipta atas nama perorangan** — `© 2026 Johan Iriawan Akbar`. PAPAN sudah punya nama sendiri | *"bukannya Papan sudah punya nama sendiri ya"* |
| 4 | **Kredit kontributor** belum tampil di samping nama emiten, dan hak ciptanya harus mengikuti kontributor masing-masing | *"dimunculkan di samping nama emiten si kontributor nya"* |
| 5 | **Catatan kaki tembus keluar halaman** di edisi harian DAN mingguan — teks bertumpuk dengan skor komposit | *"footer footer ini bnyk yan tembus"* |
| 6 | **Susunan harian kurang rapi**; **sampul mingguan** perlu diperbaiki | *"daily kurang rapi nih susunan nya, cover mingguan juga di perbaiki"* |
| 7 | **Single saham BUMI dan ARCI belum diproduksi** — keduanya punya 10 tanggal setoran | *"single saham belum di produksi nih"* |

## Bahan yang sudah siap, jangan diulang

- `arus-pasar/edisi/2026-08-14.json` — 20 emiten lengkap
- `arus-pasar/draft/*.json` — transkripsi 21 emiten berikut ruas `_mentah`
- `arus-pasar/cache/ohlc-2026-08-14.json` — 20 emiten + JKSE
- `arus-pasar/masuk/2026-08-14/` — 23 screenshot asli
- `arus-pasar/keluaran/index.json.tahan-17agu` — daftar edisi sebelum ditarik

## Catatan data yang harus ikut diperbaiki

- **AADI** tak masuk edisi: screenshot berfilter 1 bulan (17 Jul - 14 Agu),
  bukan satu hari. Penyetornya perlu diberi tahu, seperti GIAA/POWR.
- **Enam emiten** (ANTM, HRUM, INDY, MDKA, PADI, POWR) harga rata-rata sisi
  jualnya bukan angka asli — screenshot terpotong, diisi harga penutupan dan
  ditandai `catatan_data`.
