# Peta fungsi halaman PAPAN

Antrean #200 opsi A, tahap 1. Diukur 15 Sep 2026 dari kode `app/src`: rute di `App.tsx`, susunan menu di `lib/dasbor/menu.ts`, dan isi tiap komponen halaman. Empat agen membaca kode tanpa mengubah apa pun, lalu Papan menyatukan hasilnya. Tiap klaim "tumpang tindih" di bawah punya bukti berkas:baris di catatan agen. Klaim yang hanya berdasar judul menu ditandai "mirip tapi beda".

Dokumen ini menjawab "halaman ini untuk pertanyaan apa". Untuk "halaman ini membaca data dari mana dan apakah jahitan", lihat `docs/referensi_idx-statistik.md` bagian peta halaman.

## Angka pokok

- **9 pintu** di rail dan laci telepon. Di baliknya ada **32 halaman menu**, ditambah Beranda, halaman rincian `/broker/:kode`, dan panel Admin.
- **Tab bertingkat dua** di pintu Aliran Dana: 7 tab menu, lalu 8 tab internal di halaman induknya. Neo Papan, salah satu tab menu itu, punya 8 tab lagi.
- **`grup` di `menu.ts` tidak sama dengan pintu tempat halaman tampil.** Chart bergrup Emiten tapi tampil di pintu Pasar. Kuli Papan, Harian Papan, dan Jago Papan bergrup Dev tapi tampil di pintu Pantau dan Screener. Neo, Whales, Trader, dan Bandarmologi bergrup Dev tapi tampil di pintu Aliran Dana.
- Halaman terbesar: Grafik Emiten 5.094 baris dalam satu berkas, Neo Papan 2.874, Stock Detail 2.745 (687 + 2.058 sub-berkas), Kalkulator 1.930, Whales Papan 1.651, Aliran Dana v2 1.632.

## Per halaman

| Pintu | Halaman | Pertanyaan pembaca yang dijawab | Data utama | Baris |
|---|---|---|---|---|
| (depan) | `/` Beranda | Kondisi pasar hari ini dan ke mana menelusurinya | harian, kabar, daftar edisi | 376 |
| Pasar | `/indeks` Pasar | Posisi IHSG terhadap bursa dunia, hari ini atau rentang | harian, OHLC IHSG, harga live | 910 |
| Pasar | `/sector` Sektor | Performa sektor dan indeks, saham per sektor | harian, peta sektor | 479 |
| Pasar | `/stocks` Top Stocks | Kapitalisasi terbesar, gainers/losers, penggerak IHSG | harian | 401 |
| Pasar | `/statistik` Berkala | Satu edisi pekan atau bulan resmi IDX dibanding periode lalu | statistik mingguan/bulanan | 1.117 |
| Pasar | `/broker` Top Broker | Saham dan broker teraktif level pasar | rekap broker harian, rentang | 290 |
| Pasar | `/chart` Chart | Grafik indeks IDX dan heatmap saham (widget TradingView) | TradingView, bukan data PAPAN | 238 |
| (rincian) | `/broker/:kode` | Di emiten mana broker X akumulasi atau distribusi | pivot broker | 228 |
| Emiten | `/stock-detail` Emiten | Fundamental, valuasi, banding, dan kabar satu emiten | fundamental, asing, laporan keuangan, kabar | 2.745 |
| Emiten | `/grafik` Grafik | Candle satu emiten dan jejak broker di harga tertentu | OHLC, asing | 5.094 |
| Emiten | `/berkas-emiten` Berkas (superadmin) | Semua yang PAPAN tahu tentang satu emiten | rezim, gudang broker, asing, kartu, keystats | 1.100 |
| Aliran Dana | `/broker-summary-v2` Aliran Dana | Delapan sudut broker untuk satu emiten | OHLCV Stockbit, gudang broker, kepemilikan KSEI, profil | 1.632 |
| Aliran Dana | `/peta-investor` Kepemilikan | Jaringan pemegang saham KSEI ≥1% dan grup konglomerat | peta investor | 796 |
| Aliran Dana | `/broker-summary` Pasar | 88 broker level pasar: inventory, kuadran, nego, flow | rekap broker harian, statistik harian | 795 |
| Aliran Dana | `/aliran-asing` Asing | Semua emiten diurut net asing 20 hari | screener, asing | 171 |
| Aliran Dana | `/neo-papan` Neo | Delapan alat komunitas: transaksi, inventory, compare, stalker, balance, musiman, rotasi, aktivitas | OHLCV, broker harian dan tahunan, kepemilikan, sampel sektor | 2.874 |
| Aliran Dana | `/whales-papan` Whales | Siapa menampung dan melepas di rentang harga × waktu | gudang broker | 1.651 |
| Aliran Dana | `/trader-papan` Trader | Posisi tiap broker pada satu emiten | gudang broker | 354 |
| Aliran Dana | `/bandarmologi` Bandarmologi | Emiten yang cocok enam teori bandar, lintas emiten | bandarmologi, kategori broker | 460 |
| Musiman | `/seasonality` Musiman | Bulan dan hari yang historis naik, dengan uji signifikansi | musiman | 1.199 |
| Musiman | `/ipo` IPO | Return IPO per tahun dan rapor penjamin emisi | IPO | 290 |
| Pantau | `/watchlist` Pantau | Daftar pantau sendiri dan indeks gabungannya | peramban, OHLC, asing, screener | 747 |
| Pantau | `/radar` Radar | Arsip edisi WD Watch List dan Penny List dari editor luar | arsip radar | 504 |
| Pantau | `/kalkulator` Kalkulator | Delapan kalkulator dari angka yang diisi pembaca | tanpa data | 1.930 |
| Pantau | `/kuli-papan` Kuli Papan | Target realistis dan pita PBV satu emiten | bid/offer, broker harian, keystats | 442 |
| Screener | `/screener` Screener | Saringan 962 emiten, preset whale, akurasi sinyal yang terbit | screener, kartu ringkas, jejak rekomendasi | 1.131 |
| Screener | `/kartu` Kartu Analisa | Level S/R, peluang tersentuh, musiman satu emiten | kartu | 922 |
| Screener | `/winrate` Winrate | Win rate rekonstruksi aturan dagang satu emiten | winrate | 501 |
| Screener | `/harian-papan` Harian | Peringkat gainer dan asing pada satu tanggal | harian papan | 541 |
| Screener | `/jago-papan` Momentum | Emiten yang lolos empat aturan momentum di bar terakhir | jago papan | 197 |
| Kabar | `/kabar` Kabar | Berita dan pengumuman resmi | kabar | 201 |
| Bulletin | `/bulletin` Bulletin | Arsip edisi Arus Pasar dan hasil H+5 | edisi terbit | 625 |
| Metodologi | `/metodologi` Metodologi | Arti istilah dan angka PAPAN | glosarium | 198 |
| Metodologi | `/feedback` Kritik & Saran | Mengirim masukan lewat WhatsApp | tanpa data | 110 |

## Tumpang tindih yang terbukti di kode

| # | Yang tumpang tindih | Bukti | Jenis |
|---|---|---|---|
| T1 | Top Broker (`/broker`) dan Broker Summary Pasar (`/broker-summary`) | Keduanya membaca rekap broker harian lewat modul yang sama (`lib/dasbor/brokerHarian.ts`, `fetchBrokerRows`) | data sama, kedalaman beda |
| T2 | Aliran Asing (`/aliran-asing`) dan panel Aliran Asing di Stock Detail | Komponen `PanelAliranAsing` yang sama dirender di `AliranAsing.tsx` dan `StockDetail.tsx` | komponen sama |
| T3 | Kabar (`/kabar`) dan panel Kabar di Stock Detail | Fungsi `kabarEmiten()` yang sama; panel hanya menyaring satu emiten | mesin sama, cakupan beda |
| T4 | Berkas Emiten dan Stock Detail, Aliran Asing, Kartu Analisa | Berkas membaca sumber asing dan kartu yang sama, lalu menulis ulang tampilannya sendiri | superset tulis ulang |
| T5 | Harga rata-rata/floor broker di Aliran Dana v2 Overview, Neo Inventory, dan Trader Papan | Tiga rumus berbeda (`brokerEmiten.ts` `floorPriceBroker`, `posisiBroker.ts`, `traderPapan.ts`) atas gudang broker yang sama | **angka bisa beda antar halaman** |
| T6 | Kepemilikan KSEI bulanan di Aliran Dana v2 Shareholders dan Neo Balance Position | Keduanya membaca `kepemilikan/<kode>`; Shareholders menambah profil pemegang saham | data sama |
| T7 | Skor SSS (Screener) dan Skor Papan (Harian Papan) | `components/dasbor/BedaSkor.tsx` mencatat dua mesin skor yang bisa memberi vonis berlawanan untuk emiten yang sama | **vonis bisa berlawanan** |
| T8 | Winrate (`/winrate`) dan tab Riwayat & Win Rate di Screener | Sama-sama "win rate", beda metode: rekonstruksi satu emiten lawan sinyal yang benar-benar terbit; kode menyebutnya | disengaja |
| T9 | Whales Papan dan Trader Papan | Data identik (gudang broker), sumbu beda: harga lawan pelaku; kode menyebutnya | disengaja |

## Mirip tapi beda

Jangan digabung hanya karena judulnya mirip:

- **Chart (`/chart`) dan Grafik (`/grafik`).** Chart adalah widget TradingView untuk indeks. Grafik adalah kanvas PAPAN untuk satu emiten.
- **Radar dan Pantau.** Radar adalah arsip editor luar. Pantau adalah daftar milik pembaca sendiri.
- **Kalkulator dan Kuli Papan.** Kalkulator berisi rumus generik tanpa data. Kuli Papan membaca data emiten.
- **Musiman dan tab Seasonality di Neo.** Musiman memakai hitungan jadi lintas emiten dengan uji signifikansi. Tab Neo menghitung satu emiten di peramban tanpa uji.
- **Sektor dan tab Rotasi atau Aktivitas di Neo.** Sektor memakai potret harian resmi. Tab Neo membangun deret sendiri dari sampel emiten likuid.
- **Berkala dan Pasar, Top Stocks, Top Broker.** Topiknya sama, tetapi Berkala memakai edisi pekan atau bulan resmi, sedangkan tiga halaman lain harian.
- **Harian Papan, Jago Papan, dan Preset Whale.** Ketiganya daftar siap pakai dengan definisi dan tanggal berbeda.

## Temuan di luar susunan menu

- **T5 tiga rumus harga rata-rata broker** menjadi antrean #202, karena itu soal kebenaran angka, bukan menu.
- **Teks layar yang mencetak nama berkas atau ruas internal** menjadi antrean #201: `AliranAsing.tsx:165` (`screener.json`), `Kabar.tsx:147` (`kabar.json`), `PanelAktivitasTransaksi.tsx:75` (ruas `ListedShares`).
- **T7 dua mesin skor** sudah ditandai di layar lewat `BedaSkor`. Pilihan satu skor adalah keputusan Johan.
