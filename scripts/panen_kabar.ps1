# Panen kabar SAJA — terpisah dari JALANKAN_OTOMATIS.bat.
#
# Kenapa terpisah: harga (IHSG/OHLC/PDF IDX) cukup sekali sehari sore, tapi
# berita (IDX/IPOT/Kontan) berubah tiap jam — menunggu jadwal harga berarti
# kabar bisa basi 10+ jam. Skrip ini dipanggil lebih sering (mis. tiap jam
# kerja bursa) lewat Task Scheduler-nya sendiri, terpisah dari task harga.
# Cara mendaftarkan: lihat docs/panen-kabar.md (perintah schtasks siap salin,
# TIDAK dijalankan otomatis di sini — Johan yang mendaftarkan).
Set-Location (Join-Path $PSScriptRoot "..")

# Sama seperti PYEXE di JALANKAN_OTOMATIS.bat — konsisten di dua jalur.
$PyExe = "C:\Python314\python.exe"
if (-not (Test-Path $PyExe)) { $PyExe = "python" }

& $PyExe "scripts\panen_kabar.py" --batas 25
if ($LASTEXITCODE -ne 0) {
  Write-Host "Panen kabar gagal (semua sumber mati) - kabar.json lama tetap dipakai."
  exit 1
}

# Commit lokal saja (aturan repo: JANGAN push tanpa diminta). Kalau tak ada
# perubahan, `git diff --quiet` bikin commit dilewati tanpa error.
git add data-idx/json/kabar.json
git diff --staged --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -m "data: panen kabar $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
  Write-Host "Kabar ter-commit lokal."
} else {
  Write-Host "Tidak ada kabar baru."
}
