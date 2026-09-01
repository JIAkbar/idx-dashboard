# -*- coding: utf-8 -*-
"""Selisih-pasar kelas TERKUNCI — maju, harian, atas kohort yang daftarnya
sudah tertulis SEBELUM hari yang diukur.

Definisi dikunci di `docs/spek-dev-papan/spek_metrik_selisih_pasar.md`
(pra-registrasi 1 Sep 2026). Berkas ini melaksanakannya apa adanya; kalau
definisinya berubah, spek yang disunting lebih dulu dan nilai lama TIDAK
ditulis ulang.

    selisih_k(E) = return_harian(E, hari_k) - baseline(hari_k)

Tiga hal yang gampang salah dan tiap satunya membalik kesimpulan:

1. **Baseline itu median emiten BERVOLUME, bukan seluruh emiten yang punya
   bar.** Emiten yang tak bertransaksi membawa tutup kemarin apa adanya, jadi
   return-nya nol; memasukkannya menarik median ke nol secara palsu dan
   membuat kohort apa pun terlihat unggul. Terukur 1 Sep 2026: median seluruh
   emiten berbar 0,00% sementara median yang bervolume jauh berbeda.

2. **Baseline BUKAN IHSG.** IHSG tertimbang kapitalisasi dan didominasi bank
   besar; saham kecil bisa "kalah dari IHSG" padahal menang melawan pasar yang
   sesungguhnya. IHSG tetap dihitung, tapi sebagai kolom pembanding — Johan
   bertanya dalam istilah itu — tak pernah sebagai dasar keputusan.

3. **Hari pertama sebuah kohort = hari bursa PERTAMA SESUDAH tanggal
   kuncinya.** Gerak harga di hari kunci ikut menentukan siapa yang masuk
   daftar hari itu, jadi menghitungnya berarti mengukur hal yang sama dua
   kali. Kesalahan ini sudah dibayar 31 Agu: jarak 2,39 poin yang sebenarnya
   1,18.

Agregat kohort memakai MEDIAN, bukan rata-rata — satu saham yang meledak tak
boleh mewakili kohortnya. Rata-rata tetap dicetak sebagai pembanding supaya
kalau keduanya berjauhan, ketimpangannya kelihatan.

Jalankan dari akar repo:
    python scripts/riset/selisih_terkunci.py
    python scripts/riset/selisih_terkunci.py --uji
"""
from __future__ import annotations

import argparse
import json
import statistics as st
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
OHLC = AKAR / "data-idx" / "json" / "ohlc"
REKOM = AKAR / "data-idx" / "json" / "rekomendasi"
KELUARAN = AKAR / "data-idx" / "json" / "selisih_terkunci.json"

# Kohort pilihan Johan: sepuluh kode yang ia sebut sendiri, terbit di artifact
# "Sepuluh Saham, Tiga Horizon" pada 31 Agu 2026. Dicatat di sini karena
# artifact bukan berkas repo — tanpa salinan ini daftarnya tak bisa diperiksa
# ulang, dan kohort yang tak bisa diperiksa ulang bukan kohort terkunci.
#
# PENTING saat membaca hasilnya: sepuluh kode ini TIDAK dipilih sistem. Sistem
# cuma menyediakan perkiraan dan level untuk kode yang sudah ditentukan Johan.
# Jadi barisnya mengukur pilihan Johan, bukan penyaring PAPAN.
KOHORT_JOHAN = {
    "tanggalKunci": "2026-08-31",
    "label": "pilihan Johan (10 saham, artifact horizon)",
    "catatan": "kode dipilih Johan, bukan sistem — mengukur pilihannya, bukan penyaring",
    "kode": ["CUAN", "DSSA", "BUMI", "ARCI", "MBMA",
             "TPIA", "BREN", "CDIA", "VKTR", "BNBR"],
}


def muat_ohlc() -> dict:
    """{kode: {tanggal: (tutup, volume)}}"""
    out = {}
    for p in OHLC.glob("*.json"):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
            bars = d["d"]
        except (KeyError, ValueError):
            continue
        # d = [tanggal, open, high, low, close, volume]
        out[p.stem] = {b[0]: (b[4], b[5] if len(b) > 5 else 0) for b in bars[-30:]}
    return out


def kalender(pasar: dict) -> list[str]:
    """Hari bursa dari data — tanggal yang dimiliki mayoritas emiten. 25 Agu
    2026 kosong di 963 dari 963 emiten (libur); kalender masehi akan
    menghitungnya sebagai hari bursa dan menggeser setiap jendela."""
    hit: dict[str, int] = {}
    for peta in pasar.values():
        for t in peta:
            hit[t] = hit.get(t, 0) + 1
    ambang = max(2, len(pasar) // 2)
    return sorted(t for t, c in hit.items() if c >= ambang)


def baseline_hari(pasar: dict, hari: str, sebelum: str) -> tuple[float | None, int, dict]:
    """Median return emiten BERVOLUME + sebaran kuartilnya."""
    r = []
    for kode, peta in pasar.items():
        if kode == "IHSG":
            continue
        a, b = peta.get(sebelum), peta.get(hari)
        if not a or not b or not a[0]:
            continue
        if not b[1]:          # volume nol = tak bertransaksi, tutup basi
            continue
        r.append(100 * (b[0] - a[0]) / a[0])
    if not r:
        return None, 0, {}
    r.sort()
    q = {"q1": round(r[len(r) // 4], 2), "q3": round(r[3 * len(r) // 4], 2),
         "naikPct": round(100 * sum(1 for v in r if v > 0) / len(r), 1)}
    return st.median(r), len(r), q


def return_ihsg(pasar: dict, hari: str, sebelum: str) -> float | None:
    peta = pasar.get("IHSG") or {}
    a, b = peta.get(sebelum), peta.get(hari)
    if not a or not b or not a[0]:
        return None
    return 100 * (b[0] - a[0]) / a[0]


def nilai_kohort(kode_list: list[str], pasar: dict, hari: str,
                 sebelum: str, dasar: float) -> dict:
    per = []
    hilang = []
    for k in kode_list:
        peta = pasar.get(k)
        a = peta.get(sebelum) if peta else None
        b = peta.get(hari) if peta else None
        if not a or not b or not a[0]:
            hilang.append(k)
            continue
        ret = 100 * (b[0] - a[0]) / a[0]
        per.append({"kode": k, "return": round(ret, 2),
                    "selisih": round(ret - dasar, 2), "bervolume": bool(b[1])})
    if not per:
        return {"n": 0, "hilang": hilang}
    s = sorted(x["selisih"] for x in per)
    return {
        "n": len(per),
        "hilang": hilang,
        "medianSelisih": round(st.median(s), 2),
        "rataSelisih": round(sum(s) / len(s), 2),
        "diAtasPasar": sum(1 for v in s if v > 0),
        "perSaham": sorted(per, key=lambda x: -x["selisih"]),
    }


def kohort_rekomendasi() -> list[dict]:
    out = []
    for p in sorted(REKOM.glob("2026-*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        if d.get("backtest"):
            continue          # REKONSTRUKSI, bukan TERKUNCI — kelas lain
        kode = sorted({s["kode"] for pr in d["presets"] for s in pr["saham"]})
        out.append({"tanggalKunci": d["tanggal"],
                    "label": f"preset PAPAN {d['tanggal']}",
                    "catatan": "dipilih sistem", "kode": kode})
    return out


def jalankan() -> dict:
    pasar = muat_ohlc()
    kal = kalender(pasar)
    kohort = kohort_rekomendasi() + [KOHORT_JOHAN]

    baris = []
    for ko in kohort:
        tk = ko["tanggalKunci"]
        if tk not in kal:
            continue
        i = kal.index(tk)
        # Penjaga sirkularitas: mulai hari bursa PERTAMA SESUDAH tanggal kunci.
        for hk, hari in enumerate(kal[i + 1:], start=1):
            sebelum = kal[i + hk - 1]
            dasar, n_pasar, q = baseline_hari(pasar, hari, sebelum)
            if dasar is None:
                continue
            r = nilai_kohort(ko["kode"], pasar, hari, sebelum, dasar)
            if not r["n"]:
                continue
            baris.append({
                "kelas": "TERKUNCI", "kohort": ko["label"],
                "catatanKohort": ko["catatan"], "tanggalKunci": tk,
                "hariKe": hk, "tanggal": hari,
                "baselineMedianPasar": round(dasar, 2), "nPasarBervolume": n_pasar,
                "kuartilPasar": q, "ihsg": (lambda v: round(v, 2) if v is not None else None)(
                    return_ihsg(pasar, hari, sebelum)),
                **r,
            })
    return {"dibuat": max(kal) if kal else None, "hariBursaTerakhir": kal[-1] if kal else None,
            "baris": baris}


def cetak(h: dict) -> None:
    print(f"\nKelas TERKUNCI — baseline = median emiten BERVOLUME (bukan IHSG).")
    print(f"Hari bursa terakhir berdata: {h['hariBursaTerakhir']}\n")
    for b in h["baris"]:
        print(f"  {b['kohort']}  ·  hari ke-{b['hariKe']} ({b['tanggal']})  ·  n={b['n']}"
              + (f"  [{len(b['hilang'])} tanpa data: {', '.join(b['hilang'])}]" if b["hilang"] else ""))
        q = b["kuartilPasar"]
        print(f"    pasar   : median {b['baselineMedianPasar']:+.2f}%  "
              f"(kuartil {q['q1']:+.2f}% .. {q['q3']:+.2f}%, naik {q['naikPct']}%, "
              f"{b['nPasarBervolume']} emiten bervolume)   IHSG {b['ihsg']:+.2f}%")
        print(f"    kohort  : median selisih {b['medianSelisih']:+.2f} poin  ·  "
              f"rata-rata {b['rataSelisih']:+.2f}  ·  "
              f"{b['diAtasPasar']} dari {b['n']} di atas median pasar")
        for x in b["perSaham"]:
            tv = "" if x["bervolume"] else "  (TAK BERVOLUME — tutup basi)"
            print(f"       {x['kode']:5s} return {x['return']:+7.2f}%   "
                  f"selisih {x['selisih']:+7.2f}{tv}")
        print()


def swauji() -> None:
    pasar = {
        "A": {"2026-09-01": (110, 5), "2026-08-31": (100, 5)},   # +10%
        "B": {"2026-09-01": (99, 5), "2026-08-31": (100, 5)},    # -1%
        "C": {"2026-09-01": (100, 0), "2026-08-31": (100, 5)},   # volume NOL
        "D": {"2026-09-01": (102, 5), "2026-08-31": (100, 5)},   # +2%
        # IHSG SENGAJA diberi volume: kalau ia lolos ke baseline, yang
        # mengeluarkannya harus aturan eksplisit, bukan kebetulan volume nol.
        "IHSG": {"2026-09-01": (101, 5), "2026-08-31": (100, 5)},
    }
    d, n, q = baseline_hari(pasar, "2026-09-01", "2026-08-31")
    # C dibuang (volume nol), IHSG dibuang (indeks) -> +10, -1, +2 -> median +2.
    # Kalau IHSG ikut, n jadi 4 dan mediannya bergeser ke +1,5.
    assert n == 3 and abs(d - 2.0) < 1e-9, (n, d)
    assert abs(return_ihsg(pasar, "2026-09-01", "2026-08-31") - 1.0) < 1e-9

    r = nilai_kohort(["A", "B"], pasar, "2026-09-01", "2026-08-31", d)
    # selisih A = 10-2 = 8 ; B = -1-2 = -3 ; median = 2.5
    assert r["n"] == 2 and abs(r["medianSelisih"] - 2.5) < 1e-9, r
    assert r["diAtasPasar"] == 1, r

    # Emiten tanpa data dilaporkan, bukan didiamkan.
    r = nilai_kohort(["A", "ZZZZ"], pasar, "2026-09-01", "2026-08-31", d)
    assert r["hilang"] == ["ZZZZ"] and r["n"] == 1, r

    # Kalender menolak tanggal yang cuma dimiliki segelintir berkas.
    p2 = dict(pasar)
    p2["E"] = {"2026-09-02": (100, 5)}
    assert "2026-09-02" not in kalender(p2), kalender(p2)

    print("swauji selisih_terkunci: 5 kasus lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)
    h = jalankan()
    cetak(h)
    KELUARAN.write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  ditulis: {KELUARAN.relative_to(AKAR)}")
