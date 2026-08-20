# -*- coding: utf-8 -*-
"""Gerbang kesegaran data turunan — dipakai `panen-harian-rumah.yml`.

Pertanyaannya satu: **apakah turunannya ikut dijalankan sesudah sumbernya
dipanen?** Bukan "apakah skripnya jalan" — itu sudah dijawab exit code, dan
exit code ternyata tak cukup.

Kenapa gerbang ini ada, terukur 20 Agustus 2026:

* `kartu_analisa.py --semua` TANPA `--tulis` menghitung 383 emiten, mencetak
  `[383/383]`, keluar dengan kode **0**, dan tidak menyimpan apa pun. Dari
  log, jalan yang tak menyimpan terlihat persis seperti jalan yang berhasil.
* Akibatnya di layar: IHSG sudah 20 Agustus sementara Kartu Analisa,
  Screener, dan Seasonality masih 19 Agustus — nol galat, nol peringatan.

Aturannya sederhana dan itu yang membuatnya kuat: **turunan tak boleh lebih
tua daripada sumbernya.** Kartu membaca OHLC, jadi tanggal kartu terbanyak
tak boleh di bawah tanggal OHLC terbanyak.

Dipakai "terbanyak" (modus), bukan maksimum: satu emiten yang kebetulan punya
lilin lebih baru tak boleh membuat seluruh panen terlihat segar. Dan bukan
minimum: puluhan emiten yang berhenti diperdagangkan memang membeku di tanggal
lama selamanya, dan itu bukan kegagalan panen.

Pakai:
    python scripts/cek_kesegaran.py          # keluar 1 kalau turunan basi
    python scripts/cek_kesegaran.py --uji    # swauji, nol berkas dibaca
"""
from __future__ import annotations

import collections
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent


def modus_tanggal(pola: str, ambil) -> tuple[str | None, int]:
    """Tanggal yang paling banyak muncul di sekumpulan berkas, plus jumlahnya."""
    c: collections.Counter = collections.Counter()
    for p in AKAR.glob(pola):
        try:
            c[ambil(json.loads(p.read_text(encoding="utf-8")))] += 1
        except Exception:  # noqa: BLE001 — berkas rusak dihitung, tak menghentikan
            c["RUSAK"] += 1
    c.pop(None, None)
    if not c:
        return None, 0
    tgl, n = c.most_common(1)[0]
    return tgl, n


def periksa() -> int:
    ohlc_tgl, ohlc_n = modus_tanggal("data-idx/json/ohlc/*.json", lambda d: d.get("akhir"))
    print(f"OHLC  : {ohlc_tgl} pada {ohlc_n} emiten")

    p_ring = AKAR / "data-idx" / "json" / "kartu" / "ringkas.json"
    if not p_ring.exists():
        print("::warning::ringkas.json tak ada — kartu belum pernah dirakit")
        return 0
    ring = json.loads(p_ring.read_text(encoding="utf-8"))
    ct = collections.Counter(x.get("tgl") for x in ring.get("emiten") or [])
    kartu_tgl, kartu_n = (ct.most_common(1)[0] if ct else (None, 0))
    print(f"KARTU : {kartu_tgl} pada {kartu_n} emiten (diperbarui {ring.get('diperbarui')})")

    if ohlc_tgl and kartu_tgl and kartu_tgl < ohlc_tgl:
        print(f"::error::Kartu ({kartu_tgl}) tertinggal dari OHLC ({ohlc_tgl}) — "
              "turunannya tak ikut dijalankan. Cek `kartu_analisa.py --semua --tulis`; "
              "tanpa --tulis ia menghitung lalu diam.")
        return 1
    print("kesegaran turunan: LOLOS")
    return 0


def _uji() -> None:
    """Swauji tanpa menyentuh cakram — yang diuji aturannya, bukan datanya."""
    # Modus, bukan maksimum: satu emiten lebih baru tak boleh menutupi 900 yang basi.
    c = collections.Counter({"2026-08-19": 900, "2026-08-20": 1})
    assert c.most_common(1)[0] == ("2026-08-19", 900)

    # Modus, bukan minimum: emiten berhenti diperdagangkan membeku di tanggal
    # lama selamanya dan itu bukan kegagalan panen.
    c2 = collections.Counter({"2026-08-20": 920, "2026-07-17": 40})
    assert c2.most_common(1)[0][0] == "2026-08-20"

    # Aturan intinya: turunan lebih tua = gagal; sama atau lebih baru = lolos.
    assert "2026-08-19" < "2026-08-20"
    assert not ("2026-08-20" < "2026-08-20")
    print("uji cek_kesegaran: LOLOS")


if __name__ == "__main__":
    if "--uji" in sys.argv:
        _uji()
    else:
        raise SystemExit(periksa())
