# PAPAN v2 — prioritas halaman dari 13 ebook KOMINSA (#269)

Johan 2 Okt 2026: *"coba kmu pelajari, setelah kmu pelajari apakah kmu bisa memprioritaskan page mana saja di PAPAN yang perlu di bangun dan bermanfaat ?"* · *"Pelajari terutama mega profit itu"*.

Cara: 13 ebook diekstrak (7 lewat OCR Windows), dibaca 7 agen sonnet (Mega Profit punya agen sendiri, per bab), diperingkat 2 agen opus dari dua sudut (pengguna ritel di ponsel · keunggulan data PAPAN), diputus 1 agen opus, acuan desain dicari 1 agen sonnet. Teks buku tidak disimpan di repo (berhak cipta); dokumen ini ringkasan dengan kata sendiri.

## Prioritas final

| # | Halaman | Alasan | Sepakat / beda |
|---|---|---|---|
| 1 | 1. Kartu Emiten (tren tiga lapis + peta level + satu sinyal) | Halaman ini paling sering dibuka. Hampir seluruh isinya aturan Mega Profit (Bab 4-5, 7-9, 25, 29), dan datanya sudah segar sampai 1 Okt 2026. Kartu ini juga menyatukan 'Status Tren' (#6 analis data) dan 'Peta Level' (#5 analis data) supaya tidak jadi tiga halaman terpisah. | Analis pengguna menaruhnya #1. Analis data memecahnya jadi #5 (level) dan #6 (tren) karena mudah ditiru pesaing. Saya ikut analis pengguna karena Johan menekankan Mega Profit dan datanya sudah siap. Lapis harga rata-rata penampung besar (usulan analis data) masuk ke kartu ini sebagai satu baris, bukan halaman sendiri. |
| 2 | 2. Radar Pola Terkonfirmasi (Setup Hari Ini) | Ini konsep terbesar Mega Profit (Bab 9, 20, 21, 24): enam syarat pola, toleransi tembus, aturan hari kedua, dan zona apex 50-80%. Semuanya dihitung dari OHLCV. Pemindainya memakai mesin swing dan level yang sama dengan halaman 1, jadi dibangun sesudahnya. | Kedua analis sepakat soal isi dan status tiga tahap. Bedanya di urutan: analis data menaruhnya #2 dan analis pengguna #3. Saya pakai #2. Baris 'konfirmasi pelaku' dari broker hanya ditampilkan bila cakupan broker emiten itu penuh, karena broker 18 dan 22-24 Sep masih berlubang. |
| 3 | 3. Rencana Transaksi + Jurnal | Mega Profit Bab 10, 28, dan 29 menyebut psikologi dan manajemen uang 80-90% dari keberhasilan. Kalkulatornya (stop dari level + toleransi, R:R, lot dari risiko % modal, keFraksi) bisa tayang lebih dulu tanpa data baru. Jurnal menyusul. | Analis pengguna menaruhnya #2 dan analis data #4. Saya menaruhnya di tengah: nilainya naik setelah stop dan target bisa diisi otomatis dari halaman 1-2. Kedua analis sepakat jurnal butuh tabel Supabase baru, dan tempatnya keputusan Johan. |
| 4 | 4. Garis Bandar (arus broker BD2-BD5 + divergensi) | Ini pembeda PAPAN yang paling sulit ditiru: broker per emiten per hari sejak 2016 dalam 6 varian. Halaman ini juga menutup kelemahan yang diakui Mega Profit Bab 18, bahwa volume tidak memberi tahu siapa pembelinya. | Analis data menaruhnya #1 dan analis pengguna #4. Saya ikut analis pengguna dengan dua alasan: cakupan broker hari terakhir belum penuh (per 1 Okt hanya 327 dari 962 emiten punya 10 hari broker cukup), dan bacaan harian sering split decision. Ada catatan yang belum diputuskan: sejak 2 Sep sumber memotong daftar di 50 broker per sisi, dan halaman wajib menandainya. |
| 5 | 5. Uji Keandalan di IDX | Halaman ini mengganti statistik Bulkowski (saham AS 1991-1996) yang dikutip Mega Profit dengan angka IDX sendiri: sampel, periode, CI, dan uji luar sampel. Hasilnya menjadi angka 'seberapa sering berhasil' di kartu halaman 1-2. | Usulan ini datang dari analis data (#3). Analis pengguna melipatnya ke halaman Setup. Saya memisahkannya karena komputasinya berat dan butuh halaman metodologi sendiri. Angkanya tetap muncul ringkas di kartu pola. |
| 6 | 6. Suhu Pasar (beranda) | Dibuka setiap hari. Breadth dihitung murah dari OHLC yang sudah ada, dan status tren IHSG ala Dow (Bab 17) memakai mesin swing yang sama dengan halaman 1. | Hanya analis pengguna yang mengusulkannya (#6). Analis data tidak memasukkannya. Saya mempertahankannya karena turunannya murah dan memakai ulang mesin halaman 1. Yield SBN dan data margin tidak ada, jadi dua indikator Graham ditandai 'butuh data luar'. |
| 7 | 7. Cek Kesehatan & Nilai Fundamental | Datanya kaya (XBRL resmi 2019-2025 dan 94 rasio keystats), tetapi jauh dari buku yang ditekankan Johan. Jebakannya juga sudah terukur: XBRL kumulatif lawan yfinance diskret memberi angka 1,96x, dan skala DER persen lawan rasio berbeda 100x. | Analis pengguna menaruhnya #5 dan analis data #8. Saya ambil tengah. Keputusan memakai XBRL sebagai sumber utama fundamental termasuk aturan 3b/3c, jadi harus Johan yang memutuskan. Koreksi untuk kedua analis: ohlcv_stockbit/*.json punya kolom 'dividend' (BBRI: 25 bar terisi), jadi riwayat dividen mungkin sudah ada. Arti kolom itu belum diukur, jadi belum boleh dipakai sebelum diuji. |
| 8 | 8. Peta Rotasi Sektor | Halaman ini memakai dua data langka (asing resmi dan broker), tetapi data sektor basi sejak 5 Sep karena IDX terblokir. Ada juga dua penamaan sektor yang belum diaudit. | Kedua analis sepakat halaman ini di bawah dan menunggu pembenahan pemetaan sektor. Simulator Nabung Saham (#8 analis pengguna) keluar dari delapan besar. Datanya siap, tetapi tanpa emiten yang sudah delisting hasilnya terlalu tinggi, dan halaman ini bukan kebutuhan harian. |

## Halaman pertama: Kartu Emiten v2: Tren, Level, Satu Sinyal

**Pekerjaan pengguna:** "Saham X ini sedang naik, turun, atau tidur? Di harga berapa ia kemungkinan ditahan atau ditolak? Ada satu alasan kuat untuk bertindak, atau lebih baik menunggu?"

**Sasaran:** Investor dan trader ritel IDX yang memegang atau memantau beberapa saham, membuka PAPAN dari ponsel (412 px, batas lipatan nyata 810 px), dan belum menguasai puluhan indikator. Sasaran kedua: pembaca Deep Dive yang ingin melihat ringkasan level tanpa membuka edisi.

### Alur di ponsel
1. Layar 1 (di atas lipatan, maks 810 px): kop berisi kode, nama, harga terakhir, perubahan %, tanggal 'Data per', dan lencana likuiditas/riwayat pendek bila ada. Di bawahnya blok Tren Tiga Lapis (tiga pil berdampingan: Bulanan 5 th · Mingguan 3 th · Harian 1 th) dan blok Satu Sinyal. Pengguna yang hanya membaca layar ini sudah mendapat jawaban.
2. Layar 2 (gulir pertama): Tangga Level berupa daftar vertikal 3 resistance di atas harga dan 3 support di bawahnya. Tiap level punya skor kekuatan (titik 1-5), jumlah sentuhan, umur, dan status 'baru ditembus, menunggu pullback'. Garis angka bulat dan +50%/+100% dari harga IPO ikut tampil bila jatuh dalam rentang 2 ATR.
3. Layar 3: Mode Pasar (ADX: tren atau sideways) dengan satu kalimat alat yang cocok, misalnya 'pasar tren, pakai MA dan SAR, abaikan RSI'. Di bawahnya formasi MA (MA10/EMA30/MA60/MA200) sebagai empat titik urut.
4. Layar 4: grafik harian 1 tahun (skala log otomatis bila rentang >1 th) dengan garis level dari layar 2, toggle Harian/Mingguan/Bulanan, dan penanda swing HH/HL/LH/LL.
5. Layar 5 (lipatan bawah): 'Siapa di balik level' berisi satu baris harga rata-rata 3 broker pembeli terbesar 20 hari dibanding harga sekarang, dengan label cakupan broker. Lalu tautan keluar ke Rencana Transaksi (stop dan target terisi dari kartu ini), Garis Bandar, dan Deep Dive bila ada.

### Blok

| Blok | Isi | Data |
|---|---|---|
| Kop emiten | Kode, nama, harga (lewat keFraksi), perubahan %, 'Data per <tanggal bar terakhir>', lencana kualitas ('riwayat pendek', 'likuiditas tipis', 'beku'). | data-idx/json/kartu/<KODE>.json (harga, prev, chg, tgl, kualitas, beku, likuiditas_median20); nama dari daftar_emiten.json |
| Tren Tiga Lapis | Arah naik/turun/sideways di tiga horizon dari urutan swing HH/HL. Swing dibaca dari bar harian, mingguan, dan bulanan hasil agregasi. Peringatan oranye bila minor melawan major. Tiap pil menyebut tanggal swing terakhir yang menentukan arahnya. | data-idx/json/ohlcv_stockbit/<KODE>.json (bar harian sejak 2000an; mingguan/bulanan diagregasi di skrip turunan). TURUNAN BARU: deteksi swing dengan ambang ATR, belum ada di kartu/*.json |
| Satu Sinyal | Hanya sinyal terkuat dari tiga keluarga (tembus level + toleransi, persilangan MA, candle di level). Status bertahap: tembus intraday → tembus close + toleransi → terkonfirmasi H+1. Bila dua sinyal bertentangan, blok tampil abu-abu dengan kalimat 'sinyal bertabrakan, tunggu' (Bab 21 dan 29). Bila tidak ada sinyal, tertulis 'tidak ada sinyal jelas'. | ohlcv_stockbit/<KODE>.json (open/high/low/close/volume); level dari blok Tangga Level; toleransi bawaan 1,5% (horizon pendek). TURUNAN BARU |
| Tangga Level | 3 support + 3 resistance. Skor kekuatan dihitung dari jumlah sentuhan, umur (bulan), dan volume relatif pada hari sentuhan. Peran berbalik setelah close menembus. Garis angka bulat terdekat (sesuai fraksi IDX) dan +50%/+100% dari harga IPO bila relevan. | kartu/<KODE>.json (support[], resistance[] dengan level, sentuhan, terakhir, dalam_atr; atr); volume per sentuhan dari ohlcv_stockbit; harga IPO dari ipo.json (harga_ipo, tanggal_listing). TURUNAN BARU: skor kekuatan dan status pullback |
| Mode Pasar | ADX(14) dan DI+/DI-. Label 'tren kuat / tren lemah / sideways' dan satu kalimat alat yang cocok. Formasi MA10>EMA30>MA60>MA200 dengan kemiringan MA200. | ohlcv_stockbit/<KODE>.json; ma20/ma50/ma200 sudah ada di kartu/*.json, ADX dan EMA30/MA60 TURUNAN BARU |
| Grafik | Candle harian 1 tahun, toggle mingguan/bulanan, garis level, penanda swing, skala log otomatis untuk rentang >1 tahun. | ohlcv_stockbit/<KODE>.json (pakai harga tersesuaikan; jangan membagi dengan volume broker) |
| Siapa di balik level | Harga rata-rata 3 broker net beli terbesar dalam 20 hari dibanding harga sekarang (+/- %). Selalu disertai 'cakupan broker: N dari 20 hari'. Disembunyikan bila cakupan <10 hari. | data-idx/json/broker_emiten/ atau broker_rentang/ (varian reguler); label kategori dari kategori_broker.json. Perlu dicek berkas mana yang memuat harga rata-rata per broker per emiten sebelum dibangun |
| Tautan lanjut | Tombol ke Rencana Transaksi (membawa entry, stop = support terdekat − toleransi, target = resistance terdekat), Garis Bandar, Deep Dive (bila ada di tinjauan_deepdive.json). | tinjauan_deepdive.json untuk daftar Deep Dive |

### Interaksi
- Ketuk pil tren untuk mengganti grafik ke horizon itu (harian/mingguan/bulanan).
- Ketuk satu level di Tangga Level untuk menyorot garisnya di grafik dan membuka rincian (tanggal tiap sentuhan dan volumenya).
- Pemilih horizon (Pendek/Menengah/Panjang) di kop mengubah toleransi tembus 1,5% / 3% / 5% sesuai Bab 9. Pilihan disimpan per pembaca di localStorage.
- Ketuk Satu Sinyal untuk membuka alasan: daftar centang syarat yang lolos dan gagal.
- Gulir horizontal dilarang. Semua blok satu kolom di ponsel, dua kolom di laptop (kiri ringkasan, kanan grafik).

### Sengaja tidak dimasukkan
- RSI, Stochastic, Williams %R, MACD, dan Bollinger sebagai panel terpisah. Mega Profit Bab 29 menyuruh memilih satu-dua saja, dan Mode Pasar sudah memutuskan alat mana yang relevan.
- Pemindai pola chart (H&S, segitiga, cup and handle). Itu halaman 2; kartu hanya menampilkan pola bila Radar sudah mendeteksinya.
- Elliott Wave. Buku sendiri menyebut hitungannya subjektif.
- Fundamental (PER, PBV, F-Score). Itu halaman 7.
- Probabilitas 'P(naik 5 hari)'. Terukur nyaris koin di Analisa PAPAN v1, jadi dilarang ditampilkan sebagai sinyal.
- Nama endpoint, nama ruas mentah, atau jalur berkas di teks layar (aturan kebocoran proyek).
- Kalkulator lot dan jurnal. Hanya tautan ke halaman 3.

### Kriteria terima
- Untuk 20 emiten acak, harga dan tanggal 'Data per' di kop sama persis dengan bar terakhir ohlcv_stockbit/<KODE>.json.
- Arah Tren Harian cocok dengan pemeriksaan manual urutan 2 swing high + 2 swing low terakhir pada 10 emiten sampel (BBRI, DSSA, GOTO, BUMI, TLKM, ASII, ADRO, ANTM, MDKA, satu emiten tipis).
- Satu Sinyal tidak pernah berstatus 'tembus sah' bila close hari itu kembali ke dalam level + toleransi. Diuji dengan skrip atas seluruh 963 emiten: jumlah pelanggaran = 0.
- Bila dua keluarga sinyal bertentangan, blok berwarna abu-abu. Skrip menghitung kasus konflik dan memastikan semuanya abu-abu.
- Semua harga level lewat keFraksi(). Skrip mencocokkan tiap level dengan tick IDX: pelanggaran = 0.
- Garis +50%/+100% IPO hanya muncul bila ipo.json punya harga_ipo untuk emiten itu.
- Blok 'Siapa di balik level' tersembunyi bila cakupan broker <10 dari 20 hari, dan label cakupan selalu tercetak.
- Ponsel 412x915: kop, Tren Tiga Lapis, dan Satu Sinyal seluruhnya berakhir di atas y=810. Tidak ada elemen dengan rect.right > innerWidth. Diukur juga di laptop 1536x960.
- Sapuan kebocoran: grep -rniE 'getstocksummary|chartbit|keystats|foreignbuy|data-idx/json|[.]json' pada berkas tampilan baru hanya mengembalikan fetch/import, bukan teks yang dirender.
- Halaman terdaftar di PETA_MENU_KUNCI dan di tabel Supabase akses_halaman dengan tingkat awal 'publik'.
- npm run build lolos (bukan tsc --noEmit -p tsconfig.json).
- Fon angka bukan JetBrains Mono atau sejenisnya: getComputedStyle untuk seluruh elemen hanya berisi fon yang diizinkan, dengan tabular-nums.

### Konsep buku yang mendasari
- Mega Profit Bab 4: multi-timeframe harian 1 th / mingguan 3 th / bulanan 5 th
- Mega Profit Bab 5: HH/HL, tiga tingkat tren, tembus sah hanya dengan close
- Mega Profit Bab 6: skala log untuk rentang di atas 1 tahun
- Mega Profit Bab 7: kekuatan level (volume, sentuhan, umur), pergantian peran, pullback
- Mega Profit Bab 8: angka psikologi dan +50%/+100% dari harga IPO (bisa karena ipo.json punya harga_ipo)
- Mega Profit Bab 9: toleransi tembus per horizon dan aturan hari kedua
- Mega Profit Bab 25: ADX sebagai saklar (tren pakai MA, sideways pakai osilator)
- Mega Profit Bab 21 dan 29: dua sinyal bertentangan = abaikan; pilih satu sinyal terjelas
- Swing Trader Dunia: formasi MA10>EMA30>MA60>MA200 dan kemiringan MA200
- Bandarmology: harga rata-rata penampung besar sebagai lapis biaya modal

## Konsep buku yang belum bisa diwujudkan (data belum ada)
- Pola candlestick, gap, dan aturan hari kedua pada riwayat lama: OpenPrice IDX kosong 5-8% sebelum 2025. Open dari Stockbit perlu diukur kelengkapannya dulu, dan pola yang butuh open diberi tanda bila open-nya dari cadangan.
- Konfirmasi dua indeks (Dow, Mega Profit Bab 2) dan korelasi dengan Hang Seng/Nikkei/Dow Jones (Swing Trader Dunia): indeks luar negeri tidak dipanen.
- Margin of safety Graham terhadap yield SBN, dan rasio ROE terhadap BI rate: yield SBN dan BI rate tidak dipanen, sehingga harus diisi manual.
- Data margin dan daftar saham marginable (ciri puncak bull market Graham, kalkulator margin call): tidak ada.
- Riwayat keanggotaan LQ45/JII (Trading Vs Investing, Swing Trader Dunia): tidak ada, sehingga diganti filter likuiditas dari nilai transaksi.
- Backtest DCA dan statistik pola tanpa survivorship bias: emiten yang sudah delisting tidak ada di data, jadi angkanya wajib diberi label 'hanya emiten yang masih tercatat'.
- Kriteria Graham 10 tahun laba dan 20 tahun dividen: XBRL hanya 2019-2025. Kolom 'dividend' di ohlcv_stockbit ada (BBRI 25 bar terisi), tetapi artinya belum diukur, jadi belum boleh dipakai sebagai riwayat dividen.
- Jurnal trading, deteksi averaging down/martingale, dan akun virtual (Mega Profit Bab 28-29): datanya milik pengguna dan butuh tabel Supabase baru. Tempat simpannya keputusan Johan.
- Broker per emiten di hari terakhir: per 1 Okt hanya 327 dari 962 emiten punya 10 hari broker cukup, dan sejak 2 Sep daftar terpotong di 50 broker per sisi. Garis bandar dan baris konfirmasi pelaku wajib mencetak cakupan per emiten.
- Peta rotasi sektor: data sektor IDX-IC basi sejak 5 Sep (IDX terblokir verifikasi bot), dan ada dua penamaan sektor yang belum diaudit.
- Data operasional per industri (jumlah outlet, BTS, volume produksi) dan umur piutang dari CALK: tidak dipanen.
- Harga penawaran IPO sudah ada di ipo.json, tetapi tingkat oversubscribe dan book building (Bandarmology, Smart Trader) tidak ada.

## Acuan desain (#269 tahap 2, menunggu pilihan Johan)

| # | Acuan | Yang ditiru | Layar | URL terverifikasi |
|---|---|---|---|---|
| 1 | [TradingView Technicals (halaman per simbol)](https://www.tradingview.com/symbols/XAUUSD/technicals/) | Tiga gauge berdampingan (Ringkasan, Osilator, Moving Average) lalu tabel Nilai/Aksi per indikator dan tabel Pivot R3-R1/P/S1-S3. Tiru: satu keputusan ringkas di atas, rincian dilipat di bawah (cocok untuk Satu Sinyal + daftar centang alasan). Hindari meniru jumlah indikatornya (11 osilator + 13 MA) karena PAPAN sengaja memilih satu-dua. Fetch terbuka (isi data kosong untuk emas, struktur terbaca). | ponsel dan laptop | ya |
| 2 | [TradingView Technical Analysis Widget - demo multi-gauge](https://www.tradingview.com/widget-docs/widgets/symbol-details/technical-analysis/demos/multiple/) | Pemilih interval (1h dst) di atas gauge yang mengganti seluruh ringkasan. Pola untuk toggle horizon Pendek/Menengah/Panjang dan pil Tren Tiga Lapis. Fetch terbuka. | ponsel dan laptop | ya |
| 3 | [Easy Pivot Point (App Store)](https://apps.apple.com/us/app/easy-pivot-point/id1116573482) | Tangga Level: tampilan ladder yang bisa diperluas, dua level terdekat di sekitar harga, harga diposisikan relatif terhadap level, tanpa grafik penuh ('no chart clutter'), tab H1/H4/Daily/Weekly/Monthly. Ladder vertikal untuk layar 2. Fetch terbuka. | ponsel | ya |
| 4 | [TrendSpider - Multi-Timeframe Analysis](https://help.trendspider.com/kb/automated-technical-analysis/multi-timeframe-analysis) | Garis horizon utama solid, garis dari horizon lebih besar putus-putus pada grafik yang sama. Dipakai untuk menggambar level mingguan/bulanan di grafik harian layar 4 tanpa membelah grafik. Fetch terbuka. | laptop (grafik), adaptasi ke ponsel | ya |
| 5 | [TrendSpider - Automated Technical Analysis](https://help.trendspider.com/kb/automated-technical-analysis) | Skor kepercayaan level berdasar jumlah sentuhan, jumlah horizon, dan kebaruan, dengan filter hanya level tinggi. Dasar skor kekuatan 1-5 titik di Tangga Level. Terlihat di hasil pencarian; halaman tidak di-fetch langsung (isi dari ringkasan pencarian). | laptop | ya |
| 6 | [Finviz - halaman quote (contoh GEN)](https://finviz.com/quote.ashx?t=GEN) | Tabel snapshot padat: RSI(14), jarak % ke SMA20/50/200, 52w high/low, ATR, di atas grafik. Tiru gaya jarak persen ke MA untuk blok formasi MA dan penanda 'jarak dari harga' di tiap level. Fetch terbuka. | laptop | ya |
| 7 | [Simply Wall St - ringkasan perusahaan (Snowflake)](https://simplywall.st/stocks/us/software/nyse-snow/snowflake) | Satu visual ringkas (skor 0-6 per lima kategori) plus daftar centang lulus/gagal di bawahnya. Pola untuk Satu Sinyal: ringkasan visual satu pandang, alasan dibuka lewat daftar centang. URL ada di hasil pencarian; fetch ditolak 403, jadi tata letak detail tidak diperiksa langsung. | ponsel dan laptop | ya |
| 8 | [Seeking Alpha - Quant Ratings (NVDA)](https://seekingalpha.com/symbol/NVDA/ratings/quant-ratings) | Satu skor 1-5 dengan label tegas (Strong Sell sampai Strong Buy) dan lima nilai faktor A+ sampai F di kartu terpisah. Pola label ringkas + faktor pendukung untuk blok Satu Sinyal dan skor kekuatan level. URL ada di hasil pencarian; fetch 403, tata letak detail tidak diperiksa langsung. | laptop | ya |
| 9 | [Barchart - Trader's Cheat Sheet (contoh APPS)](https://www.barchart.com/stocks/quotes/APPS/cheat-sheet) | Halaman 'cheat sheet' satu emiten berisi pivot, support/resistance, dan sinyal dalam satu tampilan. Cocok sebagai acuan struktur Tangga Level plus ringkasan. URL ada di hasil pencarian; fetch mengembalikan halaman kosong (render JS), jadi isi belum diperiksa langsung. | laptop | belum |
| 10 | [Robinhood - Stock Detail Page (dokumentasi resmi)](https://robinhood.com/support/articles/360001380846/viewing-stock-detail-pages/) | Urutan layar ponsel: harga dan grafik dulu, lalu bagian Statistik (rentang harian dan 52 minggu), lalu bagian lanjutan. Acuan alur gulir bertahap dan rentang 52 minggu sebagai bilah posisi. URL ada di hasil pencarian; belum di-fetch, jadi detail visual perlu dilihat langsung di aplikasi. | ponsel | belum |

## Peringkat masing-masing analis

- Sudut pengguna: 1. Kartu Emiten (satu layar per saham, ringkas di ponsel) · 2. Rencana Transaksi + Jurnal · 3. Setup Hari Ini (pemindai pola dengan daftar periksa dan statistik IDX) · 4. Bukti Pelaku (siapa yang menyerap: broker dan asing) · 5. Cek Kesehatan & Nilai (fundamental untuk pemula) · 6. Suhu Pasar (beranda) · 7. Peta Rotasi Sektor · 8. Simulator Nabung Saham & Biaya Kerugian
- Sudut data: 1. Garis Bandar (arus broker berlapis BD2-BD5 + divergensi harga) · 2. Radar Pola Terkonfirmasi (pemindai pola chart + candle dengan daftar periksa Mega Profit) · 3. Uji Keandalan di IDX (statistik pola dan sinyal hasil hitung sendiri) · 4. Rencana Trading dan Jurnal · 5. Peta Level (S/R berbobot, angka psikologi, biaya modal bandar) · 6. Status Tren Tiga Lapis Waktu dan Mode Pasar · 7. Rotasi Sektor (asing resmi + arus bandar per sektor IDX-IC) · 8. Kesehatan dan Nilai Fundamental (XBRL resmi)

