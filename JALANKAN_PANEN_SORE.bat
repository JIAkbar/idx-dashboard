@echo off
REM ============================================================
REM  PAPAN - Panen SORE otomatis (perintah Johan 27 Agu 2026:
REM  "lain kali tidak perlu dibuat otomatis saja atau masuk buka laptop
REM   panen itu sekitar jam 6 malam sudah tersedia itu termasuk OLCHV dari SB")
REM  Terjadwal Task Scheduler PAPAN-PanenSore, harian 18:00.
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
if not defined PYEXE set PYEXE=C:\Python314\python.exe
if not exist "%PYEXE%" set PYEXE=python

if exist "%~dp0.panen.lock" (
  echo Pipeline lain sedang jalan - .panen.lock ada - keluar.
  goto akhir
)
mkdir "%~dp0.panen.lock" 2>nul

echo ============================================================
echo  PAPAN - Panen Sore (%date% %time%)
echo ============================================================

echo.
echo [B] OHLCV Stockbit --paksa (bar hari ini) + IHSG + gabung + jahit
"%PYEXE%" scripts\panen_ohlcv_stockbit.py --semua --paksa
if errorlevel 1 echo   (OHLCV gagal - lanjut)
"%PYEXE%" scripts\panen_ohlcv_stockbit.py IHSG --paksa
"%PYEXE%" scripts\gabung_ohlc_stockbit.py
"%PYEXE%" scripts\jahit_ihsg.py

echo.
echo [B2] Broker hari-tuntas - 12 varian bentuk PERSIS CI
for /f %%d in ('"%PYEXE%" scripts\tgl_broker_aman.py') do set TGL_BROKER=%%d
echo      target: %TGL_BROKER%
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
"%PYEXE%" scripts\panen_broker_harian.py --tanggal %TGL_BROKER% --jeda 0.4 --varian reguler,asing,nego,nego-asing,tunai,tunai-asing
if errorlevel 1 echo   (broker gagal - lanjut)

echo.
echo [C] Aliran asing
"%PYEXE%" scripts\panen_asing.py
if errorlevel 1 echo   (asing gagal - lanjut)

echo.
echo [D] Intraday 1 menit + bangun 1H
"%PYEXE%" scripts\panen_intraday_stockbit.py
if errorlevel 1 echo   (intraday gagal - lanjut)
"%PYEXE%" scripts\bangun_intraday_1h.py

echo.
echo [E] Turunan: tahunan + kategori + kartu + screener + penjaga radar
for /f %%y in ('"%PYEXE%" -c "import datetime;print(datetime.date.today().year)"') do set TAHUN_KINI=%%y
"%PYEXE%" scripts\bangun_broker_tahunan.py --tahun %TAHUN_KINI% --paralel 8
"%PYEXE%" scripts\bangun_kategori_broker.py
"%PYEXE%" scripts\riset\kartu_analisa.py --semua --tulis
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
REM aman dipanggil dari kedua jalur tanpa panen dobel.
"%PYEXE%" scripts\bangun_aliran_investor.py
if errorlevel 1 echo   (aliran investor gagal - lanjut)
"%PYEXE%" scripts\bangun_bidoffer.py
if errorlevel 1 echo   (bidoffer gagal - lanjut)
"%PYEXE%" scripts\bangun_harga_terakhir.py
if errorlevel 1 echo   (harga terakhir gagal - lanjut)
"%PYEXE%" scripts\petakan_grup.py
if errorlevel 1 echo   (peta grup gagal - lanjut)
"%PYEXE%" scripts\panen_keystats_stockbit.py --semua --jeda 0.4
if errorlevel 1 echo   (keystats gagal - lanjut)
"%PYEXE%" scripts\panen_info_stockbit.py --semua --jeda 0.4
if errorlevel 1 echo   (info stockbit gagal - lanjut)
"%PYEXE%" scripts\cek_radar_basi.py

echo.
echo [F] Commit data hasil panen
git add data-idx/json/ohlc data-idx/json/ohlcv_stockbit data-idx/json/asing data-idx/json/intraday_1h data-idx/json/kartu data-idx/json/screener.json data-idx/json/pola_screener.json data-idx/json/daftar_emiten.json data-idx/json/broker_harian data-idx/json/broker_tahunan data-idx/json/harian_papan data-idx/json/jago_papan data-idx/json/ipo.json data-idx/json/pola_screener.json data-idx/json/kategori_broker.json data-idx/json/ihsg_ohlc_ringkas.json data-idx/json/aliran_investor.json data-idx/json/bidoffer.json data-idx/json/harga_terakhir.json data-idx/json/grup_konglomerat.json data-idx/json/keystats_stockbit data-idx/json/info_stockbit data-idx/json/rekomendasi 2>nul
git commit -m "data: panen sore otomatis (%date%)" -- data-idx/json/ohlc data-idx/json/ohlcv_stockbit data-idx/json/asing data-idx/json/intraday_1h data-idx/json/kartu data-idx/json/screener.json data-idx/json/pola_screener.json data-idx/json/daftar_emiten.json data-idx/json/broker_harian data-idx/json/broker_tahunan data-idx/json/harian_papan data-idx/json/jago_papan data-idx/json/ipo.json data-idx/json/pola_screener.json data-idx/json/kategori_broker.json data-idx/json/ihsg_ohlc_ringkas.json data-idx/json/aliran_investor.json data-idx/json/bidoffer.json data-idx/json/harga_terakhir.json data-idx/json/grup_konglomerat.json data-idx/json/keystats_stockbit data-idx/json/info_stockbit data-idx/json/rekomendasi
git push origin main

:akhir
rmdir "%~dp0.panen.lock" 2>nul
if not "%1"=="auto" pause
