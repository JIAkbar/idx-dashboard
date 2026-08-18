# -*- coding: utf-8 -*-
"""Panen aliran dana ASING per emiten -> data-idx/json/asing/<KODE>.json

Ruas `ForeignBuy`/`ForeignSell` sudah ada di `GetStockSummary` sejak dulu —
32 ruas per emiten per tanggal — tapi tak pernah kita simpan. Pemanen lain
(`download_idx.py`) menyimpan ringkasan HARIAN level pasar; yang dibutuhkan
halaman satu emiten adalah RIWAYAT satu emiten, dan membuka satu emiten tak
boleh berarti mengunduh seluruh pasar. Karena itu keluarannya per emiten,
meniru bentuk `data-idx/json/ohlc/<KODE>.json`.

SATUAN — jangan ditebak, ini sudah diukur (18 Agu 2026)
--------------------------------------------------------
    beli, jual, volume  -> LEMBAR saham
    value               -> RUPIAH
    frekuensi           -> jumlah transaksi (kali)

Buktinya: seluruh pasar 18 Agu 2026 menjumlah ForeignBuy 5,03e9 sementara
Volume 2,88e10 dan Value 1,37e13. Kalau ForeignBuy rupiah, ia cuma 0,04% dari
nilai transaksi pasar — mustahil. Sebagai lembar ia 17% dari volume, wajar.
Pemeriksaan kedua: TAK SATU PUN emiten punya ForeignBuy > Volume hari itu.

Konsekuensinya: **aliran asing di sini TIDAK punya versi rupiah.** IDX hanya
melaporkan lembar. Menaksir rupiahnya = lembar x harga rata-rata (Value/Volume)
— itu taksiran, bukan data, jadi tidak disimpan di sini.

BATAS RIWAYAT — 2020-01-02, terbukti bukan tebakan
---------------------------------------------------
Diuji 18 Agu 2026, satu panggilan per tanggal:

    2020-01-02 -> 671 baris   2019-12-30 -> 0 baris
    2020-01-03 -> 671 baris   2019-12-27 -> 0 baris
    2020-01-06 -> 671 baris   2019-12-02 -> 0 baris
                              2019-09-02 -> 0 baris
                              2018-01-02 -> 0 | 2015-01-05 -> 0 | 2010-01-04 -> 0

Bukan hari libur (30 Des 2019 hari bursa) dan bukan galat — HTTP 200 dengan
`data: []`. Itu batas sumbernya. **Jangan menjadwalkan percobaan ulang untuk
tanggal sebelum 2020-01-02**; panen XBRL 2016-2019 hari ini sudah membuang
satu siklus penuh untuk pelajaran yang sama.

Nol baris juga yang dikembalikan hari libur/akhir pekan (mis. 17 Agu 2026,
HUT RI) — jadi "0 baris" TIDAK dihitung gagal, cuma dilewati.

CARA KERJA
----------
1. Satu panggilan per TANGGAL mengembalikan seluruh pasar (~963 emiten).
   Parameter `length` DIABAIKAN endpoint — `length=5` tetap membalas 963
   baris. Jangan menghitung halaman.
2. Respons MENTAH diarsipkan ke `_arsip-mentah/asing/<tahun>/<YYYYMMDD>.json.gz`
   SEBELUM diparse, dan arsip dibaca lebih dulu sebelum menembak jaringan
   (aturan keras proyek: yang mahal MENGAMBILNYA). Di-gzip karena mentahnya
   ~630 KB/tanggal — 1600 tanggal = ~1 GB mentah vs ~165 MB ter-gzip.
   Efeknya: menambah ruas keluaran nanti berbiaya jaringan NOL.
3. Arsip itu sekaligus penanda kemajuan. Putus di tengah lalu dijalankan
   ulang = tanggal yang sudah terarsip dibaca dari cakram, sisanya diunduh.
   Tak perlu berkas kemajuan terpisah yang bisa tak sinkron dengan arsipnya.
4. Satu tanggal gagal TIDAK membunuh sisa panen — dicatat, dihitung, lanjut.

Laju sengaja tidak dinaikkan sebagai obat 403: yang ditolak IDX itu sidik
jari TLS (bentuk permintaan), bukan jumlahnya — lihat `scripts/idx_net.py`.

PAKAI
-----
  py -3.14 scripts/panen_asing.py                      # 2020-01-02 s/d hari ini
  py -3.14 scripts/panen_asing.py --mulai 2026-01-01
  py -3.14 scripts/panen_asing.py --dari-arsip         # tanpa jaringan sama sekali
  py -3.14 scripts/panen_asing.py --demo               # swauji, tanpa jaringan
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import arsip_mentah  # noqa: E402
import idx_net  # noqa: E402

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "asing"

URL = "https://www.idx.co.id/primary/TradingSummary/GetStockSummary"
REFERER = "https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan"

# Batas riwayat sumber — lihat blok "BATAS RIWAYAT" di atas. Bukan pilihan
# selera; sebelum tanggal ini endpoint membalas 200 dengan data kosong.
AWAL_SUMBER = date(2020, 1, 2)

SUMBER_ARSIP = "asing"


def hari_bursa(mulai: date, akhir: date):
    """Semua hari kerja dalam rentang. Libur nasional tak disaring — endpoint
    membalas 0 baris dan tanggalnya dilewati, jadi tak perlu kalender libur
    yang harus dirawat tiap tahun."""
    d = mulai
    while d <= akhir:
        if d.weekday() < 5:
            yield d
        d += timedelta(days=1)


def _unduh(tgl: date) -> bytes:
    r = idx_net.get(URL, params={"date": tgl.strftime("%Y%m%d"), "start": 0, "length": 9999},
                    referer=REFERER)
    return gzip.compress(r.content, 6)


def baris_pasar(tgl: date, *, dari_arsip: bool) -> list[dict]:
    """Seluruh baris satu tanggal. Arsip lebih dulu; jaringan hanya kalau perlu."""
    bagian = (str(tgl.year), f"{tgl:%Y%m%d}.json.gz")
    isi = arsip_mentah.baca(SUMBER_ARSIP, *bagian)
    if isi is None:
        if dari_arsip:
            return []
        isi = _unduh(tgl)
        arsip_mentah.simpan(SUMBER_ARSIP, *bagian, data=isi)
    return json.loads(gzip.decompress(isi)).get("data") or []


def _bil(v) -> int:
    """Ruas numerik IDX datang sebagai float (kadang None, kadang teks kosong).
    Dibulatkan ke int: lembar/frekuensi memang bulat, dan rupiah pecahan sen
    tak punya arti di sini. Nilai tak terbaca jadi 0, bukan melempar —
    satu sel rusak tak boleh membunuh seluruh tanggal."""
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return 0


def petik(r: dict) -> tuple[str, str] | None:
    """(kode, baris JSON siap tempel) atau None kalau barisnya tak terpakai.

    Barisnya diserialkan LANGSUNG jadi teks, bukan ditumpuk sebagai list of
    list, supaya 1600 tanggal x ~950 emiten (~1,5 juta baris) muat di memori:
    string ~60 byte vs list-of-7-objek ~300 byte.
    """
    kode = (r.get("StockCode") or "").strip().upper()
    if not kode:
        return None
    tgl = (r.get("Date") or "")[:10]
    if len(tgl) != 10:
        return None
    beli, jual = _bil(r.get("ForeignBuy")), _bil(r.get("ForeignSell"))
    # Lembar tak pernah negatif. Kalau sumbernya mengirim negatif, itu sel
    # rusak — dinolkan, bukan disimpan sebagai fakta.
    beli, jual = max(beli, 0), max(jual, 0)
    return kode, '["%s",%d,%d,%d,%d,%d]' % (
        tgl, beli, jual, _bil(r.get("Volume")), _bil(r.get("Value")), _bil(r.get("Frequency")))


def tulis(per_emiten: dict[str, list[str]]) -> int:
    KELUARAN.mkdir(parents=True, exist_ok=True)
    n = 0
    for kode, baris in sorted(per_emiten.items()):
        baris.sort()  # tanggal ISO -> urut leksikografis = urut kronologis
        isi = ('{"kode":"%s","satuan":{"beli":"lembar","jual":"lembar",'
               '"volume":"lembar","value":"rupiah","frekuensi":"kali"},'
               '"ruas":["tanggal","beli","jual","volume","value","frekuensi"],'
               '"catatan":"net asing = beli - jual (lembar). IDX tidak melaporkan '
               'aliran asing dalam rupiah.","mulai":"%s","akhir":"%s","n":%d,"d":[%s]}'
               % (kode, baris[0][2:12], baris[-1][2:12], len(baris), ",".join(baris)))
        try:
            (KELUARAN / f"{kode}.json").write_text(isi, encoding="utf-8")
            n += 1
        except OSError as e:  # satu berkas gagal tulis tak boleh membunuh sisanya
            print(f"  [gagal tulis {kode}: {e}]")
    return n


def panen(mulai: date, akhir: date, *, jeda: float, dari_arsip: bool) -> None:
    per_emiten: dict[str, list[str]] = {}
    gagal: list[tuple[str, str]] = []
    kosong = terarsip = terunduh = 0
    tanggal = list(hari_bursa(mulai, akhir))
    print(f"panen asing: {mulai} s/d {akhir} — {len(tanggal)} hari kerja")

    for i, tgl in enumerate(tanggal, 1):
        sudah_ada = arsip_mentah.jalur(SUMBER_ARSIP, str(tgl.year), f"{tgl:%Y%m%d}.json.gz").exists()
        try:
            rows = baris_pasar(tgl, dari_arsip=dari_arsip)
        except Exception as e:  # noqa: BLE001 — satu tanggal gagal, sisanya lanjut
            gagal.append((str(tgl), f"{type(e).__name__}: {e}"))
            print(f"[{i}/{len(tanggal)}] {tgl} GAGAL — {e}")
            continue
        if sudah_ada:
            terarsip += 1
        else:
            terunduh += 1
            if jeda:
                time.sleep(jeda)
        if not rows:
            kosong += 1
            continue
        for r in rows:
            hasil = petik(r)
            if hasil:
                per_emiten.setdefault(hasil[0], []).append(hasil[1])
        if i % 50 == 0 or i == len(tanggal):
            print(f"[{i}/{len(tanggal)}] {tgl} — {len(per_emiten)} emiten terkumpul")

    n = tulis(per_emiten)
    jml = sorted(len(v) for v in per_emiten.values())
    med = jml[len(jml) // 2] if jml else 0
    print(f"\nselesai: {n} berkas di {KELUARAN}")
    print(f"  hari bursa terpakai : {len(tanggal) - kosong - len(gagal)}")
    print(f"  0 baris (libur)     : {kosong}")
    print(f"  dari arsip / unduh  : {terarsip} / {terunduh}")
    print(f"  median baris/emiten : {med}  (min {jml[0] if jml else 0}, max {jml[-1] if jml else 0})")
    if gagal:
        print(f"  GAGAL {len(gagal)} tanggal:")
        for t, e in gagal[:20]:
            print(f"    {t}: {e}")


def demo() -> None:
    """Swauji tanpa jaringan — yang gagal kalau logika petik/tulis rusak."""
    import shutil
    import tempfile

    r = {"StockCode": " aadi ", "Date": "2026-08-18T00:00:00", "ForeignBuy": 5559600.0,
         "ForeignSell": 5032700.0, "Volume": 15946000.0, "Value": 153998085000.0,
         "Frequency": 11031.0}
    kode, baris = petik(r)
    assert kode == "AADI", kode
    b = json.loads(baris)
    assert b == ["2026-08-18", 5559600, 5032700, 15946000, 153998085000, 11031], b
    assert b[1] - b[2] == 526900, "net = beli - jual harus terhitung dari ruas tersimpan"

    assert petik({"StockCode": "", "Date": "2026-08-18T00:00:00"}) is None
    assert petik({"StockCode": "X", "Date": ""}) is None
    # sel rusak/teks tak boleh melempar (dua kali membunuh panen hari ini)
    assert json.loads(petik({"StockCode": "X", "Date": "2026-08-18T00:00:00",
                             "ForeignBuy": "", "Volume": None})[1])[1] == 0
    # negatif dinolkan
    assert json.loads(petik({"StockCode": "X", "Date": "2026-08-18T00:00:00",
                             "ForeignSell": -5})[1])[2] == 0

    hk = list(hari_bursa(date(2026, 8, 14), date(2026, 8, 18)))
    assert hk == [date(2026, 8, 14), date(2026, 8, 17), date(2026, 8, 18)], hk

    global KELUARAN
    asli, tmp = KELUARAN, Path(tempfile.mkdtemp())
    KELUARAN = tmp
    try:
        assert tulis({"ZZZZ": [baris, '["2026-08-17",1,2,3,4,5]']}) == 1
        j = json.loads((tmp / "ZZZZ.json").read_text(encoding="utf-8"))
        assert j["mulai"] == "2026-08-17" and j["akhir"] == "2026-08-18", j
        assert j["n"] == 2 and j["d"][0][0] == "2026-08-17", "baris wajib urut kronologis"
        assert j["satuan"]["beli"] == "lembar" and j["satuan"]["value"] == "rupiah"
    finally:
        KELUARAN = asli
        shutil.rmtree(tmp, ignore_errors=True)
    print("panen_asing: swauji lolos")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mulai", default=str(AWAL_SUMBER))
    p.add_argument("--akhir", default=str(date.today()))
    p.add_argument("--jeda", type=float, default=0.35, help="detik antar unduhan baru")
    p.add_argument("--dari-arsip", action="store_true", help="bangun ulang tanpa jaringan")
    p.add_argument("--demo", action="store_true")
    a = p.parse_args()
    if a.demo:
        demo()
        return
    mulai = max(date.fromisoformat(a.mulai), AWAL_SUMBER)
    panen(mulai, date.fromisoformat(a.akhir), jeda=a.jeda, dari_arsip=a.dari_arsip)


if __name__ == "__main__":
    main()
