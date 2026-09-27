# -*- coding: utf-8 -*-
"""Isi hari yang belum ada di data-idx/json/asing/ dari ohlcv_stockbit/ (#253 A).

LATAR — IDX memasang verifikasi bot dan `panen_asing.py` berhenti bisa
menembus sejak 2026-09-23. Stockbit sudah punya `foreignbuy`/`foreignsell`
dalam RUPIAH sampai beberapa hari lebih baru. Diukur 27 Sep 2026 atas 5.034
hari x 120 emiten: lembar taksiran = foreignbuy_rp / (value/volume) meleset
median -0,09% (p10 -1,49%, p90 +0,58%) terhadap angka IDX, arah net cocok
99,3%. Keputusan Johan: selama IDX terblokir, hari yang belum ada di asing/
diisi dari Stockbit, DITANDAI (kolom ke-7 "stockbit"), dan ditulis di layar.

Begitu IDX kembali, `panen_asing.py` menimpanya OTOMATIS — `gabung()` di sana
sudah menang-tanggal-baru tanpa perubahan apa pun di sini.

Baris lama (IDX, 6 kolom) TIDAK PERNAH disentuh/ditimpa — skrip ini cuma
MENAMBAH baris bertanggal sesudah `akhir` yang tersimpan, maksimal
MAKS_HARI_ISIAN hari bursa terakhir per emiten.

Pakai:
  py -3.14 scripts/isi_asing_stockbit.py --kering   # cuma hitung
  py -3.14 scripts/isi_asing_stockbit.py            # tulis
  py -3.14 scripts/isi_asing_stockbit.py --uji      # uji bawaan, tanpa data nyata
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent

# Paling banyak berapa hari bursa terakhir yang boleh diisi dari Stockbit per
# emiten — jaga-jaga kalau IDX terblokir lama, isian tak menumpuk tanpa batas.
MAKS_HARI_ISIAN = 10

KOLOM_SB = ("tanggal", "volume", "value", "frequency", "foreignbuy", "foreignsell")


def _baca(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 — berkas rusak/tak ada diperlakukan sama
        return None


def _bil(v) -> int:
    """Sama seperti `panen_asing._bil`: dibulatkan ke int, gagal jadi 0."""
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return 0


def bar_isian(sb: dict, sesudah: str) -> list[list]:
    """Bar Stockbit bertanggal > `sesudah`, volume & value > 0, dipangkas ke
    `MAKS_HARI_ISIAN` hari terbaru — [tanggal, beli, jual, volume, value, frekuensi]."""
    kolom = sb.get("kolom") or []
    try:
        i = {k: kolom.index(k) for k in KOLOM_SB}
    except ValueError:
        return []
    calon = []
    for b in sb.get("bar") or []:
        tgl = b[i["tanggal"]]
        if not isinstance(tgl, str) or tgl <= sesudah:
            continue
        volume, value = _bil(b[i["volume"]]), _bil(b[i["value"]])
        if volume <= 0 or value <= 0:
            continue  # bar tak berdagang — vwap tak terhitung, dilewati
        vwap = value / volume
        beli = max(_bil(b[i["foreignbuy"]] / vwap), 0)
        jual = max(_bil(b[i["foreignsell"]] / vwap), 0)
        calon.append([tgl, beli, jual, volume, value, _bil(b[i["frequency"]])])
    calon.sort(key=lambda r: r[0])
    return calon[-MAKS_HARI_ISIAN:]


def isi_emiten(f_asing: Path, dir_sb: Path) -> tuple[str, list[str]] | None:
    """Isi satu berkas `asing/<KODE>.json`. Kembalikan (kode, tanggal-tanggal
    yang ditambah) atau None kalau tak ada yang ditambah."""
    asing = _baca(f_asing)
    if not asing or not asing.get("d"):
        return None
    kode = asing["kode"]
    sb = _baca(dir_sb / f"{kode}.json")
    if not sb:
        return None

    akhir_lama = asing["akhir"]
    baru = bar_isian(sb, akhir_lama)
    if not baru:
        return None

    lama_tgl = {r[0] for r in asing["d"]}
    baru = [r for r in baru if r[0] not in lama_tgl]  # jaga-jaga, tak menimpa
    if not baru:
        return None

    baris = [json.dumps(r, separators=(",", ":"), ensure_ascii=False) for r in asing["d"]]
    baris += [json.dumps(r + ["stockbit"], separators=(",", ":"), ensure_ascii=False) for r in baru]
    baris.sort(key=lambda s: json.loads(s)[0])

    isian_stockbit = sorted({json.loads(s)[0] for s in baris if len(json.loads(s)) == 7})
    mulai, akhir = json.loads(baris[0])[0], json.loads(baris[-1])[0]

    isian_kv = ('"isian_stockbit":%s,' % json.dumps(isian_stockbit, ensure_ascii=False)) if isian_stockbit else ""
    isi = ('{"kode":"%s","satuan":{"beli":"lembar","jual":"lembar",'
           '"volume":"lembar","value":"rupiah","frekuensi":"kali"},'
           '"ruas":["tanggal","beli","jual","volume","value","frekuensi"],'
           '"catatan":"net asing = beli - jual (lembar). IDX tidak melaporkan '
           'aliran asing dalam rupiah.",%s"mulai":"%s","akhir":"%s","n":%d,"d":[%s]}'
           % (kode, isian_kv, mulai, akhir, len(baris), ",".join(baris)))
    f_asing.write_text(isi, encoding="utf-8")
    return kode, [r[0] for r in baru]


def jalankan(akar: Path, *, kering: bool) -> None:
    dir_asing = akar / "data-idx" / "json" / "asing"
    dir_sb = akar / "data-idx" / "json" / "ohlcv_stockbit"
    hasil: dict[str, list[str]] = {}
    for f in sorted(dir_asing.glob("*.json")):
        if kering:
            asing = _baca(f)
            if not asing or not asing.get("d"):
                continue
            sb = _baca(dir_sb / f"{asing['kode']}.json")
            if not sb:
                continue
            baru = bar_isian(sb, asing["akhir"])
            lama_tgl = {r[0] for r in asing["d"]}
            baru = [r for r in baru if r[0] not in lama_tgl]
            if baru:
                hasil[asing["kode"]] = [r[0] for r in baru]
        else:
            r = isi_emiten(f, dir_sb)
            if r:
                hasil[r[0]] = r[1]

    tanggal = sorted({t for v in hasil.values() for t in v})
    print(f"{'(kering) ' if kering else ''}diisi: {len(hasil)} emiten")
    print(f"tanggal isian: {', '.join(tanggal) if tanggal else '(tak ada)'}")
    for kode, tgl in sorted(hasil.items()):
        print(f"  {kode}: {', '.join(tgl)}")


def demo() -> None:
    """Uji bawaan tanpa jaringan/data nyata — baris lama utuh, isian
    ditandai, tak menimpa, idempoten, bar volume 0 dilewati."""
    import shutil
    import tempfile

    tmp = Path(tempfile.mkdtemp())
    try:
        dir_asing, dir_sb = tmp / "asing", tmp / "ohlcv_stockbit"
        dir_asing.mkdir()
        dir_sb.mkdir()

        (dir_asing / "ZZZZ.json").write_text(json.dumps({
            "kode": "ZZZZ", "mulai": "2026-09-22", "akhir": "2026-09-23", "n": 2,
            "d": [["2026-09-22", 100, 90, 1000, 5000000, 50],
                  ["2026-09-23", 110, 95, 1100, 5500000, 55]],
        }), encoding="utf-8")

        kolom = ["tanggal", "unixdate", "open", "high", "low", "close", "volume",
                 "value", "frequency", "foreignbuy", "foreignsell"]
        (dir_sb / "ZZZZ.json").write_text(json.dumps({
            "kode": "ZZZZ", "kolom": kolom,
            "bar": [
                ["2026-09-23", 0, 100, 105, 99, 103, 1100, 5500000, 55, 500000, 450000],
                ["2026-09-24", 0, 103, 106, 102, 104, 1200, 6000000, 60, 600000, 500000],
                ["2026-09-25", 0, 104, 107, 103, 106, 0, 0, 0, 0, 0],  # tak berdagang -> dilewati
                ["2026-09-26", 0, 106, 109, 105, 108, 1300, 6500000, 65, 700000, 650000],
            ],
        }), encoding="utf-8")

        r = isi_emiten(dir_asing / "ZZZZ.json", dir_sb)
        assert r == ("ZZZZ", ["2026-09-24", "2026-09-26"]), r  # 09-23 (sudah ada) & 09-25 (volume 0) dilewati

        j = json.loads((dir_asing / "ZZZZ.json").read_text(encoding="utf-8"))
        assert j["n"] == 4, j["n"]
        assert j["d"][0] == ["2026-09-22", 100, 90, 1000, 5000000, 50], "baris lama pertama wajib utuh"
        assert j["d"][1] == ["2026-09-23", 110, 95, 1100, 5500000, 55], "baris lama tak boleh ditimpa isian"
        assert j["d"][2][-1] == "stockbit" and j["d"][2][0] == "2026-09-24"
        vwap_24 = 6000000 / 1200
        assert j["d"][2][1] == round(600000 / vwap_24), j["d"][2]
        assert j["d"][3][-1] == "stockbit" and j["d"][3][0] == "2026-09-26"
        assert j["isian_stockbit"] == ["2026-09-24", "2026-09-26"], j.get("isian_stockbit")
        assert j["akhir"] == "2026-09-26"

        # Jalan kedua: idempoten — tak ada lagi yang ditambah.
        assert isi_emiten(dir_asing / "ZZZZ.json", dir_sb) is None
        j2 = json.loads((dir_asing / "ZZZZ.json").read_text(encoding="utf-8"))
        assert j2 == j, "jalan kedua tak boleh mengubah apa pun"

        # Tak ada berkas Stockbit -> dilewati diam-diam, bukan galat.
        (dir_asing / "YYYY.json").write_text(json.dumps({
            "kode": "YYYY", "mulai": "2026-09-23", "akhir": "2026-09-23", "n": 1,
            "d": [["2026-09-23", 1, 1, 1, 1, 1]],
        }), encoding="utf-8")
        assert isi_emiten(dir_asing / "YYYY.json", dir_sb) is None

        print("demo isi_asing_stockbit: OK")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--akar", type=Path, default=AKAR, help="akar data (untuk uji di salinan)")
    ap.add_argument("--kering", action="store_true", help="cuma hitung/cetak, jangan tulis")
    ap.add_argument("--uji", action="store_true", help="uji bawaan, tanpa data nyata")
    a = ap.parse_args()

    if a.uji:
        demo()
    else:
        jalankan(a.akar, kering=a.kering)
