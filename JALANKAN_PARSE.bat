@echo off
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
