# Panen kabar SAJA — cadangan RUMAHAN untuk cron awan (#138).
#
# Kenapa terpisah dari JALANKAN_OTOMATIS.bat: harga (IHSG/OHLC/PDF IDX) cukup
# sekali sehari sore, tapi berita berubah tiap jam — menunggu jadwal harga
# berarti kabar bisa basi 10+ jam.
#
# Kenapa jadi CADANGAN, bukan sekadar pilihan: cron GitHub itu best-effort dan
# terbukti hilang. Terukur 9 Sep 2026: jalan terjadwal terakhir 06:39 WIB, lalu
# EMPAT slot beruntun tidak jalan sampai 13:5x — alurnya `active`, YAML-nya
# terurai, cron-nya utuh, dan pemicu `push` tetap normal; yang hilang khusus
# pemicu terjadwal. Berkas alurnya sendiri sudah mencatat gejala yang sama pada
# 7-8 Sep ("dua slot jam bursa hilang"), jadi ini bukan sekali kejadian.
#
# Dua pendorong pada satu berkas itu disengaja dan aman karena keduanya:
#   1. memakai PEMBANDING YANG SAMA (`scripts/beda_kabar.py`) sehingga tak ada
#      commit yang isinya cuma stempel waktu, dan
#   2. `git pull --rebase` sebelum push, jadi yang kalah balapan menyusul,
#      bukan menimpa.
#
# Mendaftarkannya ke Task Scheduler: `scripts/daftar_tugas_kabar.ps1`.
$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

# Log ke berkas: tanpa ini kegagalan hilang bersama jendela yang tertutup, dan
# yang tersisa cuma berkas berstempel tertinggal tanpa cara tahu kenapa —
# pelajaran yang sama yang melahirkan blok Tee di bat panen (#102 A).
$null = New-Item -ItemType Directory -Force -Path "logs"
$Log = Join-Path "logs" ("panen_kabar_" + (Get-Date -Format 'yyyy-MM-dd') + ".log")
function Catat($teks) {
  $baris = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $teks
  Write-Host $baris
  Add-Content -Path $Log -Value $baris -Encoding utf8
}

$PyExe = "C:\Python314\python.exe"
if (-not (Test-Path $PyExe)) { $PyExe = "python" }

Catat "mulai panen kabar"
& $PyExe "scripts\panen_kabar.py" --batas 30 2>&1 | ForEach-Object { Catat $_ }
if ($LASTEXITCODE -ne 0) {
  Catat "panen gagal (semua sumber mati) - kabar.json lama TIDAK ditimpa"
  exit 1
}

# Pembanding yang sama dengan CI: ISI daftarnya, bukan berkasnya.
$Beda = (& $PyExe "scripts\beda_kabar.py") | Select-Object -Last 1
if ($Beda -eq "0") {
  Catat "daftar kabar sama - tidak commit (berkas dipulihkan)"
  git checkout -- data-idx/json/kabar.json data-idx/json/snips.json 2>$null
  exit 0
}
Catat "item kabar berubah: $Beda"

# Rebase DULU: cron awan bisa saja mendorong lebih dulu. Yang kalah balapan
# menyusul, bukan menimpa.
git add data-idx/json/kabar.json data-idx/json/snips.json data-idx/json/kabar-sumber-awan.json 2>$null
git commit -m ("data: panen kabar rumahan " + (Get-Date -Format 'yyyy-MM-dd HH:mm')) -- data-idx/json/kabar.json data-idx/json/snips.json data-idx/json/kabar-sumber-awan.json 2>&1 | ForEach-Object { Catat $_ }
# --autostash: tugas ini jalan lima kali sehari TANPA ada yang menonton, dan
# pohon kerja mesin ini jarang bersih (sesi kerja, berkas panen lain). Tanpa
# itu rebase menolak dengan "cannot pull with rebase: You have unstaged
# changes" dan kabar tak pernah terdorong — CI sudah memakainya sejak awal.
git pull --rebase --autostash origin main 2>&1 | ForEach-Object { Catat $_ }
if ($LASTEXITCODE -ne 0) {
  # Rebase yang berhenti di konflik meninggalkan .git/rebase-merge dan git
  # BERIKUTNYA di mesin ini menolak bekerja — jalan keluarnya wajib ada.
  Catat "rebase gagal - dibatalkan, commit lokal tetap ada"
  git rebase --abort 2>$null
  exit 1
}
git push origin main 2>&1 | ForEach-Object { Catat $_ }
if ($LASTEXITCODE -ne 0) { Catat "push gagal"; exit 1 }
Catat "selesai - kabar terdorong"
