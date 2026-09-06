@echo off
REM Server lokal untuk menguji dashboard. Path relatif ke lokasi file ini,
REM jadi tetap jalan walau folder proyek dipindahkan.
cd /d "%~dp0"

echo ============================================
echo   IDX Market Intelligence - Server Lokal
echo ============================================
echo.
echo Dashboard : http://localhost:8000/index_live.html
echo Maintenance: http://localhost:8000/index.html
echo.
echo Tekan Ctrl+C untuk menghentikan server.
echo.

start http://localhost:8000/index_live.html
python -m http.server 8000

pause
