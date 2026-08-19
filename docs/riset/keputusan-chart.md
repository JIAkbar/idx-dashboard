<!-- Hasil adu lima sudut + pembantahnya, 19 Agu 2026, dengan daftar alat
     TradingView yang dibaca langsung dari peramban sebagai bahan. Disimpan dari
     keluaran workflow yang kalau tidak akan hilang bersama berkas sementara.

     PERINGATAN: sebagian rujukan file:baris di dalamnya sudah basi — Compare
     symbols dan Bar replay ternyata SUDAH terbangun di working tree saat adu ini
     berjalan. Yang tetap berlaku: enam kerusakan hidup di bagian RUSAK. -->

# Dokumen Keputusan — Apa yang Dikerjakan Besok di PAPAN

## Ringkasan eksekutif

Lima sudut diadu; yang bertahan cuma sedikit. Dua fitur yang diusulkan sebagai "kurang" ternyata **sudah terbangun** di working tree (#187 Compare symbols dan Bar replay — terverifikasi di `GrafikEmiten.tsx:409` dan `:431`), dan seluruh rujukan `file:baris` di adu itu basi. Yang tersisa dan terverifikasi hari ini: enam kerusakan hidup, semuanya gagal senyap, semuanya lolos `tsc` + build + tangkapan layar tiga viewport. Yang paling mahal: **chip rentang di kaki kanvas mengubah ANGKA indikator, bukan cuma pandangan** — RSI/EMA/MACD/ATR menyemai bibitnya di batas rentang. Enam kerusakan itu dikerjakan lebih dulu, tanpa kecuali. Fitur baru — termasuk pane aliran asing yang memang aset paling khas PAPAN — menunggu di belakangnya, karena menambah deret di atas kanvas yang angkanya masih bergantung tombol tampilan cuma menambah tempat bersembunyi.

---

## Sepuluh besar (berurut)

### RUSAK — kerjakan dulu

**1. `/grafik` — indikator dihitung dari deret yang sudah dipotong rentang**
Kerjakan: serahkan deret PENUH ke `setData`, jadikan chip rentang murni jendela pandang lewat `timeScale().setVisibleRange()`.
Kenapa nomor satu: satu perbaikan menutup lima gejala sekaligus — RSI/EMA/MACD berhenti berubah nilai per chip, MA 200 berhenti lenyap tanpa pesan di rentang pendek, pencarian Double Bottom berhenti menemukan pola berbeda per rentang (ATR-nya ikut berubah), enam kombinasi kerangka×rentang yang menyisakan satu lilin hilang sendiri, dan penjaga `bandingLilin` berhenti membandingkan ke angka basi. Ini juga satu-satunya kerusakan yang menyerang klaim implisit "angka di sini benar" di halaman yang paling banyak ditautkan.
Terverifikasi: `app/src/views/dasbor/GrafikEmiten.tsx:938` memotong di dalam memo `penuh`; `lilin` diturunkan darinya (`:954`) dan SELURUH turunan memakainya — komentar di `:943-951` sendiri menyebut satu-potongan-di-hulu sebagai desain sadar untuk Bar replay.
Biaya: **½–1 hari**, nol jaringan. WAJIB dengan daftar lima pembaca `penuh` di tangan: titik mulai replay (`:1834` `Math.ceil(penuh.lilin.length*0.7)`), langkah/akhir replay, klip garis pembanding, validasi `bandingLilin` (`jumlahLilin={lilin.length}`), dan probe QA `dataset.jumlahLilin/tglPertama/tglAkhir` — probe itu berubah arti (yang DIMUAT vs yang TERLIHAT) dan harus dipisah jadi dua ruas, karena ia satu-satunya alat verifikasi kita untuk perbaikan ini.
Catatan jujur: rentang bawaan halaman `All`, jadi tampilan saat halaman dibuka sudah benar. Kerusakan nyata di 1D/5D/1M/3M — bukan alasan menunda, tapi jangan dijual sebagai "seluruh chart salah".

**2. `/stock-detail` — emiten tidak bisa datang dari URL; 14 tautan Tanya PAPAN mendarat kosong**
Kerjakan: `sp.get('kode') ?? sp.get('sym')` sebagai nilai awal `activeTicker`, plus ubah `setSp({tab:…})` jadi bentuk fungsional agar kode tak hilang saat pindah tab.
Kenapa nomor dua: bug hidup, gagal senyap (halaman terbuka normal, cuma kosong, nol galat), dan obatnya satu baris. `?sym=` JANGAN diganti nama — 10 pemakai tersebar (`tanyaPapan.ts`, `BatangPeringkat`, `IndeksDunia`, `SektorIndeks`); mengganti nilai tanpa menyapu pembacanya persis regresi #142.
Terverifikasi: `StockDetail.tsx:62` state murni, `:68` cuma membaca `tab`.
Biaya: **±30 menit**, satu berkas.

**3. Seluruh aplikasi — `/forum` tak punya rute, dan tak ada rute cadangan `path="*"`**
Kerjakan: tambahkan `<Route path="*">` (wajib, apa pun keputusan Forum), lalu entah daftarkan `/forum` + `/forum/:tag` atau cabut tiga tautan yang menunjuk ke sana.
Kenapa nomor tiga: `grep` membuktikan nol `path="/forum"` dan nol `path="*"` di `App.tsx` — klik tag emiten di pesan memberi layar putih total, rail dan topbar ikut hilang, dan LoginModal menjual "Forum tanpa batas" sebagai alasan membuat akun. Paling murah dari semua yang rusak.
Biaya: **±30 menit** (404 saja), keputusan Forum lihat bagian bawah.

**4. `/grafik` — chip rentang menjanjikan riwayat yang tak ada pada kerangka intraday**
Kerjakan: nonaktifkan (bukan sembunyikan) chip yang melampaui riwayat kerangka aktif, dengan `title` alasannya — pola `title` batas riwayat sudah dipakai tombol kerangka.
Kenapa di sini: 12 kombinasi (5m/15m/30m × 6M/1Y/5Y/All) tetap bisa ditekan dan tetap tersorot lalu menggambar satu bulan tanpa satu kata pun. Setengahnya lagi (kombinasi degenerate satu-lilin) hilang gratis begitu #1 selesai — makanya ini dikerjakan SESUDAH #1, bukan sebelum.
Biaya: **±1–2 jam** sesudah #1. Ganti juga `All` → `Semua`; **jangan** ganti label lain ke `LABEL_RENTANG` — `grafikEmiten.ts:101-106` sudah mencatat alasan tertulis bahwa label panjang tak muat di kaki 412px.

**5. `/peta-investor` — tak menyebut tanggal data; berkas metanya ada dan tak pernah dibaca**
Kerjakan: fetch `investor_map.meta.json` (263 byte) dan tulis DUA tanggal di kaki: terbit pengumuman **2 Juni 2026** dan disegarkan **13 Agu 2026**.
Kenapa di sini: hari ini 19 Agustus, jaringan kepemilikan dari pengumuman 2 Juni dibaca sebagai posisi sekarang. Terverifikasi: `publish_date` dan `announcement_no` ada di berkas, `petaInvestorData.ts:63` hanya mengambil `investor_map.json`. Menampilkan salah satu tanggal saja mengulang kesalahan yang sedang diperbaiki.
Biaya: **<1 jam**.

**6. `/kartu` — menu tingkat atas untuk 3 dari 964 emiten, dan `?kode=` tak dikenal memberi halaman kosong tanpa pesan**
Kerjakan (bagian yang tak butuh keputusan): pasang keadaan kosong yang jujur — `?kode=XXXX` yang tak ada di indeks harus BERBUNYI "belum tersedia", bukan merender nol kartu dan nol pesan. Cakupannya sendiri masuk daftar keputusan Johan.
Terverifikasi: `data-idx/json/kartu/` berisi ARCI, BUMI, WIFI + index.json.
Biaya: **±30 menit** untuk guard-nya.

### BARU — hanya setelah enam di atas mendarat

**7. `/grafik` — pane "Net asing (lembar)"**
Kerjakan: satu `HistogramSeries` di pane sendiri (`priceScaleId:'asing'`), sumber `data-idx/json/asing/{KODE}.json`, disaring ke himpunan tanggal lilin.
Kenapa fitur baru nomor satu: 989 berkas sudah dipanen (vs 964 OHLC), parsernya sudah produksi (`stockDetailData.ts:471`), dan ini satu-satunya deret yang TradingView struktural tak akan pernah punya untuk IDX. Kenapa BUKAN nomor satu keseluruhan: ia menempel pada kanvas yang #1 belum betulkan, dan `kumulatifNet` sengaja memulai ulang dari 0 tiap jendela — ditaruh di kanvas yang jendelanya chip rentang, ia jadi contoh paling murni dari bug #1. Karena itu **gambar NET HARIAN, bukan kumulatif**, sampai #1 selesai.
Yang wajib ikut dan sering dilupakan: mati di kerangka intraday (sumbu timestamp vs string tanggal), agregasi ke W/M (jangan biarkan deret harian memperpanjang sumbu waktu lilin bulanan), ikut dipotong Bar replay, hari tanpa data KOSONG bukan nol, dan legenda menyebut satuannya **lembar mentah**.
Biaya realistis: **1,5–2 hari**, bukan 4 jam. Ada satu prasyarat pengukuran — lihat cacat fatal #1 di bawah.

**8. `/grafik` — Measure dan Magnet di bilah alat gambar**
Kerjakan: naikkan alat `measurement` (DatePriceRange/DateRange, sudah ada di pustaka) ke `ALAT_UTAMA` yang sekarang cuma tujuh entri; tambahkan snap titik gambar ke O/H/L/C terdekat lalu bulatkan lewat `keFraksi()`.
Kenapa di sini: dua alat paling sering dipakai di TradingView, keduanya nyaris gratis, dan snap-ke-fraksi khas PAPAN — garis yang tak jatuh di tick BEI menjanjikan harga yang tak ada di papan pesanan.
Biaya: **±3–4 jam** keduanya. Jalur snap pustaka tertutup (`applySnap` protected, kita pakai FSM sendiri), jadi ditulis sendiri ~15 baris.

**9. `/grafik` — "Ke tanggal" di kaki kanvas**
Kerjakan: `DatePicker` kanonis + `timeScale().setVisibleRange()`.
Kenapa di sini: riwayat 10 tahun praktis setengah tak terjangkau tanpa ini, dan di telepon menggeser kanvas puluhan kali tak masuk akal. Murah, komponennya sudah kanonis, dan jalurnya sama dengan #1 — kerjakan menempel di belakangnya.
Biaya: **±2 jam**.

**10. `/grafik` — satu baris tautan keluar, sadar-kunci-akses**
Kerjakan: pil `Fundamental · Kartu · Musiman` di kaki, tiap pil melewati `boleh(kunci)` dan menampilkan gembok kalau terkunci — bukan tautan mati.
Kenapa paling belakang meski paling sering diusulkan: dua dari tiga tujuannya hari ini cacat (Stock Detail tak bisa dituju sampai #2 selesai, Kartu cuma 3 emiten sampai #6 diputuskan), dan `/grafik` dijaga `PenjagaHalaman` sementara tujuannya punya kunci masing-masing — pil yang dipasang keras jadi permukaan navigasi kedua yang tak bisa diatur dari tab Akses. Bilah atas juga sudah pecah tiga baris di ≤700px dengan kanvas terkunci 340px; taruh di KAKI, jangan di kepala.
Biaya: **±2 jam** sesudah #2 dan #6.

---

## Rusak vs baru — batas tegasnya

| | Butir | Sifat |
|---|---|---|
| **Rusak** | 1–6 | Kode yang sudah tayang memberi angka/halaman yang salah tanpa satu pun galat. Semuanya lolos `tsc`, build hijau, dan tangkapan layar. Total ±2 hari. |
| **Baru** | 7–10 | Permukaan tambahan. Nol di antaranya boleh mulai sebelum 1–6 mendarat dengan buktinya di `docs/jejak-permintaan.md`. |

Alasannya bukan disiplin demi disiplin: #7 (pane asing) dan #10 (tautan keluar) masing-masing **memburuk** kalau dikerjakan lebih dulu — yang satu menambah deret yang salahnya tak kelihatan di atas kanvas yang belum betul, yang satu menambah tautan ke halaman yang belum bisa menerima emiten.

---

## Fitur TradingView yang sengaja TIDAK ditiru

| Fitur | Kenapa tidak |
|---|---|
| **Preset gabungan rentang+kerangka** ("3 months in 1 hour") | Intraday PAPAN: 5m/15m/30m ±1 bulan, 1h ±2 tahun, 4h dirakit dari 1h, **nol diarsipkan**. Preset itu jadi label yang menjanjikan lalu menggambar potongan jauh lebih pendek, tanpa galat. Gantinya sudah ada di butir #4: chip yang melampaui riwayat dinonaktifkan dengan alasannya. |
| **Create alert** | Tak ada harga real-time (layar kita sendiri menuliskannya), tak ada lilin jam-an terarsip, dan pipa panennya merah empat hari berturut-turut karena IDX 403. Alarm yang tak berbunyi tak bisa dibedakan dari "tak ada sinyal" — pengguna membaca diamnya sebagai kabar baik, di jalur keputusan uang. |
| **Fundamentals sebagai deret di atas chart** (Income statement / Balance sheet / Cash flow) | `keuangan/` kuartal DISKRET vs `keuangan_idx/` interim KUMULATIF, kunci periode SAMA, rasio terukur TLKM 1,96× ASII 1,99× ICBP 2,08×. Ditambah XBRL berkunci tanggal PERIODE sementara laporannya sampai ke pasar berminggu-minggu kemudian — grafik yang menggambar TW2 di 30 Juni memberi tahu pembaca sesuatu yang pasar belum tahu. Angka salah di tabel dibaca sebagai angka; di grafik dibaca sebagai TREN. Ditinjau ulang hanya kalau tanggal terbit ikut dipanen. |
| **COMMUNITY / Store indicators** (Editors' picks, Top, Trending, Pine) | Skrip tanpa kalibrasi di produk yang aturannya melarang skor tunggal tanpa kalibrasi. Sumber kesalahannya bertambah, kemampuan memeriksanya tidak. |
| **Publish idea / lapisan sosial** | Forum sendiri belum punya rute (butir #3). Menambah lapisan publikasi di atas fitur yang layarnya putih adalah urutan yang terbalik. |
| **Indicator templates komunitas & Layout multi-chart** | Bukan salah, cuma tak menjawab pertanyaan siapa pun di IDX ritel sebelum sepuluh butir di atas selesai. Ditolak karena urutan, bukan karena prinsip — boleh diajukan lagi nanti. |

**Yang JANGAN dianggap belum ada** (dua sudut mengusulkannya sebagai kekurangan, keduanya salah): **Compare symbols** dan **Bar replay** sudah terbangun sebagai #187 — `GrafikEmiten.tsx:409` dan `:431`, lengkap dengan pemaksaan skala persentase, batas tiga pembanding, putar-otomatis, dan potongan-di-hulu yang benar. Jangan dibangun ulang, dan **jangan dihapus** atas nama argumen epistemik soal replay.

---

## Butuh keputusan Johan (tiga, tak lebih)

**A. Kartu Analisa — cakupan 3 dari 964.**
&nbsp;&nbsp;(i) Sembunyikan dari `MENU_ITEMS` sampai cakupan layak (halaman tetap hidup lewat URL); atau
&nbsp;&nbsp;(ii) tetap di menu, tapi kartunya berbunyi "baru 3 emiten"; atau
&nbsp;&nbsp;(iii) jalankan pemanennya untuk 964 emiten — pekerjaan tersendiri, biayanya belum diukur.
Guard halaman kosong (butir #6) dikerjakan apa pun jawabannya.

**B. Forum — tayang atau cabut.**
&nbsp;&nbsp;(i) Daftarkan `/forum` + `/forum/:tag` (kodenya lengkap: 533 baris + edge function `forum-kirim`); atau
&nbsp;&nbsp;(ii) cabut tiga tautan + satu baris janji di LoginModal, simpan kodenya.
Rute `path="*"` dipasang duluan, tanpa menunggu jawaban.

**C. Tautan lintas halaman menembus jenjang atau tidak.**
&nbsp;&nbsp;(i) Pil tujuan yang terkunci tetap tampil dengan gembok sebagai ajakan naik jenjang; atau
&nbsp;&nbsp;(ii) disaring `useAksesHalaman()` seperti rail, jadi yang tak berhak tak melihatnya sama sekali.
Ini juga menentukan apakah katalis Beranda ("BBRI melesat 12%") boleh dipindah dari `/stocks` yang terbuka ke `/grafik` yang berkunci — **jangan** dipindah sebelum C dijawab.

---

## Cacat fatal yang masih ada di rekomendasi ini

1. **Butir #7 punya prasyarat pengukuran yang belum saya lakukan.** Salah satu sudut melaporkan harga/volume chart (Yahoo) ADJUSTED sementara aliran asing/value/frekuensi (IDX) MENTAH — contohnya BBCA 2 Jan 2020 rasio volume 5,0× karena split Okt 2021, dan 180 emiten punya >5% hari yang selisihnya >2%. Saya **tidak memverifikasi ulang angka itu**. Kalau benar, pane asing berdampingan dengan pane volume adalah dua sumbu bernama sama yang artinya berbeda sampai lima kali, tanpa galat. **Langkah pertama #7 adalah satu skrip pengukur rasio `volume_ohlc/volume_idx` di seluruh emiten** — bukan menulis komponen. Kalau rasionya terkonfirmasi, #7 turun peringkat atau berubah bentuk.
2. **Semua rujukan `file:baris` di bahan adu basi**, dan meleset makin jauh makin ke bawah berkas (`GrafikEmiten.tsx` 2.326 baris, bukan 1.896/1.899/2.040 seperti diklaim tiga sudut berbeda). Angka baris di dokumen ini saya periksa hari ini, tapi berkas itu sedang aktif disunting — **verifikasi ulang sebelum menyalin ke `docs/jejak-permintaan.md`**, jangan percaya dokumen ini lebih dari satu hari.
3. **Alat verifikasi kita buta terhadap butir #1.** `tsc`, build, dan tangkapan layar tiga viewport akan lulus semuanya sebelum maupun sesudah perbaikan. Satu-satunya bukti yang mungkin adalah probe `containerRef.dataset` — jadi perbaikan #1 belum selesai sebelum probe-nya dipisah jadi "dimuat" vs "terlihat" dan hasilnya dicatat sebagai bukti. Tanpa itu, #1 dilaporkan selesai tanpa cara membuktikannya, dan itu bentuk kegagalan yang sedang kita perbaiki.
4. **Bilah kendali `/grafik` sudah penuh di 412px** — di ≤700px toolbar pecah tiga baris penuh dengan kanvas terkunci 340px. Butir #8, #9, #10 masing-masing menambah kendali. Kalau ketiganya mendarat tanpa keputusan penataan, kanvas di telepon terdorong melewati batas lipatan nyata 810px. **Kerjakan satu per satu, verifikasi 412px per penambahan** — bukan verifikasi sekali di akhir.
5. **Butir #10 belum punya tujuan yang utuh.** Kalau keputusan A jatuh ke (i) sembunyikan, pil "Kartu" hilang dan tinggal dua tujuan — nilainya menyusut, dan ia mungkin tak layak jadi sepuluh besar sama sekali. Saya biarkan di posisi 10 dengan sadar; siapa pun yang mengerjakannya boleh mencoretnya kalau A menjawab (i).
6. **Tak ada satu pun butir di daftar ini yang memperbaiki pipa panen** — statistik harian merah empat hari, kabar berhenti 18 Agu 12:55. Sepuluh butir ini membuat PAPAN terasa jauh lebih utuh sambil datanya tetap basi. Itu risiko yang diterima sadar untuk sesi ini, dengan syarat `docs/status-panen.md` diperbarui di sesi yang sama supaya basinya terlihat, bukan tersembunyi di balik antarmuka yang mulus.