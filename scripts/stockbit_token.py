# -*- coding: utf-8 -*-
"""Pengelola token Stockbit — access token 24 jam, refresh token 7 hari, diputar.

Johan 22 Agu 2026: *"gimana caranya supaya panen setiap hari autonomus"*.

## Mekanismenya, dibaca dari bundle JS stockbit.com (bukan tebakan)

    POST https://exodus.stockbit.com/login/refresh
    Authorization: Bearer <REFRESH token>
    -> {"data": {"access": {"token", "expired_at"}, "refresh": {"token", "expired_at"}}}

Diuji 22 Agu 2026: memanggilnya dengan ACCESS token ditolak persis
`token is not refresh token type` — jadi endpointnya hidup dan memang
membedakan jenis token. Umur terukur dari cookie `credentialStorage`:
access 24 jam, refresh 7 hari. Tiap refresh mengembalikan PASANGAN baru,
jadi selama dipanggil minimal sepekan sekali, rantainya tak pernah putus.

## Satu tempat penyimpanan, bukan dua

Runner GitHub rumahan memeriksa repo ke `C:\\actions-runner\\_work\\...`,
jadi `app/.env.local` di folder proyek TAK TERLIHAT dari sana. Kalau token
disimpan per-checkout, sesi Claude dan runner akan masing-masing memutar
refresh token dan saling membatalkan. Karena itu tokennya hidup di

    %USERPROFILE%\\.papan\\stockbit-token.json

— satu berkas untuk semua pemanggil di mesin ini, di luar git. Isi
`app/.env.local` (`STOCKBIT_TOKEN`, `STOCKBIT_REFRESH_TOKEN`) dipakai hanya
untuk MENYEMAI berkas itu pertama kali.

## Refresh MEMBATALKAN pasangan lama — terbukti 22 Agu 2026 21:58 WIB

Sekali skrip memutar, peramban yang menyemai tokennya terlempar keluar:
`/login/refresh` dari peramban dijawab 401 dan muncul "Sesi Kamu Sudah
Habis". Artinya satu rantai token hanya boleh dipegang SATU pemakai, dan
pemakainya adalah skrip ini. Konsekuensinya:

- Johan login ulang di peramban seperti biasa — itu rantai BARU miliknya,
  tak perlu disemai ke sini lagi selama rantai skrip masih hidup.
- Jangan pernah menyemai ulang dari cookie peramban kecuali rantai skrip
  benar-benar mati (refresh > 7 hari tak dipanggil, atau ditolak server).
  Menyemai ulang berarti mencuri rantai peramban dan melemparnya keluar lagi.
- Jangan memanggil `--segarkan` dari dua mesin. Berkas bersama di
  `%USERPROFILE%\\.papan` memang ada untuk ini.

Skrip TIDAK pernah mencetak token, termasuk saat galat.

Pakai:
    python scripts/stockbit_token.py --status      # umur kedua token, tanpa isinya
    python scripts/stockbit_token.py --segarkan    # paksa refresh sekarang
    python scripts/stockbit_token.py --uji         # swauji, nol jaringan
Dari skrip lain:
    from stockbit_token import token_segar
    access = token_segar()                          # refresh otomatis kalau perlu
"""
from __future__ import annotations

import base64
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).resolve().parent.parent
ENV_LOCAL = AKAR / "app" / ".env.local"
BERKAS_TOKEN = Path(os.environ.get("PAPAN_STOCKBIT_TOKEN_FILE")
                    or Path.home() / ".papan" / "stockbit-token.json")
URL_REFRESH = "https://exodus.stockbit.com/login/refresh"
WIB = timezone(timedelta(hours=7))

# Refresh kalau sisa umur access di bawah ini. Satu jam cukup untuk panen
# 950 emiten (±20 menit) tanpa tokennya mati di tengah jalan.
MARGIN_DETIK = 3600


def klaim_jwt(token: str) -> dict:
    """Isi klaim JWT tanpa verifikasi tanda tangan — yang memverifikasi server."""
    try:
        bagian = token.split(".")
        if len(bagian) != 3:
            return {}
        isi = bagian[1] + "=" * (-len(bagian[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(isi))
    except Exception:  # noqa: BLE001
        return {}


def kedaluwarsa(token: str | None) -> datetime | None:
    exp = klaim_jwt(token or "").get("exp")
    return datetime.fromtimestamp(exp, WIB) if exp else None


def _baca_env_local() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_LOCAL.exists():
        for baris in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
            baris = baris.strip()
            if baris and not baris.startswith("#") and "=" in baris:
                k, v = baris.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def baca_simpanan() -> dict:
    """Pasangan token dari berkas bersama; kalau belum ada, semai dari .env.local."""
    if BERKAS_TOKEN.exists():
        try:
            return json.loads(BERKAS_TOKEN.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    env = _baca_env_local()
    simpanan = {"access": env.get("STOCKBIT_TOKEN"), "refresh": env.get("STOCKBIT_REFRESH_TOKEN")}
    if simpanan["access"] or simpanan["refresh"]:
        tulis_simpanan(simpanan)
    return simpanan


def tulis_simpanan(simpanan: dict) -> None:
    BERKAS_TOKEN.parent.mkdir(parents=True, exist_ok=True)
    simpanan = dict(simpanan)
    simpanan["ditulis"] = datetime.now(WIB).isoformat(timespec="seconds")
    BERKAS_TOKEN.write_text(json.dumps(simpanan, indent=1), encoding="utf-8")


def perlu_refresh(access: str | None, sekarang: datetime | None = None,
                  margin: int = MARGIN_DETIK) -> bool:
    if not access:
        return True
    exp = kedaluwarsa(access)
    if not exp:
        return True
    return (exp - (sekarang or datetime.now(WIB))).total_seconds() < margin


def urai_balasan_refresh(balasan: dict) -> tuple[str, str]:
    """(access, refresh) dari balasan /login/refresh; ValueError kalau bentuknya lain.

    Bentuknya dari bundle JS: `e.data.data.access.token` dan `.refresh.token`.
    Kalau salah satu kosong, lebih baik gagal keras di sini daripada menulis
    pasangan setengah jadi yang memutus rantai di panen berikutnya.
    """
    d = (balasan or {}).get("data") or {}
    access = (d.get("access") or {}).get("token")
    refresh = (d.get("refresh") or {}).get("token")
    if not access or not refresh:
        raise ValueError("balasan refresh tak memuat access+refresh: "
                         + ", ".join(sorted(d)) if d else "data kosong")
    return access, refresh


def refresh_sekarang(simpanan: dict) -> dict:
    import requests

    refresh = simpanan.get("refresh")
    if not refresh:
        raise SystemExit("Tak ada refresh token — semai dulu: STOCKBIT_REFRESH_TOKEN di app/.env.local "
                         "(dari cookie credentialStorage.state.refresh.token).")
    exp_r = kedaluwarsa(refresh)
    if exp_r and exp_r < datetime.now(WIB):
        raise SystemExit(f"Refresh token sudah kedaluwarsa ({exp_r:%d %b %H:%M}) — "
                         "login ulang di peramban dan semai lagi.")
    r = requests.post(URL_REFRESH, headers={
        "Authorization": f"Bearer {refresh}",
        "Origin": "https://stockbit.com", "Referer": "https://stockbit.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }, timeout=30)
    if r.status_code != 200:
        # Pesan server dicetak, tokennya tidak.
        raise SystemExit(f"Refresh ditolak HTTP {r.status_code}: {r.text[:160]}")
    access, refresh_baru = urai_balasan_refresh(r.json())
    baru = {"access": access, "refresh": refresh_baru,
            "refresh_terakhir": datetime.now(WIB).isoformat(timespec="seconds")}
    tulis_simpanan(baru)
    return baru


def token_segar(margin: int = MARGIN_DETIK) -> str:
    """Access token yang masih hidup ≥ `margin` detik — refresh kalau perlu."""
    simpanan = baca_simpanan()
    if not perlu_refresh(simpanan.get("access"), margin=margin):
        return simpanan["access"]
    return refresh_sekarang(simpanan)["access"]


def status() -> int:
    s = baca_simpanan()
    kini = datetime.now(WIB)
    print(f"berkas : {BERKAS_TOKEN}")
    for nama in ("access", "refresh"):
        t = s.get(nama)
        if not t:
            print(f"{nama:8s}: TIDAK ADA")
            continue
        exp = kedaluwarsa(t)
        sisa = (exp - kini) if exp else None
        ket = (f"habis {exp:%d %b %H:%M WIB} ({sisa.total_seconds()/3600:+.1f} jam)"
               if exp else "exp tak terbaca")
        print(f"{nama:8s}: {ket}")
    if s.get("refresh_terakhir"):
        print(f"refresh terakhir: {s['refresh_terakhir']}")
    return 0


def swauji() -> int:
    def jwt_palsu(exp: int) -> str:
        isi = base64.urlsafe_b64encode(json.dumps({"exp": exp}).encode()).decode().rstrip("=")
        return f"x.{isi}.y"

    kini = datetime(2026, 8, 22, 12, 0, tzinfo=WIB)
    hidup = jwt_palsu(int((kini + timedelta(hours=5)).timestamp()))
    hampir = jwt_palsu(int((kini + timedelta(minutes=30)).timestamp()))
    mati = jwt_palsu(int((kini - timedelta(hours=1)).timestamp()))
    assert not perlu_refresh(hidup, kini)
    assert perlu_refresh(hampir, kini), "30 menit < margin 1 jam harus refresh"
    assert perlu_refresh(mati, kini)
    assert perlu_refresh(None, kini) and perlu_refresh("bukan-jwt", kini)

    a, r = urai_balasan_refresh({"data": {"access": {"token": "A"}, "refresh": {"token": "R"}}})
    assert (a, r) == ("A", "R")
    for rusak in ({}, {"data": {}}, {"data": {"access": {"token": "A"}}}):
        try:
            urai_balasan_refresh(rusak)
            raise AssertionError(f"balasan rusak lolos: {rusak}")
        except ValueError:
            pass

    # Simpanan: tulis lalu baca balik lewat berkas sementara, bukan berkas asli.
    import tempfile
    global BERKAS_TOKEN
    asli = BERKAS_TOKEN
    try:
        with tempfile.TemporaryDirectory() as d:
            BERKAS_TOKEN = Path(d) / "t.json"
            tulis_simpanan({"access": hidup, "refresh": "R"})
            s = json.loads(BERKAS_TOKEN.read_text(encoding="utf-8"))
            assert s["access"] == hidup and s["refresh"] == "R" and s["ditulis"]
    finally:
        BERKAS_TOKEN = asli

    print("7/7 lulus")
    return 0


if __name__ == "__main__":
    if "--uji" in sys.argv:
        raise SystemExit(swauji())
    if "--segarkan" in sys.argv:
        refresh_sekarang(baca_simpanan())
        print("refresh berhasil")
        raise SystemExit(status())
    raise SystemExit(status())
