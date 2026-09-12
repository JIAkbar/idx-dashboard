@echo off
REM Encoding keluaran - satu karakter non-ASCII di baris cetak membunuh
REM skrip Python di konsol ini (ralat 12 Sep 2026, sumbu lingkungan).
set PYTHONIOENCODING=utf-8

REM Olah PDF di data\pdf\ menjadi data\ds_YYMMDD.json + perbarui data\index.json.
REM Path relatif ke lokasi file ini, jadi tahan terhadap perpindahan folder.
cd /d "%~dp0"

echo ============================================================
echo  IDX Dashboard - Parse PDF ke JSON
echo ============================================================
echo.

python scripts\parse_idx_pdf.py --semua

echo.
pause
