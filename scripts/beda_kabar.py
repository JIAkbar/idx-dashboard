# -*- coding: utf-8 -*-
"""Berapa ITEM kabar yang berubah dibanding commit terakhir — satu rumah.

Cetak satu angka ke stdout; 0 berarti daftarnya sama persis dan tak ada yang
perlu di-commit.

Kenapa ada sebagai berkas, bukan potongan di dalam alur CI: sejak #138 ada DUA
pendorong kabar — CI di awan dan runner di laptop ini — dan keduanya harus
memutuskan hal yang sama. Pembanding yang disalin akan menyimpang satu per
satu, dan yang menyimpang paling jauh justru yang paling jarang dibaca.

Yang dibandingkan ISI daftarnya, bukan berkasnya: kedua berkas membawa ruas
`dipanen`/`diperbarui` yang berganti TIAP JALAN, jadi `git diff` tak pernah
kosong walau daftarnya sama persis — dan dulu itu berarti belasan commit
sehari yang isinya cuma stempel waktu.

Selisihnya SIMETRIS, bukan cuma yang bertambah (#142 B): dedup per tautan
hanya MEMBUANG item, jadi dengan `baru - lama` saja, jalan yang membersihkan
puluhan salinan menghitung nol, berkasnya dipulihkan, dan pembersihannya tak
pernah mendarat.
"""
import io
import json
import subprocess
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
BERKAS = ("data-idx/json/kabar.json", "data-idx/json/snips.json")


def kunci(teks: str) -> set | None:
    try:
        d = json.loads(teks)
    except Exception:  # noqa: BLE001 — berkas rusak = perlakukan sebagai berubah
        return None
    return {f"{i.get('tautan')}|{i.get('judul')}|{i.get('waktu')}"
            for i in (d.get("item") or [])}


def beda(berkas=BERKAS) -> int:
    total = 0
    for f in berkas:
        p = AKAR / f
        if not p.exists():
            continue
        lama_teks = subprocess.run(["git", "show", f"HEAD:{f}"], cwd=AKAR,
                                   capture_output=True, text=True, encoding="utf-8").stdout
        baru_teks = io.open(p, encoding="utf-8").read()
        a, b = kunci(lama_teks), kunci(baru_teks)
        if a is None or b is None:
            total += 1          # tak terbaca di salah satu sisi = anggap berubah
        elif a != b:
            total += len(a ^ b)
    return total


def swauji() -> int:
    def k(items):
        return kunci(json.dumps({"item": items}))
    a = k([{"tautan": "x", "judul": "A", "waktu": "1"}])
    b = k([{"tautan": "x", "judul": "A", "waktu": "1"}])
    assert len(a ^ b) == 0, "daftar sama harus nol"
    c = k([{"tautan": "x", "judul": "A", "waktu": "1"}, {"tautan": "y", "judul": "B", "waktu": "2"}])
    assert len(c ^ a) == 1, "satu item bertambah"
    assert len(a ^ c) == 1, "satu item BERKURANG juga dihitung - inilah #142 B"
    assert kunci("bukan json") is None
    print("swauji beda_kabar lolos")
    return 0


if __name__ == "__main__":
    if "--swauji" in sys.argv[1:]:
        raise SystemExit(swauji())
    print(beda())
