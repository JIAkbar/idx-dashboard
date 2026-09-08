# -*- coding: utf-8 -*-
"""Winrate PAPAN per emiten — aturan rencana dagang yang SAMA, diperluas.

Asal: Johan 8 Sep 2026 (sesi pengawas), *"artifact nya bagus nih untuk BNBR
kalau dijadikan page Winrate sistem Papan, tapi perlu di improve lagi
re-layouting lagi dan diterapkan di semua saham serta ambil dari data selama
ini bisa cek data per 10, 20, 60, 120, 200 hari dan kalau ada teknikal lagi
lebih bagus"* — antrean #92 A/#91, spek `docs/spek-dev-papan/winrate-papan.md`.

Yang dijawab, per emiten: kalau aturan rencana dagang PAPAN diterapkan pada
saham ini, seberapa sering menang, berapa ekspektansinya sesudah biaya, pada
horizon berapa, dan pada kondisi teknikal apa — dengan kejujuran penyebut.

## Aturannya TIDAK ditulis ulang di sini

Level (target, batas), ATR, dan biaya diimpor dari `rencana_saham.py` — modul
yang mengisi kartu rencana dagang. Yang ditulis di sini cuma pengulangan
telusurnya dalam bentuk PER SINYAL (dibutuhkan saringan teknikal, median bar
ke berapa, rata menang/kalah), dan `--uji` membuktikan hasilnya identik dengan
`telusuri()` produksi pada data nyata: angka 120 sinyal h5/h10/h20 di halaman
Winrate HARUS sama dengan yang tercetak di kartu — dua mesin, satu angka.

## Perluasan terhadap kartu

* horizon [5, 10, 20, 60, 120, 200] hari bursa, bukan cuma 5/10/20;
* dua jendela sinyal: 120 (angka kartu) dan 500 (jendela stabil);
* `nEfektif` = n ÷ horizon — sinyal harian yang jendelanya saling tindih
  bukan sampel bebas; 120 sinyal h200 ≈ satu percobaan;
* return mentah beli-lalu-tahan per horizon (750 bar) sebagai pembanding jujur
  untuk aturan target/batas;
* saringan teknikal di hari sinyal (h20 + h60, jendela 500): RSI14 Wilder,
  posisi terhadap MA20·50·200, volume vs rata 20 hari, arus asing 5 hari dari
  gudang Stockbit, ATR terhadap median jendela — 13 kondisi;
* bar beku per tahun, posisi teknikal hari ini, dan persentil emiten terhadap
  seluruh pasar (jendela 120, tiap horizon).

Keluaran: `data-idx/json/winrate/<KODE>.json` per emiten dan `index.json`
(distribusi pasar + persentil tiap emiten). Nol jaringan — semuanya dari
`ohlc/`, `ohlcv_stockbit/`, dan `rencana_saham.json`.

Jalankan dari akar repo:
    python scripts/riset/winrate_emiten.py                 # semua emiten
    python scripts/riset/winrate_emiten.py --emiten BNBR,ARCI
    python scripts/riset/winrate_emiten.py --uji           # swauji + kesamaan
"""
from __future__ import annotations

import argparse
import json
import statistics as st
import sys
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(AKAR / "scripts" / "riset"))
sys.path.insert(0, str(AKAR / "scripts"))
import rencana_saham as rs  # noqa: E402  — aturan produksi, jangan disalin
from bar_berisi import potong_ke_berisi  # noqa: E402

OHLC = rs.OHLC
GUDANG = rs.GUDANG
RENCANA = rs.KELUARAN
KELUARAN = AKAR / "data-idx" / "json" / "winrate"
HORIZON = [5, 10, 20, 60, 120, 200]
JENDELA = {"n120": rs.N_SINYAL, "n500": 500}
HORIZON_SARINGAN = (20, 60)
JENDELA_SARINGAN = "n500"
N_MENTAH = 750
BIAYA = rs.BIAYA
WIB = timezone(timedelta(hours=7))


# ── bahan ───────────────────────────────────────────────────────────────────
def baca(kode: str) -> list | None:
    """Deret OHLC PERSIS seperti yang dipakai `rencana_saham.jalankan()`:
    dipotong ke bar berisi terakhir, ditolak kalau terlalu pendek. Menyaring
    lebih dari itu akan menggeser indeks sinyal dan angkanya berhenti sama."""
    p = OHLC / f"{kode}.json"
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text(encoding="utf-8"))["d"]
    except Exception:  # noqa: BLE001 — berkas rusak = tak ada data
        return None
    if len(d) < rs.ATR_HARI + 30:
        return None
    d = potong_ke_berisi(d)
    return d if len(d) >= rs.ATR_HARI + 30 else None


def atr_deret(d: list) -> list:
    """`atr_persen(d[: i + 1])` untuk tiap i, dihitung sekali. Sama persis:
    median rentang harian (dalam % penutupan) atas 14 bar terakhir yang
    penutupannya terisi — jendelanya 14 bar, bukan 14 bar berisi."""
    out = [None] * len(d)
    n = rs.ATR_HARI
    for i in range(len(d)):
        jendela = d[max(0, i - n + 1): i + 1]
        r = [100 * (b[2] - b[3]) / b[4] for b in jendela if b[4]]
        out[i] = st.median(r) if r else None
    return out


# ── telusur per sinyal ─────────────────────────────────────────────────────
def sinyal_per_hari(d: list, n_sinyal: int, horizon: int, atr: list) -> list[dict]:
    """Pengulangan `rencana_saham.telusuri()` yang menyimpan hasil TIAP sinyal.

    Urutan keputusan sama: hari sinyal tak dinilai; target dan batas di hari
    yang sama = kalah; menggantung dinilai pada penutupan akhir jendela, dan
    kalau penutupan itu kosong sinyalnya tetap dihitung menggantung tanpa
    return (persis `telusuri`, yang juga tak menambahkan apa pun ke daftar
    hasil di kasus itu)."""
    out = []
    mulai = max(rs.ATR_HARI + 5, len(d) - n_sinyal - horizon)
    for i in range(mulai, len(d) - horizon):
        harga = d[i][4]
        if not harga:
            continue
        ap = atr[i]
        if not ap:
            continue
        low5 = min(b[3] for b in d[i - 4: i + 1] if b[3]) if i >= 4 else None
        lv = rs.level(harga, ap, low5)
        if not lv["tp1"] or not lv["sl"] or lv["sl"] >= harga:
            continue
        untung = (lv["tp1"] - harga) / harga
        rugi = (harga - lv["sl"]) / harga
        hasil, r, bar_ke = "gantung", None, None
        for k, b in enumerate(d[i + 1: i + 1 + horizon], 1):
            kena_tp = b[2] >= lv["tp1"]
            kena_sl = b[3] <= lv["sl"]
            if kena_sl:                      # termasuk kena keduanya = kalah
                hasil, r, bar_ke = "kalah", -rugi, k
                break
            if kena_tp:
                hasil, r, bar_ke = "menang", untung, k
                break
        if hasil == "gantung":
            akhir = d[i + horizon][4]
            r = (akhir - harga) / harga if akhir else None
        out.append({"i": i, "tgl": d[i][0], "hasil": hasil, "r": r,
                    "barKe": bar_ke, "atrPct": ap})
    return out


def ringkas(sig: list[dict]) -> dict:
    m = sum(1 for s in sig if s["hasil"] == "menang")
    k = sum(1 for s in sig if s["hasil"] == "kalah")
    g = sum(1 for s in sig if s["hasil"] == "gantung")
    n = m + k + g
    rr = [s["r"] for s in sig if s["r"] is not None]
    rata = st.mean(rr) if rr else None

    def rata_kelas(nama):
        v = [s["r"] for s in sig if s["hasil"] == nama and s["r"] is not None]
        return round(100 * st.mean(v), 2) if v else None

    return {
        "menang": m, "kalah": k, "gantung": g, "n": n,
        "winRate": round(100 * m / (m + k), 1) if (m + k) else None,
        "winRateSemua": round(100 * m / n, 1) if n else None,
        "ekspektansi": round(100 * rata, 3) if rata is not None else None,
        "ekspektansiBiaya": round(100 * (rata - BIAYA), 3) if rata is not None else None,
        "rataMenang": rata_kelas("menang"),
        "rataKalah": rata_kelas("kalah"),
        "rataGantung": rata_kelas("gantung"),
        "medianBarKe": st.median([s["barKe"] for s in sig if s["barKe"]]) if (m + k) else None,
    }


def dengan_n_efektif(ring: dict, horizon: int) -> dict:
    return dict(ring, nEfektif=max(1, ring["n"] // horizon) if ring["n"] else 0)


# ── indikator (dari OHLC; Wilder untuk RSI, SMA sederhana) ────────────────
def rsi14(c: list, n: int = 14) -> list:
    out = [None] * len(c)
    if len(c) < n + 1:
        return out
    gain = loss = 0.0
    for i in range(1, n + 1):
        ch = c[i] - c[i - 1]
        gain += max(ch, 0)
        loss += max(-ch, 0)
    ag, al = gain / n, loss / n
    out[n] = 100 - 100 / (1 + ag / al) if al else 100.0
    for i in range(n + 1, len(c)):
        ch = c[i] - c[i - 1]
        ag = (ag * (n - 1) + max(ch, 0)) / n
        al = (al * (n - 1) + max(-ch, 0)) / n
        out[i] = 100 - 100 / (1 + ag / al) if al else 100.0
    return out


def sma(x: list, n: int) -> list:
    out = [None] * len(x)
    s = 0.0
    for i, v in enumerate(x):
        s += v
        if i >= n:
            s -= x[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def arus_asing(kode: str, d: list) -> dict:
    """Net asing 5 hari (lembar) dari gudang Stockbit, per tanggal sinyal.
    Kosong kalau gudangnya tak ada — kondisi asing lalu tak dihitung, bukan
    dianggap nol."""
    p = GUDANG / f"{kode}.json"
    if not p.exists():
        return {}
    try:
        g = json.loads(p.read_text(encoding="utf-8"))
        kol = g["kolom"]
        ib, ij = kol.index("foreignbuy"), kol.index("foreignsell")
    except Exception:  # noqa: BLE001
        return {}
    net = {b[0]: (b[ib] or 0) - (b[ij] or 0) for b in g["bar"]}
    tgl = [b[0] for b in d]
    return {t: sum(net.get(x, 0) for x in tgl[max(0, i - 4): i + 1]) for i, t in enumerate(tgl)}


def saringan(sig: list[dict], d: list, asing: dict) -> dict:
    """13 kondisi di HARI SINYAL, masing-masing diringkas seperti tabel utama.
    Satu sinyal masuk ke satu kondisi per keluarga (RSI, MA, volume, asing,
    ATR), jadi jumlah n dalam satu keluarga = n sinyal yang kondisinya bisa
    dihitung."""
    c = [b[4] for b in d]
    v = [b[5] or 0 for b in d]
    r = rsi14(c)
    m20, m50, m200, v20 = sma(c, 20), sma(c, 50), sma(c, 200), sma(v, 20)
    atr_med = st.median([s["atrPct"] for s in sig]) if sig else None
    kel: dict[str, list] = {}

    def masuk(nama, s):
        kel.setdefault(nama, []).append(s)

    for s in sig:
        i = s["i"]
        if r[i] is not None:
            masuk("RSI < 30" if r[i] < 30 else ("RSI > 70" if r[i] > 70 else "RSI 30–70"), s)
        if m20[i] and m50[i] and m200[i]:
            if c[i] > m20[i] and c[i] > m50[i] and c[i] > m200[i]:
                masuk("Di atas MA20·50·200", s)
            elif c[i] < m20[i] and c[i] < m50[i] and c[i] < m200[i]:
                masuk("Di bawah MA20·50·200", s)
            else:
                masuk("Campuran MA", s)
        if v20[i]:
            rasio = v[i] / v20[i]
            masuk("Volume > 1,5× rata 20 hari" if rasio > 1.5
                  else ("Volume < 0,5× rata 20 hari" if rasio < 0.5 else "Volume normal"), s)
        a = asing.get(s["tgl"])
        if a is not None:
            masuk("Asing net beli 5 hari" if a > 0 else "Asing net jual/nol 5 hari", s)
        if atr_med is not None:
            masuk("ATR di atas median" if s["atrPct"] > atr_med else "ATR di bawah median", s)
    return {k: ringkas(v) for k, v in kel.items()}


def return_mentah(d: list, horizon: int, n_bar: int = N_MENTAH) -> dict | None:
    """Beli lalu tahan `horizon` bar, tanpa target dan batas — pembanding
    jujur: kalau sekadar menahan sudah lebih baik, aturannya yang memotong."""
    c = [b[4] for b in d]
    mulai = max(rs.ATR_HARI, len(c) - n_bar - horizon)
    rr = sorted(100 * (c[i + horizon] / c[i] - 1)
                for i in range(mulai, len(c) - horizon) if c[i] and c[i + horizon])
    if not rr:
        return None
    q = lambda p: rr[min(len(rr) - 1, int(p * len(rr)))]  # noqa: E731
    return {"n": len(rr), "nEfektif": max(1, len(rr) // horizon),
            "winRate": round(100 * sum(1 for x in rr if x > 0) / len(rr), 1),
            "median": round(st.median(rr), 2), "p25": round(q(0.25), 2), "p75": round(q(0.75), 2),
            "rata": round(st.mean(rr), 2)}


def bar_beku(d: list) -> dict:
    """Bar yang tinggi = rendah DAN tutupnya sama dengan kemarin: hari tanpa
    satu pun tick berpindah. Porsi tinggi = angka win rate tahun itu lahir
    dari harga yang tak bergerak, bukan dari perilaku pasar."""
    tahun: dict[str, list] = {}
    for i, b in enumerate(d):
        t = tahun.setdefault(b[0][:4], [0, 0])
        t[1] += 1
        if b[2] == b[3] and i > 0 and b[4] == d[i - 1][4]:
            t[0] += 1
    return {y: {"beku": v[0], "bar": v[1], "pct": round(100 * v[0] / v[1], 1)} for y, v in tahun.items()}


def teknikal_hari_ini(d: list) -> dict:
    c = [b[4] for b in d]
    m20, m50, m200 = sma(c, 20), sma(c, 50), sma(c, 200)
    r = rsi14(c)
    return {"harga": c[-1],
            "ma20": round(m20[-1], 2) if m20[-1] else None,
            "ma50": round(m50[-1], 2) if m50[-1] else None,
            "ma200": round(m200[-1], 2) if m200[-1] else None,
            "rsi14": round(r[-1], 1) if r[-1] is not None else None,
            "tertinggi52": max(b[2] for b in d[-250:]),
            "terendah52": min(b[3] for b in d[-250:])}


# ── satu emiten ─────────────────────────────────────────────────────────────
RUAS_RENCANA = ("tanggal", "harga", "areaBeli", "tp1", "tp2", "sl", "rr", "atrPct", "nilaiHarian")


def satu_emiten(kode: str, d: list, rencana: dict | None) -> dict:
    atr = atr_deret(d)
    asing = arus_asing(kode, d)
    horizon: dict = {}
    sinyal_stabil: dict = {}
    for h in HORIZON:
        horizon[f"h{h}"] = {}
        for nama, n in JENDELA.items():
            sig = sinyal_per_hari(d, n, h, atr)
            horizon[f"h{h}"][nama] = dengan_n_efektif(ringkas(sig), h)
            if nama == JENDELA_SARINGAN:
                sinyal_stabil[h] = sig
    return {
        "kode": kode,
        "nBar": len(d), "mulai": d[0][0], "akhir": d[-1][0],
        "horizon": horizon,
        "returnMentah": {f"h{h}": return_mentah(d, h) for h in HORIZON},
        "saringan": {f"h{h}": saringan(sinyal_stabil[h], d, asing) for h in HORIZON_SARINGAN},
        "barBeku": bar_beku(d),
        "teknikal": teknikal_hari_ini(d),
        "rencana": {k: rencana.get(k) for k in RUAS_RENCANA} if rencana else None,
    }


# ── pasar ───────────────────────────────────────────────────────────────────
def persentil(nilai: list[float], v: float) -> int:
    return round(100 * sum(1 for x in nilai if x < v) / len(nilai))


def ringkas_pasar(hasil: dict[str, dict]) -> tuple[dict, dict]:
    """Distribusi pasar per horizon dari jendela 120 (angka kartu), plus
    persentil tiap emiten di dalamnya. Emiten yang win rate atau
    ekspektansinya kosong (tak ada sinyal tuntas) tak ikut menjadi pembagi."""
    pasar, per_emiten = {}, {k: {} for k in hasil}
    for h in HORIZON:
        kh = f"h{h}"
        baris = [(k, e["horizon"][kh]["n120"]) for k, e in hasil.items()]
        baris = [(k, r) for k, r in baris if r["winRate"] is not None and r["ekspektansiBiaya"] is not None]
        wr = sorted(r["winRate"] for _, r in baris)
        ek = sorted(r["ekspektansiBiaya"] for _, r in baris)
        if not baris:
            pasar[kh] = {"n": 0}
            continue
        pasar[kh] = {
            "n": len(baris),
            "winRateMedian": round(st.median(wr), 1), "winRateP25": wr[len(wr) // 4], "winRateP75": wr[3 * len(wr) // 4],
            "eksMedian": round(st.median(ek), 3), "eksP25": round(ek[len(ek) // 4], 3), "eksP75": round(ek[3 * len(ek) // 4], 3),
            "pctEksPositif": round(100 * sum(1 for x in ek if x > 0) / len(ek), 1),
        }
        for k, r in baris:
            per_emiten[k][kh] = {"persentilWinRate": persentil(wr, r["winRate"]),
                                 "persentilEks": persentil(ek, r["ekspektansiBiaya"])}
    return pasar, per_emiten


def muat_rencana() -> dict:
    try:
        return {e["kode"]: e for e in json.loads(RENCANA.read_text(encoding="utf-8"))["emiten"]}
    except Exception:  # noqa: BLE001 — halaman tetap jalan tanpa blok rencana
        return {}


def daftar_kode() -> list[str]:
    return sorted(p.stem for p in OHLC.glob("*.json") if p.stem != "IHSG")


def jalankan(kode_dipilih: list[str] | None = None, tulis: bool = True) -> dict:
    t0 = time.time()
    rencana = muat_rencana()
    kode_semua = kode_dipilih or daftar_kode()
    hasil: dict[str, dict] = {}
    for j, kode in enumerate(kode_semua, 1):
        d = baca(kode)
        if d is None:
            continue
        hasil[kode] = satu_emiten(kode, d, rencana.get(kode))
        if j % 100 == 0:
            print(f"    {j}/{len(kode_semua)} ({time.time() - t0:.0f}s)")
    # Persentil pasar hanya bermakna atas SELURUH pasar; jalan sebagian
    # (--emiten) memakai pembanding dari index.json yang sudah ada kalau ada.
    if kode_dipilih:
        pasar, per_emiten = ringkas_pasar(hasil)
        try:
            lama = json.loads((KELUARAN / "index.json").read_text(encoding="utf-8"))
            pasar = lama["pasar"]
            per_emiten = {k: lama["emiten"].get(k, {}) for k in hasil}
        except Exception:  # noqa: BLE001
            pass
    else:
        pasar, per_emiten = ringkas_pasar(hasil)
    dibangun = datetime.now(WIB).isoformat(timespec="seconds")
    akhir = Counter(e["akhir"] for e in hasil.values()).most_common(1)[0][0] if hasil else None
    kepala = {"dibangun": dibangun, "kelasBukti": rs.KELAS_BUKTI, "biayaPct": round(100 * BIAYA, 2)}
    if tulis:
        KELUARAN.mkdir(parents=True, exist_ok=True)
        for kode, e in hasil.items():
            isi = {**kepala, **e, "pasar": per_emiten.get(kode, {})}
            (KELUARAN / f"{kode}.json").write_text(
                json.dumps(isi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        if not kode_dipilih:
            index = {**kepala, "akhir": akhir, "horizon": HORIZON, "jendela": JENDELA,
                     "horizonSaringan": list(HORIZON_SARINGAN), "nBarMentah": N_MENTAH,
                     "nEmiten": len(hasil), "pasar": pasar,
                     # Persentil per emiten dipadatkan jadi larik [winRate, eks] per
                     # horizon: 956 emiten x 6 horizon dengan nama ruas penuh membuat
                     # index.json dua kali lebih gemuk untuk isi yang sama.
                     "emiten": {k: {"akhir": e["akhir"], "nBar": e["nBar"],
                                    "p": {h: [v["persentilWinRate"], v["persentilEks"]]
                                          for h, v in per_emiten.get(k, {}).items()}}
                                for k, e in hasil.items()}}
            (KELUARAN / "index.json").write_text(
                json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {len(hasil)} emiten · {time.time() - t0:.0f} s · akhir {akhir}")
    return {"hasil": hasil, "pasar": pasar, "perEmiten": per_emiten}


# ── uji ─────────────────────────────────────────────────────────────────────
KUNCI_SAMA = ("menang", "kalah", "gantung", "n", "winRate", "winRateSemua", "ekspektansi", "ekspektansiBiaya")


def swauji() -> None:
    # 1) naik lurus, turun lurus, datar: arah yang sudah dibuktikan telusuri
    naik = [["2026-01-%02d" % (i + 1), 100 + i, 101 + i, 99 + i, 100 + i, 1000] for i in range(60)]
    r = ringkas(sinyal_per_hari(naik, 30, 5, atr_deret(naik)))
    assert r["menang"] > r["kalah"], r
    turun = [["2026-01-%02d" % (i + 1), 200 - i, 201 - i, 199 - i, 200 - i, 1000] for i in range(60)]
    r = ringkas(sinyal_per_hari(turun, 30, 5, atr_deret(turun)))
    assert r["kalah"] > r["menang"], r
    datar = [["2026-01-%02d" % (i + 1), 100, 100, 100, 100, 1000] for i in range(60)]
    r = ringkas(sinyal_per_hari(datar, 30, 5, atr_deret(datar)))
    # ATR nol = tak ada level yang bisa dibuat = tak ada sinyal sama sekali,
    # persis telusuri(); bukan "semua menggantung".
    assert r["n"] == 0 and r["winRate"] is None, r
    assert bar_beku(datar)["2026"]["beku"] == len(datar) - 1, bar_beku(datar)

    # 2) sintetis vs telusuri produksi — ketiga deret di atas, tiga horizon
    for deret in (naik, turun, datar):
        for h in (5, 10, 20):
            prod = rs.telusuri(deret, 30, h)
            kita = ringkas(sinyal_per_hari(deret, 30, h, atr_deret(deret)))
            assert all(prod[k] == kita[k] for k in KUNCI_SAMA), (h, prod, kita)

    # 3) data NYATA: tiga emiten, dua jendela, enam horizon — identik dengan
    #    telusuri() produksi pada deret yang sama; lalu identik dengan jejak di
    #    rencana_saham.json bila berkas itu dibangun dari bar terakhir yang sama.
    rencana = muat_rencana()
    n_cek = 0
    for kode in ("BNBR", "ARCI", "BBCA"):
        d = baca(kode)
        assert d is not None, f"{kode}: arsip harga tak ada"
        atr = atr_deret(d)
        for h in HORIZON:
            for n in JENDELA.values():
                prod = rs.telusuri(d, n, h)
                kita = ringkas(sinyal_per_hari(d, n, h, atr))
                assert all(prod[k] == kita[k] for k in KUNCI_SAMA), (kode, h, n, prod, kita)
                n_cek += 1
        rc = rencana.get(kode)
        if rc and rc["tanggal"] == d[-1][0]:
            for h in (5, 10, 20):
                kita = ringkas(sinyal_per_hari(d, rs.N_SINYAL, h, atr))
                jejak = rc["jejak"][f"h{h}"]
                assert all(jejak[k] == kita[k] for k in KUNCI_SAMA), (kode, h, jejak, kita)
                n_cek += 1
        else:
            print(f"  (jejak {kode} di rencana_saham.json bukan dari bar terakhir yang sama — dilewati)")
    # BNBR h10 @120: angka yang dikutip Johan/pengawas dari kartu
    d = baca("BNBR")
    r = ringkas(sinyal_per_hari(d, rs.N_SINYAL, 10, atr_deret(d)))
    print(f"  BNBR h10/120: winRate {r['winRate']} · winRateSemua {r['winRateSemua']} · eks biaya {r['ekspektansiBiaya']}")

    # 4) saringan: tiap sinyal masuk tepat satu kondisi per keluarga
    sig = sinyal_per_hari(d, 500, 20, atr_deret(d))
    s = saringan(sig, d, arus_asing("BNBR", d))
    for keluarga in (("RSI < 30", "RSI 30–70", "RSI > 70"),
                     ("Di atas MA20·50·200", "Campuran MA", "Di bawah MA20·50·200"),
                     ("Volume > 1,5× rata 20 hari", "Volume normal", "Volume < 0,5× rata 20 hari"),
                     ("ATR di atas median", "ATR di bawah median")):
        total = sum(s[k]["n"] for k in keluarga if k in s)
        assert total <= len(sig), (keluarga, total, len(sig))
    assert sum(s[k]["n"] for k in ("ATR di atas median", "ATR di bawah median")) == len(sig)

    # 5) persentil: nilai terkecil = 0, terbesar < 100, nilai di luar tak ikut
    assert persentil([1, 2, 3, 4], 1) == 0 and persentil([1, 2, 3, 4], 4) == 75
    print(f"swauji winrate_emiten: lolos ({n_cek} pembanding data nyata identik)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    ap.add_argument("--emiten", help="daftar kode dipisah koma (jalan sebagian, index.json tak ditulis)")
    ap.add_argument("--tanpa-tulis", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)
    dipilih = [k.strip().upper() for k in a.emiten.split(",") if k.strip()] if a.emiten else None
    jalankan(dipilih, tulis=not a.tanpa_tulis)
