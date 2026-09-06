@echo off
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
