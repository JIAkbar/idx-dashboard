<#
.SYNOPSIS
  Pasang GitHub Actions self-hosted runner di PC ini, sebagai layanan Windows.

.DESCRIPTION
  Dipakai supaya panen kabar IDX + Kontan berjalan dari IP rumahan. Terukur
  20 Agustus 2026: kedua sumber itu menjawab 200 dari sini dan 403 dari runner
  GitHub. Yang membedakan alamat IP-nya, bukan bentuk permintaannya — jadi tak
  ada perubahan kode yang bisa menambalnya.

  Skrip ini hanya memasang runner. Alurnya sudah ada di
  `.github/workflows/panen-kabar-rumah.yml`.

.PARAMETER Token
  Token pendaftaran dari GitHub. AMBIL SENDIRI, jangan dari siapa pun:

    Repo -> Settings -> Actions -> Runners -> New self-hosted runner
    -> Windows -> salin nilai sesudah `--token` (diawali A..., berlaku 1 jam)

  Token ini SEKALI PAKAI dan kedaluwarsa satu jam. Ia bukan kata sandi dan
  bukan token pribadi: ia hanya bisa mendaftarkan runner ke repo ini.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\pasang-runner.ps1 -Token AXXXXX...
#>
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Repo    = 'https://github.com/JIAkbar/idx-dashboard',
  [string]$Dir     = 'C:\actions-runner',
  [string]$Nama    = "papan-$env:COMPUTERNAME",
  [string]$Versi   = '2.319.1'
)

$ErrorActionPreference = 'Stop'

# Layanan Windows berjalan sebagai akun lain dengan PATH-nya sendiri. Alurnya
# mencari Python yang punya curl_cffi secara eksplisit, jadi periksa di sini
# supaya kegagalannya ketahuan SEKARANG, bukan dua jam lagi saat cron menyala
# dan gagal tanpa ada yang melihat.
$py = 'C:\Python314\python.exe'
if (-not (Test-Path $py)) { throw "Python tak ditemukan di $py" }
& $py -c "import curl_cffi, requests" 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "$py belum punya curl_cffi/requests. Jalankan dulu: `"$py`" -m pip install curl_cffi requests"
}
Write-Host "Python siap: $py"

if (-not (Test-Path $Dir)) { New-Item -ItemType Directory -Path $Dir -Force | Out-Null }
Set-Location $Dir

$zip = "actions-runner-win-x64-$Versi.zip"
if (-not (Test-Path $zip)) {
  Write-Host "Mengunduh runner $Versi..."
  Invoke-WebRequest -Uri "https://github.com/actions/runner/releases/download/v$Versi/$zip" -OutFile $zip
}
if (-not (Test-Path (Join-Path $Dir 'config.cmd'))) {
  Write-Host "Membuka paket..."
  Expand-Archive -Path $zip -DestinationPath $Dir -Force
}

# --unattended: jangan pernah menunggu jawaban di konsol; kalau ada yang perlu
# ditanyakan, lebih baik gagal terang-terangan daripada menggantung diam.
# --labels papan: dipakai kalau nanti ada runner lain di mesin yang sama.
Write-Host "Mendaftarkan runner '$Nama'..."
& .\config.cmd --unattended --url $Repo --token $Token --name $Nama `
    --labels papan --work _work --runasservice
if ($LASTEXITCODE -ne 0) { throw "Pendaftaran gagal (kode $LASTEXITCODE). Token kedaluwarsa? Ambil yang baru." }

$svc = Get-Service -Name 'actions.runner.*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($svc) {
  # Otomatis menyala lagi sesudah PC dinyalakan ulang — tanpa ini runner mati
  # diam-diam tiap kali Windows restart dan panennya berhenti tanpa alarm.
  Set-Service -Name $svc.Name -StartupType Automatic
  if ($svc.Status -ne 'Running') { Start-Service -Name $svc.Name }
  Write-Host "Layanan: $($svc.Name) — $((Get-Service $svc.Name).Status), mulai otomatis."
} else {
  Write-Warning "Layanan runner tak ditemukan. Periksa $Dir\_diag untuk log."
}

Write-Host ""
Write-Host "Selesai. Periksa di: $Repo/settings/actions/runners"
Write-Host "Uji sekarang tanpa menunggu jadwal:"
Write-Host "  gh workflow run panen-kabar-rumah.yml"
