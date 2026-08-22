# -*- coding: utf-8 -*-
"""Panen profil (pemegang saham, anak usaha, eksekutif, sejarah) per emiten dari Stockbit.

Endpoint `GET /emitten/{kode}/profile` — snapshot terkini. Rincian ruas:
`docs/riset/stockbit-inventaris-endpoint.md` baris 18.

Seluruh ruas yang endpoint berikan DISIMPAN apa adanya (`shareholder`,
`subsidiary`, `key_executive`, `address`, `background`, `history`, dst.) —
bukan memilih sebagian lalu membuang sisanya (kesalahan itu pernah terjadi di
proyek ini dan mahal, lihat CLAUDE.md "Ruas salinan yfinance"). Ruas turunan
`ringkasan` (jumlah pemegang saham/anak usaha/eksekutif) ditambahkan DI
SAMPING salinan penuhnya.

## Arsip mentah

Balasan JSON apa adanya ke `_arsip-mentah/profil-stockbit/<KODE>/<tanggal-
panen>.json` (di luar git). Arsip hari ini yang sudah ada dipakai ulang
kecuali `--paksa`.

Pakai:
    python scripts/panen_profil_stockbit.py BBCA BUMI AADI
    python scripts/panen_profil_stockbit.py --semua --jeda 0.4
    python scripts/panen_profil_stockbit.py BBCA --paksa
    python scripts/panen_profil_stockbit.py --swauji
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

DIR_JSON = AKAR / "data-idx" / "json"
DAFTAR = DIR_JSON / "daftar_emiten.json"
KELUARAN = DIR_JSON / "profil_stockbit"
ARSIP = AKAR / "_arsip-mentah" / "profil-stockbit"
WIB = timezone(timedelta(hours=7))

URL = "https://exodus.stockbit.com/emitten/{kode}/profile"


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def tulis_ulet(p: Path, teks: str, coba: int = 5) -> None:
    for i in range(coba):
        try:
            p.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if i == coba - 1:
                raise
            time.sleep(0.5 * (i + 1))


# ── Normalisasi ─────────────────────────────────────────────────────────────
def urai(mentah: dict) -> dict:
    """Balasan profile -> keluaran: salinan penuh `data` + `ringkasan` DI SAMPINGnya."""
    data = (mentah or {}).get("data") or {}
    eksekutif = data.get("key_executive") or {}
    return {
        **data,
        "ringkasan": {
            "jumlah_pemegang_saham": len(data.get("shareholder") or []),
            "jumlah_anak_usaha": len(data.get("subsidiary") or []),
            "jumlah_eksekutif": sum(
                len(v) for v in eksekutif.values() if isinstance(v, list)
            ),
        },
    }


def verifikasi(hasil: dict) -> str | None:
    if not (hasil.get("shareholder") or hasil.get("key_executive") or hasil.get("background")):
        return "profil kosong"
    return None


# ── Jaringan ────────────────────────────────────────────────────────────────
def ambil(token: str, kode: str, percobaan: int = 4):
    """Ambil profil satu emiten, dicoba ulang mundur-bertahap kalau jaringan
    gagal (lihat CLAUDE.md soal `RemoteDisconnected` mematikan panen ke-285)."""
    import requests

    galat = ""
    for ke in range(1, percobaan + 1):
        try:
            r = requests.get(URL.format(kode=kode), headers={
                "Authorization": f"Bearer {token}", "Origin": "https://stockbit.com",
                "Referer": "https://stockbit.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }, timeout=60)
            return r.status_code, (r.json() if r.status_code == 200 else r.text[:200])
        except Exception as e:  # noqa: BLE001 — jaringan apa pun
            galat = f"{type(e).__name__}: {str(e)[:100]}"
            if ke < percobaan:
                time.sleep(min(30.0, 2 ** ke))
    return 0, f"jaringan gagal {percobaan}x — {galat}"


def daftar_kode(semua: bool, pilih: list[str]) -> list[str]:
    if semua:
        d = baca(DAFTAR) or {}
        return [e["kode"] for e in d.get("emiten") or [] if e.get("kode")]
    return [k.strip().upper() for k in pilih if k.strip()]


def jalankan(a) -> int:
    from stockbit_token import token_segar

    kode_semua = daftar_kode(a.semua, a.kode)
    if not kode_semua:
        raise SystemExit("Tak ada emiten — beri kode atau --semua.")
    hari_ini = datetime.now(WIB).strftime("%Y-%m-%d")
    token = token_segar()
    if len(kode_semua) > 1:
        print(f"Panen profil Stockbit {hari_ini} — {len(kode_semua)} emiten, jeda {a.jeda}s")

    n_ok = n_lewat = n_gagal = 0
    mulai = time.time()
    for i, kode in enumerate(kode_semua, 1):
        ark = ARSIP / kode / f"{hari_ini}.json"
        if ark.exists() and not a.paksa:
            mentah = baca(ark)
            n_lewat += 1
        else:
            st, isi = ambil(token, kode)
            if st == 401:
                token = token_segar(margin=10**9)
                st, isi = ambil(token, kode)
            if st == 429:
                print(f"  {kode}: 429 — jeda 30 detik")
                time.sleep(30)
                st, isi = ambil(token, kode)
            if st != 200:
                n_gagal += 1
                print(f"  {kode}: HTTP {st} {str(isi)[:80]}")
                time.sleep(a.jeda)
                continue
            mentah = isi
            ark.parent.mkdir(parents=True, exist_ok=True)
            tulis_ulet(ark, json.dumps(mentah, ensure_ascii=False))
            time.sleep(a.jeda)

        hasil = urai(mentah)
        alasan = verifikasi(hasil)
        if alasan:
            n_gagal += 1
            print(f"  {kode}: verifikasi gagal — {alasan}")
            continue

        out = KELUARAN / f"{kode}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        tulis_ulet(out, json.dumps({
            "kode": kode,
            "sumber": "Stockbit profile",
            "dipanen_pada": hari_ini,
            **hasil,
        }, ensure_ascii=False, separators=(",", ":")))
        n_ok += 1
        if i % 100 == 0:
            print(f"  ...{i}/{len(kode_semua)} ({time.time()-mulai:.0f}s)")

    print(f"Selesai {time.time()-mulai:.0f}s: {n_ok} tersimpan ({n_lewat} dari arsip), {n_gagal} gagal")
    return 0 if n_ok else 1


def swauji() -> int:
    mentah = {"data": {
        "background": "Bank umum.",
        "shareholder": [
            {"name": "PT DWIMURIA INVESTAMA ANDALAN", "percentage": "54.942%", "badges": ["pengendali"]},
            {"name": "MASYARAKAT NON WARKAT", "percentage": "42.134%", "badges": []},
        ],
        "subsidiary": [
            {"company": "PT BCA Finance", "percentage": "100%", "types": "Pembiayaan"},
        ],
        "key_executive": {
            "commissioner": [{"value": "TONNY KUSNADI"}],
            "director": [{"value": "DAVID FORMULA"}, {"value": "HENDRA TANUMIHARDJA"}],
            "president_commissioner": [{"value": "JAHJA SETIAATMADJA"}],
            "vice_president_commissioner": [],
        },
        "address": [{"office": "Menara BCA"}],
        "history": {"date": "31 May 2000", "shares": "662,400,000"},
    }}
    hasil = urai(mentah)
    assert hasil["ringkasan"]["jumlah_pemegang_saham"] == 2
    assert hasil["ringkasan"]["jumlah_anak_usaha"] == 1
    assert hasil["ringkasan"]["jumlah_eksekutif"] == 4, "commissioner+director(2)+president_commissioner, vice kosong"
    assert hasil["shareholder"] == mentah["data"]["shareholder"], "salinan penuh wajib tetap ada"
    assert hasil["background"] == "Bank umum."
    assert verifikasi(hasil) is None

    assert verifikasi(urai({"data": {}})) == "profil kosong"
    assert verifikasi(urai({})) == "profil kosong"

    # Grup eksekutif kosong semua tak boleh menjatuhkan skrip.
    kosong = {"data": {"key_executive": {"director": []}, "background": "x"}}
    hasil2 = urai(kosong)
    assert hasil2["ringkasan"]["jumlah_eksekutif"] == 0 and verifikasi(hasil2) is None

    print("6/6 lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen profil dari Stockbit")
    ap.add_argument("kode", nargs="*", help="kode emiten, mis. BBCA BUMI AADI")
    ap.add_argument("--semua", action="store_true", help="seluruh daftar_emiten.json")
    ap.add_argument("--jeda", type=float, default=0.4, help="detik antar permintaan")
    ap.add_argument("--paksa", action="store_true", help="abaikan arsip hari ini, tarik ulang")
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()
    return jalankan(a)


if __name__ == "__main__":
    raise SystemExit(main())
