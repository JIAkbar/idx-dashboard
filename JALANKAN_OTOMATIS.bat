@echo off
REM Encoding keluaran - satu karakter non-ASCII di baris cetak membunuh
REM skrip Python di konsol ini (ralat 12 Sep 2026, sumbu lingkungan).
set PYTHONIOENCODING=utf-8

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
set "LOG_NAMA=panen_otomatis"

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


echo ============================================================
echo  IDX Dashboard - Update Otomatis (%date% %time%)
echo ============================================================

echo.
echo [1/8] Download PDF harian + mingguan + bulanan...
"%PYEXE%" scripts\download_idx.py --hari-ini --jenis semua
REM Susulan bulan berjalan - PDF IDX kadang terbit sesudah runner jalan
REM (31 Agu 2026 hilang seminggu karena --hari-ini tak menengok mundur).
REM Yang sudah ada dilewati [SKIP], jadi ini murah.
for /f %%b in ('call "%PYEXE%" -c "import datetime;print(datetime.date.today().month)"') do set BLN=%%b
for /f %%t in ('call "%PYEXE%" -c "import datetime;print(datetime.date.today().year)"') do set THN=%%t
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
REM Dua penjaga di blok ini, keduanya dibayar pengalaman:
REM
REM 1. `git commit` DULU tanpa daftar path, jadi ia mengambil SELURUH index —
REM    termasuk berkas yang kebetulan sudah di-stage sesi lain. Persis cara
REM    13 berkas halaman Kartu Analisa terbawa ke commit berjudul lain pada
REM    18 Agu. Sejak pipa sore memanggil berkas ini sebagai langkah [A]
REM    (#80 A), risikonya jalan tiap hari tanpa ada yang menonton. Sekarang
REM    commit menyebut kedua path yang memang miliknya.
REM 2. `git pull --rebase` yang berhenti di konflik meninggalkan
REM    `.git/rebase-merge` terbuka, dan git BERIKUTNYA di mesin ini menolak
REM    bekerja (terjadi 2 Sep 18:39 dan 3 Sep 08:01). Rebase yang gagal
REM    sekarang dibatalkan dan panennya berhenti dengan pesan, bukan
REM    meninggalkan pohon kerja setengah jalan.
set DATA_PATH=data-idx/json/ arus-pasar/keluaran/
REM SATU daftar jalur untuk add DAN commit (#148). Commit ber-pathspec
REM hanya mengambil jalur yang disebut, jadi dua daftar yang berbeda
REM berarti berkas yang sudah di-add tak pernah terdorong dan tertahan
REM di index tanpa satu pun galat - terjadi pada profil_stockbit, dan
REM sebelumnya pada gudang broker tahunan.
set "DATA_JALUR=%DATA_PATH%"
git add %DATA_JALUR% 2>nul
git diff --staged --quiet -- %DATA_PATH%
if not errorlevel 1 (
  echo Tidak ada data baru hari ini.
  goto akhir
)
git commit -m "data: update IDX %date%" -- %DATA_JALUR%
git pull --rebase origin main
if errorlevel 1 (
  echo   Rebase gagal - dibatalkan, data TETAP ter-commit tapi belum ter-push.
  git rebase --abort
  goto akhir
)
git push origin main
echo Data ter-push ke GitHub.

:akhir
echo.
echo Selesai %time%.
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
