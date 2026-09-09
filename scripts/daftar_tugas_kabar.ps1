# Daftarkan panen kabar rumahan ke Task Scheduler (#138).
#
# Dipisah dari `panen_kabar.ps1` supaya pendaftaran tak pernah terjadi sebagai
# efek samping menjalankan panen: yang satu boleh dijalankan kapan saja, yang
# lain mengubah keadaan mesin.
#
# Jadwalnya lima slot jam bursa hari kerja — 08:45, 10:45, 12:45, 14:45, 16:45
# WIB — sengaja BERSELANG dari cron awan (yang menembak menit :45 tiap 2 jam
# sepanjang hari): kalau awan jalan, pembanding item membuat yang kedua tak
# menghasilkan commit apa pun, jadi keduanya hidup berdampingan tanpa saling
# menimpa. Kalau awan hilang — dan 9 Sep 2026 ia hilang empat slot beruntun —
# yang rumahan menutup lubangnya.
#
# Dipakai cmdlet ScheduledTasks, BUKAN `schtasks /tr "..."`: jalur repo ini
# memuat spasi, dan kutipan bersarang di `/tr` diurai salah oleh cmd — percobaan
# pertama gagal dengan "Invalid argument/option - 'Pengembangan\IDX'".
#
# Membatalkan: Unregister-ScheduledTask -TaskName "PAPAN panen kabar 2 jam" -Confirm:$false
$ErrorActionPreference = "Stop"
$Akar = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Nama = "PAPAN panen kabar 2 jam"
$Skrip = Join-Path $Akar "scripts\panen_kabar.ps1"
if (-not (Test-Path $Skrip)) { throw "Skrip panen tak ada: $Skrip" }

# -WindowStyle Hidden: tugas ini jalan lima kali sehari; jendela yang muncul
# sendiri sesering itu akan berakhir dinonaktifkan orangnya.
$Aksi = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Skrip`"" `
  -WorkingDirectory $Akar

# Lima pemicu eksplisit, bukan satu pemicu berulang: jamnya jadi terbaca apa
# adanya di Task Scheduler, dan tak ada perilaku pengulangan yang perlu ditebak.
$Jam = "08:45", "10:45", "12:45", "14:45", "16:45"
$Pemicu = $Jam | ForEach-Object {
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $_
}

# StartWhenAvailable: laptop yang tertutup saat slotnya lewat tetap menyusul
# begitu tersedia — persis alasan tugas ini ada.
$Setelan = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Register-ScheduledTask -TaskName $Nama -Action $Aksi -Trigger $Pemicu -Settings $Setelan `
  -Description "Cadangan rumahan panen kabar PAPAN (#138) - cron GitHub best-effort dan terbukti hilang" `
  -Force | Out-Null

Write-Host "Terdaftar. Bukti:"
schtasks /query /tn "$Nama" /fo LIST
