"""Rezim pasar per emiten — perilakunya saat IHSG naik vs saat IHSG turun.

Asal permintaan (Johan, 28 Agu 2026): *"potensi dia naik atau turun di saat
market bearish or bullish"* — blok A rancangan Berkas Emiten.

## v2 — hasil audit adversarial 28 Agu 2026 (4 lensa + sintesis)

Versi pertama memakai rasio rata-rata `fmean(emiten)/fmean(pasar)` per ember.
Audit membuktikannya CACAT AKAR: rasio itu secara aljabar = `beta +
alfa/rata2_pasar`, dan karena rata-rata IHSG per ember cuma ±0,0093, suku
drift (alfa) masuk dengan pengali ±100 BERTANDA BERLAWANAN di dua ember.
Terukur: korelasi (tangkap_naik − tangkap_turun) dengan alfa = 0,998, dengan
beta = 0,023 — sumbu asimetrinya sepenuhnya drift harga masa lalu, bukan
perilaku terhadap rezim. Label "ideal" bermedian drift +100,6%/tahun (detektor
pemenang belakangan), dan di uji luar sampel label v1 bertahan 54,1% sementara
menebak "defensif" untuk semua emiten benar 65,8%.

Perubahan v2, semuanya keputusan audit:
1. Estimator = BETA KOVARIAN per ember (regresi tanpa intersep bias:
   cov(e,p)/var(p) atas pasangan return di ember itu) — drift tersingkir.
2. Pagar |return| <= 300%: bar rusak arsip (BCIC close bolak-balik 560 <->
   5,5 juta; SIPD; ITMA) lolos saringan volume & jeda. Arsipnya TIDAK
   ditambal di sini — kerusakan ohlc/ dilaporkan ke Johan terpisah.
3. Nilai beta NEGATIF = kelas sendiri ("berlawanan"), bukan disamakan dengan
   "defensif" — rata-rata rugi saat pasar naik itu beda kualitatif dari tak
   bereaksi.
4. Ambang label dari PERSENTIL populasi (median), bukan angka bulat 0,9/0,8
   yang terukur menjadikan "defensif" keranjang sampah 622/955. Emiten dalam
   ±0,05 dari ambang ditandai `batas_tipis`.
5. UJI LUAR SAMPEL BAWAAN: latih <2023, uji >=2023, bandingkan ketahanan
   label vs tebakan-modus. Hasilnya ditulis ke berkas (`uji_luar_sampel`)
   dan `label_tayang` = ketahanan > tebakan buta. Kalau kalah, HALAMAN TIDAK
   BOLEH MERENDER LABEL — cukup dua angka beta + kalimat ujinya. Angka yang
   kalah dari tebakan buta tak berhak tampil sebagai kategori berwarna.
6. Porsi hari ber-return nol ikut ditulis (`porsi_nol`) — "defensif" di
   emiten tak likuid sering berarti "jarang bergerak", dan pembaca berhak
   melihat penandanya (terukur: korelasi porsi-nol vs beta naik −0,33).
7. Asimetri ditahan bila |beta_turun| < 0,2 DAN tanda beta turun tahunan
   berganti >= 3 kali — penyebut kecil yang labil antar tahun.

Keluaran: `data-idx/json/rezim_pasar.json`.

    python scripts/bangun_rezim_pasar.py
    python scripts/bangun_rezim_pasar.py --uji     # swauji, tanpa menulis
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from statistics import fmean, median

AKAR = Path(__file__).resolve().parent.parent
DIR_OHLC = AKAR / "data-idx" / "json" / "ohlc"
P_KELUARAN = AKAR / "data-idx" / "json" / "rezim_pasar.json"

MIN_SAMPEL = 60
# |return| di atas ini = bar rusak arsip, bukan pergerakan pasar (BCIC 9820x).
MAKS_RETURN = 3.0
MAKS_JEDA_HARI = 7
N_HARI_TERBURUK = 5
# Asimetri ditahan bila penyebut kecil DAN labil antar tahun (audit #7).
AMBANG_PENYEBUT = 0.2
MIN_GANTI_TANDA = 3
# Jarak ke ambang label yang dianggap "batas tipis" (audit #5).
TIPIS = 0.05
# Batas periode uji luar sampel (audit #2/#5).
BATAS_UJI = "2023-01-01"

I_TGL, I_CLOSE, I_VOL = 0, 4, 5


def _hari(t: str) -> date:
    return date(int(t[0:4]), int(t[5:7]), int(t[8:10]))


def deret_return(bar: list) -> dict[str, float]:
    """{tanggal: return} — hanya hari bervolume, jeda wajar, dan besaran waras."""
    out: dict[str, float] = {}
    for i in range(1, len(bar)):
        kini, lalu = bar[i], bar[i - 1]
        try:
            c1, c0 = float(kini[I_CLOSE]), float(lalu[I_CLOSE])
            vol = float(kini[I_VOL] or 0)
        except (TypeError, ValueError, IndexError):
            continue
        if vol <= 0 or c0 <= 0 or c1 <= 0:
            continue
        if (_hari(kini[I_TGL]) - _hari(lalu[I_TGL])).days > MAKS_JEDA_HARI:
            continue
        r = c1 / c0 - 1.0
        if abs(r) > MAKS_RETURN:
            continue  # bar rusak arsip — audit #3
        out[kini[I_TGL]] = r
    return out


def beta(pasangan: list[tuple[float, float]], min_sampel: int = MIN_SAMPEL) -> float | None:
    """Beta kovarian atas satu ember: cov(emiten, pasar) / var(pasar).

    BUKAN rasio rata-rata — rasio membawa drift dengan pengali ±100 (audit #1).
    """
    if len(pasangan) < min_sampel:
        return None
    me = fmean(e for e, _ in pasangan)
    mp = fmean(p for _, p in pasangan)
    var = sum((p - mp) ** 2 for _, p in pasangan)
    if var <= 0:
        return None
    cov = sum((e - me) * (p - mp) for e, p in pasangan)
    return cov / var


def belah(ret_em: dict[str, float], ret_ps: dict[str, float]):
    naik: list[tuple[float, float]] = []
    turun: list[tuple[float, float]] = []
    for tgl, rp in ret_ps.items():
        re = ret_em.get(tgl)
        if re is None or rp == 0:
            continue
        (naik if rp > 0 else turun).append((re, rp))
    return naik, turun


def hitung(ret_em: dict[str, float], ret_ps: dict[str, float]) -> dict:
    naik, turun = belah(ret_em, ret_ps)
    b_naik = beta(naik)
    b_turun = beta(turun)

    n_nol = sum(1 for v in ret_em.values() if v == 0)

    return {
        "tangkap_naik": None if b_naik is None else round(b_naik, 4),
        "tangkap_turun": None if b_turun is None else round(b_turun, 4),
        "asimetri": None,   # diisi belakangan (butuh per_tahun utk guard #7)
        "alasan": None if (b_naik is not None and b_turun is not None)
                  else f"sampel < {MIN_SAMPEL} hari di salah satu rezim",
        "n_naik": len(naik),
        "n_turun": len(turun),
        # Porsi hari bervolume yang harganya tak bergerak — penanda
        # "defensif karena tak likuid" (audit #6). Bukan penyaring.
        "porsi_nol": round(n_nol / len(ret_em), 4) if ret_em else None,
    }


def isi_asimetri(r: dict) -> None:
    """Asimetri = beta_naik/beta_turun, dengan dua penahan (audit #7)."""
    n, t = r["tangkap_naik"], r["tangkap_turun"]
    if n is None or t is None:
        return
    if abs(t) < 0.05:
        r["alasan"] = "perilaku saat pasar turun nyaris nol — rasio tak bermakna"
        return
    if abs(t) < AMBANG_PENYEBUT:
        tanda = [v["tangkap_turun"] > 0 for v in r["per_tahun"].values()]
        ganti = sum(1 for a, b in zip(tanda, tanda[1:]) if a != b)
        if ganti >= MIN_GANTI_TANDA:
            r["alasan"] = ("perilaku saat pasar turun berganti tanda antar tahun — "
                           "rasio tak stabil")
            return
    r["asimetri"] = round(n / t, 4)


def label_watak(n: float | None, t: float | None,
                amb_n: float, amb_t: float) -> tuple[str | None, bool]:
    """(watak, batas_tipis). Ambang = median populasi, BUKAN angka bulat."""
    if n is None or t is None:
        return None, False
    # Beta negatif = bergerak MELAWAN pasar — kelas sendiri (audit #4).
    if n < 0 or t < 0:
        return "berlawanan", False
    tipis = abs(n - amb_n) < TIPIS or abs(t - amb_t) < TIPIS
    if n >= amb_n and t <= amb_t:
        return "ideal", tipis
    if n >= amb_n:
        return "pengungkit", tipis
    if t <= amb_t:
        return "defensif", tipis
    return "perangkap", tipis


def per_tahun(ret_em: dict[str, float], ret_ps: dict[str, float]) -> dict[str, dict]:
    out = {}
    for th in sorted({t[:4] for t in ret_em}):
        em = {t: v for t, v in ret_em.items() if t.startswith(th)}
        ps = {t: v for t, v in ret_ps.items() if t.startswith(th)}
        naik, turun = belah(em, ps)
        b_n = beta(naik, MIN_SAMPEL // 2)
        b_t = beta(turun, MIN_SAMPEL // 2)
        if b_n is None or b_t is None:
            continue
        out[th] = {
            "tangkap_naik": round(b_n, 4),
            "tangkap_turun": round(b_t, 4),
            "n_naik": len(naik),
            "n_turun": len(turun),
        }
    return out


def hari_terburuk(ret_em: dict[str, float], ret_ps: dict[str, float]) -> list[dict]:
    out = []
    for tgl, rp in sorted(ret_ps.items(), key=lambda kv: kv[1]):
        re = ret_em.get(tgl)
        if re is None:
            continue
        out.append({"tanggal": tgl, "ihsg": round(rp * 100, 2), "emiten": round(re * 100, 2)})
        if len(out) >= N_HARI_TERBURUK:
            break
    return out


def _median_ambang(nilai_n: list[float], nilai_t: list[float]) -> tuple[float, float]:
    return (round(median(nilai_n), 4), round(median(nilai_t), 4)) if nilai_n and nilai_t else (1.0, 1.0)


def uji_luar_sampel(semua_ret: dict[str, dict[str, float]],
                    ret_ps: dict[str, float]) -> dict:
    """Latih <BATAS_UJI, uji >=BATAS_UJI. Label berhak tayang hanya kalau
    ketahanannya mengalahkan tebakan-modus (audit #2 — v1 kalah 54% vs 66%)."""
    ps_a = {t: v for t, v in ret_ps.items() if t < BATAS_UJI}
    ps_b = {t: v for t, v in ret_ps.items() if t >= BATAS_UJI}

    def label_periode(ps: dict[str, float]) -> dict[str, str]:
        mentah = {}
        for kode, rem in semua_ret.items():
            em = {t: v for t, v in rem.items() if t in ps}
            naik, turun = belah(em, ps)
            b_n, b_t = beta(naik), beta(turun)
            if b_n is not None and b_t is not None:
                mentah[kode] = (b_n, b_t)
        if not mentah:
            return {}
        amb_n, amb_t = _median_ambang([v[0] for v in mentah.values()],
                                      [v[1] for v in mentah.values()])
        return {k: label_watak(n, t, amb_n, amb_t)[0] for k, (n, t) in mentah.items()}

    la, lb = label_periode(ps_a), label_periode(ps_b)
    sama = [k for k in la if k in lb]
    if not sama:
        return {"n": 0, "bertahan_pct": None, "tebakan_buta_pct": None, "label_tayang": False}
    bertahan = sum(1 for k in sama if la[k] == lb[k])
    modus = max(set(lb.values()), key=lambda x: sum(1 for v in lb.values() if v == x))
    buta = sum(1 for k in sama if lb[k] == modus)
    return {
        "n": len(sama),
        "batas": BATAS_UJI,
        "bertahan_pct": round(100 * bertahan / len(sama), 1),
        "tebakan_buta_pct": round(100 * buta / len(sama), 1),
        "modus": modus,
        "label_tayang": bertahan > buta,
    }


def bangun() -> dict:
    ihsg = json.loads((DIR_OHLC / "IHSG.json").read_text(encoding="utf-8"))
    ret_ps = deret_return(ihsg["d"])
    print(f"IHSG: {len(ret_ps)} hari return sah ({min(ret_ps)} .. {max(ret_ps)})")

    # Pass 1 — deret return semua emiten (dipakai hitung + uji luar sampel).
    semua_ret: dict[str, dict[str, float]] = {}
    for p in sorted(DIR_OHLC.glob("*.json")):
        kode = p.stem
        if kode == "IHSG" or kode.startswith("_"):
            continue
        try:
            bar = json.loads(p.read_text(encoding="utf-8")).get("d") or []
        except (json.JSONDecodeError, OSError):
            continue
        rem = deret_return(bar)
        if rem:
            semua_ret[kode] = rem

    # Pass 2 — beta seumur hidup + per tahun.
    hasil: dict[str, dict] = {}
    for kode, rem in semua_ret.items():
        r = hitung(rem, ret_ps)
        r["per_tahun"] = per_tahun(rem, ret_ps)
        isi_asimetri(r)
        r["hari_terburuk"] = hari_terburuk(rem, ret_ps)
        hasil[kode] = r

    # Pass 3 — ambang label dari median populasi (audit #5), lalu label.
    n_semua = [v["tangkap_naik"] for v in hasil.values() if v["tangkap_naik"] is not None and v["tangkap_naik"] >= 0]
    t_semua = [v["tangkap_turun"] for v in hasil.values() if v["tangkap_turun"] is not None and v["tangkap_turun"] >= 0]
    amb_n, amb_t = _median_ambang(n_semua, t_semua)
    for v in hasil.values():
        w, tipis = label_watak(v["tangkap_naik"], v["tangkap_turun"], amb_n, amb_t)
        v["watak"] = w
        v["batas_tipis"] = tipis

    # Pass 4 — uji luar sampel: label berhak tayang atau tidak.
    uji = uji_luar_sampel(semua_ret, ret_ps)
    print(f"uji luar sampel: bertahan {uji.get('bertahan_pct')}% vs tebakan buta "
          f"{uji.get('tebakan_buta_pct')}% (n={uji.get('n')}) -> label_tayang={uji.get('label_tayang')}")

    return {
        "dibangun": date.today().isoformat(),
        "acuan": "IHSG",
        "estimator": "beta kovarian per rezim (v2 — audit 28 Agu 2026; v1 rasio rata-rata GUGUR: sumbunya drift, bukan perilaku)",
        "min_sampel": MIN_SAMPEL,
        "ambang_label": {"naik": amb_n, "turun": amb_t, "dasar": "median populasi"},
        "uji_luar_sampel": uji,
        "catatan": (
            "tangkap_naik/turun = beta (kovarian) emiten terhadap IHSG, dihitung "
            "terpisah untuk hari IHSG naik dan turun. Hari tanpa transaksi, jeda "
            ">7 hari, dan |return|>300% (bar rusak arsip) dibuang."
        ),
        "n_emiten": len(hasil),
        "emiten": hasil,
    }


def swauji() -> None:
    from datetime import timedelta
    tgl0 = date(2018, 1, 2)

    def deret(nfaktor, tfaktor, drift=0.0, n=800):
        bar_ps, bar_em = [], []
        h = e = 100.0
        for i in range(n):
            naik = i % 2 == 0
            # Magnitudo bervariasi — beta butuh var(pasar) > 0 DI DALAM ember;
            # deret +1%/-1% murni membuat var nol dan beta tak terdefinisi.
            m = 0.01 + 0.008 * ((i // 2) % 3)
            rp = m if naik else -m
            re = rp * (nfaktor if naik else tfaktor) + drift
            h *= 1 + rp
            e *= 1 + re
            t = (tgl0 + timedelta(days=i)).isoformat()
            bar_ps.append([t, h, h, h, h, 1])
            bar_em.append([t, e, e, e, e, 1])
        return bar_em, bar_ps

    # 1. Beta murni terukur benar.
    em, ps = deret(2.0, 0.5)
    r = hitung(deret_return(em), deret_return(ps))
    assert abs(r["tangkap_naik"] - 2.0) < 0.02, r
    assert abs(r["tangkap_turun"] - 0.5) < 0.02, r

    # 2. UJI KUNCI ANTI-DRIFT (akar gugurnya v1): emiten beta 1 dua arah
    #    + drift +0,5%/hari. v1 membacanya naik>1 turun<1 (palsu); beta wajib
    #    tetap ~1/~1 di kedua ember.
    em2, ps2 = deret(1.0, 1.0, drift=0.005)
    r2 = hitung(deret_return(em2), deret_return(ps2))
    assert abs(r2["tangkap_naik"] - 1.0) < 0.05, r2
    assert abs(r2["tangkap_turun"] - 1.0) < 0.05, r2

    # 3. Pagar bar rusak: satu hari 9820x dibuang.
    em3, ps3 = deret(1.0, 1.0)
    em3[400][4] = em3[399][4] * 9820
    ret3 = deret_return(em3)
    assert em3[400][0] not in ret3, "bar rusak lolos pagar MAKS_RETURN"

    # 4. Beta negatif -> kelas 'berlawanan', bukan 'defensif'.
    w, _ = label_watak(-0.3, 0.8, 1.0, 1.0)
    assert w == "berlawanan", w

    # 5. Label pakai ambang yang DIBERIKAN (median populasi), bukan konstanta.
    assert label_watak(1.2, 0.6, 1.0, 0.8)[0] == "ideal"
    assert label_watak(1.2, 1.5, 1.0, 0.8)[0] == "pengungkit"
    assert label_watak(0.5, 0.4, 1.0, 0.8)[0] == "defensif"
    assert label_watak(0.5, 1.5, 1.0, 0.8)[0] == "perangkap"

    # 6. Batas tipis tertanda.
    assert label_watak(1.02, 0.6, 1.0, 0.8)[1] is True

    # 7. Volume nol & jeda panjang tetap dibuang (warisan v1).
    lompat = [["2020-01-01", 100, 100, 100, 100, 1], ["2021-01-01", 30, 30, 30, 30, 1]]
    assert deret_return(lompat) == {}

    # 8. Sampel tipis -> None.
    assert beta([(0.01, 0.01)] * 10) is None

    print("swauji lolos: 8 pemeriksaan (termasuk uji kunci anti-drift)")


if __name__ == "__main__":
    if "--uji" in sys.argv:
        swauji()
        raise SystemExit(0)
    swauji()
    data = bangun()
    if data["n_emiten"] < 500:
        raise SystemExit(f"BATAL: cuma {data['n_emiten']} emiten terhitung — arsip harga kurang?")
    P_KELUARAN.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kb = P_KELUARAN.stat().st_size / 1024
    berlabel = sum(1 for v in data["emiten"].values() if v["watak"])
    print(f"OK -> {P_KELUARAN} ({data['n_emiten']} emiten, {berlabel} berlabel, {kb:.0f} KB)")
