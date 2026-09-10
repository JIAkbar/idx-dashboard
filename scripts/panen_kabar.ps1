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
# pemicu terjadwal.
#
# ── KENAPA TANPA REBASE SAMA SEKALI (#163, ralat 9 Sep 22:15) ──────────────
# Versi pertama memanen dulu, commit, lalu `git pull --rebase --autostash`.
# Cron awan mendorong 22:10 — di antara panen dan push — dan rebase berhenti:
#   "CONFLICT (content): Auto-merging data-idx/json/kabar.json"
# lalu dibatalkan, jadi kabar rumahan tak pernah terdorong.
#
# Konflik pada berkas HASIL GENERASI tak pernah layak diselesaikan tangan:
# `kabar.json` bukan tulisan siapa-siapa, ia keluaran pemanen atas apa pun yang
# ada di cakram. Jadi jawabannya bukan "gabungkan dua versi", melainkan
# "bangun ulang di atas versi remote terbaru". Itu yang dilakukan skrip ini:
# ambil ketiga berkas dari `origin/main`, panen di atasnya (pemanen memang
# menggabung dengan isi berkas yang ada), lalu dorong. Kalau remote maju lagi
# di tengah jalan, ulangi sekali dari awal alih-alih menambal.
#
# Ikutannya: TAK ADA autostash yang bisa tertinggal di cabang gagal, karena tak
# ada rebase sama sekali. Pohon kerja di luar ketiga berkas itu tak disentuh.
#
# Mendaftarkannya ke Task Scheduler: `scripts/daftar_tugas_kabar.ps1`.
$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

$Berkas = @(
  "data-idx/json/kabar.json",
  "data-idx/json/snips.json",
  "data-idx/json/kabar-sumber-awan.json"
)

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

# Kembalikan ketiga berkas ke keadaan commit lokal — dipakai saat tak ada
# kabar baru, dan saat menyerah, supaya pohon kerja tak meninggalkan jejak.
function PulihkanBerkas {
  git checkout HEAD -- $Berkas 2>$null
}

$Sukses = $false
foreach ($percobaan in 1..2) {
  Catat "percobaan $percobaan - basis dari remote"

  git fetch origin 2>&1 | ForEach-Object { Catat $_ }
  if ($LASTEXITCODE -ne 0) { Catat "fetch gagal - berhenti"; PulihkanBerkas; exit 1 }

  # Sisa bangunan percobaan SEBELUMNYA dibuang dulu. Tanpa ini maju-cepat
  # ditolak dengan "Your local changes would be overwritten by merge" — lapis
  # kedua kegagalan yang sama, dan lagi-lagi hanya terlihat dari uji interleave.
  PulihkanBerkas

  # CABANGNYA ikut dimajukan, bukan cuma berkasnya. Versi pertama perbaikan
  # #163 hanya mengambil ketiga berkas dari remote dan lupa ini — commit lalu
  # menumpuk di atas HEAD lama, dan push SELALU ditolak non-fast-forward,
  # termasuk pada percobaan kedua. Rebase yang dicabut itu yang diam-diam
  # memajukan cabang; mencabutnya tanpa menggantinya memindahkan kegagalan,
  # bukan menghapusnya. Ketahuan dari uji interleave, bukan dari membaca ulang.
  #
  # `--ff-only`: maju kalau memang cuma tertinggal, MENOLAK menggabung. Cabang
  # yang menyimpang (punya commit sendiri DAN tertinggal) bukan urusan skrip
  # data — ia berhenti dan bilang, bukan menebak.
  $tertinggal = [int](git rev-list --count HEAD..origin/main)
  $mendahului = [int](git rev-list --count origin/main..HEAD)
  if ($tertinggal -gt 0 -and $mendahului -gt 0) {
    Catat "cabang menyimpang ($mendahului maju / $tertinggal tertinggal) - berhenti, bukan urusan skrip data"
    PulihkanBerkas
    exit 1
  }
  if ($tertinggal -gt 0) {
    git merge --ff-only origin/main 2>&1 | ForEach-Object { Catat $_ }
    if ($LASTEXITCODE -ne 0) { Catat "maju-cepat gagal - berhenti"; PulihkanBerkas; exit 1 }
  }

  # Basis = isi remote TERBARU. Hanya ketiga berkas ini yang disentuh.
  git checkout origin/main -- $Berkas 2>&1 | ForEach-Object { Catat $_ }

  & $PyExe "scripts\panen_kabar.py" --batas 30 2>&1 | ForEach-Object { Catat $_ }
  if ($LASTEXITCODE -ne 0) {
    Catat "panen gagal (semua sumber mati) - berkas dipulihkan, tak ada yang ditimpa"
    PulihkanBerkas
    exit 1
  }

  # Dibandingkan ke REMOTE, bukan ke commit lokal: basisnya memang remote, dan
  # kalau lokal tertinggal kedua pertanyaan itu berbeda jawabannya.
  $Beda = (& $PyExe "scripts\beda_kabar.py" --basis origin/main) | Select-Object -Last 1
  if ($Beda -eq "0") {
    Catat "daftar kabar sama dengan remote - tidak commit"
    PulihkanBerkas
    exit 0
  }
  Catat "item kabar berbeda dari remote: $Beda"

  git add $Berkas 2>$null
  git commit -m ("data: panen kabar rumahan " + (Get-Date -Format 'yyyy-MM-dd HH:mm')) -- $Berkas 2>&1 |
    ForEach-Object { Catat $_ }
  if ($LASTEXITCODE -ne 0) { Catat "commit gagal - berhenti"; exit 1 }

  git push origin main 2>&1 | ForEach-Object { Catat $_ }
  if ($LASTEXITCODE -eq 0) { $Sukses = $true; break }

  Catat "push ditolak - remote maju di tengah jalan"
  # Commit sendiri dilepas supaya percobaan kedua benar-benar mulai dari
  # remote, bukan menumpuk di atas commit yang sudah tertinggal. Dijaga
  # ketat: hanya kalau commit teratas MEMANG milik skrip ini.
  $judul = (git log -1 --format='%s')
  if ($judul -like "data: panen kabar rumahan *") {
    git reset --soft HEAD~1 2>&1 | ForEach-Object { Catat $_ }
    git restore --staged $Berkas 2>$null
  } else {
    Catat "commit teratas bukan milik skrip ini ($judul) - tidak dilepas, berhenti"
    exit 1
  }
}

if (-not $Sukses) { Catat "dua percobaan gagal - berhenti tanpa menimpa apa pun"; PulihkanBerkas; exit 1 }
Catat "selesai - kabar terdorong"
