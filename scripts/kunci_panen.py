"""Kenali dan buang `.panen.lock` basi (#245, Johan 27 Sep 2026: "sweep dan
perbaiki semua").

Bat panen membuat folder `.panen.lock` di awal dan menghapusnya di ujung. Bat
yang mati di tengah jalan (jendela cmd ditutup 23 Sep 22:12; berhenti 26 Sep
+-14:15) meninggalkan kunci itu, dan jalan berikutnya keluar tanpa memanen:
panen sore 24 Sep hilang karena kunci 23 Sep. Bat tak bisa membedakan kunci
milik proses hidup dari kunci milik proses mati - skrip ini yang membedakannya.

Kunci dianggap DIPEGANG bila ada proses lain (selain rantai induk pemanggil)
yang menjalankan bat panen atau skrip pemanen Stockbit/broker. Tanpa itu
kuncinya BASI dan dihapus.

Kode keluar (dibaca bat lewat `if errorlevel`):
  0  tak ada kunci, atau kunci dipegang proses hidup (dibiarkan)
  2  kunci basi DIHAPUS
Pakai:  python scripts/kunci_panen.py --bersihkan-basi
Uji:    python scripts/kunci_panen.py --uji
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
KUNCI = AKAR / ".panen.lock"
# Proses yang boleh memegang kunci: bat panen lokal dan pemanen yang memakai
# token Stockbit (anak bat bisa hidup terus walau induknya mati - 23 Sep PID 14252).
POLA_PEMEGANG = re.compile(
    r"JALANKAN_(BUKA_LAPTOP|PANEN_SORE|OTOMATIS)\.bat|"
    r"panen_(broker_harian|ohlcv_stockbit|intraday_stockbit|keystats_stockbit|info_stockbit|profil_stockbit|asing)\.py|"
    r"backfill_broker_massal\.py|bangun_broker_tahunan\.py", re.I)


def daftar_proses() -> list[dict]:
    ps = ("Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine "
          "| ConvertTo-Json -Compress")
    r = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=60)
    d = json.loads(r.stdout or "[]")
    return d if isinstance(d, list) else [d]


def leluhur(proses: list[dict], pid: int) -> set[int]:
    induk = {p["ProcessId"]: p["ParentProcessId"] for p in proses}
    hasil = set()
    while pid in induk and pid not in hasil:
        hasil.add(pid)
        pid = induk[pid]
    return hasil


# Hanya penjalan skrip yang dihitung: editor yang sekadar MEMBUKA berkas pemanen
# (notepad++ ...\panen_broker_harian.py) bukan pemegang (sanggahan pemeriksa #245).
PENJALAN = {"python.exe", "pythonw.exe", "cmd.exe", "powershell.exe", "pwsh.exe"}


def pemegang(proses: list[dict], kecuali: set[int]) -> list[dict]:
    return [p for p in proses
            if p["ProcessId"] not in kecuali and (p.get("Name") or "").lower() in PENJALAN
            and POLA_PEMEGANG.search(p.get("CommandLine") or "")]


def main() -> int:
    if not KUNCI.exists():
        return 0
    try:
        proses = daftar_proses()
    except (OSError, subprocess.SubprocessError, ValueError) as e:
        print(f"  kunci: daftar proses tak terbaca ({type(e).__name__}) - kunci dibiarkan")
        return 0
    hidup = pemegang(proses, leluhur(proses, os.getpid()))
    if hidup:
        print(f"  kunci dipegang proses hidup: " + ", ".join(str(p["ProcessId"]) for p in hidup[:5]))
        return 0
    try:
        KUNCI.rmdir()
    except OSError as e:
        print(f"  kunci basi tapi gagal dihapus: {e}")
        return 0
    print("  KUNCI BASI dihapus - jalan sebelumnya mati sebelum selesai (tak ada proses panen yang hidup).")
    return 2


def uji() -> int:
    proses = [
        {"ProcessId": 1, "ParentProcessId": 0, "Name": "explorer.exe", "CommandLine": "explorer.exe"},
        {"ProcessId": 10, "Name": "cmd.exe", "ParentProcessId": 1, "CommandLine": 'cmd /c "C:\\x\\JALANKAN_PANEN_SORE.bat" auto'},
        {"ProcessId": 11, "Name": "cmd.exe", "ParentProcessId": 10, "CommandLine": 'cmd /c "C:\\x\\JALANKAN_PANEN_SORE.bat" auto'},
        {"ProcessId": 12, "Name": "python.exe", "ParentProcessId": 11, "CommandLine": "python scripts\\kunci_panen.py --bersihkan-basi"},
        {"ProcessId": 20, "Name": "python.exe", "ParentProcessId": 1, "CommandLine": "python scripts\\panen_broker_harian.py --tanggal 2026-09-17"},
        {"ProcessId": 30, "Name": "python.exe", "ParentProcessId": 1, "CommandLine": "python ruang-agen\\server.py 5190"},
    ]
    # Rantai induk pemanggil (10, 11, 12) bukan pemegang; pemanen yatim 20 pemegang.
    assert leluhur(proses, 12) == {12, 11, 10, 1}
    assert [p["ProcessId"] for p in pemegang(proses, leluhur(proses, 12))] == [20]
    # Tanpa pemanen yatim: tak ada pemegang -> basi.
    tanpa = [p for p in proses if p["ProcessId"] != 20]
    assert pemegang(tanpa, leluhur(tanpa, 12)) == []
    # Bat lain yang hidup (bukan leluhur) memegang kunci.
    lain = tanpa + [{"ProcessId": 40, "Name": "cmd.exe", "ParentProcessId": 1, "CommandLine": "cmd /c JALANKAN_BUKA_LAPTOP.bat auto"}]
    assert [p["ProcessId"] for p in pemegang(lain, leluhur(lain, 12))] == [40]
    # Editor yang membuka berkas pemanen bukan pemegang.
    ed = tanpa + [{"ProcessId": 50, "Name": "notepad++.exe", "ParentProcessId": 1,
                   "CommandLine": r"notepad++.exe C:\x\scripts\panen_broker_harian.py"}]
    assert pemegang(ed, leluhur(ed, 12)) == []
    print("uji kunci_panen: LOLOS 5 kasus")
    return 0


if __name__ == "__main__":
    if "--uji" in sys.argv:
        sys.exit(uji())
    if "--bersihkan-basi" in sys.argv:
        sys.exit(main())
    print(__doc__)
