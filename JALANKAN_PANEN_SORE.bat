@echo off
REM ============================================================
REM  PAPAN - Panen SORE otomatis (perintah Johan 27 Agu 2026:
REM  "lain kali tidak perlu dibuat otomatis saja atau masuk buka laptop
REM   panen itu sekitar jam 6 malam sudah tersedia itu termasuk OLCHV dari SB")
REM  Terjadwal Task Scheduler PAPAN-PanenSore, Senin-Jumat 18:00 (sejak 14 Sep 2026, #187).
REM
REM  --paksa WAJIB di OHLCV (pelajaran 27 Agu): arsip bulan berjalan "sudah
REM  ada" membuat bar HARI INI dilewati diam-diam tanpa galat.
REM  Jahit IHSG kini berpenjaga resmi (bar menyimpang >0,5% dari statistik
REM  resmi diganti angka resmi - insiden chartbit 27 Agu 6521,75 vs 6428,11).
REM ============================================================
cd /d "%~dp0"
REM PYEXE bisa ditimpa dari lingkungan — 6 Sep 2026, saat bat ini mulai
REM dilacak git dan berhenti jadi milik satu mesin. Yang tak menyetelnya
REM tetap dapat jalur bawaan yang sama seperti sebelumnya.
REM --- Encoding keluaran (ralat 12 Sep 2026) ----------------------------
REM  Baris ini HILANG di sini sementara saudaranya JALANKAN_BUKA_LAPTOP.bat
REM  sudah menyetelnya sejak 5 Sep 2026 - dan komentar di sana menceritakan
REM  insiden yang persis sama: "panen_asing.py mati di baris cetak pembukanya
REM  selama berhari-hari, jadi asing/ berhenti di 3 Sep dan dua turunan ikut
REM  basi". Perbaikannya dipasang di satu bat saja, jadi bat sore tetap
REM  membunuh skrip yang sama.
REM
REM  Terukur 12 Sep 2026: log panen sore memuat traceback yang SAMA dua kali
REM  (jalan pagi dan jalan petang), keduanya di langkah [C] Aliran asing -
REM  UnicodeEncodeError pada U+2212 di baris cetak pembuka panen_asing.py.
REM  Skripnya mati sebelum memanen apa pun, dan tiga turunan yang membaca
REM  arsip asing berhenti dua hari di belakang tanpa satu pun alarm.
REM
REM  Sapuan 34 skrip yang dipanggil bat ini: 26 mencetak karakter non-ASCII.
REM  Menambal 26 baris cetak satu per satu salah arah - satu variabel di sini
REM  menutup semuanya sekaligus, termasuk skrip yang ditambahkan besok.
set PYTHONIOENCODING=utf-8

if not defined PYEXE set PYEXE=C:\Python314\python.exe
if not exist "%PYEXE%" set PYEXE=python
set "LOG_NAMA=panen_sore"

REM --- Log ke berkas (#102 A) -------------------------------------------
REM  Sampai 8 Sep 2026 kedua bat ini hanya menulis ke layar. Waktu panen
REM  melewatkan 99 emiten tanpa satu pun jejak, sebab kegagalannya sudah
REM  hilang bersama jendela konsol yang tertutup - yang tersisa cuma
REM  berkas yang stempelnya tertinggal, tanpa cara tahu kenapa.
REM
REM  Polanya: bat memanggil ULANG dirinya sendiri sekali, dan panggilan
REM  kedua dialirkan lewat Tee-Object supaya keluarannya tetap tampil di
REM  layar DAN tersimpan. `2>&1` disatukan sebelum pipa, jadi galat ikut
REM  masuk - itu justru baris yang paling dicari nanti.
if not defined PAPAN_LOG (
  set PAPAN_LOG=1
  if not exist logs md logs
  for /f %%d in ('call "%PYEXE%" -c "import datetime;print(datetime.date.today().isoformat())"') do set TGL_LOG=%%d
  REM `goto`, bukan `call ... & exit /b %errorlevel%` (#146 A). Di cmd, SELURUH
  REM blok dalam kurung diurai sekali sebelum baris pertamanya jalan, jadi
  REM `%errorlevel%` di dalamnya sudah diganti angka lama saat blok ini dibaca —
  REM nilainya nol, selalu, apa pun yang terjadi sesudahnya. `:TEE` sekarang
  REM yang mengurus keluarnya sendiri.
  goto :TEE
)


REM ---- Batas akhir 22:00 (Johan, 8 Sep 2026) ----------------------------
REM Pemicunya 18:00, tapi `StartWhenAvailable` membuat jalan yang terlewat
REM dijalankan begitu laptop tersedia — TANPA batas jam. Terbukti: 7 Sep ia
REM jalan 19:42, bukan 18:00. Jadi kalau laptop baru dibuka tengah malam,
REM tanpa penjaga ini panen sore jalan tengah malam juga.
REM
REM Penjaganya di sini, bukan di Task Scheduler: Scheduler tak punya opsi
REM "jangan mulai sesudah jam sekian" (EndBoundary mematikan pemicu per
REM TANGGAL, ExecutionTimeLimit membatasi lama jalan). Di bat ia ikut git
REM dan berlaku juga saat dijalankan tangan.
REM
REM Jam dibaca dari %TIME%, dan jam satu digit datang dengan SPASI di depan
REM (" 9:05") — itu sebabnya dipakai substring %TIME:~0,2% lalu spasi
REM dibuang, pola yang sama dengan pembaca jam di bat buka-laptop.
REM :cek_gerbang - putaran tunggu kunci (#190) kembali ke sini, jadi gerbang
REM jam dan hari diperiksa ulang tiap kali selesai menunggu.
:cek_gerbang
set JAM=%TIME:~0,2%
set JAM=%JAM: =%
if %JAM% GEQ 22 (
  echo Sudah lewat 22:00 - panen sore dilewati hari ini.
  echo Jalan manual juga ditolak sesudah 22:00; jadwal berikutnya pukul 18:00, Senin-Jumat.
  goto akhir
)
REM Dini hari 00:00-05:59 (#194 A, keputusan Johan 15 Sep 2026). Jalan terjadwal
REM yang terlewat lalu dijalankan StartWhenAvailable sesudah tengah malam tidak
REM memanen. Aman karena hari yang terlewat kini dikejar: harga, asing, dan
REM intraday memang menarik mundur, dan broker memanen semua hari bursa 7 hari
REM terakhir yang belum lengkap (langkah B2). Jalan tangan tetap boleh.
if not "%1"=="auto" goto jam_pagi_ok
if %JAM% GEQ 6 goto jam_pagi_ok
echo Jalan terjadwal yang terlewat baru mulai pukul %JAM% dini hari - panen sore dilewati.
echo Jadwal berikutnya pukul 18:00, Senin-Jumat; jalan manual tetap boleh.
goto akhir
:jam_pagi_ok

REM ---- Hari kerja saja (13 Sep 2026) ----------------------------------
REM Johan 13 Sep 2026, dikutip pengawas (sidik PGW-0913-HARIKERJA): "untuk panen itu
REM maksimal jumat saja, sabtu minggu tidak perlu".
REM Hanya jalan terjadwal (argumen auto) yang digerbang: dijalankan tangan
REM di akhir pekan tetap boleh. Diletakkan sebelum kunci diambil, jadi
REM :akhir tak melepas kunci milik proses lain. Tanpa blok berkurung,
REM supaya %HARI% diperluas saat baris dieksekusi (pola gerbang jam bat
REM buka-laptop).
if not "%1"=="auto" goto hari_ok
for /f %%h in ('call "%PYEXE%" -c "import datetime;print(datetime.date.today().isoweekday())"') do set HARI=%%h
REM PAPAN_UJI_HARI (1 = Senin ... 7 = Minggu) hanya untuk uji; menimpa hari dari jam laptop.
if defined PAPAN_UJI_HARI set HARI=%PAPAN_UJI_HARI%
if not defined HARI goto hari_ok
if %HARI% LSS 6 goto hari_ok
echo Akhir pekan ^(hari %HARI%^) - panen sore terjadwal hanya Senin-Jumat, dilewati.
goto akhir
:hari_ok

REM ---- Kunci dipegang pipeline lain: tunggu, jangan langsung keluar (#190) ----
REM 14 Sep 2026 PAPAN-BukaLaptop mulai 18:32 dan memegang kunci sekitar 4 menit.
REM Task sore yang telat ke 18:34 keluar begitu melihat kunci, dan panen hari
REM itu tidak jalan sama sekali karena task tidak mengulang. Sekarang bat
REM menunggu: periksa tiap 30 detik, paling lama 20 menit (40 kali). Tiap
REM putaran kembali ke :cek_gerbang, jadi menunggu tak pernah membuat panen
REM mulai sesudah 22:00. Tidur lewat Python, bukan `timeout`: `timeout`
REM langsung gagal kalau masukan dialihkan, seperti di bawah Task Scheduler.
if not exist "%~dp0.panen.lock" goto kunci_bebas
if not defined PAPAN_TUNGGU_KUNCI set PAPAN_TUNGGU_KUNCI=0
if %PAPAN_TUNGGU_KUNCI% GEQ 40 goto kunci_tetap_dipegang
if %PAPAN_TUNGGU_KUNCI%==0 echo Pipeline lain sedang jalan - .panen.lock ada - menunggu sampai 20 menit.
set /a PAPAN_TUNGGU_KUNCI+=1
"%PYEXE%" -c "import time;time.sleep(30)"
goto cek_gerbang
:kunci_tetap_dipegang
echo Pipeline lain masih memegang .panen.lock sesudah 20 menit - keluar.
REM Keluar TANPA melepas kunci: kuncinya milik proses lain. Sampai
REM 9 Sep 2026 baris ini melompat ke :akhir yang menghapusnya, jadi
REM pipa yang mengalah justru membuka pintu untuk pipa ketiga - dan
REM dua panen yang jalan bersamaan persis yang memutus rantai token.
REM Kode 1 = panen sore tidak memanen (#197 A), apa pun yang dikerjakan pipa
REM pemegang kunci; data hari itu dibaca dari pemeriksaan sesudah panen.
set PAPAN_RC=1
goto keluar_tanpa_kunci
:kunci_bebas
if defined PAPAN_TUNGGU_KUNCI echo Kunci dilepas sesudah menunggu %PAPAN_TUNGGU_KUNCI% x 30 detik - lanjut.
mkdir "%~dp0.panen.lock" 2>nul
REM Sejak titik ini kunci MILIK proses ini, jadi :akhir boleh melepasnya.
set PAPAN_KUNCI_MILIK=1

echo ============================================================
echo  PAPAN - Panen Sore (%date% %time%)
echo ============================================================

echo.
echo [A] Jalur IDX (statistik harian/mingguan/bulanan + kabar) - pipa yang sama
REM  Sampai 8 Sep 2026 panen sore TIDAK punya jalur IDX sama sekali: statistik
REM  harian hanya lahir dari BukaLaptop (yang berdiri di belakang gerbang token)
REM  dan dari CI 19:30. Akibatnya terlihat di layar - Johan menemukan "Data per
REM  4 September" pada 7 Sep. Sekarang satu pipa: jalur IDX jalan lebih dulu,
REM  tanpa bergantung pada hidup-matinya token Stockbit.
REM
REM  LEWATI_OHLC_YAHOO=1: sapuan Yahoo 963 emiten percuma di sini karena
REM  langkah [B] menimpa ohlc/ dengan arsip Stockbit beberapa menit kemudian.
REM  Kuncinya TIDAK diambil ulang - bat ini sudah memegangnya di atas, dan
REM  JALANKAN_OTOMATIS memang tak pernah mengambil kunci sendiri.
set LEWATI_OHLC_YAHOO=1
call "%~dp0JALANKAN_OTOMATIS.bat" auto
set LEWATI_OHLC_YAHOO=

echo.
echo [0] Uji token Stockbit sebelum langkah Stockbit (#195 C)
REM Uji hidup token yang dipakai panen tanpa memutar apa pun - gerbang yang sama
REM dengan bat buka-laptop. 13 Sep 2026 panen jalan dengan token yang ditolak
REM server: harga saja menghabiskan 13.296 detik untuk 962 emiten gagal. Kalau
REM ditolak, langkah Stockbit dilewati dan kode keluar bat jadi 1; jalur IDX,
REM asing, dan turunan tetap jalan dari data yang ada.
set TOKEN_MATI=
"%PYEXE%" scripts\cek_token.py
if errorlevel 1 set TOKEN_MATI=1
if defined TOKEN_MATI set PAPAN_RC=1
if defined TOKEN_MATI echo   TOKEN DITOLAK - harga Stockbit, broker, intraday, keystats, dan info dilewati hari ini.

echo.
echo [B] OHLCV Stockbit --paksa (bar hari ini) + IHSG + gabung + jahit
if not defined TOKEN_MATI "%PYEXE%" scripts\panen_ohlcv_stockbit.py --semua --paksa
if not defined TOKEN_MATI if errorlevel 1 echo   (OHLCV gagal - lanjut)
if not defined TOKEN_MATI "%PYEXE%" scripts\panen_ohlcv_stockbit.py IHSG --paksa
"%PYEXE%" scripts\gabung_ohlc_stockbit.py
"%PYEXE%" scripts\jahit_ihsg.py
REM Gerbang #102 A: emiten yang arsip gabungannya sudah sampai hari bursa
REM terakhir tapi berkas sumbernya belum. Panen 8 Sep 2026 melewatkan 99
REM emiten sambil melaporkan sukses; ini yang membuatnya terlihat pada menit
REM yang sama. Tidak menghentikan pipa - turunan tetap dibangun dari yang ada,
REM dan daftarnya tertulis di logs\panen_tertinggal.txt.
"%PYEXE%" scripts\cek_panen_ohlcv.py
REM Gerbang ini TIDAK menghentikan pipa (turunan tetap dibangun dari yang ada),
REM tapi sejak #146 A ia menentukan kode keluar bat — supaya Task Scheduler
REM mencatat kegagalannya walau tak ada yang membaca lognya malam itu.
if errorlevel 1 set PAPAN_RC=1
if errorlevel 1 echo   [B] PERINGATAN: ada emiten tertinggal - lihat logs\panen_tertinggal.txt

echo.
echo [B2] Broker hari-tuntas - 6 varian bentuk PERSIS CI, 8 utas
REM -- ENAM varian, bukan dua belas. Ketetapan Johan 1 Sep 2026: "tidak
REM -- perlu harvest 12 varian cukup 6 varian saja ... net dihitung dari
REM -- gross dan sudah ada SOP nya" (docs/desain-broker-summary.md:26 --
REM -- "NET = beli - jual, dihitung di klien").
REM --
REM -- Dibuktikan sebelum dibuang, bukan diasumsikan: 19.888 dari 19.944
REM -- baris net hasil panen COCOK PERSIS dengan (beli - jual) dari gross
REM -- (99,72%). Dan 56 sisanya bukan informasi tambahan -- semuanya lot
REM -- bertanda terbalik sementara nilainya cocok, jadi net hasil panen
REM -- justru tak konsisten dengan dirinya sendiri di situ.
REM --
REM -- Memanen keduanya menggandakan permintaan untuk nol angka baru --
REM -- dan kuota permintaan itu yang dibutuhkan panen harga.
REM Semua hari bursa 7 hari terakhir yang arsip BBCA-nya belum lengkap enam
REM varian, lalu hari tuntas terakhir (#194 A, keputusan Johan 15 Sep 2026).
REM Dulu satu tanggal saja, jadi jalan yang terlewat meninggalkan lubang broker
REM untuk selamanya (14 Sep 2026). Pemanen melewati berkas yang sudah ada.
if defined TOKEN_MATI goto broker_lewat
for /f %%d in ('"%PYEXE%" scripts\tgl_broker_lubang.py') do (
  echo      target: %%d
  "%PYEXE%" scripts\panen_broker_harian.py --tanggal %%d --jeda 0.4 --paralel 48 --varian reguler,asing,nego,nego-asing,tunai,tunai-asing
  if errorlevel 1 echo   broker %%d gagal - lanjut
)
:broker_lewat

echo.
echo [C] Aliran asing
"%PYEXE%" scripts\panen_asing.py
if errorlevel 1 echo   (asing gagal - lanjut)

echo.
echo [D] Intraday 1 menit + bangun 1H
if not defined TOKEN_MATI "%PYEXE%" scripts\panen_intraday_stockbit.py
if not defined TOKEN_MATI if errorlevel 1 echo   (intraday gagal - lanjut)
"%PYEXE%" scripts\bangun_intraday_1h.py

echo.
echo [E] Turunan: tahunan + kategori + kartu + screener + penjaga radar
for /f %%y in ('call "%PYEXE%" -c "import datetime;print(datetime.date.today().year)"') do set TAHUN_KINI=%%y
REM Pagar tahun (#68). Tanpa ini, TAHUN_KINI kosong membuat barisnya jadi
REM "--tahun --paralel 8": pengurai menelan --paralel sebagai nilai --tahun
REM dan angka 8 jatuh jadi KODE EMITEN - itu asal broker_tahunan/8 pada
REM 6 Sep 18:27. Baris kembar di JALANKAN_BUKA_LAPTOP.bat sudah berpagar
REM sejak awal; yang ini tertinggal.
if "%TAHUN_KINI%"=="" (echo   [E] PERINGATAN: tahun tak terbaca, memakai 2026 ^& lanjut) & if "%TAHUN_KINI%"=="" set TAHUN_KINI=2026
"%PYEXE%" scripts\bangun_broker_tahunan.py --tahun %TAHUN_KINI% --paralel 16
"%PYEXE%" scripts\bangun_kategori_broker.py
"%PYEXE%" scripts\riset\kartu_analisa.py --semua --tulis
REM Peluang historis seluruh emiten. Dulu YATIM: nol pemanggil di bat
REM maupun CI, jadi angkanya membeku dan tak seorang pun tahu - stempel
REM `harga_pada` yang dipasang 6 Sep 2026 langsung memperlihatkannya
REM tertinggal 5 hari bursa. Membaca ohlc/ yang baru dijahit langkah [B].
REM Statistik RBS per kerangka + pemasok kandidat Deep Dive (#49). Angka
REM yang dipajang chart datang dari berkas ini; kalau ia tak jalan, chart
REM DIAM soal statistik alih-alih memajang angka basi.
"%PYEXE%" scripts\riset\rbs_statistik.py --kerangka D W M --tulis
if errorlevel 1 echo   (statistik RBS gagal - lanjut)
REM Statistik Gap per kerangka (#50). Node, bukan Python: skripnya
REM MENGIMPOR mesin gap yang sama dengan yang menggambar zonanya, jadi
REM angka layar dan zona layar tak mungkin berbeda diam-diam.
for %%T in (D W M) do node app\scripts\gap-statistik.ts --tf=%%T --tulis
REM Backtest kelas Pivot/CPR + setup R:R (#63) - angka di balik badge rapor
REM panel analitik chart. Node, alasan sama seperti Gap: skripnya MENGIMPOR
REM mesin klasifikasi yang dipakai layar. D, W, M sekali jalan (~15 detik).
node app\scripts\bt-pivot-cpr.ts --tulis
REM Rollup Top Broker lintas hari (#29). Dijumlah dari rekap broker harian
REM resmi yang SUDAH dibaca halaman itu - sumber sama, bukan jahitan.
"%PYEXE%" scripts\bangun_broker_rentang.py --tulis
if errorlevel 1 echo   (rollup broker rentang gagal - lanjut)
REM Pivot broker -> emiten (#30). Membalik arsip per-emiten jadi satu
REM berkas per broker; sumber sama, cuma arah bacanya yang dibalik.
"%PYEXE%" scripts\bangun_broker_pivot.py --tulis
if errorlevel 1 echo   (pivot broker gagal - lanjut)
"%PYEXE%" scripts\bangun_prob.py
if errorlevel 1 echo   (peluang gagal - lanjut)
REM Rezim pasar: dulu HANYA di bat buka-laptop. Hari Johan tak membuka
REM laptop, halaman Rezim Pasar diam memakai angka kemarin tanpa satu pun
REM galat. Membaca ohlc/ + ohlc/IHSG.json yang baru dijahit langkah [B].
"%PYEXE%" scripts\bangun_rezim_pasar.py
if errorlevel 1 echo   (rezim pasar gagal - lanjut)
node app\scripts\bangun-screener.mjs
"%PYEXE%" scripts\riset\rekap_preset.py
if errorlevel 1 echo   (rekap preset gagal - lanjut)
rem -- Penilai jejak. Menutup celah yang ditemukan 1 Sep 2026: keduanya
rem -- ditulis hari itu tapi tak dipanggil di mana pun, jadi baris TERKUNCI
rem -- hari berikutnya tak akan pernah lahir -- dan tak ada satu pun galat
rem -- yang memberitahu, persis bentuk lima alarm senyap yang sudah dibayar.
rem -- WAJIB sesudah rekap_preset: keduanya membaca jejak yang ia tulis.
"%PYEXE%" scripts\riset\nilai_jejak.py
if errorlevel 1 echo   (nilai jejak gagal - lanjut)
"%PYEXE%" scripts\riset\selisih_terkunci.py
REM Rencana dagang per emiten (area beli, TP1/TP2, batas rugi) yang dibaca
REM blok rencana di Kartu Analisa. Dulu YATIM di sini: pemanggilnya cuma ada
REM di JALANKAN_BUKA_LAPTOP, jadi berkasnya basi tiap kali laptop tak dibuka
REM -- terukur 3 hari basi pada 8 Sep 2026, batas 0, tanpa satu pun galat.
REM Nol jaringan, +-40 detik, membaca ohlc/ yang baru dipanen di atas.
"%PYEXE%" scripts\riset\rencana_saham.py
if errorlevel 1 echo   (rencana dagang gagal - lanjut)
REM Winrate PAPAN per emiten (#91): aturan rencana dagang yang sama, enam
REM horizon, saringan teknikal, pembanding pasar. Membaca arsip harga + gudang
REM Stockbit + rencana_saham.json yang baru ditulis di atas -- WAJIB sesudahnya.
REM Nol jaringan, +-40 detik, keluaran data-idx/json/winrate/ (ikut commit [F]).
"%PYEXE%" scripts\riset\winrate_emiten.py
if errorlevel 1 echo   (winrate gagal - lanjut)
REM Tinjauan H+5 tiap Deep Dive - menutup lingkaran Analisa PAPAN v1 bagian 5.
REM Dulu YATIM: keluarannya efek samping tanpa jadwal, jadi kelima barisnya
REM berhenti di 3/5 dan 4/5 hari sejak 22 Agu tanpa satu pun galat. Nol
REM jaringan, jalannya sepersekian detik.
"%PYEXE%" scripts\riset\tinjau_deepdive.py
if errorlevel 1 echo   (tinjauan H+5 gagal - lanjut)
if errorlevel 1 echo   (selisih terkunci gagal - lanjut)
node app\scripts\bangun-harian-papan.mjs
if errorlevel 1 echo   (harian papan gagal - lanjut)
node app\scripts\bangun-jago-papan.mjs
if errorlevel 1 echo   (jago papan gagal - lanjut)
node app\scripts\bangun-ipo.mjs
if errorlevel 1 echo   (ipo gagal - lanjut)
pushd app
call npx vite-node scripts/pola-screener.ts
if errorlevel 1 echo   (pola screener gagal - lanjut)
popd
REM [E2] Turunan halaman yang KEMARIN yatim (audit 28 Agu atas keluhan
REM Johan "bnyk yang setelah panen data, page-page itu tidak saling
REM terhubung"): aliran investor (tab Flow), bidoffer (Kuli Papan),
REM peta grup+harga terakhir (Deret Konglomerat), keystats+info Stockbit
REM (Kuli Papan & Neo). Keystats/info punya guard arsip-hari-ini, jadi
REM aman dipanggil dari kedua jalur tanpa panen dobel. Irama HARIAN ini
REM disengaja (#182 A, keputusan Johan 13 Sep 2026): P/BV, P/S, dan
REM kelompok laba TTM di Stock Detail dibaca dari keystats, dan semuanya
REM bergerak mengikuti harga. Profil tetap bulanan di blok Buka Laptop.
"%PYEXE%" scripts\bangun_aliran_investor.py
if errorlevel 1 echo   (aliran investor gagal - lanjut)
"%PYEXE%" scripts\bangun_bidoffer.py
if errorlevel 1 echo   (bidoffer gagal - lanjut)
REM Bandarmologi: sama - dulu HANYA di bat buka-laptop, jadi Whales/Neo
REM memakai angka kemarin diam-diam. Membaca asing/ [C], broker_harian/
REM [B2], dan ohlc/ [B] - ketiganya sudah turun di atas.
"%PYEXE%" scripts\bangun_bandarmologi.py
if errorlevel 1 echo   (bandarmologi gagal - lanjut)
"%PYEXE%" scripts\bangun_harga_terakhir.py
if errorlevel 1 echo   (harga terakhir gagal - lanjut)
"%PYEXE%" scripts\petakan_grup.py
if errorlevel 1 echo   (peta grup gagal - lanjut)
REM [E4] Seasonality HILIR. Pemanen hulunya (~20 menit ke Yahoo, 963
REM emiten) SENGAJA tidak ikut ke bat - ia terjadwal di CI
REM panen-harian-rumah.yml, dan menambahkannya di sini berarti dua sapuan
REM jaringan berat per hari untuk data yang cuma berubah sebulan sekali.
REM Yang di sini dua langkah NOL JARINGAN yang mengubah hasil panen itu
REM jadi berkas yang benar-benar dibaca halaman. Sampai 6 Sep 2026
REM keduanya tak dipanggil dari MANA PUN (grep seluruh repo: cuma
REM docstring-nya sendiri), jadi hulunya segar tiap hari sementara
REM hilirnya berhenti di 19 Agustus - nol galat, angkanya salah di layar.
"%PYEXE%" scripts\bangun_ihsg_bulanan.py
if errorlevel 1 echo   (ihsg bulanan gagal - lanjut)
"%PYEXE%" scripts\siapkan_seasonality.py
if errorlevel 1 echo   (siapkan seasonality gagal - lanjut)
if not defined TOKEN_MATI "%PYEXE%" scripts\panen_keystats_stockbit.py --semua --jeda 0.4
if not defined TOKEN_MATI if errorlevel 1 echo   (keystats gagal - lanjut)
if not defined TOKEN_MATI "%PYEXE%" scripts\panen_info_stockbit.py --semua --jeda 0.4
if not defined TOKEN_MATI if errorlevel 1 echo   (info stockbit gagal - lanjut)
"%PYEXE%" scripts\cek_radar_basi.py

echo.
REM Gerbang kesegaran (#101 A): seluruh turunan diperiksa terhadap hari
REM bursa terakhir SEBELUM di-commit. Tidak menghentikan commit - data yang
REM sudah benar tetap layak didorong - tapi angkanya masuk log panen, jadi
REM turunan yang diam-diam tertinggal punya baris yang bisa dibaca besok.
"%PYEXE%" scripts\cek_kesegaran.py
if errorlevel 1 echo   PERINGATAN: ada turunan basi/kosong - lihat keluaran di atas

echo [F] Commit data hasil panen
REM SATU daftar jalur untuk add DAN commit (#148). Commit ber-pathspec
REM hanya mengambil jalur yang disebut, jadi dua daftar yang berbeda
REM berarti berkas yang sudah di-add tak pernah terdorong dan tertahan
REM di index tanpa satu pun galat - terjadi pada profil_stockbit, dan
REM sebelumnya pada gudang broker tahunan.
set "DATA_JALUR=data-idx/json/ohlc data-idx/json/ohlcv_stockbit data-idx/json/asing data-idx/json/intraday_1h data-idx/json/kartu data-idx/json/nilai_jejak.json data-idx/json/penilaian data-idx/json/selisih_terkunci.json data-idx/json/rencana_saham.json data-idx/json/winrate data-idx/json/prob data-idx/json/screener.json data-idx/json/pola_screener.json data-idx/json/daftar_emiten.json data-idx/json/broker_harian data-idx/json/broker_tahunan data-idx/json/broker_pivot data-idx/json/broker_rentang data-idx/json/bt data-idx/json/rbs_kandidat.json data-idx/json/harian_papan data-idx/json/jago_papan data-idx/json/ipo.json data-idx/json/pola_screener.json data-idx/json/kategori_broker.json data-idx/json/ihsg_ohlc_ringkas.json data-idx/json/aliran_investor.json data-idx/json/bidoffer.json data-idx/json/harga_terakhir.json data-idx/json/grup_konglomerat.json data-idx/json/keystats_stockbit data-idx/json/info_stockbit data-idx/json/rekomendasi data-idx/json/seasonality data-idx/json/tinjauan_deepdive.json data-idx/json/rezim_pasar.json data-idx/json/bandarmologi.json"
git add %DATA_JALUR% 2>nul
git commit -m "data: panen sore otomatis (%date%)" -- %DATA_JALUR%
REM ---- Dorong data (#198 A, keputusan Johan 15 Sep 2026) ----------------
REM Dulu satu `git push` saja. 15 Sep 2026 CI panen kabar mendorong lebih dulu,
REM push bat buka-laptop ditolak, bat tetap keluar 0, dan data hari itu tidak
REM tayang tanpa satu pun tanda. Sekarang: tarik dengan rebase (autostash,
REM karena pohon kerja bisa berisi suntingan lain), dorong, ulangi sampai 3
REM kali; tetap gagal = PERINGATAN dan kode keluar 1. Commit di atas memakai
REM pathspec, jadi yang terdorong hanya data milik bat ini.
REM PAPAN_JEDA_DORONG (detik antar percobaan) hanya untuk uji.
set DORONG_COBA=0
if not defined PAPAN_JEDA_DORONG set PAPAN_JEDA_DORONG=20
:dorong_ulang
set /a DORONG_COBA+=1
git pull --rebase --autostash origin main
if errorlevel 1 goto dorong_rebase_gagal
REM Autostash yang bentrok TIDAK membuat pull gagal: git keluar 0, menyimpan
REM suntingan di stash, dan meninggalkan berkas berstatus UU berisi penanda
REM konflik (dibuktikan Pemeriksa Akhir #198 dengan git sungguhan). Berkas itu
REM dikembalikan ke versi HEAD; suntingannya tetap ada di `git stash list`.
set DORONG_ADA_KONFLIK=
for /f "delims=" %%f in ('git diff --name-only --diff-filter=U') do set DORONG_ADA_KONFLIK=1
if not defined DORONG_ADA_KONFLIK goto dorong_tanpa_konflik
echo   PERINGATAN: suntingan belum di-commit bentrok dengan commit dari GitHub. Berkas dikembalikan ke versi HEAD,
echo   suntingannya tersimpan di git stash - periksa dengan: git stash list
for /f "delims=" %%f in ('git diff --name-only --diff-filter=U') do (
  echo      %%f
  git checkout HEAD -- "%%f"
)
set PAPAN_RC=1
:dorong_tanpa_konflik
git push origin HEAD:main
if not errorlevel 1 goto dorong_ok
goto dorong_coba_lagi
:dorong_rebase_gagal
echo   Rebase gagal pada percobaan %DORONG_COBA% - dibatalkan.
git rebase --abort 2>nul
:dorong_coba_lagi
if %DORONG_COBA% GEQ 3 goto dorong_menyerah
"%PYEXE%" -c "import time;time.sleep(%PAPAN_JEDA_DORONG%)"
goto dorong_ulang
:dorong_menyerah
echo   PERINGATAN: push data gagal 3 kali - data sudah di-commit di laptop tapi BELUM tayang.
set PAPAN_RC=1
goto dorong_selesai
:dorong_ok
echo   Data ter-push ke GitHub pada percobaan %DORONG_COBA%.
:dorong_selesai

:akhir
if defined PAPAN_KUNCI_MILIK rmdir "%~dp0.panen.lock" 2>nul
:keluar_tanpa_kunci
REM Kode keluar dititipkan ke berkas untuk induk di :TEE (#146 A) — lihat
REM alasannya di sana. Ditulis SEBELUM pause supaya jalan manual yang ditutup
REM paksa tetap meninggalkan statusnya.
if not defined PAPAN_RC set PAPAN_RC=0
> "logs\status_%LOG_NAMA%_%TGL_LOG%.txt" echo %PAPAN_RC%
if not "%1"=="auto" pause

REM Batas alur: tanpa exit di sini, bat jatuh ke :TEE sesudah pause dan
REM menjalankan dirinya sekali lagi.
exit /b %PAPAN_RC%

:TEE
REM Dipanggil sekali dari blok log di atas; `PAPAN_LOG` sudah terpasang di
REM lingkungan ini, jadi panggilan kedua langsung menjalankan isi bat.
REM
REM Kode keluar anak dititipkan lewat BERKAS, bukan lewat pipa (#146 A): kode
REM keluar sebuah pipa di cmd adalah kode keluar perintah TERAKHIR, yaitu
REM powershell yang menulis log — dan powershell hampir selalu berhasil. Karena
REM itu Task Scheduler mencatat 0x0 walau panennya gagal, dan satu-satunya
REM tanda kegagalan justru hilang di tempat yang dibuat untuk mencatatnya.
REM
REM Berkas lama dihapus dulu: kalau anak mati sebelum sempat menulis, yang
REM tersisa status kemarin, dan kegagalan hari ini terbaca sebagai sukses.
set "PAPAN_STATUS=logs\status_%LOG_NAMA%_%TGL_LOG%.txt"
del "%PAPAN_STATUS%" 2>nul
call "%~f0" %* 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -FilePath 'logs\%LOG_NAMA%_%TGL_LOG%.log' -Append"
REM Bawaannya 1: berkas yang tak ada berarti anak tak sampai ke ujung.
set PAPAN_RC=1
for /f "usebackq tokens=1" %%r in ("%PAPAN_STATUS%") do set PAPAN_RC=%%r
exit /b %PAPAN_RC%
