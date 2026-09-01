# Rantai Panen ke Halaman PAPAN: Peta Lengkap dan Titik Putusnya

Disusun 29 Agustus 2026. Semua angka kesegaran di dokumen ini dibaca ulang langsung dari isi berkas pada pagi 29 Agustus, bukan disalin dari `docs/status-panen.md`.

**Jawaban singkat untuk pertanyaan Johan.** Rantainya bukan satu pipa, melainkan **dua pipa paralel yang cakupannya berbeda** dan tidak saling menutupi: GitHub Actions di runner rumah (10 langkah, cron 18:30 WIB hari kerja) dan tiga berkas `.bat` di Task Scheduler (belasan langkah lain, ONLOGON dan 18:00). Sebagian besar rantai memang jalan. Yang membuat halaman terasa "tidak nyambung" ada tiga sebab konkret: (a) sembilan baris di ketiga `.bat` mengandung byte BACKSPACE menggantikan huruf `b`, sehingga lima pembangun turunan tidak pernah benar benar dipanggil sejak baris itu ditulis, dan justru baris itulah yang ditulis untuk memperbaiki keluhan Johan 28 Agustus; (b) gerbang kesegaran CI hanya memeriksa satu berkas turunan dari belasan yang ada, jadi CI tetap hijau walau turunan lain basi; (c) kegagalan di dalam `.bat` ditelan pola `if errorlevel 1 echo ... - lanjut`, jadi gagal tidak meninggalkan jejak merah di mana pun.

---

## 1. Rantai dalam satu gambar

Lima lapis, berurut dari sumber ke mata pembaca.

```
LAPIS 1  PANEN            API luar  ->  berkas mentah + json
         Pemicu A : GitHub Actions runner rumah (service Windows, cron 18:30 WIB, Senin-Jumat)
         Pemicu B : Task Scheduler PAPAN-BukaLaptop  (saat login)
         Pemicu C : Task Scheduler PAPAN-PanenSore   (tiap hari 18:00)
         Pemicu D : tangan Johan (kuartalan, setoran kontributor, riset)

LAPIS 2  DISK             data-idx/json/**  ,  data-idx/radar/**  ,  arus-pasar/keluaran/**
         Ini satu satunya "kebenaran" yang dilihat halaman. Tidak ada basis data.

LAPIS 3  PEMBANGUN        json mentah  ->  json turunan  (nol jaringan)
         kartu_analisa.py, bangun-screener.mjs, pola-screener.ts, bangun_aliran_investor.py,
         bangun_bidoffer.py, bangun_harga_terakhir.py, bangun_rezim_pasar.py, petakan_grup.py,
         bangun_kategori_broker.py, bangun_broker_tahunan.py, bangun_intraday_1h.py, dan lainnya.
         Dipicu dari LAPIS 1 yang sama, tetapi cakupannya TIDAK sama antara CI dan .bat.

LAPIS 4  PENYAJIAN
         Dev      : app/vite.config.ts  serveRepoDir()  memasang tiga folder repo ke URL
         Produksi : npm run build  ->  app/scripts/copy-static-data.mjs menyalin ketiga folder
                    itu ke app/dist, lalu Vercel menyajikannya sebagai berkas statis biasa

LAPIS 5  HALAMAN          fetch() di app/src  ->  cache modul  ->  komponen React
         Sekitar 50 titik fetch, 9 modul cache, sebagian tanpa batas umur.
```

Yang penting dimengerti dari gambar ini: **Lapis 1 sampai 3 tidak punya satu pemilik.** Folder `data-idx/json/ohlc/` misalnya ditulis oleh tiga skrip berbeda dari dua mekanisme berbeda, dan tidak ada yang menjaga siapa jalan lebih dulu. Sedangkan Lapis 4 dan 5 sudah terbukti sehat secara mekanisme, jadi kalau halaman menampilkan angka basi, sebabnya hampir selalu ada di Lapis 1 sampai 3.

---

## 2. Tabel per halaman

Diurut dari yang paling putus. Kolom "Isi terakhir" memakai stempel di dalam berkas bila ada, karena `mtime` bisa berubah tanpa isi berubah. Acuan segar hari ini: **OHLC bertanggal 2026-08-28 untuk 962 dari 964 berkas** (`collections.Counter` atas ruas `akhir` di `data-idx/json/ohlc/*.json`).

| Halaman | Berkas yang dibutuhkan | Pembangun | Pemicu | Isi terakhir | Status rantai |
|---|---|---|---|---|---|
| Broker Summary tab Flow (Aliran Investor) | `aliran_investor.json` | `scripts/bangun_aliran_investor.py` | **tidak ada**. Satu satunya baris pemanggil ada di `JALANKAN_PANEN_SORE.bat:78` dan `JALANKAN_BUKA_LAPTOP.bat`, dan baris itu rusak | ruas `akhir` = **2026-08-27** | **PUTUS**, terlihat pembaca |
| Kuli Papan | `bidoffer.json` | `scripts/bangun_bidoffer.py` | sama, `JALANKAN_PANEN_SORE.bat:80` rusak | ruas `tanggal` = **2026-08-27**, 833 emiten | **PUTUS**, terlihat pembaca |
| Kalkulator (cadangan harga), kamusEmiten, tanyaPapan | `harga_terakhir.json` | `scripts/bangun_harga_terakhir.py` | sama, `JALANKAN_PANEN_SORE.bat:82` rusak | `bulan` = `2026-08`, mtime 28 Agu 21:31 | otomasi **PUTUS**, isi kebetulan segar karena dijalankan tangan |
| Konsumen `app/src/lib/dasbor/rezimPasar.ts` | `rezim_pasar.json` | `scripts/bangun_rezim_pasar.py` | sama, baris di `JALANKAN_BUKA_LAPTOP.bat` dan `JALANKAN_OTOMATIS.bat` bagian `[6/8]` rusak | `dibangun` = **2026-08-28** | otomasi **PUTUS**, isi kebetulan segar |
| Screener, Watchlist, Bedah | `data-idx/json/kartu/*.json` | `scripts/riset/kartu_analisa.py --semua --tulis` | `panen-harian-rumah.yml` + dua `.bat` | `kartu/BBCA.json` ruas `tgl` = **2026-08-27** sementara OHLC sudah 28 | **RAPUH**, gerbang CI sudah merah |
| Halaman fundamental non harga (Screener, Stock Detail) *(pemetaan halaman: DUGAAN)* | `fundamental/*.json` ruas `sector`, `eps`, `pe`, `der`, `roe`, `f_score` | `fetch_fundamental` lewat `.github/workflows/update-fundamental.yml` | cron `0 23 28-31 * *` **tidak menyala sejak 31 Juli**, 29 hari | ruas `updated` = **2026-08-17 13:37**, tanggal yang tidak cocok dengan run CI mana pun | **PUTUS** |
| Profil emiten, pengendali *(pemetaan halaman: DUGAAN)* | `profil/`, `profil_stockbit/`, `pengendali.json` | `panen_profil_idx.py`, `panen_profil_stockbit.py`, `panen_pengendali.py` | **nihil** di seluruh `.yml` dan `.bat` | 22 Agu, 23 Agu, 20 Agu | **PUTUS** |
| Halaman kepemilikan KSEI | `kepemilikan/` | `panen_ksei_balancepos.py` | **nihil** | tidak diukur sesi ini | **PUTUS** |
| Apa pun yang membaca kuartal diskret | `keuangan_idx_diskret/` | `turunkan_kuartal_diskret.py` | ada lokal, tetapi foldernya di `.gitignore` | ada di laptop, **nol di produksi** | **PUTUS di produksi saja** |
| Panel setoran broker per emiten | `broker_emiten/<KODE>/` | `panen_broker_emiten.py` | manusia, **disengaja** (komentar `panen-harian-rumah.yml:139-142`) | `broker_emiten/BBCA/` isi satu berkas, 21 Agu | PUTUS **by design** |
| Laporan keuangan kuartalan | `keuangan_idx/` | `panen_keuangan_idx.py` | tangan, **disengaja** (komentar `panen-harian-rumah.yml:26-28`) | tidak diukur | PUTUS **by design** |
| Tidak ada pembaca | `tinjauan_deepdive.json` | `scripts/riset/tinjau_deepdive.py` | **nihil**, docstring skripnya sendiri mengaku dikerjakan tangan | mtime 22 Agu | **PUTUS di dua ujung**, nol halaman terdampak |
| Screener, Harian Papan, Jago Papan, IPO, Pola Screener, Kategori Broker, Broker Tahunan, Intraday 1H, Grup Konglomerat, Rekomendasi | `screener.json`, `harian_papan/`, `jago_papan/`, `ipo.json`, `pola_screener.json`, `kategori_broker.json`, `broker_tahunan/`, `intraday_1h/`, `grup_konglomerat.json`, `rekomendasi` | `bangun-screener.mjs`, `pola-screener.ts`, `bangun_kategori_broker.py`, `bangun_broker_tahunan.py`, `bangun_intraday_1h.py`, `petakan_grup.py`, `rekap_preset.py` | **hanya dua `.bat` lokal**, nol di CI | mtime 28 Agu antara 18:56 dan 21:31 | **RAPUH**, hidup mati bersama laptop |
| BrokerSummaryV2 (7 tab), TraderPapan, WhalesPapan | `broker_harian/`, `ohlcv_stockbit/` | `panen_broker_harian.py --varian` | CI langkah 3d, **gagal di run 28 Agu** | data ada, satu run gagal | **RAPUH** |
| Neo Papan (8 tab) | `neoPapanData`, `ohlcv_stockbit/`, `kepemilikan/` | beragam | beragam | cache peramban tanpa batas umur | **RAPUH**, lihat butir 5 dan 6 di bawah |
| Halaman pemakai rasio Stockbit | `keystats_stockbit/`, `info_stockbit/` | `panen_keystats_stockbit.py`, `panen_info_stockbit.py` | dua `.bat`, gagal ditelan `errorlevel` | `dipanen_pada` = **2026-08-23**, enam hari | **RAPUH** |
| BadgeRapor | `data-idx/json/bt/` | `scripts/riset/bt_papan.py` | tangan, alat riset | mtime 26 Agu | RAPUH **by design**, tanpa penanda umur di layar |
| Statistik Berkala mingguan dan bulanan | `ws_*.json`, `ms_*.json`, `index_weekly.json`, `index_monthly.json` | `parse_idx_weekly.py`, `parse_idx_monthly.py` | `JALANKAN_BUKA_LAPTOP.bat:40` memanggil `JALANKAN_OTOMATIS.bat`, langkah `[3/8]` dan `[3b/8]` | mtime **28 Agu 18:50**, tiga menit sesudah task ONLOGON sukses | **TERSAMBUNG** |
| Beranda, kartu Ringkasan Pasar | `index.json` + berkas per hari | `parse_idx_pdf.py`, `panen_ihsg.py` | `update-rumah.yml` dan CI harian | segar | TERSAMBUNG, **tetapi labelnya salah**, lihat butir 1 dan 2 |
| Stock Detail bagian harga | `fundamental/*.json` ruas `last_price`, `prev_close` | `segarkan_harga_fundamental.py` | CI langkah 3b, tiap hari kerja | `last_price` BBCA 6400, cocok bar OHLC terakhir | **TERSAMBUNG** |

---

## 3. Daftar PUTUS yang bertahan sesudah sanggahan

Diurut dari yang paling merugikan pembaca halaman, bukan dari yang paling rumit secara teknis.

**1. Beranda menyebut angka hari berjalan sebagai "penutupan" tanpa syarat.**
`app/src/views/dasbor/Beranda.tsx:100-134`, fungsi `RingkasanPasar`. Grep `.sementara` di berkas itu nol hasil, padahal objek `hari` yang sama sudah membawa ruas `sementara` dan `sumber`. Baris 129 sampai 131 mencetak `Sumber angka: Statistik Ringkas IDX · penutupan {hari.date_id}`.
Yang dilihat pemakai: headline IHSG di halaman utama, sebelum bursa tutup, dilabeli penutupan resmi. Dokumentasi `dataHarian.ts:17-23` mencatat selisih terukur nyata pada 20 Agustus 2026: cadangan menulis 6.498,60 (+1,63%) sementara PDF resmi menyebut 6.501,585 (+1,68%), meleset 2,985 poin.

**2. Ruas penanda "angka sementara" tidak pernah ditulis ke `index.json`.**
Dideklarasikan di `app/src/lib/dasbor/dataHarian.ts:25`. Penulisnya `scripts/parse_idx_pdf.py:480-488` memakai allowlist tujuh kunci tanpa `sementara`, dan `scripts/panen_ihsg.py:186-189` hanya menambal ruas `sumber`. Diverifikasi ke data asli: hitungan kata `sementara` di `data-idx/json/index.json` adalah **0**.
Yang dilihat pemakai: badge "angka sementara" di IndeksDunia, SektorIndeks, TopBroker, dan TopStocks saat ini benar, tetapi hanya karena kebetulan membaca berkas per hari. Kode baru mana pun yang mengikuti tipe `TanggalIndex` akan diam diam tidak pernah menyalakan badge itu, tanpa galat TypeScript karena ruasnya opsional.

**3. Sembilan baris `.bat` berisi byte BACKSPACE, lima pembangun mati senyap.**
`JALANKAN_PANEN_SORE.bat:78,80,82` (tiga), `JALANKAN_BUKA_LAPTOP.bat` (lima), `JALANKAN_OTOMATIS.bat` bagian `[6/8]` (satu). Byte `0x08` menggantikan garis miring balik tepat sebelum `bangun_`, sehingga perintah nyatanya `python "scripts<BACKSPACE>angun_aliran_investor.py"`.
Bukti tambahan yang muncul saat menulis dokumen ini: grep pola `bangun_harga_terakhir` ke seluruh repo tidak menemukan satu pun `.bat`, hanya docstring skrip dan dokumen. Itu justru konfirmasi, bukan bantahan, karena teks di `.bat` sudah bukan `bangun_` lagi melainkan `angun_`.
Yang dilihat pemakai: Broker Summary tab Flow dan Kuli Papan menampilkan tanggal **27 Agustus** padahal 962 emiten sudah punya bar 28 Agustus. Ini persis keluhan Johan 28 Agustus, dan baris yang rusak itu adalah baris yang ditulis untuk memperbaikinya.

**4. `update-fundamental.yml` tidak menyala 29 hari.**
`gh run list --workflow update-fundamental.yml --limit 8` menampilkan run terakhir 31 Juli 2026 lalu langsung melompat ke Juni. Nol run di Agustus walau cron `0 23 28-31 * *` sudah lewat minimal sekali. `gh workflow list --all` menyebut statusnya `active`, jadi bukan dinonaktifkan.
Yang dilihat pemakai: sektor, EPS, PE, DER, ROE, dan F Score di berkas fundamental berhenti di **17 Agustus 13:37**, tanggal yang bahkan tidak cocok dengan run CI mana pun. Dugaan yang belum terbukti: berkas itu ditulis dari panen tangan di laptop.

**5. Tujuh dari sembilan modul cache tidak punya batas umur.**
`brokerEmitenV2.ts:45-56`, `kuliPapanData.ts:33-42`, `neoPapanData.ts:9-19`, `brokerProfilKsei.ts:22-30` dan `131-139`, `rasioTambahanKeystats.ts:91-201`, `watchlistIndeks.ts:222-250`, `seasonalityData.ts:29`. Tiga di antaranya mengambil endpoint yang persis sama dengan `ohlcvKaya.ts:69`, yaitu `/data-idx/json/ohlcv_stockbit/${kode}.json`, dan `ohlcvKaya.ts:45` justru sudah diberi TTL 30 menit dengan komentar "audit kesegaran 27 Agu §2, tanpa ini data halaman membeku sampai muat ulang penuh".
Yang dilihat pemakai: tab yang dibiarkan terbuka melewati jam panen tetap menampilkan angka dari pemuatan pertama, tanpa galat, tanpa penanda.

**6. Neo Papan sebagian besar tidak menyebut periode datanya.**
Komponen `Sumber` di `app/src/views/dasbor/neo-papan/bersama.tsx:27-29` hanya menerima `children`, tidak pernah menerima tanggal. Contoh `BalanceTab.tsx:129` menulis "Kepemilikan bulanan resmi KSEI, per tipe investor" tanpa menyebut bulan mana.
Catatan kejujuran: klaim "seluruh delapan tab" **tidak bertahan**. `TransaksiTab.tsx:208` merender `hariTerakhirBroker.tanggal`, dan `StalkerTab.tsx:400` merender rentang jendela di judul grafik. Jadi yang benar: enam dari delapan tab tanpa penanda periode.

**7. Berkas di `.gitignore` tidak pernah sampai ke produksi, dan gagalnya senyap.**
`.gitignore` memuat `data-idx/json/keuangan_idx_diskret/`. Berkasnya ada di laptop (`AADI.json`, `AALI.json`, `ABBA.json`), tetapi `curl https://papan-idx.vercel.app/data-idx/json/keuangan_idx_diskret/AADI.json` membalas HTTP 200 dengan `Content-Type: text/html` dan `Content-Disposition: filename="index.html"`.
Yang dilihat pemakai: bukan pesan galat, melainkan halaman kosong atau nilai hilang, karena `r.ok` bernilai true dan kegagalan baru muncul sebagai `SyntaxError` saat `r.json()` mencoba mengurai HTML. Hanya tiga titik fetch yang menjaga ini: `brokerEmiten.ts:104-119`, `candleStockbit.ts:34`, `intradayWhales.ts:133`. Sekitar 47 titik lain memakai pola `r.ok ? r.json() : Promise.reject(...)` yang tidak menangkapnya.

**8. Gerbang kesegaran hanya menjaga satu berkas.**
`scripts/cek_kesegaran.py`, fungsi `periksa()`, membuka satu path literal `data-idx/json/kartu/ringkas.json` dan membandingkannya dengan modus OHLC. Tidak ada glob atau loop untuk turunan lain.
Akibatnya `screener.json`, `harian_papan/`, `jago_papan/`, `ipo.json`, `pola_screener.json`, `valuasi_historis.json`, `aliran_investor.json`, `bidoffer.json`, `harga_terakhir.json`, `rezim_pasar.json`, `grup_konglomerat.json`, `kategori_broker.json`, dan `broker_tahunan/` boleh basi berhari hari sementara CI tetap mencetak lolos.

**9. Dua penulis untuk folder `ohlc/` yang sama, tanpa urutan.**
`panen_ohlc.py` jalan lewat GitHub Actions dengan mode harian, menambahkan satu bar Yahoo. `gabung_ohlc_stockbit.py` jalan hanya lewat dua `.bat`, dan baris 341 berbunyi `oh = baca(p_y) or baca(p_out)`, artinya basisnya arsip Yahoo beku dan hasil CI hari itu hanya cadangan bila arsip tidak ada. Grep nama skrip kedua ke seluruh `.github/workflows/*.yml` nihil.
Siapa jalan terakhir hari itu yang menang, dan urutannya tidak dijamin oleh apa pun.

**10. Delapan skrip panen tanpa pemicu otomatis.**
`panen_pengendali.py`, `panen_ipot_arsip.py`, `panen_ksei_balancepos.py`, `panen_sektor_idx.py`, `panen_profil_idx.py`, `panen_profil_stockbit.py`, `panen_pembanding.py`, `bangun_broker_tahunan_semua.py`. Grep nihil di seluruh `.yml` dan seluruh `.bat`. Stempel: `pengendali.json` 2026-08-20, `profil_stockbit/BBCA.json` 2026-08-23, `profil/BBCA.json` 2026-08-22.

**11. Ketiga `.bat` tidak pernah masuk git.**
`git check-ignore -v` mencocokkan ketiganya ke `.gitignore:10:*.bat`, dan `git ls-files` mengembalikan kosong. Tidak pernah ter diff, tidak pernah ter review, tidak punya riwayat. Bug backspace butir 3 bertahan sekian lama justru karena ini.

**12. `PAPAN-PanenSore` menolak jalan dan tidak akan jalan di baterai.**
`Get-ScheduledTaskInfo PAPAN-PanenSore` mengembalikan `LastTaskResult=2147946720`, yaitu `0x800710E0`, Win32 4320, "The operator or administrator has refused the request". Setelan `DisallowStartIfOnBatteries=True` dan `LogonType=Interactive`. Task ini satu satunya pemicu terjadwal waktu untuk seluruh rantai Stockbit sore. Kalau laptop tidak dicolok pada pukul 18:00, ia tidak jalan sama sekali dan tidak meninggalkan galat lain.

**13. `panen_broker_harian` gagal di run CI terakhir.**
`gh run view 33212638452` memuat anotasi `! panen_broker_harian gagal`. Empat run terdekat 24 sampai 27 Agustus bersih, jadi ini sesekali, bukan selalu. `continue-on-error: true` membuatnya hanya muncul sebagai teks peringatan, bukan langkah merah.

**14. Run CI harian telat sekitar sepuluh jam.**
Cron `30 11 * * 1-5` yaitu 11:30 UTC, tetapi run 28 Agustus baru mulai `2026-08-28T21:27:31Z`. Runner adalah service Windows dengan `StartType=Automatic` dan status `Running`, jadi ini antrean menunggu PC tersedia, bukan kegagalan. Efek nyatanya: turunan yang bergantung pada CI selesai jauh melewati jam yang diasumsikan penulis `.bat`.

**15. `tinjau_deepdive.py` yatim di dua ujung.**
Tidak dipanggil dari mana pun, dan grep `tinjauan_deepdive` di `app/` nol hasil. Berkasnya 22 Agustus. Tidak ada pembaca, jadi kerugian ke pemakai nol. Dicatat supaya tidak ditambal sia sia.

**16. Komentar `/api/live-harga` menyesatkan.**
`app/src/lib/dasbor/hargaLive.ts:1-5` menulis bahwa endpoint ini "404 di dev lokal". Nyatanya `curl -i http://localhost:5176/api/live-harga?kode=BBCA` membalas HTTP 200 dengan `Content-Type: text/html` dan panjang 4957 byte, identik dengan fallback SPA. Fungsionalnya aman karena ada try catch pembungkus. Kerugiannya hanya ke developer yang mencari log 404 yang tidak akan pernah ada.

---

## 4. Yang GUGUR, jangan diperiksa ulang

**GUGUR 1. "Parser mingguan dan bulanan putus sejak jadwal dimatikan 27 Agustus."**
Salah. Rantainya hidup lewat jalur yang tidak dibuka pemeriksa: `JALANKAN_BUKA_LAPTOP.bat:40` memanggil `call JALANKAN_OTOMATIS.bat auto`, dan `JALANKAN_OTOMATIS.bat` langkah `[3/8]` dan `[3b/8]` memanggil `parse_idx_weekly.py --semua` dan `parse_idx_monthly.py --semua`. Bukti: `PAPAN-BukaLaptop` sukses 28 Agustus 18:48 dengan `LastTaskResult=0`, `index_weekly.json` bermtime 28 Agustus 18:50:38, `index_monthly.json` 18:50:54, dan `git log -- data-idx/json/index_weekly.json` memuat commit "data: update IDX 28-Aug-26" pukul 18:51:23.
Pelajaran metodologis: grep hanya ke `.yml` tidak cukup, karena satu `.bat` memanggil `.bat` lain.

**GUGUR 2. "Seluruh delapan tab Neo Papan tidak menampilkan tanggal."**
Terlalu luas. `TransaksiTab.tsx:208` dan `StalkerTab.tsx:400` menampilkannya. Klaim yang bertahan adalah enam dari delapan tab, dan bahwa komponen `Sumber` memang tidak dirancang menerima tanggal.

**GUGUR 3. "Komentar `vite.config.ts` benar, hosting menyajikan folder apa adanya."**
Komentarnya memang basi, tetapi persoalannya sudah diselesaikan di tempat lain yang tidak disebut komentar itu. `app/package.json` menjalankan `tsc -b && vite build && node scripts/copy-static-data.mjs`, dan skrip itu menyalin `data-idx/json`, `data-idx/radar`, serta `arus-pasar/keluaran` ke `app/dist` sebelum Vercel membekukan keluaran. Diuji langsung ke produksi: `daftar_emiten.json` balas JSON asli, `broker_tahunan/BBCA/2020.json` balas 942.805 byte JSON, PDF di `arus-pasar/keluaran` balas PDF asli. Rewrite catch all `/(.*)` di `vercel.json` tidak menimpa berkas statis nyata.
Catatan konflik yang perlu Johan tahu: satu pemeriksa menambahkan bahwa `app/public/data-idx/` tidak ada di disk dan `docs/status-panen.md:47-49` mengaku build Vercel belum pernah diuji. Dua duanya benar sebagai fakta, tetapi tidak relevan sebagai bantahan, karena mekanismenya bukan `public/` melainkan `copy-static-data.mjs`. Bukti `curl` ke URL produksi lebih kuat daripada dokumen yang mengaku belum menguji.

**GUGUR 4. "Runner CI bergantung pada jendela Claude atau sesi login Johan menyala."**
`Get-Service actions.runner.JIAkbar-idx-dashboard.papan-JOHANDUOS` mengembalikan `Status=Running`, `StartType=Automatic`. Ia service, bukan aplikasi interaktif. Tetap bergantung PC menyala, tetapi tidak bergantung Johan login.

**GUGUR 5 (sebagian). "Empat pembangun korban bug backspace semuanya menghasilkan data basi."**
Yang terbukti basi hari ini hanya dua: `aliran_investor.json` dan `bidoffer.json`, keduanya 27 Agustus. Dua lainnya justru segar: `rezim_pasar.json` ruas `dibangun` = 2026-08-28, dan `harga_terakhir.json` bermtime 28 Agustus 21:31. Penjelasan paling masuk akal, dan ini **DUGAAN**: keduanya dijalankan tangan pada 28 Agustus malam. Bugnya tetap nyata dan tetap berarti tidak ada otomasi untuk keempatnya.

---

## 5. Urutan perbaikan

Diurut dari untung terbesar per biaya terkecil. Tiap langkah punya kriteria terima berupa perintah yang bisa Johan jalankan sendiri dari akar repo `IDX Statistik`.

### Langkah 1. Bersihkan sembilan byte backspace di tiga `.bat`

Ganti byte `0x08` dengan garis miring balik. Ini satu perintah, bukan penulisan ulang berkas.

```bash
python -c "
for f in ['JALANKAN_PANEN_SORE.bat','JALANKAN_BUKA_LAPTOP.bat','JALANKAN_OTOMATIS.bat']:
    b=open(f,'rb').read()
    n=b.count(b'\x08')
    open(f,'wb').write(b.replace(b'\x08', b'\\\\'))
    print(f, 'diganti', n)
"
```

**Kriteria terima**, harus mencetak nol tiga kali:

```bash
python -c "
for f in ['JALANKAN_PANEN_SORE.bat','JALANKAN_BUKA_LAPTOP.bat','JALANKAN_OTOMATIS.bat']:
    print(f, open(f,'rb').read().count(b'\x08'))
"
```

**Kriteria terima kedua**, sesudah `.bat` dijalankan sekali, dua angka ini harus sama:

```bash
python -c "
import json,glob,collections
c=collections.Counter(json.load(open(f,encoding='utf-8')).get('akhir') for f in glob.glob('data-idx/json/ohlc/*.json'))
print('OHLC:', c.most_common(1)[0])
print('aliran:', json.load(open('data-idx/json/aliran_investor.json',encoding='utf-8'))['akhir'])
print('bidoffer:', json.load(open('data-idx/json/bidoffer.json',encoding='utf-8'))['tanggal'])
"
```

### Langkah 2. Hentikan kegagalan senyap di `.bat`

Pola `if errorlevel 1 echo (... gagal - lanjut)` membuat setiap kegagalan tak berjejak. Ubah menjadi mengumpulkan penanda lalu keluar tidak nol di akhir, misalnya `if errorlevel 1 set GAGAL=1` di tiap langkah dan `if defined GAGAL exit /b 1` di baris terakhir.

**Kriteria terima**: sesudah sengaja merusak nama satu skrip, `JALANKAN_PANEN_SORE.bat & echo KODE=%ERRORLEVEL%` harus mencetak `KODE=1`, bukan `KODE=0`.

### Langkah 3. Perluas `cek_kesegaran.py` ke seluruh turunan

Ubah `periksa()` dari satu path literal menjadi daftar pasangan `berkas, ruas tanggal`. Isi minimal daftarnya: `kartu/ringkas.json`, `aliran_investor.json`, `bidoffer.json`, `rezim_pasar.json`, `screener.json`, `pola_screener.json`, `ipo.json`, `grup_konglomerat.json`, `valuasi_historis.json`.

**Kriteria terima**: `python scripts/cek_kesegaran.py` harus keluar tidak nol hari ini, karena `aliran_investor.json` masih 27 Agustus, dan harus keluar nol sesudah Langkah 1 dijalankan.

### Langkah 4. Nyalakan kembali penanda "angka sementara"

Dua sisi. Sisi penulis: tambahkan penambalan ruas `sementara` di `scripts/panen_ihsg.py:186-189`, sejajar dengan cara ruas `sumber` sudah ditambal di situ. Sisi pembaca: `Beranda.tsx:100-134` memakai penanda yang sama yang sudah dipakai komponen `KonteksData`, sehingga kata "penutupan" hanya muncul kalau bukan angka sementara.

**Kriteria terima penulis**, harus mencetak angka lebih dari nol:

```bash
python -c "print(open('data-idx/json/index.json',encoding='utf-8').read().count('sementara'))"
```

**Kriteria terima pembaca**, harus menemukan setidaknya satu baris:

```bash
grep -n "sementara" app/src/views/dasbor/Beranda.tsx
```

### Langkah 5. Tetapkan satu pemilik untuk folder `ohlc/`

Pilih satu dari dua: entah CI yang menambah bar harian, entah `.bat` yang membangun ulang dari Stockbit. Yang tidak dipilih berhenti menulis ke `data-idx/json/ohlc/`. Kalau dua duanya harus tetap ada, jalankan yang membangun ulang **sesudah** CI, dan buat `gabung_ohlc_stockbit.py:341` membaca `p_out` lebih dulu, bukan `p_y`.

**Kriteria terima**: `grep -rn "json/ohlc/" scripts/*.py | grep -i "tulis\|write\|dump"` menyisakan satu skrip penulis, atau urutannya terdokumentasi di satu tempat yang jelas.

### Langkah 6. Beri batas umur ke tujuh cache

Tiru persis pola `ohlcvKaya.ts:45`, yaitu `UMUR_CACHE_MS` dan `cacheSejak`, ke tujuh modul di butir 5 daftar PUTUS. Tiga di antaranya mengambil endpoint yang sama persis, jadi salinan langsung.

**Kriteria terima**, harus mengembalikan sembilan berkas, bukan dua:

```bash
grep -l "UMUR_CACHE_MS\|cacheSejak" app/src/lib/dasbor/*.ts | wc -l
```

### Langkah 7. Perbaiki pemicu yang mati

Tiga hal terpisah. Pertama, `update-fundamental.yml`: ubah cron dari `0 23 28-31 * *` menjadi jadwal harian yang menyaring tanggal di dalam job, karena cron GitHub pada rentang tanggal akhir bulan terbukti tidak dapat diandalkan di sini. Kedua, `PAPAN-PanenSore`: setel `DisallowStartIfOnBatteries` menjadi `False` lewat `Set-ScheduledTask`. Ketiga, hilangkan `continue-on-error: true` pada langkah `panen_broker_harian`, atau biarkan tetapi tambahkan berkas itu ke daftar gerbang Langkah 3.

**Kriteria terima 1**: `gh run list --workflow update-fundamental.yml --limit 3` memuat run bertanggal Agustus atau sesudahnya.
**Kriteria terima 2**: `Get-ScheduledTask PAPAN-PanenSore | Select -Expand Settings | Select DisallowStartIfOnBatteries` mencetak `False`.

### Langkah 8. Masukkan ketiga `.bat` ke git

Tambahkan pengecualian di `.gitignore`, misalnya `!JALANKAN_*.bat`, lalu commit. Ini yang membuat bug seperti Langkah 1 terlihat di diff berikutnya.

**Kriteria terima**: `git ls-files JALANKAN_*.bat` mencetak tiga nama berkas.

### Langkah 9. Putuskan nasib dua kelompok yatim

Delapan skrip tanpa pemicu (butir 10 daftar PUTUS) dan `tinjau_deepdive.py` (butir 15). Untuk masing masing, Johan memutuskan satu dari tiga: masuk jadwal, tetap manual tetapi ditulis di dokumen sebagai manual, atau dihapus. Yang tidak boleh adalah membiarkannya di antara ketiganya, karena itulah yang membuat "tidak jelas" bertahan.

---

## 6. Yang belum diperiksa

Digabung jujur dari kelima lapis pemeriksaan.

**Cakupan yang tidak lengkap.** Dari sekitar 70 skrip yang menulis ke `data-idx/json/`, hanya sekitar 25 yang paling berdampak diverifikasi pemicu dan stempelnya. Skrip uji dan kalibrasi (`test_*.py`, `uji_*.py`, `kalibrasi_ambang.py`, `cacat_sumber.py`) sengaja dilewati karena bukan penulis data produksi. Turunan tingkat pertama seperti `broker/`, `keuangan/`, `seasonality/`, `kepemilikan/` tidak diaudit satu per satu apakah semuanya benar terpanggil.

**Akar penyebab dua anomali tidak bisa dipastikan.** Pertama, mengapa `update-fundamental.yml` berhenti terpicu sejak 31 Juli padahal berstatus `active`: GitHub tidak memberi log atau alasan lewat `gh` untuk cron yang gagal terpicu. Kedua, mengapa `PAPAN-PanenSore` mengembalikan Win32 4320 pada 28 Agustus: channel `Microsoft-Windows-TaskScheduler/Operational` kosong atau tidak aktif saat dicek.

**Produksi.** Verifikasi produksi dilakukan dengan sampel, yaitu `daftar_emiten.json`, `broker_tahunan/BBCA/2020.json`, `radar/index.json`, dan satu PDF. Bukan sensus atas keempat belas subfolder `data-idx/json`. Juga belum dipastikan apakah deploy `papan-idx.vercel.app` yang diuji benar benar dibangun dari commit HEAD saat ini, mengingat ada dua worktree paralel aktif dan perubahan yang belum di commit. Ambang jumlah berkas Vercel yang disebut sebagai risiko di komentar `copy-static-data.mjs` sendiri juga belum diuji, dan komentar itu sendiri mengaku belum tahu angkanya.

**Sisi peramban.** Tidak ada halaman yang benar benar dibuka di peramban untuk konfirmasi visual. Semua temuan Lapis 5 berasal dari pembacaan kode ditambah verifikasi ke JSON asli. Akibatnya: `Seasonality.tsx`, `SeasonalityHarian.tsx`, dan `SeasonalityKomparasi.tsx` belum bisa dipastikan benar benar tanpa penanda rentang tahun, karena label bisa saja dirender lewat konfigurasi Chart.js dan tidak tertangkap grep teks JSX. Pola cache tanpa batas umur juga belum dicari di modul yang memakai bentuk lain, misalnya `let x = null`, di luar pola `Map<string, Promise>`.

**Daftar titik fetch rawan belum lengkap.** Terverifikasi bahwa `r.ok` tidak berarti apa apa di bawah mount dev dan di produksi untuk berkas yang tidak ada, dan terverifikasi tiga titik yang sudah dijaga. Daftar lengkap "titik mana aman, titik mana rawan" dari sekitar 50 titik belum disusun.

**Tidak diperiksa sama sekali.** Wiring `ms_*.json` dan `ws_*.json` ke komponen pembacanya. Isi `raporBadge.ts` secara detail, sehingga belum jelas apakah ada penanda umur di layar untuk data `bt/`. Endpoint eksternal seperti `corsproxy.io` dan jalur Supabase. Apakah `node_modules` selalu berhasil terpasang di lingkungan `.bat` lokal untuk pembangun `.mjs`.

**Kesegaran adalah snapshot.** Semua angka tanggal di dokumen ini dibaca pagi 29 Agustus 2026. Kalau run CI sore ini sudah selesai saat dokumen dibaca, sebagian status RAPUH, terutama Kartu Analisa, mungkin sudah membaik. Perintah di Langkah 1 dan Langkah 3 bagian kriteria terima adalah cara termurah mengeceknya ulang kapan saja.