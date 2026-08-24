#!/usr/bin/env bash
# Rantai panen: tunggu 2026 -> tambal lubang 2026 -> laporkan sisa -> 2025.
#
# KENAPA BERANTAI, BUKAN BERSAMAAN. Dua alasan, dua-duanya terukur 23 Agu 2026:
#   1. Token Stockbit satu rantai. Dua proses yang sama-sama bisa memicu
#      refresh saling membatalkan — seluruh 963 emiten gagal berturut-turut
#      dalam 72 menit, dan tokennya harus disemai ulang dari sesi peramban.
#   2. Batas jaringannya sudah diukur: 44 thread bersih (0,03% gagal),
#      50 thread patah (3,5%, ConnectionError). Dua proses x 44 = 88 koneksi
#      serentak, jauh melewati titik patah itu — bukan dua kali lebih cepat,
#      melainkan dua-duanya melambat sambil menumpuk pekerjaan ulang.
#
# JEBAKAN VERSI PERTAMA (23 Agu 2026, sudah memakan korban): deteksi proses
# memakai `wmic`, yang SUDAH TIDAK ADA di Windows ini. Ia tak melempar galat —
# cuma menjawab kosong, yang terbaca sebagai "tak ada yang jalan", jadi panen
# 2025 langsung start berdampingan dengan 2026. Karena itu deteksinya sekarang
# PowerShell, DAN skrip ini menolak jalan kalau deteksinya sendiri terbukti
# tak berfungsi.
set -u

AKAR="/c/1-Johan/10. Pengembangan/IDX Statistik"
PY="C:/Python314/python.exe"
# ENAM varian GROSS saja. Yang enam lagi (net*) TIDAK dipanen sejak 23 Agu
# 2026 karena terbukti bisa dihitung: NET = GROSS bval - sval, dengan catatan
# di mode NET `sval` SUDAH bertanda negatif sementara di GROSS positif —
# konvensi itu yang bikin uji pertama seolah menunjukkan beda. Diuji dua kali
# secara terpisah: 5.756 baris (sesi AI Skill) dan 9.694 baris (sesi ini,
# 40 emiten acak x 6 hari x 6 pasangan), dua-duanya NOL beda dan nol broker
# ekstra. Memangkas separuh waktu panen dan ~28 GB untuk 2017-2025.
VARIAN="reguler,asing,nego,nego-asing,tunai,tunai-asing"
LOG="logs/rantai_panen.log"

cd "$AKAR" || exit 1

lapor() { echo "[rantai] $(date '+%F %T') $*" >> "$LOG"; }

hitung_backfill() {
  powershell -NoProfile -Command \
    "@(Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -like '*backfill_broker_massal*' }).Count" \
    2>/dev/null | tr -d '\r\n '
}

tunggu_sepi() {
  while :; do
    n=$(hitung_backfill)
    # Ragu = anggap masih jalan. Menebak "sudah sepi" saat sebenarnya belum
    # itu yang membunuh token; menunggu kelamaan cuma memboroskan waktu.
    [[ "$n" =~ ^[0-9]+$ ]] || n=1
    [ "$n" -eq 0 ] && return 0
    sleep 60
  done
}

# Palang: deteksi WAJIB melihat proses 2026 yang kita tahu sedang jalan saat
# skrip ini dipasang. Kalau ia menjawab 0 sekarang, ia rusak — berhenti.
awal=$(hitung_backfill)
if ! [[ "$awal" =~ ^[0-9]+$ ]] || [ "$awal" -lt 1 ]; then
  lapor "BATAL: deteksi proses tak berfungsi (jawab '$awal'). Tidak menyambung."
  exit 1
fi
lapor "menunggu panen 2026 selesai ($awal proses terdeteksi)"
tunggu_sepi
lapor "2026 berhenti"

# Jalan KEDUA 2026 — inilah yang menambal hari yang gagal saat token mati di
# tengah jalan pertama. Emiten yang sudah lengkap dilewati dalam hitungan
# detik tanpa menyentuh jaringan, jadi biayanya kecil.
lapor "jalan kedua 2026 (menambal lubang) dimulai"
"$PY" scripts/backfill_broker_massal.py --dari 2026-01-02 --sampai 2026-08-21 \
  --paralel 44 --jeda 0.4 --varian "$VARIAN" \
  >> logs/backfill_2026_semua_12varian.log 2>&1
lapor "jalan kedua 2026 selesai"

lapor "sisa lubang 2026:"
"$PY" -X utf8 scripts/cek_lubang_2026.py >> "$LOG" 2>&1

lapor "menyambung ke 2025"
"$PY" scripts/backfill_broker_massal.py --dari 2025-01-02 --sampai 2025-12-30 \
  --paralel 44 --jeda 0.4 --varian "$VARIAN" \
  >> logs/backfill_2025_semua_12varian.log 2>&1
lapor "2025 selesai"

lapor "sisa lubang 2025:"
"$PY" -X utf8 scripts/cek_lubang_2026.py --dari 2025-01-02 --sampai 2025-12-30 >> "$LOG" 2>&1
lapor "RANTAI SELESAI"
