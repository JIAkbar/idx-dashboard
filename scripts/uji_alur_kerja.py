"""Swauji alur kerja GitHub Actions: kunci GANDA di tingkat atas.

Kenapa berkas ini ada, terukur 13 Sep 2026:

    env:
      PAPAN_ARSIP_AKAR: '...'

    env:
      PYTHONIOENCODING: utf-8

Dua blok `env:` di `panen-kabar-rumah.yml` dan `update-rumah.yml`. YAML
melarangnya, tapi `yaml.safe_load` MENELANNYA diam-diam (yang terakhir
menang) - jadi uji parse yang kupakai saat menyuntingnya menjawab "OK" untuk
berkas yang GitHub tolak mentah-mentah. Akibatnya kedua alur berhenti
DIURAI: nol langkah berjalan, delapan jalan merah berturut-turut, dan kedua
jalur panen rumahan (kabar IDX/Kontan + statistik harian) mati 12 jam tanpa
satu pun galat yang menyebut sebabnya. Halaman jalannya bahkan berhenti
menampilkan nama alurnya dan memajang nama berkasnya - satu-satunya gejala.

Sengaja TANPA PyYAML: pemeriksanya harus jalan di mana saja, termasuk runner
yang cuma punya Python polos. Kunci tingkat atas berada di kolom 0, jadi
memindainya tak butuh pengurai YAML penuh.
"""
import glob
import os
import re
import sys

KUNCI = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):")


def kunci_ganda(teks):
    """Kembalikan [(nama, baris pertama, baris ulangan), ...]."""
    pertama, ganda = {}, []
    for i, b in enumerate(teks.splitlines(), 1):
        m = KUNCI.match(b)
        if not m:
            continue
        nama = m.group(1)
        if nama in pertama:
            ganda.append((nama, pertama[nama], i))
        else:
            pertama[nama] = i
    return ganda


def periksa(akar):
    berkas = sorted(glob.glob(os.path.join(akar, "*.yml")) +
                    glob.glob(os.path.join(akar, "*.yaml")))
    assert berkas, "tak ada alur kerja di %s" % akar
    rusak = 0
    for p in berkas:
        g = kunci_ganda(open(p, encoding="utf-8").read())
        if g:
            rusak += 1
            for nama, a, b in g:
                print("  RUSAK %-26s kunci '%s' di baris %d DAN %d"
                      % (os.path.basename(p), nama, a, b))
        else:
            print("  OK    %s" % os.path.basename(p))
    print()
    print("diperiksa %d berkas - rusak %d" % (len(berkas), rusak))
    return rusak


def swauji():
    assert kunci_ganda("env:\n  a: 1\n") == []
    assert kunci_ganda("env:\n  a: 1\n\nenv:\n  b: 2\n") == [("env", 1, 4)]
    # yang menjorok BUKAN kunci tingkat atas - dua `run:` di bawah langkah
    # berbeda itu sah dan tak boleh dituduh
    assert kunci_ganda("jobs:\n  a:\n    run: x\n  b:\n    run: y\n") == []
    assert kunci_ganda("on:\n  push:\n#env:\nenv:\n  a: 1\n") == []


if __name__ == "__main__":
    swauji()
    akar = sys.argv[1] if len(sys.argv) > 1 else os.path.join(".github", "workflows")
    sys.exit(1 if periksa(akar) else 0)
