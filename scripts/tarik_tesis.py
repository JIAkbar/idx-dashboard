# -*- coding: utf-8 -*-
"""Tarik tabel `tesis` ke cakram supaya hakimnya bisa nol jaringan.

Antrean #3 (*"kerjakan #3"*, 6 Sep 2026). Satu-satunya langkah berjaringan di
rantai tesis; `scripts/riset/nilai_tesis.py` sesudahnya tidak menyentuh
jaringan sama sekali. Pemisahan itu yang membuat angkanya bisa dihitung ulang
kapan saja tanpa bergantung pada basis data yang hidup.

**Tak butuh kunci rahasia.** Kebijakan baca tabel `tesis` adalah PUBLIK
(keputusan Johan #1: "halaman publik boleh membaca isi tesis"), jadi kunci
anon yang sudah ada di `app/.env.local` cukup. Skrip ini TIDAK pernah memakai
service key — yang bisa menulis apa pun tak perlu dipegang oleh pembaca.

Jalankan dari akar repo:
    python scripts/tarik_tesis.py
    python scripts/tarik_tesis.py --uji     # swauji parser env, nol jaringan
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
ENV_LOCAL = AKAR / "app" / ".env.local"
KELUARAN = AKAR / "data-idx" / "json" / "tesis_masuk.json"
WIB = timezone(timedelta(hours=7))

# Ruas yang ditarik. Disebut satu per satu, bukan `*`: kalau kelak tabelnya
# menumbuhkan ruas yang tak boleh keluar dari basis data, ia tak ikut terbawa
# ke berkas publik hanya karena namanya kebetulan ada di sana.
RUAS = ("id,penyetor,kode,arah,tanggal_sinyal,masuk_bawah,masuk_atas,target,stop,"
        "horizon_hari,alasan,status,ambigu,dibuat_pada")


def baca_env(teks: str) -> dict[str, str]:
    """Parser .env seadanya — cukup untuk dua ruas yang dibutuhkan."""
    hasil = {}
    for baris in teks.splitlines():
        baris = baris.strip()
        if not baris or baris.startswith("#") or "=" not in baris:
            continue
        k, v = baris.split("=", 1)
        hasil[k.strip()] = v.strip().strip('"').strip("'")
    return hasil


def main() -> int:
    import requests  # lokal: swauji tak butuh jaringan sama sekali

    if not ENV_LOCAL.exists():
        print(f"Tak ada {ENV_LOCAL.relative_to(AKAR)} — kunci Supabase belum tersedia.",
              file=sys.stderr)
        return 1
    env = baca_env(ENV_LOCAL.read_text(encoding="utf-8"))
    url, kunci = env.get("VITE_SUPABASE_URL"), env.get("VITE_SUPABASE_ANON_KEY")
    if not url or not kunci:
        print("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY kosong.", file=sys.stderr)
        return 1

    r = requests.get(f"{url}/rest/v1/tesis",
                     params={"select": RUAS, "order": "dibuat_pada.asc"},
                     headers={"apikey": kunci, "Authorization": f"Bearer {kunci}"},
                     timeout=30)
    if r.status_code == 404:
        print("Tabel `tesis` belum ada — terapkan dulu "
              "supabase/migrations/20260906_tesis_kontributor.sql", file=sys.stderr)
        return 2
    r.raise_for_status()
    baris = r.json()

    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(json.dumps({
        "ditarik": datetime.now(WIB).isoformat(timespec="seconds"),
        "n": len(baris),
        "tesis": baris,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    batal = sum(1 for b in baris if b.get("status") == "batal")
    print(f"OK -> {KELUARAN.relative_to(AKAR)} ({len(baris)} tesis, {batal} batal)")
    return 0


def swauji() -> None:
    e = baca_env('# komentar\nVITE_SUPABASE_URL=https://x.supabase.co\n'
                 'VITE_SUPABASE_ANON_KEY="abc"\n\nSTOCKBIT_TOKEN=zzz\n')
    assert e["VITE_SUPABASE_URL"] == "https://x.supabase.co", e
    assert e["VITE_SUPABASE_ANON_KEY"] == "abc", e   # tanda kutip dilepas
    assert "STOCKBIT_TOKEN" in e, e                  # dibaca, tapi tak pernah dipakai
    assert baca_env("bukan-pasangan\n") == {}
    # Ruas disebut eksplisit, tak pernah `*`.
    assert "*" not in RUAS and "alasan" in RUAS and "lampiran" not in RUAS
    print("swauji tarik_tesis: 5 kasus lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    if ap.parse_args().uji:
        swauji()
        sys.exit(0)
    sys.exit(main())
