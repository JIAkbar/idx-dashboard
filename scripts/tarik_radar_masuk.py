"""K7 (#170, dibuka Johan 27 Agu "kerjakan K7") — jembatan data Radar.

Keluhan aslinya: *"di page radar ini belum kesentuh sama sekali karena data
masih di gmail"*. UI Radar sudah ada (audit-kendali K7: arsip + stepper +
enam tab); yang bolong jalur MASUK datanya — lampiran surat (wdwl.png tabel
Watch List + rbu.pdf chart RBU) selama ini dipindah tangan.

Alur yang ditutup skrip ini:
  1. Johan unggah lampiran lewat /admin (RadarUnggah, sudah ada) ATAU
     dari mana pun ke bucket `screenshots` path `radar/<tanggal>/...`.
  2. Skrip ini MENARIK semua unggahan radar yang edisinya BELUM diparse
     (belum ada `data-idx/radar/r_<stem>.json`) ke singgahan lokal
     `data-idx/radar/masuk/<tanggal>/`.
  3. Sesi Claude Code (pemicu: "Radar Masuk") membaca singgahan itu —
     wdwl.png diparse visual -> r_<stem>.json, rbu.pdf dipecah per emiten ->
     `data-idx/radar/rbu/<tanggal>/<TIK>.png`, index.json diperbarui.
     Parsing tabel dari gambar butuh mata, bukan regex — karena itu langkah
     3 sesi, bukan cron.

Akses baca memakai anon key `.env.local` (pola backup_screenshot.py).
Pembacaan kotak surat Gmail langsung DITOLAK pengaman mode-otomatis
(27 Agu) — kalau kelak diizinkan Johan lewat aturan izin, langkah 1 bisa
diganti tarik-dari-Gmail; bentuk singgahan & langkah 3 tidak berubah.

Idempoten: berkas yang sudah ada & >0 byte dilewati; tak pernah menghapus.

Pakai:
  C:/Python314/python.exe scripts/tarik_radar_masuk.py
  C:/Python314/python.exe scripts/tarik_radar_masuk.py --swauji
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
RADAR = AKAR / "data-idx" / "radar"
MASUK = RADAR / "masuk"
ENV_LOCAL = AKAR / "app" / ".env.local"


def baca_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for baris in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
        baris = baris.strip()
        if not baris or baris.startswith("#") or "=" not in baris:
            continue
        k, v = baris.split("=", 1)
        env[k] = v
    return env


def stem(tanggal: str) -> str:
    """2026-08-13 -> r_260813 (pola namaBerkas lib/radar/arsip.ts)."""
    return "r_" + tanggal[2:4] + tanggal[5:7] + tanggal[8:10]


def daftar(url: str, key: str, prefix: str) -> list[dict]:
    r = requests.post(
        f"{url}/storage/v1/object/list/screenshots",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        json={"prefix": prefix, "limit": 1000},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def swauji() -> int:
    assert stem("2026-08-13") == "r_260813"
    assert stem("2026-01-02") == "r_260102"
    print("swauji lolos")
    return 0


def main() -> int:
    if "--swauji" in sys.argv:
        return swauji()
    env = baca_env()
    url = env.get("VITE_SUPABASE_URL", "").rstrip("/")
    key = env.get("VITE_SUPABASE_ANON_KEY", "")
    if not url or not key:
        print("VITE_SUPABASE_URL/ANON_KEY tak ketemu di app/.env.local", file=sys.stderr)
        return 1

    folder = daftar(url, key, "radar/")
    tanggal_semua = sorted(f["name"] for f in folder if f.get("name", "").startswith("20"))
    if not tanggal_semua:
        print("Bucket radar/ kosong — tak ada unggahan.")
        return 0

    belum = [t for t in tanggal_semua if not (RADAR / f"{stem(t)}.json").exists()]
    print(f"unggahan di bucket: {len(tanggal_semua)} tanggal; belum diparse: {len(belum)}")
    if not belum:
        print("Semua edisi unggahan sudah diparse — tak ada yang ditarik.")
        return 0

    ditarik = 0
    for t in belum:
        for f in daftar(url, key, f"radar/{t}"):
            nama = f.get("name", "")
            if not nama or nama.endswith("/"):
                continue
            dest = MASUK / t / nama
            if dest.exists() and dest.stat().st_size > 0:
                continue
            r = requests.get(
                f"{url}/storage/v1/object/screenshots/radar/{t}/{nama}",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
                timeout=60,
            )
            if r.status_code != 200:
                print(f"  GAGAL {t}/{nama}: HTTP {r.status_code}")
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(r.content)
            ditarik += 1
            print(f"  {t}/{nama}  {len(r.content)/1024:.0f} KB")
    print(f"selesai: {ditarik} berkas ke {MASUK}")
    if ditarik:
        print('Lanjutkan dengan sesi Claude Code, pemicu: "Radar Masuk" — parse '
              "singgahan jadi r_<stem>.json + rbu/<tanggal>/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
