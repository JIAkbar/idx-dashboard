# -*- coding: utf-8 -*-
"""Adu Broker Summary API Stockbit lawan setoran tangkapan layar kontributor.

Johan 22 Agu 2026: *"saya malah penasaran pembuktian manual dan api dari
stockbit itu, bisa kita ujicoba lagi"*.

Uji pertama cuma satu hari satu emiten (BUMI 3 Agu, 20 baris) — cukup untuk
menyatakan "cocok", jauh dari cukup untuk menyatakan "bisa dipercaya".
Skrip ini mengadu SELURUH setoran yang pernah dikurasi: 4 emiten x 35 hari
bursa, top-10 tiap sisi per hari.

## Apa yang diadu

1. **Baris broker** — untuk tiap (emiten, tanggal, sisi, kode broker) di
   setoran, cari padanannya di balasan API hari yang sama. Ukur rasio
   `api / setoran` pada tiga ruas: lot, nilai net, harga rata-rata.
2. **Urutan** — apakah sepuluh besar API, dalam urutan yang sama, memuat
   kode yang sama dengan yang ditulis di tangkapan layar. Angka yang cocok
   tapi urutannya beda berarti salah satunya memeringkat dengan ruas lain.
3. **Ringkasan** — `ringkas` setoran (`n_buyer`, `n_seller`, `net_volume`,
   `net_value_juta`, `average_rp`, `top1_pct`...) lawan `bandar_detector`
   API. Ini lapis yang berbeda: bukan baris broker, melainkan ringkasan yang
   dihitung Stockbit sendiri.

## Kenapa rasionya tidak akan tepat 1,0000

Setoran disalin dari tampilan Stockbit yang MEMBULATKAN: `32.400` juta rupiah
dan `1.900.000` lot, sementara API menjawab `32.444.510.800` dan `1.916.897`.
Jadi yang dinilai bukan "apakah persis sama" melainkan apakah selisihnya
sebesar pembulatan tampilan dan tidak lebih. Baris yang meleset lebih dari
`AMBANG_MELESET` dicetak satu per satu supaya bisa diperiksa, bukan cuma
dihitung.

## Biaya

Satu permintaan per (emiten, tanggal) — 35 panggilan. Hasilnya disimpan lewat
`panen_broker_emiten.simpan()` sehingga mentahnya ikut terarsip dan jalan
berikutnya MELEWATI yang sudah ada (idempoten, nol permintaan ulang).

Pakai:
    python scripts/riset/uji_broker_api_vs_setoran.py
    python scripts/riset/uji_broker_api_vs_setoran.py BUMI DSSA
    python scripts/riset/uji_broker_api_vs_setoran.py --uji     # swauji
"""
from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(AKAR / "scripts"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import panen_broker_emiten as pb  # noqa: E402

DIR_FLOW = AKAR / "arus-pasar" / "bedah"
KELUARAN = AKAR / "docs" / "riset" / "uji-broker-api-vs-setoran.json"

JEDA = 1.5          # detik antar permintaan — endpoint tak mengumumkan rate limit
AMBANG_MELESET = 0.05   # 5% — di atas ini baris dicetak untuk diperiksa tangan


def berkas_hasil(kode: str, tgl: str) -> Path:
    return (AKAR / "data-idx" / "json" / "broker_emiten" / kode /
            f"{tgl}_{tgl}_stockbit.json")


def ambil_hari(token: str, kode: str, tgl: str) -> dict | None:
    """Balasan satu hari, dari cakram kalau sudah pernah dipanen."""
    ada = berkas_hasil(kode, tgl)
    if ada.exists():
        return json.loads(ada.read_text(encoding="utf-8"))
    mentah = pb.ambil_stockbit(token, kode, tgl, tgl)
    rapi = pb.normalkan_stockbit(mentah, kode, tgl, tgl, "MARKET_BOARD_REGULER")
    pb.simpan(rapi, mentah)
    time.sleep(JEDA)
    return rapi


def adu_hari(setoran: dict, api: dict) -> dict:
    """Satu (emiten, tanggal): rasio per baris + kecocokan urutan.

    Kolom setoran: [kode, nilai NET dalam JUTA rupiah, lot, harga rata-rata]
    — arti yang baru terbaca 22 Agu 2026 dari pengaduan ini sendiri, dan tak
    pernah tertulis di berkas setorannya.
    """
    per_kode = {b["kode"]: b for b in api.get("broker", [])}
    baris, hilang = [], []

    for sisi, tanda in (("beli", 1), ("jual", -1)):
        for r in setoran.get(sisi, []):
            kode, juta, lot, avg = r[0], r[1], r[2], r[3]
            a = per_kode.get(kode)
            if not a:
                hilang.append(f"{sisi}:{kode}")
                continue
            api_lot = a["beli_lot"] or a["jual_lot"]
            api_avg = a["avg_beli"] or a["avg_jual"]
            baris.append({
                "kode": kode, "sisi": sisi,
                "r_lot": (api_lot / lot) if lot else None,
                "r_nilai": (a["net_nilai"] / (tanda * juta * 1e6)) if juta else None,
                "r_avg": (api_avg / avg) if avg else None,
            })

    # Urutan: sepuluh besar API per sisi, dibandingkan sebagai DERET, bukan
    # himpunan. Kode yang sama dengan urutan berbeda berarti salah satu pihak
    # memeringkat dengan ruas yang lain.
    urut = {}
    for sisi, kunci, balik in (("beli", "net_nilai", True), ("jual", "net_nilai", False)):
        setoran_kode = [r[0] for r in setoran.get(sisi, [])]
        n = len(setoran_kode)
        api_urut = sorted(api.get("broker", []), key=lambda x: x[kunci], reverse=balik)
        urut[sisi] = {
            "setoran": setoran_kode,
            "api": [x["kode"] for x in api_urut[:n]],
        }
        urut[sisi]["sama"] = urut[sisi]["setoran"] == urut[sisi]["api"]

    return {"baris": baris, "hilang": hilang, "urutan": urut}


def adu_ringkasan(ringkas: dict, api: dict) -> dict | None:
    """`ringkas` setoran lawan `bandar_detector` API.

    Lapis yang berbeda dari baris broker: ini angka yang DIHITUNG Stockbit,
    jadi kalau baris cocok tapi ringkasan tidak, yang berbeda tafsirnya —
    bukan datanya.
    """
    bd = api.get("bandar_detector") or {}
    if not ringkas or not bd:
        return None
    hasil = {}
    if ringkas.get("average_rp") and bd.get("average"):
        hasil["average"] = bd["average"] / ringkas["average_rp"]
    for kunci_set, kunci_api in (("top1_pct", "top1"), ("top3_pct", "top3"),
                                 ("top5_pct", "top5")):
        s, a = ringkas.get(kunci_set), (bd.get(kunci_api) or {}).get("percent")
        if s is not None and a is not None:
            hasil[kunci_set] = {"setoran": s, "api": round(a, 4),
                                "selisih_pp": round(a - s, 2)}
    for kunci_set, kunci_api in (("n_buyer", "total_buyer"), ("n_seller", "total_seller")):
        s, a = ringkas.get(kunci_set), bd.get(kunci_api)
        if s is not None and a is not None:
            hasil[kunci_set] = {"setoran": s, "api": a, "sama": s == a}
    return hasil


def ringkas_rasio(nilai: list[float]) -> dict | None:
    v = sorted(x for x in nilai if x)
    if not v:
        return None
    return {
        "n": len(v),
        "median": round(statistics.median(v), 4),
        "p05": round(v[int(len(v) * 0.05)], 4),
        "p95": round(v[min(len(v) - 1, int(len(v) * 0.95))], 4),
        "min": round(v[0], 4),
        "maks": round(v[-1], 4),
    }


def jalankan(pilih: list[str] | None = None) -> int:
    token = pb.baca_env().get("STOCKBIT_TOKEN")
    if not token:
        print("Tak ada STOCKBIT_TOKEN — lihat panen_broker_emiten.py --bantuan-token",
              file=sys.stderr)
        return 2
    exp = pb.umur_jwt(token)
    if exp and exp < pb.datetime.now(pb.WIB):
        print(f"Token kedaluwarsa ({exp:%d %b %H:%M}) — ambil ulang.", file=sys.stderr)
        return 2

    berkas = sorted(DIR_FLOW.glob("flow-*.json"))
    if pilih:
        berkas = [f for f in berkas if f.stem.replace("flow-", "") in pilih]

    semua_baris, per_emiten, ringkasan_hari = [], {}, []
    urut_cocok = urut_total = 0
    meleset: list[str] = []
    hilang_total = 0

    for f in berkas:
        d = json.loads(f.read_text(encoding="utf-8"))
        kode = d["ticker"]
        harian = d.get("harian") or {}
        baris_emiten = []
        print(f"\n{kode} — {len(harian)} hari bursa")

        for tgl in sorted(harian):
            try:
                api = ambil_hari(token, kode, tgl)
            except SystemExit as e:
                print(f"  {tgl}: {e}")
                continue
            except Exception as e:  # noqa: BLE001
                print(f"  {tgl}: GAGAL {e}")
                continue
            if not api or not api.get("broker"):
                print(f"  {tgl}: API kosong")
                continue

            h = adu_hari(harian[tgl], api)
            semua_baris.extend(h["baris"])
            baris_emiten.extend(h["baris"])
            hilang_total += len(h["hilang"])
            for sisi in ("beli", "jual"):
                urut_total += 1
                urut_cocok += 1 if h["urutan"][sisi]["sama"] else 0

            for b in h["baris"]:
                for ruas in ("r_lot", "r_nilai", "r_avg"):
                    v = b.get(ruas)
                    if v and abs(v - 1) > AMBANG_MELESET:
                        meleset.append(f"{kode} {tgl} {b['sisi']}:{b['kode']} "
                                       f"{ruas}={v:.4f}")

            r = ringkas_rasio([b["r_lot"] for b in h["baris"]])
            tanda_urut = "".join("Y" if h["urutan"][s]["sama"] else "n"
                                 for s in ("beli", "jual"))
            print(f"  {tgl}: {len(h['baris'])} baris cocok, "
                  f"{len(h['hilang'])} tak ketemu, urutan {tanda_urut}, "
                  f"median lot {r['median'] if r else '—'}")

            rk = adu_ringkasan(harian[tgl].get("ringkas") or {}, api)
            if rk:
                ringkasan_hari.append({"kode": kode, "tanggal": tgl, **rk})

        per_emiten[kode] = {
            ruas: ringkas_rasio([b[ruas] for b in baris_emiten])
            for ruas in ("r_lot", "r_nilai", "r_avg")
        }

    hasil = {
        "baris_diadu": len(semua_baris),
        "baris_tak_ketemu_di_api": hilang_total,
        "urutan_sama": f"{urut_cocok}/{urut_total}",
        "meleset_di_atas_ambang": meleset,
        "ambang_meleset": AMBANG_MELESET,
        "keseluruhan": {
            ruas: ringkas_rasio([b[ruas] for b in semua_baris])
            for ruas in ("r_lot", "r_nilai", "r_avg")
        },
        "per_emiten": per_emiten,
        "ringkasan_vs_bandar_detector": ringkasan_hari,
    }
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(json.dumps(hasil, ensure_ascii=False, indent=1), encoding="utf-8")

    print("\n" + "=" * 66)
    print(f"{len(semua_baris)} baris diadu · {hilang_total} tak ketemu di API · "
          f"urutan sama {urut_cocok}/{urut_total}")
    print(f'{"ruas":8} {"n":>5} {"median":>9} {"p05":>9} {"p95":>9} {"min":>9} {"maks":>9}')
    for ruas, label in (("r_lot", "lot"), ("r_nilai", "nilai"), ("r_avg", "avg")):
        s = hasil["keseluruhan"][ruas]
        if s:
            print(f'{label:8} {s["n"]:>5} {s["median"]:>9.4f} {s["p05"]:>9.4f} '
                  f'{s["p95"]:>9.4f} {s["min"]:>9.4f} {s["maks"]:>9.4f}')
    if meleset:
        print(f"\nMeleset >{AMBANG_MELESET:.0%} ({len(meleset)} baris):")
        for m in meleset[:20]:
            print("  " + m)
        if len(meleset) > 20:
            print(f"  ...dan {len(meleset) - 20} lagi")
    print(f"\n-> {KELUARAN.relative_to(AKAR)}")
    return 0


def swauji() -> int:
    setoran = {
        "beli": [["LG", 32400, 1900000, 169], ["AK", 16600, 987500, 169]],
        "jual": [["ZP", 32200, 1900000, 169]],
        "ringkas": {"average_rp": 169, "top1_pct": 0.2, "n_buyer": 38, "n_seller": 37},
    }
    api = {"broker": [
        {"kode": "LG", "beli_lot": 1916897, "jual_lot": 0, "avg_beli": 169,
         "avg_jual": 0, "net_nilai": 32444510800},
        {"kode": "AK", "beli_lot": 987519, "jual_lot": 0, "avg_beli": 169,
         "avg_jual": 0, "net_nilai": 16638831300},
        {"kode": "ZP", "beli_lot": 0, "jual_lot": 1903319, "avg_beli": 0,
         "avg_jual": 169, "net_nilai": -32164054200},
    ], "bandar_detector": {"average": 169.4, "top1": {"percent": 0.21},
                           "total_buyer": 38, "total_seller": 37}}

    h = adu_hari(setoran, api)
    assert len(h["baris"]) == 3 and not h["hilang"], h
    for b in h["baris"]:
        for ruas in ("r_lot", "r_nilai", "r_avg"):
            assert abs(b[ruas] - 1) < 0.02, (b, ruas)
    # Sisi jual: setoran menulis nilai POSITIF, API net negatif. Tandanya harus
    # dinormalkan, kalau tidak rasionya jadi -1 dan uji ini terlihat gagal
    # padahal datanya cocok sempurna.
    zp = [b for b in h["baris"] if b["kode"] == "ZP"][0]
    assert zp["r_nilai"] > 0, f"tanda sisi jual tak dinormalkan: {zp}"
    assert h["urutan"]["beli"]["sama"] and h["urutan"]["jual"]["sama"], h["urutan"]

    # Broker yang tak ada di API dicatat, bukan diam-diam dilewati.
    h2 = adu_hari({"beli": [["ZZ", 1, 1, 1]], "jual": []}, api)
    assert h2["hilang"] == ["beli:ZZ"], h2

    # Urutan beda harus KETAHUAN walau kode-kodenya sama.
    h3 = adu_hari({"beli": [["AK", 16600, 987500, 169], ["LG", 32400, 1900000, 169]],
                   "jual": []}, api)
    assert not h3["urutan"]["beli"]["sama"], "urutan terbalik lolos"

    rk = adu_ringkasan(setoran["ringkas"], api)
    assert rk["n_buyer"]["sama"] and rk["n_seller"]["sama"], rk
    assert abs(rk["average"] - 1) < 0.01, rk

    s = ringkas_rasio([1.0, 1.1, 0.9, None, 0])
    assert s["n"] == 3 and s["median"] == 1.0, s

    print("6/6 lulus")
    return 0


if __name__ == "__main__":
    arg = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "--uji" in sys.argv:
        raise SystemExit(swauji())
    raise SystemExit(jalankan(arg or None))
