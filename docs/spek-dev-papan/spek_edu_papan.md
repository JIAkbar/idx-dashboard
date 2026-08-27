Dari sesi AI Skill (Fable), 25 Agu 2026 — SPEK **EDU PAPAN**. Asal perintah Johan: *"buat page Edu Papan isinya daging"* + 5 gambar dari materi Private Class BidOffer Bandar (Abdullah Ali Akbar): Market Cycle 4 fase, tahapan Market Makers Flow, chart TPIA road-to-MSCI dengan pita fase, "buy on rumors sell on corp action", dan Rules of Thumb Open Live Trade / After Close Market. Bahasa: Indonesia sehari-hari, istilah asing diterjemahkan tapi istilah pasar yang sudah lazim dipertahankan.

# Halaman `/edu-papan` — "Edu Papan", grup DEV

Bedanya dari halaman lain: Harian Papan, Jago Papan, Neo Papan menampilkan angka. Edu Papan menjelaskan **cara membacanya**, dan tiap penjelasan langsung menunjuk ke data kita sendiri. Jadi bukan artikel yang berdiri sendiri, tapi bab-bab yang tiap seksinya punya contoh hidup dari 962 emiten dan arsip broker 2017–2026.

Aturan isi: setiap klaim yang bisa diuji harus punya angkanya. Kalau belum diuji, tulis "belum diuji". Kalau tidak bisa dihitung dari data kita, tulis alasannya.

## Bab 1 · Siklus pasar dan empat fase

Isi: apa itu Akumulasi, Mark Up, Distribusi, Mark Down. Istilah versi "Wyckoff pasar": Stealth Phase (akumulasi senyap), Awareness Phase (fase menggoreng), Mania Phase (distribusi awal), Blow Off Phase (distribusi akhir). Semua istilah asing diterjemahkan di kurung.

Yang membuatnya "daging", bukan sekadar gambar siklus:
- **Pita fase otomatis** di bawah chart emiten mana pun. Fase ditentukan dari data kita, bukan digambar tangan: akumulasi = accdist NET bertanda Acc berhari-hari + konsentrasi beli tinggi (`top3_pct`) sementara harga mendatar; mark up = harga menembus MA20/MA50 dengan volume di atas rata-rata; distribusi = accdist berbalik Dist sementara harga masih bertahan; mark down = harga jatuh di bawah MA20 dengan jual terkonsentrasi.
- **Contoh bawaan TPIA 2023–2024** persis seperti gambar materi (31 Agu 2023 sampai 8 Nov 2024), tapi pita fasenya dihitung mesin, dan pembaca bisa mengganti emitennya.
- Pembaca bisa membandingkan hasil mesin dengan garis yang ditarik materi. Kalau beda, biarkan beda, tulis bedanya.

Batas yang harus ditulis: fase baru bisa dipastikan setelah lewat. Label fase hari ini adalah dugaan, bukan fakta.

### Empat gambar yang wajib ada di Bab 1 (kiriman Johan 25 Agu)

Gambar-gambar ini bukan hiasan. Keempatnya jadi tulang punggung Bab 1, digambar ulang sendiri sebagai SVG (jangan menempel tangkapan layar materi orang), dengan warna dan istilah yang sama supaya pembaca yang pernah lihat materinya langsung mengenali.

**Gambar 1 · Kurva siklus pasar dengan psikologi pelakunya.** Kurva satu putaran penuh, dibagi empat warna: Stealth (jingga), Awareness (hijau), Mania (ungu), Blow Off (merah). Di atas kurva ditulis siapa yang bergerak di tiap bagian: Smart Money, Institutional Investors, Public. Titik-titik emosi ditandai di posisinya masing-masing: Take Off, First Sell Off, Bear Trap, Media Attention, Greed, Fomo, Bull Trap, Return to normal atau Death Cat Bounce, Fear, Capitulation, Despair. Garis putus-putus mendatar sebagai acuan harga awal.

Di bawahnya empat baris keterangan, ditulis apa adanya seperti materi: Stealth Phase yaitu awal akumulasi senyap, Awareness Phase yaitu fase menggoreng, Mania Phase yaitu fase distribusi awal dengan cara mark up distribusi, Blow Off Phase yaitu fase distribusi akhir dengan cara mark down distribusi.

**Gambar 2 · Empat tahap dalam bentuk zig-zag harga.** Bentuknya beda dari Gambar 1 dan keduanya perlu ada: Accumulation mendatar (ranging) di bawah, Mark Up naik, Distribution mendatar di atas, Mark Down turun. Garis putus-putus menandai batas atas dan bawah tiap area mendatar, label Uptrend dan Downtrend di sisi miringnya. Ini yang paling gampang dicocokkan pembaca dengan chart aslinya.

Keterangan empat tahap, dan satu kalimat yang penting untuk Bab 3: pemain besar biasanya memakai lebih dari satu sekuritas supaya tidak mudah terbaca dan bisa saling mengoper barang, biasanya antara tiga sampai delapan sekuritas.

**Gambar 3 · Contoh nyata TPIA 2023–2024.** Bukan gambar tempelan, tapi chart hidup dari data kita dengan pita fase di bawahnya. Tanggal pembatas mengikuti materi: 31 Agu 2023, 4 Des 2023, 6 Mar 2024, 15 Mei 2024, 12 Agu 2024, 8 Nov 2024, dengan label berurutan Accumulation, Mark Up, Mark Up, Distribution, Mark Down, Accumulation. Penanda MSCI di posisi Mei 2024.

Yang membuat ini berguna: di sampingnya ditampilkan **pita fase versi hitungan kita** untuk rentang yang sama. Pembaca membandingkan sendiri garis manual materi dengan hasil mesin. Kalau meleset, tulis di mana melesetnya. Emiten bisa diganti, jadi pembaca boleh menguji chart lain.

**Gambar 4 · Kalimat penutup "buy on rumors, sell on corp action".** Ditulis sebagai kotak kecil dengan legenda empat warna fase, menjembatani ke Bab 7 yang membahas rumor dan aksi korporasi. Sertakan tautan berita yang disebut materi sebagai contoh, bukan sebagai anjuran.

Semua gambar dibuat dua versi warna, terang dan gelap, dan tetap terbaca di layar 412 piksel.

## Bab 2 · Membaca broker summary

Isi: aturan dari materi, bahwa saat akumulasi nilai beli menumpuk di sedikit sekuritas sementara jualnya tersebar, dan sebaliknya saat distribusi.

Data pendukung yang kita punya: `top1/top3/top5/top10` (konsentrasi dua sisi), `total_buyer` dan `total_seller`, `number_broker_buysell`, label `accdist` tujuh tingkat dengan ambang ±6 / ±12,5 / ±20 persen yang sudah kita buktikan dari data Stockbit sendiri.

Tabel interaktif: pilih emiten dan rentang tanggal, halaman menghitung apakah polanya cocok dengan aturan materi, lalu menunjukkan broker mana yang mendominasi tiap sisi.

## Bab 3 · Jejak beberapa sekuritas milik satu pemain

Materi menyebut satu pemain besar biasanya memakai tiga sampai delapan sekuritas supaya tidak mudah terbaca, dan supaya bisa saling mengoper barang.

Ini bisa kita uji, dan setahu saya belum ada yang menyajikannya terbuka: korelasi net beli harian antar broker di satu emiten, jendela 60 hari. Broker yang net-nya bergerak bersamaan muncul sebagai satu klaster. Hasilnya ditampilkan sebagai matriks kecil plus daftar "kelompok broker yang bergerak seirama".

Uji kejujuran yang wajib menyertainya: korelasi bukan bukti kepemilikan. Dua broker bisa bergerak sama karena sama-sama mengikuti indeks. Tulis itu di halaman.

## Bab 4 · Bid, offer, dan batas yang kita punya

Isi: definisi bid, offer, orderbook, tradebook, dan aturan "lot besar frekuensi kecil condong bandar, lot kecil frekuensi besar condong ritel".

Bagian ini harus jujur soal batas. Orderbook penuh per tick hanya ada di layanan berbayar, dan tradebook per transaksi tidak kita panen. Yang kita punya: antrean penutupan level terbaik dari IDX, bar satu menit dari chartbit (harga, volume, frekuensi), dan ukuran tiket harian yaitu nilai dibagi frekuensi.

Jadi aturan seperti "total offer tiga kali total bid" tidak bisa dihitung otomatis di sini. Yang bisa: ukuran tiket rata-rata per hari, ukuran tiket per broker (nilai beli dibagi frekuensi), dan lonjakannya terhadap kebiasaan emiten itu. Tulis apa adanya, jangan menjanjikan orderbook.

## Bab 5 · Target harga dan cara mengujinya

Isi rumus Target Market Makers dari materi: `TMM = (volume lot pembeli ÷ rata-rata lot per tick) × fraksi harga + harga saat lonjakan pertama`. Verifikasi kita ke contoh materinya sendiri: PTRO 2.806,7 lawan 2.806 di slide, RAJA 2.498 lawan 2.500, RAJA kedua 1.642,4 lawan 1.645. Rumusnya konsisten.

Kaitannya dengan halaman lain: strukturnya sama dengan Kuli Papan yang sudah kita punya. Edu Papan menjelaskan asal-usulnya, Kuli Papan yang menghitung.

Bagian yang paling penting di bab ini: tombol "uji di BT Papan". Setiap aturan yang diajarkan bisa langsung diadu ke riwayat.

## Bab 6 · Aturan harian dan hasil ujinya

Materi memberi dua aturan harian. Pertama, saat pasar buka, pantau nilai transaksi IHSG lima sampai sepuluh menit pertama, lalu cari emiten yang nilai transaksinya delapan sampai sepuluh persen dari nilai pasar. Kedua, setelah pasar tutup, kalau net beli asing mencapai sepuluh sampai lima belas persen nilai transaksi emiten itu, dianggap layak ditahan beberapa hari.

Uji kita, Januari 2025 sampai Agustus 2026, horizon lima hari bursa:

| Saringan | Jumlah kejadian | Median | Menang |
|---|---|---|---|
| Semua hari-emiten sebagai pembanding | 320.309 | 0,00% | 43% |
| Nilai transaksi ≥ 8% nilai pasar | 452 | −0,63% | 44% |
| Ditambah net beli asing ≥ 10% nilai | 98 | −0,87% | 44% |

Hasilnya tidak lebih baik dari rata-rata pasar. Sampelnya kecil, sembilan puluh delapan kejadian, jadi ini bukan vonis. Tapi angkanya ditampilkan apa adanya, termasuk saat aturan yang diajarkan tidak terbukti. Justru itu isi bab ini: cara menguji aturan yang beredar, bukan mengulanginya.

Bagian pertama aturan itu, yang soal lima menit pertama, hanya bisa dijalankan kalau panen intraday sudah berjalan. Sebelum itu, tulis "belum bisa diuji".

## Bab 7 · Rumor dan aksi korporasi

Materi menutup dengan "beli saat rumor, jual saat aksi korporasi", memakai contoh TPIA menuju MSCI: rumor November 2023, rumor Januari 2024, pengumuman Mei 2024.

Yang bisa kita tambahkan: arsip kabar kita (`kabar.json`, Snips Stockbit, IPOT News) bisa ditempelkan sebagai penanda di chart, sehingga pembaca melihat sendiri harga bergerak sebelum atau sesudah berita. Cakupan arsip kabar terbatas, jadi tulis sejak kapan datanya ada.

## Bentuk halaman

Satu halaman, tujuh bab, daftar isi menempel di samping. Tiap bab punya susunan yang sama: penjelasan singkat, gambar atau bagan, contoh hidup dari data kita dengan pemilih emiten, lalu kotak "sumber" yang menyebut berkas asalnya seperti di Broker Summary v2.

Bahasa: Indonesia sehari-hari. Istilah asing diterjemahkan saat pertama muncul, lalu boleh dipakai istilah aslinya. Contoh: akumulasi (mengumpulkan barang diam-diam), distribusi (melepas barang ke publik), mark up (menaikkan harga dengan pembelian agresif).

Kredit: materi asal disebut jelas, "diringkas dari Private Class BidOffer Bandar oleh Abdullah Ali Akbar", dengan catatan bahwa angka uji dan bantahan adalah hitungan PAPAN sendiri.

## Rumah tiap fitur turunan materi ini (ketetapan penempatan)

Tiga fitur lahir dari materi ini. Ketiganya tidak jadi halaman sendiri, supaya menu Dev tidak beranak terus:

| Fitur | Rumah | Alasan |
|---|---|---|
| **Fase Bandar** (pita empat fase di bawah chart, dihitung mesin) | **Neo Papan, tab baru "Fase Bandar"** (jadi 9 tab) + pita ringkasnya ikut muncul di **Edu Papan Bab 1** sebagai contoh hidup | Neo Papan sudah berisi tab-tab per-emiten yang membaca broker harian; fase adalah bacaan lanjutan dari data yang sama |
| **Klaster Bandar** (kelompok broker yang net-nya bergerak seirama) | **Neo Papan, tab "Fase Bandar" bagian bawah** — satu tab, dua bagian: pita fase di atas, klaster broker di bawah | Keduanya menjawab pertanyaan sama: siapa yang sedang bekerja di emiten ini |
| **Mode TMM** (rumus target dari materi) | **Kuli Papan, kalkulator ketiga** di samping Target Realistis dan PBV Band | Kuli Papan memang rumah kalkulator target; TMM varian rumus, bukan halaman |

Edu Papan menjelaskan cara bacanya, ketiga fitur itu yang menghitung. Tiap bab Edu Papan menaruh tautan ke tempat hitungnya.

## Yang perlu dibangun

Ruas baru: `fase_bandar` (empat fase per hari per emiten), `klaster_broker` (kelompok broker berkorelasi per emiten, hitung mingguan), `tiket_avg` dan lonjakannya. Sisanya memakai ruas yang sudah ada atau sudah masuk spek Preset Screener dan Jago Papan.

Berkas: `data-idx/json/fase/<KODE>.json` (pita fase harian) dan `klaster/<KODE>.json` (klaster broker). Dihitung di rantai panen, bukan di peramban.

## Uji dan dokumentasi

Uji angka: pita fase TPIA 2023–2024 dibandingkan dengan garis di materi, bedanya dicatat. Klaster broker diuji di emiten yang polanya sudah diketahui. Angka bab 6 diulang sebagai uji regresi.

Uji tampilan: dua ukuran layar, 1920 kali 1080 dan 412 kali 915, tema terang dan gelap.

Dokumentasi: baris di `docs/jejak-permintaan.md`, peta halaman ke sumber di referensi proyek, lalu HTML dibangun ulang.


---

> **⚠️ KOREKSI LINTAS-SPEK 26 Agu 2026 — kedalaman arsip OHLCV.**
> Beberapa spek di folder ini menulis OHLCV harian "2017–2026" (≈10 tahun). **Itu SALAH — understated.** Terukur langsung dari `ohlcv_stockbit/`:
> IHSG **1997-07-01** · ASII **2000-10-17** · BUMI **2003-01-01** · BBCA & TLKM **2004-01-02** · SIDO 2013-12-18 (tanggal IPO-nya) — semua sampai 2026-08-21.
> Jadi OHLCV = **20–30 tahun** untuk emiten lama, bukan 10. Angka "2017" itu tercampur dari **lantai BROKER** (yang benar pun **2016-01-04**, terbukti lewat uji 2015 yang nihil).
> **Yang benar: OHLCV ≈ 1997/2000-an→2026 (per emiten, sejak IPO) · BROKER 2016→2026 · INTRADAY 1m ±90 hari (panen rutin sejak 26 Agu 2026).**
> Dampak: Seasonality boleh memakai 20+ tahun (bukan 10), backtest BT Papan punya sampel jauh lebih panjang, dan klaim "menang telak atas riwayat pesaing" justru lebih kuat dari yang tertulis.
