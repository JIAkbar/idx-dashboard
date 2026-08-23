#!/usr/bin/env bash
# Menunggu panen 2026 benar-benar berhenti, lalu menjalankan 2025.
#
# KENAPA BERANTAI, BUKAN BERSAMAAN: token Stockbit itu satu rantai. Dua proses
# yang sama-sama bisa memicu refresh akan saling membatalkan dan mematikan
# keduanya — terjadi 23 Agu 2026 malam, seluruh 963 emiten gagal berturut-turut
# dalam 72 menit.
#
# JEBAKAN YANG SUDAH MEMAKAN KORBAN (23 Agu 2026, versi pertama skrip ini):
# deteksi prosesnya memakai `wmic`, yang SUDAH TIDAK ADA di Windows ini. Ia
# tak melempar galat — cuma mengembalikan kosong, yang terbaca sebagai "tak
# ada yang berjalan", jadi 2025 langsung start berdampingan dengan 2026.
# Karena itu deteksinya sekarang PowerShell, dan skrip ini menolak jalan
# kalau deteksinya sendiri tak berfungsi.
set -u
AKAR="/c/1-Johan/10. Pengembangan/IDX Statistik"
PY="C:/Python314/python.exe"
VARIAN="reguler,asing,nego,nego-asing,tunai,tunai-asing,net,net-asing,net-nego,net-nego-asing,net-tunai,net-tunai-asing"
LOG="logs/backfill_2025_semua_12varian.log"

cd "$AKAR" || exit 1

hitung_backfill() {
  powershell -NoProfile -Command \
    "@(Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -like '*backfill_broker_massal*' }).Count" 2>/dev/null | tr -d '\r\n '
}

# Palang pengaman: deteksinya WAJIB melihat proses 2026 yang sedang jalan
# sekarang. Kalau ia menjawab 0 di saat kita tahu ada yang jalan, berarti
# deteksinya rusak — berhenti, jangan menyambung membabi buta.
awal=$(hitung_backfill)
if ! [[ "$awal" =~ ^[0-9]+$ ]] || [ "$awal" -lt 1 ]; then
  echo "[rantai] BATAL $(date '+%F %T'): deteksi proses tak berfungsi (jawab '$awal'). Tidak menyambung." >> "$LOG"
  exit 1
fi
echo "[rantai] mulai menunggu $(date '+%F %T') — $awal backfill terdeteksi jalan" >> "$LOG"

while :; do
  n=$(hitung_backfill)
  [[ "$n" =~ ^[0-9]+$ ]] || n=1        # ragu = anggap masih jalan, jangan nekat
  [ "$n" -eq 0 ] && break
  sleep 60
done

echo "[rantai] 2026 berhenti $(date '+%F %T') — menyambung ke 2025" >> "$LOG"
"$PY" scripts/backfill_broker_massal.py \
  --dari 2025-01-02 --sampai 2025-12-30 \
  --paralel 44 --jeda 0.4 --varian "$VARIAN" >> "$LOG" 2>&1
echo "[rantai] 2025 selesai $(date '+%F %T')" >> "$LOG"
