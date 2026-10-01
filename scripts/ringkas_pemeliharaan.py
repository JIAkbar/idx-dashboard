"""Isi halaman pemeliharaan (#266, Johan 1 Okt 2026: "kerjakan #266 A+B").

Halaman pemeliharaan tak boleh fetch apa pun, jadi isinya dibakukan ke
`app/src/views/pemeliharaan.json` dan ikut ter-bundle saat build:
  ihsg     potret IHSG dari ohlc/IHSG.json (close, perubahan, jarak dari puncak, rata-rata)
  jejak    rekam jejak Deep Dive dari tinjauan_deepdive.json (hasil H+5)
  deepdive draf analis arus-pasar/draft/DD-pemeliharaan-*.json TERBARU yang
           disetujui=true, dibawa apa adanya (draf baru tak menurunkan yang tayang)

Pakai:  python scripts/ringkas_pemeliharaan.py
Uji:    python scripts/ringkas_pemeliharaan.py --uji
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
JSON = AKAR / "data-idx" / "json"
KELUAR = AKAR / "app" / "src" / "views" / "pemeliharaan.json"


def potret_ihsg(d: list) -> dict:
    c = [b[4] for b in d]
    tahun = d[-252:]
    puncak = max(tahun, key=lambda b: b[2])
    sma = lambda n: round(sum(c[-n:]) / n, 2)
    return {
        "tanggal": d[-1][0], "close": c[-1],
        "hari_pct": round((c[-1] / c[-2] - 1) * 100, 2),
        "lima_pct": round((c[-1] / c[-6] - 1) * 100, 2),
        "duapuluh_pct": round((c[-1] / c[-21] - 1) * 100, 2),
        "puncak": puncak[2], "puncak_tanggal": puncak[0],
        "dari_puncak_pct": round((c[-1] / puncak[2] - 1) * 100, 1),
        "sma20": sma(20), "sma50": sma(50), "sma200": sma(200),
    }


def main() -> int:
    ihsg = json.loads((JSON / "ohlc" / "IHSG.json").read_text(encoding="utf-8"))["d"]
    tinjau = json.loads((JSON / "tinjauan_deepdive.json").read_text(encoding="utf-8"))
    jejak = [{k: t.get(k) for k in ("kode", "tanggal", "harga_acuan", "level_bull", "level_invalid",
                                     "harga_h5", "tertinggi_h5", "gerak_pct", "status")}
             | {"tersentuh": [u["level"] for u in t.get("urutan_tersentuh") or []]}
             for t in tinjau["terbitan"]]
    # Draf TERBARU yang sudah disetujui; draf baru yang belum disetujui tak
    # menurunkan yang sedang tayang (#268).
    draf = sorted((AKAR / "arus-pasar" / "draft").glob("DD-pemeliharaan-*.json"), key=lambda p: p.stem)
    semua = [json.loads(p.read_text(encoding="utf-8")) for p in draf]
    dd = next((d for d in reversed(semua) if d.get("disetujui")), None)
    if dd:
        dd.pop("catatan", None)
    isi = {"ihsg": potret_ihsg(ihsg), "jejak": jejak, "deepdive": dd}
    KELUAR.write_text(json.dumps(isi, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"pemeliharaan.json: IHSG {isi['ihsg']['tanggal']} {isi['ihsg']['close']}, jejak {len(jejak)}, "
          f"deepdive {'disetujui' if dd and dd.get('disetujui') else 'draf (tak tayang)'}")
    return 0


def uji() -> int:
    d = [[f"t{i}", 0, 100 + i, 0, 100 + i, 0] for i in range(260)]
    p = potret_ihsg(d)
    assert p["close"] == 359 and p["puncak"] == 359 and p["dari_puncak_pct"] == 0.0
    assert p["hari_pct"] == round((359 / 358 - 1) * 100, 2)
    print("uji ringkas_pemeliharaan: LOLOS")
    return 0


if __name__ == "__main__":
    sys.exit(uji() if "--uji" in sys.argv else main())
