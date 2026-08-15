# -*- coding: utf-8 -*-
"""Panen candle HARIAN (OHLCV) seluruh emiten IDX.

Berbeda dari `panen_seasonality.py` yang menyimpan penutupan BULANAN untuk
menghitung pola musiman, berkas ini menyimpan candle harian penuh — bahan
untuk chart lightweight-charts, lilin per emiten, dan analisis teknikal apa
pun yang butuh tinggi/rendah harian.

BENTUK KELUARAN
---------------
Satu berkas per emiten: `data-idx/json/ohlc/<KODE>.json`

    {"kode":"BBCA","mulai":"2021-08-16","akhir":"2026-08-14","n":1218,
     "d":[["2021-08-16",7250,7300,7200,7275,54321000], ...]}

Satu berkas per emiten, bukan satu berkas besar: halaman yang menampilkan
BBCA cuma perlu mengunduh BBCA. Kalau semuanya digabung, membuka satu emiten
berarti mengunduh 900-an emiten lain yang tak dilihat siapa pun.

Angka disimpan sebagai bilangan bulat kalau memang bulat (harga saham IDX
selalu kelipatan fraksi, jadi hampir selalu bulat) — "7250" hemat empat huruf
dibanding "7250.0", dan dikalikan jutaan baris selisihnya nyata.

JADWAL
------
Bursa tutup 16:15 WIB. Yahoo memberi harga dengan delay ~15 menit, dan
penutupan resmi biasanya sudah final sekitar 30 menit sesudahnya. Jadi
panen harian dijalankan **16:45 WIB atau lebih malam** — lebih awal dari itu
berisiko menyimpan harga yang masih bergerak.

Mode:
  python scripts/panen_ohlc.py --penuh          # riwayat penuh (sekali)
  python scripts/panen_ohlc.py                  # harian: tambah hari baru saja
  python scripts/panen_ohlc.py --batas 5        # uji cepat
  python scripts/panen_ohlc.py --tahun 3        # batasi riwayat saat --penuh

Pengaman terhadap Yahoo sama persis dengan panen_seasonality.py: satu
permintaan pada satu waktu, jeda acak, backoff yang menghormati Retry-After,
dan berhenti setelah tiga penolakan beruntun.
"""
import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
DAFTAR = AKAR / "data-idx" / "json" / "daftar_emiten.json"
KELUARAN = AKAR / "data-idx" / "json" / "ohlc"
CERMIN = AKAR / "app" / "public" / "data-idx" / "json" / "ohlc"

KEPALA = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Connection": "keep-alive",
}

JEDA = (0.9, 1.6)
TUNGGU_ULANG = (5, 15, 45)
BATAS_TOLAK = 3


class Ditolak(Exception):
    """Yahoo menolak (429/403) — isyarat berhenti, bukan galat data."""


def rapi(x):
    """Bulat kalau memang bulat. Harga IDX selalu kelipatan fraksi, jadi
    hampir semua nilai lolos ke cabang pertama — dan itu memangkas berkas."""
    f = float(x)
    return int(f) if f == int(f) else round(f, 2)


def ambil(kode: str, p1: int | None, p2: int | None, rentang: str | None) -> dict:
    dasar = f"https://query1.finance.yahoo.com/v8/finance/chart/{kode}.JK?interval=1d"
    url = f"{dasar}&period1={p1}&period2={p2}" if rentang is None else f"{dasar}&range={rentang}"
    req = urllib.request.Request(url, headers=KEPALA)
    galat = None
    for n in range(len(TUNGGU_ULANG)):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 403):
                saran = e.headers.get("Retry-After")
                jeda = int(saran) if (saran or "").isdigit() else TUNGGU_ULANG[n]
                print(f"    ditolak {e.code}, tunggu {jeda}s")
                time.sleep(jeda)
                galat = e
                continue
            if e.code == 404:
                raise RuntimeError("tidak ada di Yahoo") from e
            if 500 <= e.code < 600:
                time.sleep(TUNGGU_ULANG[n])
                galat = e
                continue
            raise RuntimeError(f"HTTP {e.code}") from e
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            time.sleep(TUNGGU_ULANG[n])
            galat = e
    if isinstance(galat, urllib.error.HTTPError) and galat.code in (429, 403):
        raise Ditolak(str(galat))
    raise RuntimeError(f"gagal setelah {len(TUNGGU_ULANG)} percobaan: {galat}")


def ke_baris(data: dict) -> list[list]:
    """[[tanggal, o, h, l, c, v], ...] — hari tanpa harga penutupan dibuang.

    Hari suspensi memang tak punya candle; menyimpannya sebagai nol akan
    tergambar sebagai harga jatuh ke nol, bukan sebagai perdagangan yang
    dihentikan.
    """
    hasil = (data.get("chart") or {}).get("result")
    if not hasil:
        return []
    res = hasil[0]
    ts = res.get("timestamp") or []
    q = (res.get("indicators", {}).get("quote") or [{}])[0]
    o, h, l, c, v = (q.get(k) or [] for k in ("open", "high", "low", "close", "volume"))
    baris = []
    for i, t in enumerate(ts):
        ci = c[i] if i < len(c) else None
        if ci is None:
            continue
        tgl = datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d")
        baris.append([
            tgl,
            rapi(o[i]) if i < len(o) and o[i] is not None else rapi(ci),
            rapi(h[i]) if i < len(h) and h[i] is not None else rapi(ci),
            rapi(l[i]) if i < len(l) and l[i] is not None else rapi(ci),
            rapi(ci),
            int(v[i]) if i < len(v) and v[i] is not None else 0,
        ])
    return baris


def simpan(kode: str, baris: list[list]) -> int:
    KELUARAN.mkdir(parents=True, exist_ok=True)
    p = KELUARAN / f"{kode}.json"
    p.write_text(json.dumps({
        "kode": kode, "mulai": baris[0][0], "akhir": baris[-1][0], "n": len(baris), "d": baris,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return p.stat().st_size


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--penuh", action="store_true", help="tarik riwayat penuh, bukan hari baru saja")
    ap.add_argument("--tahun", type=int, default=5, help="riwayat berapa tahun saat --penuh (0 = maksimum)")
    ap.add_argument("--batas", type=int, default=0, help="berhenti setelah sekian emiten (uji)")
    ap.add_argument("--cermin", action="store_true", help="salin juga ke app/public")
    arg = ap.parse_args()

    kode_semua = [e["kode"] for e in json.loads(DAFTAR.read_text(encoding="utf-8"))["emiten"]]
    if arg.batas:
        kode_semua = kode_semua[: arg.batas]

    KELUARAN.mkdir(parents=True, exist_ok=True)
    tolak_beruntun = 0
    baru = segar = lewat = 0
    total_byte = 0
    gagal: dict[str, str] = {}
    t0 = time.time()

    for i, kode in enumerate(kode_semua, 1):
        p = KELUARAN / f"{kode}.json"
        lama = json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
        # Emiten yang belum pernah dipanen SELALU ditarik penuh, walau mode
        # harian: menambah satu hari ke berkas yang belum ada tak menghasilkan
        # riwayat apa pun.
        penuh = arg.penuh or lama is None

        try:
            if penuh:
                if arg.tahun:
                    # range=max menurunkan resolusi jadi bulanan walau interval=1d
                    # (ketahuan 15 Agu 2026 pada ^JKSE: 437 titik untuk 36 tahun).
                    # Karena itu selalu period1/period2, tak pernah range=max.
                    p2 = int(datetime.now(timezone.utc).timestamp())
                    p1 = int((datetime.now(timezone.utc) - timedelta(days=365 * arg.tahun + 10)).timestamp())
                    data = ambil(kode, p1, p2, None)
                else:
                    p2 = int(datetime.now(timezone.utc).timestamp())
                    p1 = int(datetime(1996, 1, 1, tzinfo=timezone.utc).timestamp())
                    data = ambil(kode, p1, p2, None)
            else:
                # Harian: 5 hari terakhir sudah lebih dari cukup untuk menambal
                # libur panjang, dan muatannya sepersekian riwayat penuh.
                data = ambil(kode, None, None, "5d")
        except Ditolak as e:
            tolak_beruntun += 1
            print(f"  ! {kode}: ditolak ({e})")
            if tolak_beruntun >= BATAS_TOLAK:
                print(f"\n  BERHENTI — {BATAS_TOLAK} penolakan beruntun. Hasil sejauh ini tersimpan.")
                break
            continue
        except Exception as e:  # noqa: BLE001 — dicatat, tidak ditelan
            gagal[kode] = str(e)
            lewat += 1
            print(f"  x {kode}: {e}")
            time.sleep(random.uniform(*JEDA))
            continue

        tolak_beruntun = 0
        baris = ke_baris(data)
        if not baris:
            gagal[kode] = "seri kosong"
            lewat += 1
        elif penuh:
            total_byte += simpan(kode, baris)
            baru += 1
        else:
            # Gabung menurut tanggal: hari yang sudah ada DITIMPA, bukan
            # ditambahkan — panen ulang di hari yang sama tidak boleh
            # menggandakan barisnya.
            peta = {b[0]: b for b in lama["d"]}
            for b in baris:
                peta[b[0]] = b
            total_byte += simpan(kode, [peta[k] for k in sorted(peta)])
            segar += 1

        if i % 50 == 0:
            print(f"  … {i}/{len(kode_semua)} ({int(time.time() - t0)}s)")
        time.sleep(random.uniform(*JEDA))

    if arg.cermin:
        CERMIN.mkdir(parents=True, exist_ok=True)
        for b in KELUARAN.glob("*.json"):
            (CERMIN / b.name).write_bytes(b.read_bytes())

    semua = list(KELUARAN.glob("*.json"))
    besar = sum(x.stat().st_size for x in semua)
    print(f"\n{len(semua)} berkas · {besar/1024/1024:.1f} MB total · "
          f"rata-rata {besar/max(1,len(semua))/1024:.0f} KB")
    print(f"{baru} ditarik penuh · {segar} disegarkan · {lewat} dilewati · {len(gagal)} gagal")
    print(f"Durasi {int(time.time() - t0)}s")
    if gagal:
        (KELUARAN / "_gagal.json").write_text(json.dumps(gagal, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
