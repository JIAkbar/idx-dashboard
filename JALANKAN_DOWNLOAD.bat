@echo off
REM Encoding keluaran - satu karakter non-ASCII di baris cetak membunuh
REM skrip Python di konsol ini (ralat 12 Sep 2026, sumbu lingkungan).
set PYTHONIOENCODING=utf-8

REM Unduh PDF statistik harian IDX ke data\pdf\ (cadangan kalau GitHub Actions diblokir).
REM Path relatif ke lokasi file ini, jadi tahan terhadap perpindahan folder.
cd /d "%~dp0"

echo ============================================================
echo  IDX Dashboard - Unduh PDF Statistik Harian
echo ============================================================
echo.

python scripts\download_idx.py --hari-ini

echo.
echo Selesai. Lanjutkan dengan JALANKAN_PARSE.bat untuk mengolah ke JSON.
pause
