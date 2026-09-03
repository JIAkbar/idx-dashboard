# -*- coding: utf-8 -*-
"""Bandarmologi — menghitung teori BidOffer Bandar & spek Algo/Radar di atas
data yang SUDAH dipanen, bukan dari umpan live.

Johan, 3 Sep 2026: *"sistem yang dibuat itu sebenarnya rata-rata jalan offline,
dimana data kita panen mereka baru build gitu sih, jadi teori algo itu coba
pelajari dan buatkan 1 page bahas semua teori itu jadi hasil kerja"*.

Sumber teori:
  · `data ide/Private Class BIDOFFER Bandar Juli - Abo.pdf` (Abdullah Ali Akbar,
    v1.0 2025) — ketimpangan bid/offer, bandar vs retail, Target Market Makers,
    empat fase siklus pasar, key account broker, aturan jempol nilai & asing.
  · `data ide/algo-radar-ops-formula.pdf` (Rizky Cahya v1.0) — baseline robust
    median/MAD, z-robust, ambang kalibrasi 20 hari, pematokan skor tak
    terkalibrasi. Studi lengkap: `docs/spek-dev-papan/studi_algo-radar-ops-formula.md`.

YANG DIHITUNG DI SINI hanyalah yang bisa dijawab data harian kita. Yang butuh
order book berlapis live atau sisi agresor per transaksi TIDAK dikarang
proksinya diam-diam — ia ditandai `tak_bisa` dengan sebabnya, supaya halaman
bisa menyatakannya apa adanya.

Keluaran: `data-idx/json/bandarmologi.json`
"""
from __future__ import annotations

import json
import math
import statistics
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
JSON = AKAR / "data-idx" / "json"
ASING = JSON / "asing"
BROKER = JSON / "broker_harian"
OHLC = JSON / "ohlc"
KELUARAN = JSON / "bandarmologi.json"

# Ambang kalibrasi dari spek Algo §2.4 — di bawah ini baseline ada tapi tak
# dipercaya, dan skor yang bergantung padanya dipatok (§6).
N_MIN_KALIBRASI = 20
# Jendela baseline: 60 hari bursa. Cukup panjang untuk median/MAD yang stabil,
# cukup pendek supaya rezim setahun lalu tak mencemari hari ini.
JENDELA = 60
# Aturan jempol BidOffer Bandar hal. 4 & 20 — dipakai APA ADANYA sebagai ambang
# yang diuji, bukan sebagai kebenaran. Halaman menyebut asalnya.
LIPAT_TIMPANG = 3.0        # "Total Offer minimal 3x Total Bid"
NILAI_SHARE_MIN = 0.08     # "transaksi emiten 8-10% dari IHSG maka valid bermain"
ASING_SHARE_MIN = 0.10     # "10-15% dari value pasti Net Buy Foreign → layak swing"


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def median_mad(xs: list[float]) -> tuple[float, float]:
    """Median & MAD — spek Algo §2.1. Basis semua z di bawah."""
    if not xs:
        return 0.0, 0.0
    med = statistics.median(xs)
    return med, statistics.median([abs(x - med) for x in xs])


def z_rob(x: float, med: float, mad: float) -> float | None:
    """z-robust §2.2: 0.6745·(x−median)/MAD. None kalau MAD nol — deret yang
    tak pernah bergerak tak punya skala, dan memaksakan z di situ menghasilkan
    angka tak terhingga yang terbaca sebagai sinyal ekstrem."""
    if not mad:
        return None
    return 0.6745 * (x - med) / mad


def fraksi(harga: float) -> int:
    """Fraksi harga bursa — sama dengan `app/src/lib/fraksiHarga.ts` dan dengan
    tabel di spek Algo §8.1."""
    if harga < 200:
        return 1
    if harga < 500:
        return 2
    if harga < 2000:
        return 5
    if harga < 5000:
        return 10
    return 25


def hhi(bagian: list[float]) -> float | None:
    """Herfindahl 0–1 atas pangsa. Dipakai mengukur 'terkonsentrasi di beberapa
    sekuritas' (BidOffer hal. 16) dengan satu angka, bukan mata."""
    tot = sum(bagian)
    if tot <= 0:
        return None
    return sum((b / tot) ** 2 for b in bagian)


def fase_broker(brokers: list[list]) -> dict | None:
    """Empat fase siklus pasar dari konsentrasi broker (BidOffer hal. 15-16).

    Teorinya: saat AKUMULASI, nilai beli menumpuk di beberapa sekuritas
    sementara jualnya tersebar; saat DISTRIBUSI, kebalikannya. Diterjemahkan
    jadi dua angka yang bisa dibandingkan: HHI sisi beli vs HHI sisi jual.

    Yang TIDAK dilakukan: memutuskan fase dari satu hari saja. Fase butuh
    arah harga juga (mark up vs mark down), dan itu ditambahkan pemanggil.
    """
    beli = [b[2] for b in brokers if len(b) > 2 and b[2]]
    jual = [b[4] for b in brokers if len(b) > 4 and b[4]]
    hb, hj = hhi(beli), hhi(jual)
    if hb is None or hj is None:
        return None
    tot_beli, tot_jual = sum(beli), sum(jual)
    urut_b = sorted(beli, reverse=True)
    urut_j = sorted(jual, reverse=True)
    return {
        "hhi_beli": round(hb, 4),
        "hhi_jual": round(hj, 4),
        # Selisih positif = beli lebih terkonsentrasi = ciri akumulasi.
        "konsentrasi": round(hb - hj, 4),
        "top3_beli_pct": round(sum(urut_b[:3]) / tot_beli * 100, 2) if tot_beli else None,
        "top3_jual_pct": round(sum(urut_j[:3]) / tot_jual * 100, 2) if tot_jual else None,
        "n_beli": len(beli),
        "n_jual": len(jual),
    }


def key_account(kode: str, tanggal_urut: list[str], hari: dict, n_hari: int = 20) -> list[dict]:
    """Sekuritas yang BERULANG jadi pembeli terbesar (BidOffer hal. 15: bandar
    memakai 3-8 sekuritas agar tak mudah dideteksi dan bisa oper barang).

    Ukurannya: berapa hari dari `n_hari` terakhir broker itu masuk 3 besar
    nilai beli, dan berapa total nilai bersihnya. Broker yang muncul sekali
    karena satu transaksi besar tersaring sendiri oleh hitungan hari.
    """
    hitung: dict[str, dict] = {}
    dipakai = tanggal_urut[-n_hari:]
    for t in dipakai:
        br = (hari.get(t) or {}).get("broker") or []
        if not br:
            continue
        top = sorted(br, key=lambda b: b[2] if len(b) > 2 else 0, reverse=True)[:3]
        for b in top:
            k = b[0]
            d = hitung.setdefault(k, {"broker": k, "hari": 0, "beli": 0.0, "jual": 0.0})
            d["hari"] += 1
            d["beli"] += b[2] if len(b) > 2 else 0
            d["jual"] += b[4] if len(b) > 4 else 0
    keluar = []
    for d in hitung.values():
        if d["hari"] < 3:  # muncul <3 hari = kebetulan, bukan pola
            continue
        d["net"] = round(d["beli"] - d["jual"])
        d["beli"] = round(d["beli"])
        d["jual"] = round(d["jual"])
        keluar.append(d)
    return sorted(keluar, key=lambda d: (-d["hari"], -d["net"]))[:8]


def tmm_swing(bo: list | None, brokers: list[list], close: float) -> dict | None:
    """Target Market Makers versi SWING (BidOffer hal. 8).

        X = Volume Lot Buyer Broksum ÷ ((Total Bid + Total Offer) ÷ 2)
            × (harga atas bid − harga bawah bid)
        Target = X + Average Price Top Buyer Broksum

    Dua penyimpangan dari resep aslinya, keduanya karena keterbatasan data —
    dan keduanya ditulis ke keluaran supaya halaman bisa menyebutnya:

    1. `(Total Bid + Total Offer)/2` di kelas itu dibaca dari order book
       SEPULUH level saat live. Kita hanya punya level TERBAIK pada penutupan
       (`bidoffer.json`), jadi penyebutnya jauh lebih kecil dan targetnya
       cenderung lebih jauh. Ditandai `basis: "level-terbaik-penutupan"`.
    2. "Harga atas bid − harga bawah bid" = rentang 10 tick di kelasnya.
       Kita pakai 10 × fraksi harga — sama artinya, tapi dihitung dari tabel
       fraksi, bukan dibaca dari layar.
    """
    if not bo or not brokers or not close:
        return None
    _bid, bid_lot, _off, off_lot, _cl, _pv = bo
    penyebut = (bid_lot + off_lot) / 2
    if penyebut <= 0:
        return None
    top = sorted(brokers, key=lambda b: b[2] if len(b) > 2 else 0, reverse=True)[:5]
    vb_lot = sum((b[1] or 0) for b in top)          # lot beli 5 broker teratas
    nilai = sum((b[2] or 0) for b in top)
    if vb_lot <= 0 or nilai <= 0:
        return None
    harga_avg = nilai / (vb_lot * 100)              # harga rata-rata tertimbang
    rentang = 10 * fraksi(close)
    x = (vb_lot / penyebut) * rentang
    return {
        "target": round(harga_avg + x),
        "harga_avg_top5": round(harga_avg, 2),
        "jarak_pct": round((harga_avg + x) / close * 100 - 100, 2) if close else None,
        "vb_lot_top5": vb_lot,
        "penyebut_lot": round(penyebut),
        "rentang_10tick": rentang,
        "basis": "level-terbaik-penutupan",
    }


def main() -> int:
    ds = sorted(JSON.glob("ds_*.json"))
    if not ds:
        print("tak ada ds_*.json"); return 1
    pasar = baca(ds[-1]) or {}
    tanggal = pasar.get("date_iso")
    nilai_pasar = pasar.get("val_idr_today")  # miliar rupiah
    bidoffer = baca(JSON / "bidoffer.json") or {}
    bo_tgl, bo_d = bidoffer.get("tanggal"), bidoffer.get("d") or {}

    hasil = []
    for p in sorted(ASING.glob("*.json")):
        kode = p.stem
        a = baca(p)
        if not a or not a.get("d"):
            continue
        baris = a["d"]
        # ruas: tanggal, beli(asing), jual(asing), volume, value, frekuensi
        akhir = baris[-1]
        if akhir[0] != tanggal:
            continue  # emiten tak bertransaksi hari itu / berkas tertinggal
        vol, val, frek = akhir[3] or 0, akhir[4] or 0, akhir[5] or 0
        if not vol or not frek:
            continue

        # ── 1. BANDAR vs RETAIL (BidOffer hal. 3) ────────────────────────
        # "Lot besar, freq kecil = bandar; lot kecil, freq besar = retail."
        # Diterjemahkan jadi lot rata-rata per transaksi, lalu dibandingkan
        # dengan kebiasaan emiten ITU SENDIRI — bukan dengan emiten lain.
        # BBCA 42 lot/transaksi dan saham gocap 8 lot/transaksi tak bisa
        # diadu langsung; yang bermakna adalah "hari ini vs biasanya".
        lot_per_tx = vol / frek / 100
        riwayat = [(b[3] / b[5] / 100) for b in baris[-(JENDELA + 1):-1]
                   if b[3] and b[5]]
        med_l, mad_l = median_mad(riwayat)
        z_lot = z_rob(lot_per_tx, med_l, mad_l)

        # ── 2. ATURAN JEMPOL NILAI (BidOffer hal. 20) ────────────────────
        # "Value transaction emiten 8-10% dari IHSG → valid emiten bermain."
        # Kelasnya memakai 5-10 menit pertama saat live; kita memakai NILAI
        # SEHARI PENUH. Bukan hal yang sama — ditandai di keluaran.
        share_nilai = (val / 1e9) / nilai_pasar if nilai_pasar else None

        # ── 3. ASING (BidOffer hal. 20) ──────────────────────────────────
        # "Dari total value emiten, 10-15% Net Buy Foreign → layak swing."
        net_asing_lembar = (akhir[1] or 0) - (akhir[2] or 0)
        share_asing = (net_asing_lembar / vol) if vol else None

        # ── 4. KETIMPANGAN BID/OFFER (BidOffer hal. 4) ───────────────────
        bo = bo_d.get(kode)
        rasio_off_bid = None
        if bo and bo[1] and bo[3]:
            rasio_off_bid = bo[3] / bo[1]

        # ── 5. FASE & KEY ACCOUNT dari broker summary ────────────────────
        bh = baca(BROKER / f"{kode}.json")
        fase = key = tmm = None
        akd = None
        if bh and (bh.get("hari") or {}).get(tanggal):
            hari = bh["hari"]
            hh = hari[tanggal]
            brokers = hh.get("broker") or []
            akd = (hh.get("ringkas") or {}).get("accdist")
            if brokers:
                fase = fase_broker(brokers)
                key = key_account(kode, sorted(hari.keys()), hari)
                o = baca(OHLC / f"{kode}.json") or {}
                close = None
                for bar in reversed(o.get("d") or []):
                    if bar and bar[0] == tanggal:
                        close = bar[4]; break
                if close:
                    tmm = tmm_swing(bo, brokers, close)

        hasil.append({
            "kode": kode,
            "lot_per_tx": round(lot_per_tx, 2),
            "lot_med": round(med_l, 2),
            "z_lot": round(z_lot, 2) if z_lot is not None else None,
            "n_baseline": len(riwayat),
            "terkalibrasi": len(riwayat) >= N_MIN_KALIBRASI,
            "nilai": val,
            "share_nilai": round(share_nilai, 5) if share_nilai else None,
            "frekuensi": frek,
            "volume": vol,
            "net_asing_lembar": net_asing_lembar,
            "share_asing": round(share_asing, 4) if share_asing is not None else None,
            "rasio_offer_bid": round(rasio_off_bid, 2) if rasio_off_bid else None,
            "accdist": akd,
            "fase": fase,
            "key_account": key,
            "tmm_swing": tmm,
        })

    keluar = {
        "tanggal": tanggal,
        "tanggal_bidoffer": bo_tgl,
        "nilai_pasar_miliar": nilai_pasar,
        "n": len(hasil),
        "ambang": {
            "lipat_timpang": LIPAT_TIMPANG,
            "share_nilai_min": NILAI_SHARE_MIN,
            "share_asing_min": ASING_SHARE_MIN,
            "n_min_kalibrasi": N_MIN_KALIBRASI,
            "jendela_baseline": JENDELA,
        },
        "tak_bisa": [
            {
                "teori": "Ketimpangan volume Tradebook (vol buyer ≥3× vol seller)",
                "sumber": "BidOffer hal. 4-6",
                "sebab": "menuntut sisi agresor per transaksi. Bursa tak menerbitkan ruas itu; "
                         "HAKA/HAKI adalah turunan platform dari harga transaksi vs bid/offer "
                         "terbaik saat itu, dan kita tak punya kutipan intrabar.",
            },
            {
                "teori": "Lot piramida di order book & rata-rata lot per tick (Vt)",
                "sumber": "BidOffer hal. 5-13",
                "sebab": "menuntut order book berlapis saat live. Kita hanya punya level terbaik "
                         "pada penutupan, sekali sehari.",
            },
            {
                "teori": "Target Market Makers versi DAYTRADE",
                "sumber": "BidOffer hal. 8",
                "sebab": "penyebutnya rata-rata lot per tick di order book, dan harga acuannya "
                         "harga spike pertama intraday — dua-duanya butuh data live.",
            },
            {
                "teori": "Jam pantau 09.20-09.45 / 10.20-10.45 / 14.20-14.45",
                "sumber": "BidOffer hal. 20",
                "sebab": "bisa dihitung dari arsip intraday 1 menit, tapi SESUDAH pasar tutup — "
                         "jadi bahan uji pola, bukan pemandu saat jam berjalan.",
            },
        ],
        "d": sorted(hasil, key=lambda r: -(r["nilai"] or 0)),
    }
    KELUARAN.write_text(json.dumps(keluar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_kal = sum(1 for r in hasil if r["terkalibrasi"])
    n_tmm = sum(1 for r in hasil if r["tmm_swing"])
    n_fase = sum(1 for r in hasil if r["fase"])
    print(f"  {tanggal}: {len(hasil)} emiten | terkalibrasi {n_kal} | fase broker {n_fase} | TMM swing {n_tmm}")
    print(f"  → {KELUARAN.relative_to(AKAR)} ({KELUARAN.stat().st_size / 1024:.0f} KB)")
    return 0


def swauji() -> int:
    """Nol jaringan, nol berkas — memeriksa yang gampang salah diam-diam."""
    lulus = gagal = 0

    def cek(nama, syarat):
        nonlocal lulus, gagal
        if syarat:
            lulus += 1
        else:
            gagal += 1
            print(f"  GAGAL: {nama}")

    cek("fraksi bursa", [fraksi(x) for x in (100, 300, 1000, 3000, 9000)] == [1, 2, 5, 10, 25])
    cek("fraksi batas bawah", fraksi(200) == 2 and fraksi(500) == 5 and fraksi(2000) == 10 and fraksi(5000) == 25)
    med, mad = median_mad([1, 2, 3, 4, 100])
    cek("median tahan pencilan", med == 3)
    cek("MAD tahan pencilan", mad == 1)
    cek("z_rob nol saat MAD nol", z_rob(5, 3, 0) is None)
    cek("z_rob tanda benar", (z_rob(5, 3, 1) or 0) > 0 and (z_rob(1, 3, 1) or 0) < 0)
    cek("median kosong", median_mad([]) == (0.0, 0.0))
    cek("hhi terpusat", abs((hhi([100]) or 0) - 1.0) < 1e-9)
    cek("hhi merata", abs((hhi([25, 25, 25, 25]) or 0) - 0.25) < 1e-9)
    cek("hhi nol", hhi([0, 0]) is None)
    # akumulasi: beli menumpuk di 1 broker, jual tersebar
    f = fase_broker([["A", 0, 1000, 0, 100], ["B", 0, 10, 0, 100], ["C", 0, 10, 0, 100]])
    cek("fase: beli terkonsentrasi → konsentrasi positif", f and f["konsentrasi"] > 0)
    f2 = fase_broker([["A", 0, 100, 0, 1000], ["B", 0, 100, 0, 10], ["C", 0, 100, 0, 10]])
    cek("fase: jual terkonsentrasi → konsentrasi negatif", f2 and f2["konsentrasi"] < 0)
    cek("fase kosong", fase_broker([]) is None)
    # TMM: target di atas harga rata-rata, dan penyebut nol tak meledak
    t = tmm_swing([1000, 500, 1010, 500, 1000, 990], [["A", 1000, 100_000_000, 0, 0]], 1000)
    cek("tmm > harga rata-rata", t and t["target"] > t["harga_avg_top5"])
    cek("tmm penyebut nol", tmm_swing([1000, 0, 1010, 0, 1000, 990], [["A", 10, 1000, 0, 0]], 1000) is None)
    cek("tmm tanpa bidoffer", tmm_swing(None, [["A", 10, 1000, 0, 0]], 1000) is None)
    # key account: yang muncul <3 hari dibuang
    hari = {f"2026-08-{d:02d}": {"broker": [["XX", 10, 100, 0, 0]]} for d in range(1, 6)}
    hari["2026-08-06"] = {"broker": [["YY", 10, 100, 0, 0]]}
    k = key_account("T", sorted(hari), hari)
    cek("key account: berulang lolos", any(x["broker"] == "XX" for x in k))
    cek("key account: sekali dibuang", not any(x["broker"] == "YY" for x in k))
    print(f"{lulus}/{lulus + gagal} lulus")
    return 0 if not gagal else 1


if __name__ == "__main__":
    sys.exit(swauji() if "--uji" in sys.argv else main())
