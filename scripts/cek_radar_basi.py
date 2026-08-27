# -*- coding: utf-8 -*-
"""Penjaga kebasian arsip Radar WDWL — dipanggil task buka-laptop. Nol jaringan.

Asal: Johan 27 Agu 2026, "otomatiskan tarik radar dari Gmail ke task buka
laptop / tapi radar biasanya gak tentu repot juga yaaa". Tarik+transkrip
SENGAJA tidak di sini — dua-duanya cuma ada di sesi Claude: Gmail MCP
(autentikasi connector Cowork, TIDAK ada di CLI — dicek `claude mcp list`
27 Agu) dan transkrip visual (wdwl.png itu tabel GAMBAR). Pemicunya tetap
"Radar Masuk". Yang bisa diotomatkan di bat: MENDETEKSI ketinggalan.

Radar terbit TAK TENTU (2-4 edisi/pekan, Google Group Meta-noia), jadi basi
tak bisa diukur "tiap hari harus ada". Ukurannya HARI BURSA sejak edisi
terakhir index.json, dihitung dari kalender bursa nyata = deret tanggal
ohlc/IHSG.json (jalankan SESUDAH langkah [B] jahit supaya kalendernya segar).
Terukur atas 11 edisi Agu 2026: jeda antar edisi 1-2 hari bursa, terpanjang 2.
Ambang bawaan 3 = satu jeda wajar + satu edisi luput.

Lewat ambang -> cetak peringatan + tulis penanda .radar_basi.json (dibaca
manusia/sesi; di luar git). Segar -> hapus penanda. Exit SELALU 0: penjaga
tidak boleh menghentikan pipeline panen.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
AMBANG_BAWAAN = 3
PENANDA = AKAR / ".radar_basi.json"


def hari_bursa_tertinggal(tgl_radar: str, tanggal_bursa: list[str]) -> int:
    # ISO string urut leksikal = urut kronologis; cukup hitung yang lebih baru.
    return sum(1 for t in tanggal_bursa if t > tgl_radar)


def jalan(indeks: Path, ihsg: Path, ambang: int, penanda: Path) -> int:
    dates = json.loads(indeks.read_text(encoding="utf-8"))["dates"]
    tgl_radar = max(dates)
    tanggal_bursa = [b[0] for b in json.loads(ihsg.read_text(encoding="utf-8"))["d"]]
    n = hari_bursa_tertinggal(tgl_radar, tanggal_bursa)
    if n > ambang:
        penanda.write_text(json.dumps({
            "radar_terakhir": tgl_radar,
            "hari_bursa_tertinggal": n,
            "ambang": ambang,
            "tindakan": "buka sesi Claude, ketik: Radar Masuk",
        }, indent=1), encoding="utf-8")
        print("!" * 60)
        print(f"!! RADAR BASI: edisi terakhir {tgl_radar}, tertinggal {n} hari bursa")
        print("!! Kemungkinan ada edisi baru di Gmail yang belum ditarik.")
        print("!! Tindakan: buka sesi Claude, ketik pemicu: Radar Masuk")
        print("!" * 60)
    else:
        penanda.unlink(missing_ok=True)
        print(f"Radar segar - edisi terakhir {tgl_radar}, tertinggal {n} hari bursa, ambang {ambang}.")
    return n


def swauji() -> None:
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        ihsg = d / "IHSG.json"
        ihsg.write_text(json.dumps({"d": [[t, 1, 1, 1, 1, 1] for t in
            ["2026-08-20", "2026-08-21", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27"]]}), encoding="utf-8")
        idx = d / "index.json"
        pen = d / ".flag.json"

        idx.write_text(json.dumps({"dates": ["2026-08-24", "2026-08-26"]}), encoding="utf-8")
        assert jalan(idx, ihsg, 3, pen) == 1 and not pen.exists(), "segar: 1 hari, tanpa penanda"

        idx.write_text(json.dumps({"dates": ["2026-08-20"]}), encoding="utf-8")
        assert jalan(idx, ihsg, 3, pen) == 5 and pen.exists(), "basi: 5 hari, penanda ditulis"
        assert json.loads(pen.read_text(encoding="utf-8"))["hari_bursa_tertinggal"] == 5

        idx.write_text(json.dumps({"dates": ["2026-08-27"]}), encoding="utf-8")
        assert jalan(idx, ihsg, 3, pen) == 0 and not pen.exists(), "segar lagi: penanda dihapus"
    print("swauji lolos")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--ambang", type=int, default=AMBANG_BAWAAN)
    p.add_argument("--indeks", type=Path, default=AKAR / "data-idx/radar/index.json")
    p.add_argument("--ihsg", type=Path, default=AKAR / "data-idx/json/ohlc/IHSG.json")
    p.add_argument("--swauji", action="store_true")
    a = p.parse_args()
    try:
        if a.swauji:
            swauji()
        else:
            jalan(a.indeks, a.ihsg, a.ambang, PENANDA)
    except Exception as e:  # penjaga tak boleh mematikan pipeline
        print(f"cek_radar_basi gagal (diabaikan, pipeline lanjut): {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
