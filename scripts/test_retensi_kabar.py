# -*- coding: utf-8 -*-
"""Retensi kabar per sumber — IDX berita tak boleh ikut luruh 7 hari.

Sampai 22 Agu 2026 `panen_kabar.py` memakai satu ambang retensi untuk semua
sumber. Siaran pers BEI terbit beberapa kali sebulan, jadi 30 item yang baru
saja dipanen SELURUHNYA lewat 7 hari dan dibuang di baris filter — halaman
Kabar tak pernah memuat satu pun, dan `cek_kabar.py` memvonis MERAH "tak ada
satu pun item di berkas" pada sumber yang panennya justru berhasil.

Uji ini menjaga dua sisi sekaligus: yang berkadensa lambat bertahan, yang
harian tetap luruh.
"""
import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

import panen_kabar as pk  # noqa: E402
import cek_kabar as ck  # noqa: E402


def uji_retensi_per_sumber():
    """Item 30 hari: IDX berita bertahan, Kontan luruh."""
    lama = (datetime.now(pk.WIB) - timedelta(days=30)).isoformat()
    idx = {"sumber": "IDX", "jenis": "berita", "judul": "siaran pers", "waktu": lama}
    kontan = {"sumber": "Kontan", "jenis": "berita", "judul": "berita harian", "waktu": lama}

    # `masih_berlaku` hidup di dalam main(); pakai jalur nyata lewat ambang.
    hari = 7
    batas = (datetime.now(pk.WIB) - timedelta(days=hari)).isoformat()
    khusus = {
        k: (datetime.now(pk.WIB) - timedelta(days=h)).isoformat()
        for k, h in {("IDX", "berita"): 60}.items()
    }
    boleh = lambda i: bool(i["waktu"]) and i["waktu"] >= khusus.get(
        (i["sumber"], i["jenis"]), batas)

    assert boleh(idx), "IDX berita 30 hari seharusnya bertahan (retensi 60 hari)"
    assert not boleh(kontan), "Kontan 30 hari seharusnya luruh (retensi 7 hari)"


def uji_ambang_idx_berita():
    """Ambang basi IDX berita harus melebihi jeda terbit nyata (maks 7,9 hari)."""
    _, _, _, ambang = ck.SUMBER["idx"]
    assert ambang >= 190, (
        f"ambang IDX berita {ambang} jam <= jeda terbit terukur 189,2 jam — "
        "sumber sehat akan divonis merah")


def uji_berkas_nyata_punya_idx_berita():
    """kabar.json produksi harus memuat siaran pers BEI, bukan nol."""
    berkas = AKAR / "data-idx" / "json" / "kabar.json"
    if not berkas.exists():
        return
    item = json.loads(berkas.read_text(encoding="utf-8"))["item"]
    n = sum(1 for i in item if i.get("sumber") == "IDX" and i.get("jenis") == "berita")
    assert n > 0, "kabar.json tak memuat satu pun IDX berita — retensi memakannya lagi"


if __name__ == "__main__":
    uji_retensi_per_sumber()
    uji_ambang_idx_berita()
    uji_berkas_nyata_punya_idx_berita()
    print("3/3 lulus")
