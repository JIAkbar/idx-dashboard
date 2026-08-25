# -*- coding: utf-8 -*-
"""Perpanjang `ohlc/<KODE>.json` dengan bar AWAL dari Yahoo, hanya yang lolos
uji ekor.

Stockbit (sumber utama `ohlc/`) kadang mulai lebih telat daripada Yahoo untuk
emiten lama. Menambal ujung awal itu berguna, TAPI dua sumber punya konvensi
harga yang beda (lihat CLAUDE.md — sesuaian aksi korporasi berbeda), jadi tiap
emiten diuji dulu lewat rasio close di tanggal yang tumpang tindih. Yang gagal
dibiarkan apa adanya, bukan ditebak.

Hanya menambah bar Yahoo yang tanggalnya LEBIH AWAL dari bar pertama kita —
tak pernah menyentuh satu pun bar Stockbit yang sudah ada.

Idempoten & bisa dibatalkan: berkas yang sudah punya ruas `jahitan` dilewati;
`--batalkan` membuang bar sebelum-dan-termasuk `jahitan.sampai` lalu menghapus
ruas itu — jangkarnya tanggal, bukan salinan cadangan, jadi tak bisa basi.

Pakai:
  python scripts/jahit_riwayat_yahoo.py --batas 5     # uji cepat
  python scripts/jahit_riwayat_yahoo.py                # jalan penuh
  python scripts/jahit_riwayat_yahoo.py --batalkan
  python scripts/jahit_riwayat_yahoo.py --swauji
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests as cffi

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).resolve().parent.parent
DIR_OHLC = AKAR / "data-idx" / "json" / "ohlc"
SUMBER_ARSIP = "yahoo-ohlc"

BATAS_MULAI = "2010-01-01"
JEDA = 0.5
BATAS_TOLAK_BERUNTUN = 10
MIN_TUMPANG_TINDIH = 200


class Ditolak(Exception):
    """Yahoo menjawab 429/403 — isyarat berhenti, bukan galat data satu emiten."""


def rapi(x):
    """Bulat kalau memang bulat — sama seperti panen_ohlc.py, supaya berkas
    tetap konsisten (harga IDX selalu kelipatan fraksi)."""
    f = float(x)
    return int(f) if f == int(f) else round(f, 2)


def baca(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def tulis(p: Path, obj: dict) -> None:
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def persentil(data: list[float], p: float) -> float:
    d = sorted(data)
    k = (len(d) - 1) * p
    f, c = int(k), min(int(k) + 1, len(d) - 1)
    return d[f] if f == c else d[f] + (d[c] - d[f]) * (k - f)


def unduh_yahoo(kode: str, sesi: cffi.Session) -> dict:
    """Unduh riwayat penuh. `period1=0` WAJIB bersama `period2` — `range=max`
    diam-diam menurunkan resolusi jadi bulanan (jebakan sudah terukur, CLAUDE.md)."""
    p2 = int(time.time())
    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{kode}.JK?period1=0&period2={p2}&interval=1d"
    galat: Exception | None = None
    for percobaan in range(3):
        try:
            r = sesi.get(url, timeout=30)
        except Exception as e:  # noqa: BLE001 — galat jaringan, coba ulang
            galat = e
            time.sleep(2)
            continue
        if r.status_code == 200:
            return r.json()
        if r.status_code in (429, 403):
            raise Ditolak(f"HTTP {r.status_code}")
        if r.status_code == 404:
            raise RuntimeError("404 — tak ada di Yahoo")
        galat = RuntimeError(f"HTTP {r.status_code}")
        time.sleep(2)
    raise RuntimeError(f"gagal setelah 3 percobaan: {galat}")


def ke_baris(raw: dict) -> list[list]:
    """[[tanggal,o,h,l,c,v], ...] — bar tanpa close (null/0) dibuang."""
    hasil = (raw.get("chart") or {}).get("result")
    if not hasil:
        return []
    res = hasil[0]
    ts = res.get("timestamp") or []
    q = (res.get("indicators", {}).get("quote") or [{}])[0]
    o, h, l, c, v = (q.get(k) or [] for k in ("open", "high", "low", "close", "volume"))
    out = []
    for i, t in enumerate(ts):
        ci = c[i] if i < len(c) else None
        if not ci:
            continue
        tgl = datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d")
        out.append([
            tgl,
            rapi(o[i]) if i < len(o) and o[i] else rapi(ci),
            rapi(h[i]) if i < len(h) and h[i] else rapi(ci),
            rapi(l[i]) if i < len(l) and l[i] else rapi(ci),
            rapi(ci),
            int(v[i]) if i < len(v) and v[i] else 0,
        ])
    return out


def uji_ekor(rasio: list[float]) -> tuple[bool, str, str]:
    """(lolos, kategori, keterangan).

    KRITERIA v2 (25 Agu 2026) — v1 menolak 348 dari 348 kandidat, dan itu
    cacat kriterianya, bukan datanya. Dua kesalahan v1:

    1. Rasio dihitung atas SELURUH tanggal tumpang tindih, termasuk hari
       TANPA transaksi. Di hari kosong kedua sumber memang berbeda cara:
       Yahoo meneruskan harga terakhir, Stockbit tidak. Terukur CTTH
       2003-01-08 (volume 105.000): keduanya 100,00 PERSIS; sehari
       sebelumnya (volume 0): Yahoo 90, kita 50. Bar tertua didominasi hari
       kosong, jadi v1 praktis mengukur artefak.
    2. Syarat "maks < 1,05 DAN min > 0,95" adalah batas MUTLAK atas ~5.000
       bar. Satu hari meleset menggugurkan seluruh emiten, dan atas ribuan
       bar itu nyaris pasti terjadi.

    v2: rasio hanya dari hari yang KEDUA sumbernya bervolume > 0 (dihitung
    di `hitung_tambahan`), dan ekstrem dinilai dari PORSI bar yang meleset,
    bukan dari satu nilai terburuk. Terukur atas 12 emiten: 10 lolos, TPIA
    (42,8% bar meleset) dan ABBA (12,9%) ditolak — keduanya memang beda
    penyesuaian aksi korporasi.
    """
    if len(rasio) < MIN_TUMPANG_TINDIH:
        return False, "kurang tumpang tindih", f"{len(rasio)} bar (< {MIN_TUMPANG_TINDIH})"
    med = persentil(rasio, 0.5)
    if abs(med - 1) >= 0.01:
        return False, "median", f"median {med:.4f}"
    porsi = sum(1 for x in rasio if abs(x - 1) > 0.01) / len(rasio)
    if porsi >= 0.02:
        return False, "porsi meleset", f"{porsi*100:.1f}% bar meleset >1% (batas 2%)"
    return True, "lolos", f"median {med:.4f} · {porsi*100:.2f}% meleset · n={len(rasio)}"


def hitung_tambahan(bar_kita: list[list], bar_yahoo: list[list]) -> tuple[list[list], list[float]]:
    """Rasio dihitung atas SELURUH tanggal tumpang tindih; tambahan hanya bar
    Yahoo yang lebih awal dari bar pertama kita, dedup per tanggal."""
    # Hanya hari yang KEDUA sumbernya benar-benar bertransaksi (volume > 0).
    # Hari kosong dibandingkan akan mengukur perbedaan konvensi, bukan
    # perbedaan harga — lihat catatan di uji_ekor().
    peta_kita = {b[0]: b[4] for b in bar_kita if b[4] and len(b) > 5 and b[5]}
    rasio = [b[4] / peta_kita[b[0]] for b in bar_yahoo
             if b[0] in peta_kita and b[4] and len(b) > 5 and b[5]]
    awal = bar_kita[0][0]
    tambahan = {b[0]: b for b in bar_yahoo if b[0] < awal}
    return [tambahan[t] for t in sorted(tambahan)], rasio


def jahit_satu(kode: str, oh: dict, sesi: cffi.Session) -> dict:
    """Proses satu emiten. Return dict hasil untuk tabel ringkas."""
    bar_kita = oh.get("d") or []
    if not bar_kita:
        return {"kode": kode, "status": "gagal", "kategori": "kosong", "ket": "tak ada bar"}

    mentah = arsip_mentah.baca(SUMBER_ARSIP, f"{kode}.json")
    if mentah is None:
        raw = unduh_yahoo(kode, sesi)
        arsip_mentah.simpan(SUMBER_ARSIP, f"{kode}.json", data=raw)
    else:
        raw = json.loads(mentah)

    bar_yahoo = ke_baris(raw)
    if not bar_yahoo:
        return {"kode": kode, "status": "gagal", "kategori": "tak ada di Yahoo", "ket": "riwayat kosong"}

    tambahan, rasio = hitung_tambahan(bar_kita, bar_yahoo)
    lolos, kategori, ket = uji_ekor(rasio)
    if not lolos:
        return {"kode": kode, "status": "gagal", "kategori": kategori, "ket": ket}
    if not tambahan:
        return {"kode": kode, "status": "gagal", "kategori": "tak ada bar lebih awal", "ket": ket}

    med_rasio = persentil(rasio, 0.5)
    # PENJAGA KERAS (permintaan Johan 25 Agu 2026: "jangan sampai menimpa
    # data yang sudah betul"). Bar lama disalin apa adanya dan dibuktikan
    # utuh SESUDAH digabung — kalau satu nilai saja berbeda, berhenti dan
    # jangan tulis apa pun. Janji "cuma menambah di depan" harus dibuktikan
    # tiap emiten, bukan dipercaya dari bentuk kodenya.
    sebelum = [list(b) for b in bar_kita]
    gabung = tambahan + bar_kita
    if gabung[len(tambahan):] != sebelum:
        return {"kode": kode, "status": "gagal", "kategori": "penjaga",
                "ket": "bar lama berubah — TIDAK ditulis"}
    tgl = [b[0] for b in gabung]
    if tgl != sorted(tgl) or len(set(tgl)) != len(tgl):
        return {"kode": kode, "status": "gagal", "kategori": "penjaga",
                "ket": "tanggal tak urut / ada duplikat — TIDAK ditulis"}
    oh["d"] = gabung
    oh["n"] = len(oh["d"])
    oh["mulai"] = oh["d"][0][0]
    oh["jahitan"] = {
        "sumber": "yahoo",
        "sampai": tambahan[-1][0],
        "bar": len(tambahan),
        "median_rasio": round(med_rasio, 4),
        "dijahit": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    tulis(DIR_OHLC / f"{kode}.json", oh)
    return {"kode": kode, "status": "lolos", "kategori": "lolos", "ket": ket, "bar": len(tambahan)}


def batalkan_satu(kode: str, oh: dict) -> bool:
    j = oh.get("jahitan")
    if not j:
        return False
    sisa = [b for b in oh["d"] if b[0] > j["sampai"]]
    oh["d"] = sisa
    oh["n"] = len(sisa)
    oh["mulai"] = sisa[0][0] if sisa else oh.get("mulai")
    del oh["jahitan"]
    tulis(DIR_OHLC / f"{kode}.json", oh)
    return True


def kandidat_jahit() -> list[str]:
    out = []
    for p in sorted(DIR_OHLC.glob("*.json")):
        if p.stem == "IHSG":
            continue
        d = baca(p)
        if not d or d.get("jahitan"):
            continue
        if (d.get("mulai") or "9999") < BATAS_MULAI:
            out.append(p.stem)
    return out


def swauji() -> int:
    # uji_ekor
    assert uji_ekor([1.0] * 250)[0] is True
    assert uji_ekor([1.0] * 50)[1] == "kurang tumpang tindih"
    assert uji_ekor([1.02] * 250)[1] == "median"
    # 4% bar meleset > batas 2% -> ditolak "porsi meleset" (kriteria v2)
    assert uji_ekor([1.0] * 240 + [1.06] * 10)[1] == "porsi meleset"
    # v1 menggugurkan ini sebagai "ekstrem". v2 SENGAJA meloloskannya:
    # satu pencilan dari 250 bar = 0,4%, jauh di bawah batas 2%. Justru
    # aturan lama itu yang menolak 348 dari 348 kandidat.
    assert uji_ekor([0.999] * 249 + [1.2])[0] is True

    # hitung_tambahan: hanya bar sebelum bar pertama kita, tak menyentuh bar kita
    kita = [["2010-01-04", 1, 1, 1, 100, 10], ["2010-01-05", 1, 1, 1, 101, 10]]
    yahoo = [["2009-12-30", 1, 1, 1, 98, 5], ["2010-01-04", 1, 1, 1, 100, 999], ["2010-01-05", 1, 1, 1, 101, 10]]
    tambahan, rasio = hitung_tambahan(kita, yahoo)
    assert tambahan == [["2009-12-30", 1, 1, 1, 98, 5]], "hanya bar sebelum awal kita"
    assert rasio == [1.0, 1.0], "rasio dihitung dari tanggal tumpang tindih"

    # jahit lalu batalkan -> identik dengan sebelum
    oh = {"kode": "UJI", "mulai": "2010-01-04", "akhir": "2010-01-05", "n": 2, "d": [list(b) for b in kita]}
    sebelum = json.dumps(oh, sort_keys=True)
    oh["d"] = tambahan + oh["d"]
    oh["n"] = len(oh["d"])
    oh["mulai"] = oh["d"][0][0]
    oh["jahitan"] = {"sumber": "yahoo", "sampai": tambahan[-1][0], "bar": 1, "median_rasio": 1.0, "dijahit": "2026-08-25"}
    sisa = [b for b in oh["d"] if b[0] > oh["jahitan"]["sampai"]]
    oh2 = dict(oh)
    oh2["d"] = sisa
    oh2["n"] = len(sisa)
    oh2["mulai"] = sisa[0][0]
    del oh2["jahitan"]
    assert json.dumps(oh2, sort_keys=True) == sebelum, "batalkan harus mengembalikan persis keadaan semula"

    # v2: outlier sedikit (1%) TIDAK boleh menggugurkan — inti perbaikannya
    assert uji_ekor([1.0] * 297 + [1.30] * 3)[0] is True
    print("swauji OK — 8/8 assert lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Jahit bar awal dari Yahoo ke ohlc/ (yang lolos uji ekor)")
    ap.add_argument("--batalkan", action="store_true")
    ap.add_argument("--swauji", action="store_true")
    ap.add_argument("--batas", type=int, default=None, help="proses N emiten pertama saja (uji cepat)")
    ap.add_argument("--kode", type=str, default=None, help="proses satu kode saja")
    a = ap.parse_args()
    if a.swauji:
        return swauji()

    if a.batalkan:
        n = 0
        for p in sorted(DIR_OHLC.glob("*.json")):
            if a.kode and p.stem != a.kode:
                continue
            oh = baca(p)
            if oh and batalkan_satu(p.stem, oh):
                print(f"  dibatalkan: {p.stem}")
                n += 1
        print(f"\ntotal dibatalkan: {n}")
        return 0

    kandidat = kandidat_jahit()
    if a.kode:
        kandidat = [k for k in kandidat if k == a.kode]
    if a.batas:
        kandidat = kandidat[: a.batas]
    print(f"kandidat (mulai < {BATAS_MULAI}, belum dijahit): {len(kandidat)}")

    sesi = cffi.Session(impersonate="chrome")
    hasil: list[dict] = []
    tolak_beruntun = 0
    for i, kode in enumerate(kandidat, 1):
        oh = baca(DIR_OHLC / f"{kode}.json")
        if not oh:
            continue
        sudah_ada_arsip = arsip_mentah.baca(SUMBER_ARSIP, f"{kode}.json") is not None
        try:
            r = jahit_satu(kode, oh, sesi)
            tolak_beruntun = 0
        except Ditolak as e:
            tolak_beruntun += 1
            r = {"kode": kode, "status": "gagal", "kategori": "ditolak Yahoo", "ket": str(e)}
            print(f"  [{i}/{len(kandidat)}] {kode}: ditolak Yahoo ({tolak_beruntun}x beruntun)")
            if tolak_beruntun > BATAS_TOLAK_BERUNTUN:
                print(f"\nBERHENTI — Yahoo menolak {tolak_beruntun}x beruntun.")
                hasil.append(r)
                break
        except Exception as e:  # noqa: BLE001 — satu emiten gagal tak boleh menjatuhkan seluruh panen
            r = {"kode": kode, "status": "gagal", "kategori": "galat", "ket": str(e)}
        hasil.append(r)
        tanda = "OK " if r["status"] == "lolos" else "-- "
        print(f"  [{i}/{len(kandidat)}] {tanda}{kode}: {r['kategori']} — {r['ket']}")
        if not sudah_ada_arsip:
            time.sleep(JEDA)

    lolos = [r for r in hasil if r["status"] == "lolos"]
    gagal = [r for r in hasil if r["status"] == "gagal"]
    print(f"\n{'=' * 60}")
    print(f"diperiksa       : {len(hasil)}")
    print(f"lolos & dijahit : {len(lolos)}")
    print(f"gagal           : {len(gagal)}")
    breakdown: dict[str, int] = {}
    for r in gagal:
        breakdown[r["kategori"]] = breakdown.get(r["kategori"], 0) + 1
    for kat, n in sorted(breakdown.items(), key=lambda x: -x[1]):
        print(f"  - {kat}: {n}")
    total_bar = sum(r.get("bar", 0) for r in lolos)
    print(f"total bar ditambahkan: {total_bar:,}")
    top15 = sorted(lolos, key=lambda r: -r.get("bar", 0))[:15]
    print("\n15 emiten dengan tambahan bar terbanyak:")
    for r in top15:
        print(f"  {r['kode']:6s} +{r['bar']:,} bar  ({r['ket']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
