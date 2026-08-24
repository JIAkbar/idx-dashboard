# -*- coding: utf-8 -*-
"""Cek token Stockbit di %USERPROFILE%\\.papan\\stockbit-token.json — baru atau belum, hidup atau mati.

Johan 23 Agu 2026: *"script untuk cek token baru"* — dibuat sesudah runner broker
berhenti 21:01 karena `Refresh ditolak HTTP 401 UNAUTHORIZED`.

Yang dilakukan (tanpa refresh, tanpa mencetak isi token):
  1. Baca pasangan access/refresh, tampilkan iat/exp masing-masing (dari klaim JWT).
  2. Bandingkan dengan jejak pemeriksaan sebelumnya (`.papan/cek-token-terakhir.json`):
     iat access lebih baru dari jejak = TOKEN BARU.
  3. Uji hidup: satu GET ringan ke `marketdetectors/BBCA` (1 hari) dengan access token
     apa adanya. 200 = hidup, 401 = mati. TIDAK memanggil /login/refresh (itu memutar
     pasangan dan bisa melempar pemakai lain keluar — lihat stockbit_token.py).

Pakai:
    python scripts/cek_token.py              # sekali
    python scripts/cek_token.py --tunggu 60  # ulangi tiap 60 detik sampai token baru HIDUP
    python scripts/cek_token.py --semai      # ambil pasangan baru dari app/.env.local (hasil
                                             # cek_token_console.js), cadangkan berkas lama,
                                             # tulis ke ~/.papan, lalu uji hidup
Kode keluar: 0 token hidup · 1 token mati/kedaluwarsa · 2 berkas tidak ada/rusak
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
WIB = timezone(timedelta(hours=7))
BERKAS = Path(os.environ.get("PAPAN_STOCKBIT_TOKEN_FILE") or (Path.home() / ".papan" / "stockbit-token.json"))
JEJAK = BERKAS.with_name("cek-token-terakhir.json")
URL = "https://exodus.stockbit.com/marketdetectors/BBCA"


def klaim(token: str | None) -> dict:
    try:
        p = token.split(".")[1]
        p += "=" * (-len(p) % 4)
        return json.loads(base64.urlsafe_b64decode(p))
    except Exception:  # noqa: BLE001 — bukan JWT / rusak
        return {}


def wib(ts: int | None) -> str:
    return datetime.fromtimestamp(ts, WIB).strftime("%d %b %H:%M") if ts else "?"


def uji_hidup(access: str) -> tuple[int, str]:
    import requests
    r = requests.get(URL, headers={
        "Authorization": f"Bearer {access}", "Origin": "https://stockbit.com",
        "Referer": "https://stockbit.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }, params={"from": "2026-08-21", "to": "2026-08-21", "transaction_type": "TRANSACTION_TYPE_GROSS",
               "market_board": "MARKET_BOARD_REGULER", "investor_type": "INVESTOR_TYPE_ALL", "limit": 5},
       timeout=30)
    if r.status_code == 200:
        n = len(((r.json().get("data") or {}).get("broker_summary") or {}).get("brokers_buy") or [])
        return 200, f"200 OK — {n} broker beli BBCA 21 Agu terbaca"
    return r.status_code, f"HTTP {r.status_code}: {r.text[:120]}"


def cek() -> int:
    kini = datetime.now(WIB)
    print(f"[{kini:%H:%M:%S}] berkas: {BERKAS}")
    if not BERKAS.exists():
        print("  TIDAK ADA — semai dulu (lihat stockbit_token.py)")
        return 2
    try:
        s = json.loads(BERKAS.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"  RUSAK: {e}")
        return 2
    mtime = datetime.fromtimestamp(BERKAS.stat().st_mtime, WIB)
    print(f"  ditulis: {s.get('ditulis', '?')} | mtime {mtime:%d %b %H:%M:%S}")
    a, r = klaim(s.get("access")), klaim(s.get("refresh"))
    for nama, k in (("access", a), ("refresh", r)):
        if not k:
            print(f"  {nama:8s}: tidak ada / bukan JWT")
            continue
        sisa = (k.get("exp", 0) - kini.timestamp()) / 3600
        print(f"  {nama:8s}: terbit {wib(k.get('iat'))} · habis {wib(k.get('exp'))} ({sisa:+.1f} jam)")

    jejak = json.loads(JEJAK.read_text(encoding="utf-8")) if JEJAK.exists() else {}
    iat = a.get("iat")
    baru = bool(iat and iat > (jejak.get("iat_access") or 0))
    print(f"  token baru sejak cek sebelumnya: {'YA' if baru else 'TIDAK'}"
          + (f" (sebelumnya terbit {wib(jejak.get('iat_access'))})" if jejak.get("iat_access") else " (cek pertama)"))

    if not s.get("access"):
        return 1
    kode, ket = uji_hidup(s["access"])
    print(f"  uji hidup: {ket}")
    JEJAK.write_text(json.dumps({"iat_access": iat, "dicek": kini.isoformat(), "hasil": kode}), encoding="utf-8")
    if kode == 200:
        print("  ==> TOKEN HIDUP" + (" DAN BARU" if baru else ""))
        return 0
    print("  ==> TOKEN MATI — login ulang di peramban, semai pasangan baru (stockbit_token.py), lalu jalankan ulang runner")
    return 1


ENV_LOCAL = Path(__file__).resolve().parent.parent / "app" / ".env.local"


def semai() -> int:
    """Pasangan baru dari app/.env.local → ~/.papan/stockbit-token.json (yang lama dicadangkan)."""
    if not ENV_LOCAL.exists():
        print(f"  {ENV_LOCAL} tidak ada — tempel dulu dua baris dari cek_token_console.js")
        return 2
    env = {}
    for b in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
        b = b.strip()
        if b and not b.startswith("#") and "=" in b:
            k, v = b.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    access, refresh = env.get("STOCKBIT_TOKEN"), env.get("STOCKBIT_REFRESH_TOKEN")
    if not (access and refresh):
        print("  STOCKBIT_TOKEN / STOCKBIT_REFRESH_TOKEN kosong di .env.local")
        return 2
    ka = klaim(access)
    if BERKAS.exists():
        lama = klaim(json.loads(BERKAS.read_text(encoding="utf-8")).get("access"))
        if lama.get("iat") and ka.get("iat") and ka["iat"] <= lama["iat"]:
            print(f"  .env.local TIDAK lebih baru dari ~/.papan (terbit {wib(ka.get('iat'))} vs {wib(lama.get('iat'))}) — tidak ditulis")
            return 1
        cadangan = BERKAS.with_name(f"stockbit-token.bak-{datetime.now(WIB):%Y%m%d-%H%M%S}.json")
        BERKAS.replace(cadangan)
        print(f"  berkas lama dicadangkan: {cadangan.name}")
    BERKAS.parent.mkdir(parents=True, exist_ok=True)
    BERKAS.write_text(json.dumps({"access": access, "refresh": refresh,
                                  "ditulis": datetime.now(WIB).isoformat(timespec="seconds"),
                                  "asal": "semai cek_token.py dari app/.env.local"}, indent=1), encoding="utf-8")
    print(f"  pasangan baru ditulis (access terbit {wib(ka.get('iat'))})")
    return cek()


def main() -> int:
    if "--semai" in sys.argv:
        return semai()
    if "--tunggu" in sys.argv:
        i = sys.argv.index("--tunggu")
        detik = int(sys.argv[i + 1]) if len(sys.argv) > i + 1 and sys.argv[i + 1].isdigit() else 60
        while True:
            if cek() == 0:
                return 0
            print(f"  ... cek lagi {detik} detik\n")
            time.sleep(detik)
    return cek()


if __name__ == "__main__":
    raise SystemExit(main())
