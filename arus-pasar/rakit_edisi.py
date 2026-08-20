# -*- coding: utf-8 -*-
"""Rakit `edisi/<tanggal>.json` dari kerangka + transkrip broker.

Melengkapi `kerangka_edisi.py` (harga, EMA50, pivot) dengan bagian yang selama
ini juga diketik tangan padahal seluruhnya turunan angka: arah, sasaran, batas
batal, kelas aliran, label, dan empat baris narasi per emiten.

Yang TETAP tidak dikerjakan mesin: narasi tingkat edisi (`ihsg_view`,
`sentimen`, `konteks`). Itu pembacaan pasar, bukan turunan satu berkas.

    python arus-pasar/rakit_edisi.py 2026-08-20
    python arus-pasar/rakit_edisi.py --uji

Masukan: `draft/kerangka-<tgl>.json` + `draft/broker-<tgl>.json`.
Keluaran: `edisi/<tgl>.json` — TANPA menimpa berkas yang sudah ada kecuali
diberi `--timpa`, karena edisi yang sudah dirakit boleh saja disunting tangan
dan jalan kedua skrip ini akan membuangnya diam-diam.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
ARUS = AKAR / "arus-pasar"
sys.path.insert(0, str(ARUS))
from kerangka_edisi import baris_ohlc, ke_fraksi  # noqa: E402

BULAN_ID = ("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
            "Agustus", "September", "Oktober", "November", "Desember")
HARI_ID = ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")
BULAN_PENDEK = ("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")


def rp(juta: float) -> str:
    """Rupiah dalam satuan yang enak dibaca. Masukan selalu JUTA rupiah —
    satuan yang dipakai seluruh berkas edisi."""
    if abs(juta) >= 1000:
        return f"Rp{juta / 1000:,.1f}B".replace(",", "#").replace(".", ",").replace("#", ".")
    return f"Rp{juta:,.1f}jt".replace(",", "#").replace(".", ",").replace("#", ".")


def pct(x: float) -> str:
    return f"{x:,.2f}%".replace(".", ",")


def atr(d: list, i: int, n: int = 14) -> float | None:
    """ATR14 klasik (true range dirata-rata). None kalau riwayatnya kurang."""
    if i < n:
        return None
    tr = []
    for k in range(i - n + 1, i + 1):
        _, _, h, l, c, _ = d[k]
        pc = d[k - 1][4]
        tr.append(max(h - l, abs(h - pc), abs(l - pc)))
    return sum(tr) / n


def kelas_aliran(net_juta: float, total_juta: float) -> str:
    """Kelas aliran dari net top-10 relatif terhadap besarnya arus itu sendiri.

    Dinormalkan, bukan ambang rupiah tetap: net Rp2 miliar berarti sangat
    berbeda pada emiten yang top-10-nya Rp10 miliar dan Rp400 miliar.
    """
    if total_juta <= 0:
        return "Neutral"
    r = net_juta / total_juta
    if r >= 0.15:
        return "Strong Accumulation"
    if r >= 0.04:
        return "Accumulation"
    if r <= -0.15:
        return "Strong Distribution"
    if r <= -0.04:
        return "Distribution"
    return "Neutral"


def arah_harga(c: float, p: float, ema50: float | None) -> str:
    """Tiga kata saja, dan tak satu pun berarti saran. Yang dibaca cuma posisi
    harga terhadap pivot hari ini dan EMA50."""
    di_atas_p = c > p
    di_atas_e = ema50 is not None and c > ema50
    if di_atas_p and di_atas_e:
        return "naik"
    if not di_atas_p and not di_atas_e:
        return "turun"
    return "netral"


def rakit_emiten(k: dict, broker: dict, tanggal: str) -> dict:
    t = k["ticker"]
    o = k["ohlc_hari"]
    piv = k["pivot"]
    c, e50 = o["c"], k["ema50"]
    beli = broker.get("beli", [])
    jual = broker.get("jual", [])
    tb = sum(r[1] for r in beli)
    tj = sum(r[1] for r in jual)
    net = tb - tj

    d = baris_ohlc(t)
    i = next(idx for idx, r in enumerate(d) if r[0] == tanggal)
    a14 = atr(d, i)
    rentang = o["h"] - o["l"]

    target = [piv["R1"], piv["R2"], piv["R3"]]
    batal = piv["S1"]
    # Posisi penutupan di dalam rentang hari itu, 0-100. Bukan "skor" —
    # ia jawaban satu pertanyaan: harga berhenti di dekat atas atau bawah?
    slider = round((c - o["l"]) / rentang * 100) if rentang > 0 else 50

    fk = kelas_aliran(net, tb + tj)
    ar = arah_harga(c, piv["P"], e50)
    posisi_p = "di atas" if c > piv["P"] else "di bawah" if c < piv["P"] else "tepat di"
    gerak = "Naik" if o["pct"] > 0 else "Turun" if o["pct"] < 0 else "Datar"

    tn = beli[0] if beli else None
    ts = jual[0] if jual else None
    return {
        "ticker": t,
        "nama": k["nama"],
        "ohlc_hari": o,
        "ema50": e50,
        "pivot": piv,
        "pivot_ragu": [],
        "beli": beli,
        "jual": jual,
        "arah": ar,
        "target": " / ".join(str(x) for x in target),
        "invalidation": f"Close <{batal}",
        "slider_pct": slider,
        "flow_kelas": fk,
        "label": f"{gerak} {pct(abs(o['pct']))} {posisi_p} Pivot — {fk} Net Top-10",
        "catatan": (f"Batas batal dari pivot S1 {batal}. Sasaran dari pivot: "
                    f"{' / '.join(str(x) for x in target)}."),
        "narasi_flow": (
            f"Net-beli 10 teratas {rp(tb)} lawan net-jual {rp(tj)} "
            f"(selisih {'+' if net >= 0 else '−'}{rp(abs(net))})."
            + (f" Top net-buyer {tn[0]} {rp(tn[1])}." if tn else "")
            + (f" Top net-seller {ts[0]} {rp(ts[1])}." if ts else "")),
        "narasi_teknikal": (
            f"Tutup {c:,}".replace(",", ".")
            + f" {'naik' if o['pct'] > 0 else 'turun' if o['pct'] < 0 else 'datar'} {pct(abs(o['pct']))}, "
            + f"{posisi_p} pivot {piv['P']}"
            + (f" dan {pct(abs(c / e50 - 1) * 100)} {'di atas' if c > e50 else 'di bawah'} EMA50 {e50}"
               if e50 else "")
            + (f". Rentang hari {rentang / a14:,.2f}x ATR14.".replace(".", "#").replace(",", ".").replace("#", ",")
               if a14 and a14 > 0 else ".")),
        "strategi": (f"Berlaku selama penutupan bertahan di atas {batal}; "
                     f"sasaran pertama {target[0]}."),
        "konsekuensi": f"Penutupan di bawah {batal} membuka ruang ke {piv['S2']}.",
        "rationale_rank": f"{fk} top-10 {'+' if net >= 0 else '−'}{rp(abs(net))}, harga {posisi_p} pivot",
        "kontributor": broker.get("kontributor", ""),
    }


def _uji() -> None:
    assert ke_fraksi(698) == 700, "pivot wajib jatuh di tick sah"
    assert kelas_aliran(0, 100) == "Neutral"
    assert kelas_aliran(20, 100) == "Strong Accumulation"
    assert kelas_aliran(5, 100) == "Accumulation"
    assert kelas_aliran(-20, 100) == "Strong Distribution"
    # Nol arus tak boleh membagi nol, dan tak boleh mengaku akumulasi.
    assert kelas_aliran(0, 0) == "Neutral"
    assert arah_harga(110, 100, 90) == "naik"
    assert arah_harga(90, 100, 110) == "turun"
    assert arah_harga(110, 100, 120) == "netral"
    # EMA50 belum ada: tak boleh melempar, dan tak boleh mengaku "naik" penuh.
    assert arah_harga(110, 100, None) == "netral"
    assert rp(2500) == "Rp2,5B"
    assert rp(250) == "Rp250,0jt"
    print("uji rakit_edisi: LOLOS")


def main() -> None:
    if "--uji" in sys.argv:
        _uji()
        return
    arg = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not arg:
        raise SystemExit(__doc__)
    tgl = arg[0]
    kerangka = json.loads((ARUS / "draft" / f"kerangka-{tgl}.json").read_text(encoding="utf-8"))
    broker = json.loads((ARUS / "draft" / f"broker-{tgl}.json").read_text(encoding="utf-8"))
    kredit = json.loads((ARUS / "masuk" / f"kredit-AP-{tgl[8:10]}{tgl[5:7]}{tgl[2:4]}-E01.json")
                        .read_text(encoding="utf-8"))
    kontrib = kredit.get("kontributor") or {}

    emiten = []
    for k in kerangka["emiten"]:
        b = dict(broker.get(k["ticker"], {}))
        b["kontributor"] = kontrib.get(k["ticker"], "")
        emiten.append(rakit_emiten(k, b, tgl))
    # Urut menurun berdasar net top-10 — yang arusnya paling kuat di depan.
    emiten.sort(key=lambda e: sum(r[1] for r in e["beli"]) - sum(r[1] for r in e["jual"]),
                reverse=True)

    th, bl, hr = int(tgl[:4]), int(tgl[5:7]), int(tgl[8:10])
    import datetime
    hari = HARI_ID[datetime.date(th, bl, hr).weekday()]
    keluar = ARUS / "edisi" / f"{tgl}.json"
    if keluar.exists() and "--timpa" not in sys.argv:
        raise SystemExit(f"{keluar.name} sudah ada — pakai --timpa kalau memang mau ditulis ulang")

    hasil = {
        "edisi": f"AP-{hr:02d}{bl:02d}{th % 100:02d}-E01",
        "tanggal": tgl,
        "tanggal_id": f"{hari}, {hr} {BULAN_ID[bl - 1]} {th}",
        "tanggal_flow": f"{hr} {BULAN_PENDEK[bl - 1]} {th % 100}",
        "emiten": emiten,
    }
    keluar.write_text(json.dumps(hasil, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"ditulis: {keluar.relative_to(AKAR)} — {len(emiten)} emiten")
    for e in emiten:
        net = sum(r[1] for r in e["beli"]) - sum(r[1] for r in e["jual"])
        print(f"  {e['ticker']:5} {e['flow_kelas']:22} net {net:>+10,.0f} jt  {e['label']}")


if __name__ == "__main__":
    main()
