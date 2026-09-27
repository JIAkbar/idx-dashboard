"""Pelapor panen harian di laptop (#241 A, Johan 27 Sep 2026: "kerjakan semua
sesuai rekomendasimu").

Sejak #241 hanya SATU pemanen harian: workflow `panen-harian-rumah.yml` di
runner rumahan (layanan Windows - tak mati saat jendela ditutup atau pengguna
keluar). Sebelumnya bat laptop dan workflow memanen bersamaan dengan token dan
jatah Stockbit yang sama (23 Sep 2026 tumpang tindih 19:52-23:44), dan bat yang
jendelanya ditutup meninggalkan kunci basi.

Bat terjadwal (PAPAN-PanenSore 18:00, PAPAN-BukaLaptop saat login 18-20) kini
hanya menjalankan skrip ini, yang:
  1. menarik repo (`git pull --ff-only`) supaya pemeriksaan membaca data terbaru;
  2. menunggu run workflow harian HARI INI selesai (paling lama BATAS_TUNGGU);
  3. mencatat ke berkas ringkasan: run yang gagal/terpotong/tak jalan, dan
     turunan yang basi menurut `cek_kesegaran.py`;
  4. menyerahkan berkas itu ke `ringkas_panen.py` (#238): kelengkapan broker,
     notifikasi Windows, Notepad bila ada masalah.

Kode keluar 0 selalu - pelapor tak boleh menggagalkan tugas terjadwal.
Pakai:  python scripts/lapor_panen.py [--tanpa-tunggu]
Uji:    python scripts/lapor_panen.py --uji
"""
from __future__ import annotations

import datetime
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
REPO = "JIAkbar/idx-dashboard"
ALUR = {
    "panen-harian-rumah.yml": "Panen harian (runner rumahan)",
    "update-rumah.yml": "Statistik IDX (runner rumahan)",
}
BATAS_TUNGGU = 4 * 3600
JEDA = 300


def jalankan(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=AKAR, capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=timeout)


def run_hari_ini(alur: str, hari: datetime.date) -> list[dict]:
    r = jalankan(["gh", "run", "list", "--repo", REPO, "--workflow", alur, "--limit", "5",
                  "--json", "status,conclusion,createdAt,url,event"], timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:200] or "gh gagal")
    return [x for x in json.loads(r.stdout or "[]") if x["createdAt"][:10] == hari.isoformat()]


def vonis(nama: str, runs: list[dict]) -> str | None:
    """Satu baris GAGAL untuk alur ini, atau None kalau run terakhir hari ini sukses."""
    if not runs:
        return f"{nama}: belum jalan hari ini - runner mati, laptop sempat mati, atau jadwal GitHub tertunda"
    r = runs[0]
    if r["status"] != "completed":
        return f"{nama}: masih berjalan sesudah batas tunggu - {r['url']}"
    if r["conclusion"] == "success":
        return None
    arti = {"cancelled": "TERPOTONG batas waktu", "failure": "GAGAL"}.get(r["conclusion"], r["conclusion"])
    return f"{nama}: {arti} - {r['url']}"


def basi_dari(keluaran: str) -> str | None:
    m = re.search(r"::error::(\d+) turunan basi: (.+)", keluaran)
    return f"{m.group(1)} turunan data basi: {m.group(2)[:300]}" if m else None


def main(tunggu: bool) -> int:
    hari = datetime.datetime.now(datetime.timezone.utc).date()
    tgl = datetime.date.today().isoformat()
    berkas = AKAR / "logs" / f"ringkasan_panen_harian_{tgl}.txt"
    berkas.parent.mkdir(exist_ok=True)
    # Sore (18:00) dan buka-laptop (login 18-20) bisa sama-sama memanggil ini;
    # satu laporan per hari cukup - yang kedua keluar.
    try:
        os.close(os.open(AKAR / "logs" / f".pelapor_{tgl}", os.O_CREAT | os.O_EXCL))
    except FileExistsError:
        print("  pelapor hari ini sudah jalan - keluar.")
        return 0
    gagal: list[str] = []

    r = jalankan(["git", "pull", "--ff-only", "-q"], timeout=300)
    if r.returncode != 0:
        gagal.append("folder laptop tak bisa ditarik dari GitHub (git pull --ff-only ditolak) - pemeriksaan memakai data lama")

    mulai = time.time()
    try:
        while tunggu and time.time() - mulai < BATAS_TUNGGU:
            runs = run_hari_ini("panen-harian-rumah.yml", hari)
            if runs and runs[0]["status"] == "completed":
                break
            if not runs and datetime.datetime.now(datetime.timezone.utc).hour >= 15:
                break  # jadwal 11:30 UTC; lewat 15:00 UTC tanpa run = tak akan datang
            print(f"  menunggu workflow harian ({int((time.time() - mulai) / 60)} menit)...", flush=True)
            time.sleep(JEDA)
        jalankan(["git", "pull", "--ff-only", "-q"], timeout=300)  # tarik hasil workflow yang baru selesai
        for alur, nama in ALUR.items():
            v = vonis(nama, run_hari_ini(alur, hari))
            if v:
                gagal.append(v)
    except (OSError, subprocess.SubprocessError, RuntimeError, ValueError) as e:
        gagal.append(f"status workflow tak terbaca ({type(e).__name__}: {str(e)[:120]})")

    try:
        k = jalankan([sys.executable, "scripts/cek_kesegaran.py"], timeout=600)
        b = basi_dari(k.stdout + k.stderr)
        if b:
            gagal.append(b)
    except (OSError, subprocess.SubprocessError) as e:
        gagal.append(f"cek kesegaran tak jalan ({type(e).__name__})")

    with open(berkas, "w", encoding="utf-8") as f:
        f.write(f"PAPAN pelapor panen harian - {datetime.datetime.now():%d-%m-%Y %H:%M}\n")
        for g in gagal:
            f.write(f"GAGAL: {g}\n")
    sys.path.insert(0, str(AKAR / "scripts"))
    import ringkas_panen
    ringkas_panen.main(berkas, "Panen harian")
    return 0


def uji() -> int:
    ok = [{"status": "completed", "conclusion": "success", "url": "u1"}]
    assert vonis("A", ok) is None
    assert "TERPOTONG" in vonis("A", [{"status": "completed", "conclusion": "cancelled", "url": "u2"}])
    assert "GAGAL" in vonis("A", [{"status": "completed", "conclusion": "failure", "url": "u3"}])
    assert "belum jalan" in vonis("A", [])
    assert basi_dari("::error::23 turunan basi: Harian Papan, Kartu").startswith("23 turunan data basi")
    assert basi_dari("segar 9 basi 0") is None
    print("uji lapor_panen: LOLOS 6 kasus")
    return 0


if __name__ == "__main__":
    if "--uji" in sys.argv:
        sys.exit(uji())
    try:
        sys.exit(main(tunggu="--tanpa-tunggu" not in sys.argv))
    except Exception as e:  # pelapor tak boleh menggagalkan tugas terjadwal
        print(f"pelapor gagal: {type(e).__name__}: {e}")
        sys.exit(0)
