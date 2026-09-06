@echo off
REM ============================================================
REM  IDX Dashboard - Pipeline Otomatis Lokal (jalur andalan)
REM ============================================================
REM  Download PDF harian+mingguan -> parse ke JSON -> commit -> push.
REM
REM  Kenapa ada file ini: GitHub Actions kerap DIBLOKIR idx.co.id
REM  (IP datacenter; riwayat: data bolong 2 bulan, Jun-Agu 2026).
REM  Dari IP rumahan tidak diblokir, jadi jalur lokal ini yang utama;
REM  Actions jadi cadangan kalau kebetulan lolos.
REM
REM  Daftarkan sekali ke Task Scheduler (jalan tiap hari kerja 18:30 WIB):
REM    schtasks /Create /TN "IDX-Update" /TR "\"%~dp0JALANKAN_OTOMATIS.bat\" auto" ^
REM      /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 18:30
REM  Hapus: schtasks /Delete /TN "IDX-Update"
REM
REM  Argumen "auto" = tanpa pause di akhir (buat scheduled task).
cd /d "%~dp0"

REM PYEXE bisa ditimpa dari lingkungan — 6 Sep 2026, saat bat ini mulai
REM dilacak git dan berhenti jadi milik satu mesin. Yang tak menyetelnya
REM tetap dapat jalur bawaan yang sama seperti sebelumnya.
if not defined PYEXE set PYEXE=C:\Python314\python.exe
if not exist "%PYEXE%" set PYEXE=python

echo ============================================================
echo  IDX Dashboard - Update Otomatis (%date% %time%)
echo ============================================================

echo.
echo [1/8] Download PDF harian + mingguan + bulanan...
"%PYEXE%" scripts\download_idx.py --hari-ini --jenis semua
REM Susulan bulan berjalan - PDF IDX kadang terbit sesudah runner jalan
REM (31 Agu 2026 hilang seminggu karena --hari-ini tak menengok mundur).
REM Yang sudah ada dilewati [SKIP], jadi ini murah.
for /f %%b in ('"%PYEXE%" -c "import datetime;print(datetime.date.today().month)"') do set BLN=%%b
for /f %%t in ('"%PYEXE%" -c "import datetime;print(datetime.date.today().year)"') do set THN=%%t
"%PYEXE%" scripts\download_idx.py --bulan %BLN% --tahun %THN% --jenis harian
if errorlevel 1 echo   (susulan bulan berjalan gagal - lanjut)
if errorlevel 1 (
  echo GAGAL download - berhenti tanpa commit.
  goto akhir
)

echo.
echo [2/8] Parse PDF harian...
"%PYEXE%" scripts\parse_idx_pdf.py --semua
if errorlevel 1 (
  echo GAGAL parse harian - berhenti tanpa commit.
  goto akhir
)

echo.
echo [3/8] Parse PDF mingguan...
"%PYEXE%" scripts\parse_idx_weekly.py --semua
if errorlevel 1 (
  echo GAGAL parse mingguan - berhenti tanpa commit.
  goto akhir
)

echo.
echo [3b/8] Parse PDF bulanan (Equity)...
"%PYEXE%" scripts\parse_idx_monthly.py --semua
if errorlevel 1 echo   (gagal/nihil - tidak menghentikan pipeline, lanjut)

echo.
echo [4/8] Sinkron daftar emiten (deteksi IPO baru + panen fundamental)...
"%PYEXE%" scripts\sinkron_emiten.py
if errorlevel 1 echo   (gagal/nihil - tidak menghentikan pipeline, lanjut commit)

REM  Bulletin mingguan HANYA hari Jumat: build_weekly.py merakit edisi harian
REM  Senin-Jumat minggu berjalan jadi satu PDF (kode AP-W<ddmmyy>-E01), lalu
REM  generate_index.py menaruhnya di manifest halaman Bulletin.
REM
REM  Kenapa di sini, bukan di GitHub Actions: template PDF memakai Bahnschrift
REM  + Cascadia Code (font Windows). Runner ubuntu tidak punya keduanya dan
REM  jatuh ke DejaVu yang lebih lebar - tata letak A4 yang rapat jadi meleber,
REM  dan terbitan mingguan kelihatan beda dari harian. Render di PC saja.
REM
REM  Gagal = tidak menghentikan pipeline: penyebab paling lazim adalah belum
REM  ada edisi harian yang dikurasi minggu itu, dan itu bukan kondisi galat.
REM  Harga dari Yahoo (IHSG + OHLC emiten). Terpisah dari langkah IDX di atas
REM  karena sumbernya lain: kalau Yahoo sedang menolak, data IDX hari itu tetap
REM  masuk. Panen harian cuma menarik 5 hari terakhir per simbol.
echo.
echo [5/8] Panen harga harian (IHSG + OHLC emiten)...
"%PYEXE%" scripts\panen_ihsg.py
if errorlevel 1 echo   (IHSG gagal - lanjut, tidak menghentikan pipeline)
REM  Sapuan Yahoo 963 emiten = jalur CADANGAN (ketetapan Johan 23 Agu:
REM  Stockbit utama, Yahoo cadangan). Dari Buka Laptop dilewati (flag di
REM  bawah): langkah [B] bat itu menimpa ohlc/ dengan arsip Stockbit
REM  beberapa menit kemudian, jadi sapuan ini +-25 menit kerja sia-sia
REM  (temuan Johan 28 Agu: "panen nya kok bnyk banget ? bukannya sudah
REM  ada ya ?"). Panggil manual/berdiri-sendiri = tetap jalan.
if "%LEWATI_OHLC_YAHOO%"=="1" (
  echo   sapuan OHLC Yahoo dilewati - arsip utama Stockbit dipanen langkah berikutnya
) else (
  "%PYEXE%" scripts\panen_ohlc.py
  if errorlevel 1 echo   (OHLC emiten gagal - lanjut, tidak menghentikan pipeline)
)

REM  Kabar (berita) dipanen di sini juga, bukan cuma lewat panen_kabar.ps1
REM  terjadwal sendiri - supaya edisi harian ikut membawa kabar terbaru saat
REM  dirakit sore. Gagal boleh, jangan sampai menghentikan commit data harga.
echo.
echo [6/8] Panen kabar (berita pasar)...
"%PYEXE%" scripts\panen_kabar.py --batas 25
"%PYEXE%" scripts\bangun_rezim_pasar.py

if errorlevel 1 echo   (rezim pasar gagal - lanjut)

if errorlevel 1 echo   (kabar gagal - lanjut, tidak menghentikan pipeline)

echo.
echo [7/8] Bulletin mingguan (khusus Jumat)...
for /f %%d in ('powershell -NoProfile -Command "(Get-Date).DayOfWeek"') do set HARI=%%d
if /i not "%HARI%"=="Friday" (
  echo   Hari ini %HARI% - dilewati, bulletin mingguan hanya dirakit Jumat.
) else (
  pushd arus-pasar
  "%PYEXE%" build_weekly.py
  if errorlevel 1 (
    echo   Perakitan mingguan gagal/nihil - lanjut tanpa bulletin mingguan.
  ) else (
    "%PYEXE%" generate_index.py
  )
  popd
)

echo.
echo [8/8] Commit dan push data baru...
git add data-idx/json/ arus-pasar/keluaran/
git diff --staged --quiet
if not errorlevel 1 (
  echo Tidak ada data baru hari ini.
  goto akhir
)
git commit -m "data: update IDX %date%"
git pull --rebase origin main
git push origin main
echo Data ter-push ke GitHub.

:akhir
echo.
echo Selesai %time%.
if not "%1"=="auto" pause
