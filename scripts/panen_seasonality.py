# -*- coding: utf-8 -*-
"""Panen harga bulanan SELURUH emiten IDX untuk halaman Seasonality.

Menyimpan satu berkas `data-idx/json/seasonality/harga_bulanan.json` berisi
seri `{kode: {"YYYY-MM": harga}}` dari sejak emiten tercatat. Halaman web
menghitung peluang/statistiknya sendiri dari berkas ini — tidak ada panggilan
ke Yahoo saat pengunjung membuka halaman.

CARA KERJA HARIAN — INKREMENTAL, BUKAN TARIK ULANG
--------------------------------------------------
Seasonality bulanan hanya berubah saat bulan berganti. Menarik ulang seluruh
riwayat 900+ emiten setiap hari berarti ~900 permintaan berat setiap pagi
untuk mengubah satu angka per emiten — itu pemborosan sekaligus cara tercepat
membuat Yahoo memblokir kita.

Maka:

* `--penuh`   : tarik seluruh riwayat (range=max). Untuk emiten yang belum
                pernah dipanen, dan sekali sebulan untuk semua.
* tanpa opsi  : mode harian. Cuma menarik `range=3mo` dan menimpa bulan-bulan
                terakhir. Muatannya kecil, dan bulan berjalan tetap segar.

SOPAN SANTUN TERHADAP YAHOO
---------------------------
Endpoint chart Yahoo tidak berdokumentasi resmi; kalau digedor, balasannya
429 lalu pemblokiran sementara per-IP. Yang dilakukan di sini:

* SATU permintaan pada satu waktu — tanpa paralel. Panen 963 emiten memang
  jadi ~20 menit, dan itu memang harga yang benar untuk data yang cuma
  berubah sekali sehari.
* Jeda ACAK 0,9–1,6 detik antar permintaan. Jeda yang persis sama tiap kali
  justru pola paling mudah dikenali sebagai mesin.
* User-Agent browser sungguhan + header `Accept`/`Accept-Language` yang
  menyertainya. UA default urllib ("Python-urllib/3.11") ditolak.
* 429 dan 5xx ditunggu dengan backoff berlipat (5s, 15s, 45s), menghormati
  header `Retry-After` kalau ada. Kalau tiga kali berturut-turut tetap 429,
  panen BERHENTI dan menyimpan apa yang sudah didapat — memaksa terus saat
  sedang ditolak adalah cara mendapat blokir yang lebih panjang.
* Hasil parsial selalu ditulis. Jalan berikutnya melanjutkan, bukan mengulang.

Cara pakai:
  python scripts/panen_seasonality.py --penuh      # panen awal / bulanan
  python scripts/panen_seasonality.py              # penyegaran harian
  python scripts/panen_seasonality.py --batas 20   # uji cepat 20 emiten
"""
import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
DAFTAR = AKAR / "data-idx" / "json" / "daftar_emiten.json"
KELUARAN = AKAR / "data-idx" / "json" / "seasonality" / "harga_bulanan.json"

KEPALA = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Connection": "keep-alive",
}

JEDA = (0.9, 1.6)          # detik, acak — lihat catatan sopan santun di atas
TUNGGU_ULANG = (5, 15, 45)  # backoff saat 429/5xx
BATAS_TOLAK = 3             # berhenti setelah sekian penolakan beruntun


class Ditolak(Exception):
    """Yahoo menolak (429/403) — bukan galat data, tapi isyarat berhenti."""


def ambil(kode: str, rentang: str) -> dict:
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{kode}.JK"
           f"?interval=1mo&range={rentang}")
    req = urllib.request.Request(url, headers=KEPALA)
    galat = None
    for n in range(len(TUNGGU_ULANG)):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                hasil = json.load(r)
                # Arsip respons MENTAH — tanggal panen masuk jalur karena
                # bulan berjalan berubah tiap kali dipanen ulang (mode harian
                # menimpa bulan-bulan terakhir).
                tanggal = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                arsip_mentah.simpan("seasonality", kode, f"{tanggal}_{rentang}.json", data=hasil)
                return hasil
        except urllib.error.HTTPError as e:
            if e.code in (429, 403):
                # Hormati Retry-After kalau server menyebutnya; ia tahu lebih
                # baik dari tebakan kita.
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


def ke_bulanan(data: dict) -> dict[str, float]:
    """{'YYYY-MM': harga penutup bulan}. Kosong kalau seri tak ada."""
    hasil = (data.get("chart") or {}).get("result")
    if not hasil:
        return {}
    res = hasil[0]
    stempel = res.get("timestamp") or []
    kutipan = (res.get("indicators", {}).get("quote") or [{}])[0]
    adj = res.get("indicators", {}).get("adjclose")
    harga = adj[0]["adjclose"] if adj else kutipan.get("close", [])
    # Yahoo TIDAK selalu menghormati interval=1mo — untuk emiten yang baru
    # tercatat ia mengirim candle mingguan (ketahuan 15 Agu 2026 pada VKTR &
    # ALII). Pengelompokan ke bulan karena itu dikerjakan di sini, bukan
    # dipercayakan ke Yahoo: harga bulan = titik TERAKHIR di bulan itu.
    per_bulan: dict[str, float] = {}
    for t, h in zip(stempel, harga):
        if h is None:
            continue
        per_bulan[datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m")] = float(h)
    return per_bulan


def muat_lama() -> dict:
    if KELUARAN.exists():
        return json.loads(KELUARAN.read_text(encoding="utf-8"))
    return {"dibuat": None, "seri": {}, "gagal": {}}


def simpan(paket: dict) -> None:
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    paket["dibuat"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    paket["sumber"] = "Yahoo Finance, candle bulanan (adjclose)"
    KELUARAN.write_text(json.dumps(paket, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--penuh", action="store_true", help="tarik seluruh riwayat, bukan 3 bulan terakhir")
    ap.add_argument("--batas", type=int, default=0, help="berhenti setelah sekian emiten (uji)")
    arg = ap.parse_args()

    emiten = json.loads(DAFTAR.read_text(encoding="utf-8"))["emiten"]
    kode_semua = [e["kode"] for e in emiten]
    if arg.batas:
        kode_semua = kode_semua[: arg.batas]

    paket = muat_lama()
    seri: dict = paket.setdefault("seri", {})
    gagal: dict = paket.setdefault("gagal", {})

    tolak_beruntun = 0
    baru = segar = lewat = 0
    t0 = time.time()

    for i, kode in enumerate(kode_semua, 1):
        # Emiten yang belum pernah dipanen SELALU ditarik penuh, walau mode
        # harian: menyegarkan 3 bulan terakhir dari seri yang belum ada sama
        # sekali cuma menghasilkan riwayat sepanjang tiga bulan.
        penuh = arg.penuh or kode not in seri
        try:
            data = ambil(kode, "max" if penuh else "3mo")
        except Ditolak as e:
            tolak_beruntun += 1
            print(f"  ! {kode}: ditolak ({e})")
            if tolak_beruntun >= BATAS_TOLAK:
                print(f"\n  BERHENTI — {BATAS_TOLAK} penolakan beruntun. "
                      f"Hasil sejauh ini disimpan; jalankan lagi nanti.")
                break
            continue
        except Exception as e:  # noqa: BLE001 — dicatat, tidak ditelan
            gagal[kode] = str(e)
            lewat += 1
            print(f"  x {kode}: {e}")
            time.sleep(random.uniform(*JEDA))
            continue

        tolak_beruntun = 0
        bulanan = ke_bulanan(data)
        if not bulanan:
            gagal[kode] = "seri kosong"
            lewat += 1
        elif penuh:
            seri[kode] = bulanan
            gagal.pop(kode, None)
            baru += 1
        else:
            seri[kode].update(bulanan)   # bulan lama tetap, yang baru menimpa
            gagal.pop(kode, None)
            segar += 1

        if i % 50 == 0:
            simpan(paket)   # titik aman: mati listrik pun tak mengulang dari nol
            print(f"  … {i}/{len(kode_semua)} ({int(time.time() - t0)}s)")
        time.sleep(random.uniform(*JEDA))

    simpan(paket)
    ukuran = KELUARAN.stat().st_size / 1024 / 1024
    print(f"\nTersimpan: {KELUARAN.relative_to(AKAR)} ({ukuran:.1f} MB)")
    print(f"{len(seri)} emiten berseri · {baru} ditarik penuh · {segar} disegarkan · "
          f"{lewat} dilewati · {len(gagal)} tercatat gagal")
    print(f"Durasi {int(time.time() - t0)}s")


if __name__ == "__main__":
    main()
