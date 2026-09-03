# -*- coding: utf-8 -*-
"""Panen OHLCV harian PENUH (sejak listing) per emiten dari Stockbit chartbit.

Diminta Johan 22-23 Agu 2026 sebagai pondasi kandidat pengganti/pelengkap
`ohlc/` (Yahoo). Terukur di `docs/riset/stockbit-chartbit-ohlcv.md`: harga
tersesuaikan aksi korporasi (seperti Yahoo) DAN volume/value/frequency persis
IDX (beda dari Yahoo) — satu permintaan menjawab seluruh riwayat emiten
(BBCA 5.483 bar sejak 2 Jan 2004, BUMI sejak 2003).

## Jebakan parameter (dari `docs/riset/stockbit-chartbit-ohlcv.md`)

`from`/`to` TERBALIK dari intuisi: `from` = tanggal TERBARU, `to` = tanggal
TERLAMA. Kirim dengan urutan wajar (from lama, to baru) dan server menjawab
200 dengan `chartbit: []` — tanpa galat, jebakan senyap. Di sini `from` selalu
"hari ini" dan `to` selalu `2000-01-01` supaya satu panggilan menjawab
seluruh riwayat, dari emiten manapun.

## Arsip mentah

Balasan JSON apa adanya ke `_arsip-mentah/ohlcv-stockbit/<KODE>/<tanggal-
panen>.json` (di luar git — lihat CLAUDE.md "jangan membuang berkas mentah
hasil panen"). Arsip hari ini yang sudah ada dipakai ulang kecuali `--paksa`.

Pakai:
    python scripts/panen_ohlcv_stockbit.py BBCA BUMI AADI
    python scripts/panen_ohlcv_stockbit.py --semua --jeda 0.4
    python scripts/panen_ohlcv_stockbit.py BBCA --paksa
    python scripts/panen_ohlcv_stockbit.py --swauji
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

DIR_JSON = AKAR / "data-idx" / "json"
DAFTAR = DIR_JSON / "daftar_emiten.json"
KELUARAN = DIR_JSON / "ohlcv_stockbit"
ARSIP = AKAR / "_arsip-mentah" / "ohlcv-stockbit"
# Catatan bar yang dikarantina — dibaca manusia, bukan mesin.
KARANTINA = DIR_JSON / "ohlcv_karantina.json"
WIB = timezone(timedelta(hours=7))

URL = "https://exodus.stockbit.com/chartbit/{kode}/price/daily"
# Lantai permintaan. JANGAN dinaikkan ke tanggal yang lebih muda: "2000-01-01"
# yang dipakai sampai 23 Agu 2026 memotong IHSG dari 7.050 bar jadi 6.426 —
# 624 bar hilang karena parameter kita sendiri, bukan karena Stockbit tak
# punya. Emiten tak terdampak (BBCA/ASII/UNTR jumlahnya sama di to=2000,
# 1990, dan 1980), tapi indeks jelas terdampak. Server berhenti sendiri di
# bar terlama yang dimilikinya, jadi lantai yang terlalu tua tidak merugikan.
TO_TERLAMA = "1980-01-01"

# Urutan sama dengan ruas yang didokumentasikan `stockbit-chartbit-ohlcv.md`
# (date · unixdate · open · high · low · close · volume · value · frequency ·
# foreignbuy · foreignsell · foreignflow · dividend · shareoutstanding ·
# soxclose · freq_analyzer · lot) — hanya `date` diganti nama `tanggal`.
KOLOM = ["tanggal", "unixdate", "open", "high", "low", "close", "volume", "value",
         "frequency", "foreignbuy", "foreignsell", "foreignflow", "dividend",
         "shareoutstanding", "soxclose", "freq_analyzer", "lot"]


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def tulis_ulet(p: Path, teks: str, coba: int = 5) -> None:
    """Sama seperti `panen_broker_harian.tulis_ulet` — Windows kadang menolak
    tulis sesaat (Errno 22/13) saat berkas dipegang proses lain."""
    for i in range(coba):
        try:
            p.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if i == coba - 1:
                raise
            time.sleep(0.5 * (i + 1))


# ── Normalisasi ─────────────────────────────────────────────────────────────
def urai(mentah: dict) -> list[list]:
    """Balasan chartbit -> baris KOLOM, terurut naik per tanggal, tanpa duplikat."""
    bar = (mentah or {}).get("data", {}).get("chartbit") or []
    per_tanggal = {b["date"]: [b.get(k if k != "tanggal" else "date") for k in KOLOM]
                   for b in bar if b and b.get("date")}
    baris = [per_tanggal[t] for t in sorted(per_tanggal)]
    # Bar hari berjalan: chartbit mengembalikannya sejak pra-pembukaan dengan
    # volume/value/frequency nol TAPI foreignbuy/sell/flow disalin dari bar
    # kemarin — angka basi yang terlihat nyata. Dibuang di sini, di penulis,
    # supaya tak pernah masuk arsip maupun terdorong CI.
    from bar_berisi import buang_bar_hari_berjalan
    return buang_bar_hari_berjalan(baris, i_volume=KOLOM.index("volume"))


def karantina_bar(baris: list[list]) -> tuple[list[list], list[dict]]:
    """Pisahkan bar yang mustahil dari deretnya. Balikan (bar sehat, bar dikarantina).

    Ketetapan Johan 1 Sep 2026: *"karantina satu bar RIGS saja"* — satu bar
    rusak tak boleh membuang SELURUH emiten. Versi lama menolak emiten begitu
    ketemu satu `high < low`, dan RIGS karena itu tak pernah terbit sama sekali:
    satu bar 2020-05-19 mengubur 1.500-an bar sehat.

    **Umum, bukan pengecualian ber-nama RIGS.** Bar cacat berikutnya akan
    datang dari emiten lain, dan pengecualian yang menyebut kode emiten di
    dalam kodenya akan membusuk tanpa ada yang tahu.

    Yang dikarantina DIKEMBALIKAN, tidak ditelan — pemanggil menulisnya ke
    catatan yang bisa dibaca manusia. Bar buang tanpa jejak berarti tiga bulan
    lagi tak seorang pun tahu deret ini pernah dipotong.

    Yang TIDAK dilakukan, dan itu disengaja: lubangnya tidak ditambal. Tanggal
    itu absen dari deret, bukan diisi interpolasi atau disalin dari tetangganya
    — menyambung dua sisi lubang membuat gerak harga yang tak pernah terjadi,
    dan itu lebih berbahaya daripada satu hari yang hilang.
    """
    ih, il = KOLOM.index("high"), KOLOM.index("low")
    sehat, buang = [], []
    for b in baris:
        if b[ih] is not None and b[il] is not None and b[ih] < b[il]:
            buang.append({"tanggal": b[0], "alasan": "high < low",
                          "high": b[ih], "low": b[il]})
            continue
        sehat.append(b)
    return sehat, buang


def verifikasi(baris: list[list]) -> str | None:
    """None kalau lolos; kalau tidak, alasan gagal (dicetak, emiten dilewati).

    Sejak 1 Sep 2026 ia TIDAK lagi memeriksa `high < low` — itu urusan
    `karantina_bar()`, yang membuang barnya saja alih-alih emitennya. Yang
    tersisa di sini cuma cacat yang memang membatalkan seluruh deret: kosong,
    atau tanggal yang tak terurut/berduplikat (tanda balasan sumber rusak,
    bukan satu hari yang aneh).
    """
    if not baris:
        return "nol bar"
    tanggal = [b[0] for b in baris]
    if tanggal != sorted(set(tanggal)):
        return "tanggal tak terurut naik atau ada duplikat"
    return None


# ── Jaringan ────────────────────────────────────────────────────────────────
def ambil(token: str, kode: str, hari_ini: str, percobaan: int = 4):
    """Ambil OHLCV penuh satu emiten.

    Galat jaringan (koneksi diputus sepihak, timeout) TIDAK boleh menghentikan
    seluruh panen — 23 Agu 2026 satu `RemoteDisconnected` di emiten ke-285
    mematikan jalan yang sudah berjalan 20 menit. Karena itu dicoba ulang
    dengan mundur-bertahap, dan kalau tetap gagal dikembalikan status 0 supaya
    pemanggil menghitungnya sebagai satu emiten gagal lalu lanjut.
    """
    import requests

    galat = ""
    for ke in range(1, percobaan + 1):
        try:
            r = requests.get(URL.format(kode=kode), headers={
                "Authorization": f"Bearer {token}", "Origin": "https://stockbit.com",
                "Referer": "https://stockbit.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }, params={"from": hari_ini, "to": TO_TERLAMA, "limit": 0}, timeout=60)
            return r.status_code, (r.json() if r.status_code == 200 else r.text[:200])
        except Exception as e:  # noqa: BLE001 — jaringan apa pun
            galat = f"{type(e).__name__}: {str(e)[:100]}"
            if ke < percobaan:
                time.sleep(min(30.0, 2 ** ke))
    return 0, f"jaringan gagal {percobaan}x — {galat}"


def daftar_kode(semua: bool, pilih: list[str]) -> list[str]:
    if semua:
        d = baca(DAFTAR) or {}
        return [e["kode"] for e in d.get("emiten") or [] if e.get("kode")]
    return [k.strip().upper() for k in pilih if k.strip()]


def jalankan(a) -> int:
    from stockbit_token import token_segar

    kode_semua = daftar_kode(a.semua, a.kode)
    if not kode_semua:
        raise SystemExit("Tak ada emiten — beri kode atau --semua.")
    hari_ini = datetime.now(WIB).strftime("%Y-%m-%d")
    token = token_segar()
    if len(kode_semua) > 1:
        print(f"Panen OHLCV Stockbit {hari_ini} — {len(kode_semua)} emiten, jeda {a.jeda}s")

    n_ok = n_lewat = n_gagal = 0
    # Bar yang dibuang karantina, dikumpulkan lalu ditulis ke berkas di akhir.
    # Dikumpulkan di memori (bukan ditulis per kejadian) supaya panen yang
    # dibatalkan di tengah tak meninggalkan catatan separuh yang terbaca
    # seolah lengkap.
    karantina_catat: list[dict] = []
    mulai = time.time()
    for i, kode in enumerate(kode_semua, 1):
        ark = ARSIP / kode / f"{hari_ini}.json"
        if ark.exists() and not a.paksa:
            mentah = baca(ark)
            n_lewat += 1
        else:
            st, isi = ambil(token, kode, hari_ini)
            if st == 401:
                token = token_segar(margin=10**9)
                st, isi = ambil(token, kode, hari_ini)
            if st == 429:
                print(f"  {kode}: 429 — jeda 30 detik")
                time.sleep(30)
                st, isi = ambil(token, kode, hari_ini)
            if st != 200:
                n_gagal += 1
                print(f"  {kode}: HTTP {st} {str(isi)[:80]}")
                time.sleep(a.jeda)
                continue
            mentah = isi
            ark.parent.mkdir(parents=True, exist_ok=True)
            tulis_ulet(ark, json.dumps(mentah, ensure_ascii=False))
            time.sleep(a.jeda)

        baris = urai(mentah)
        baris, dikarantina = karantina_bar(baris)
        if dikarantina:
            for b in dikarantina:
                karantina_catat.append({"kode": kode, **b})
            print(f"  {kode}: {len(dikarantina)} bar dikarantina "
                  f"({', '.join(b['tanggal'] for b in dikarantina)}) — sisanya tetap terbit")
        alasan = verifikasi(baris)
        if alasan:
            n_gagal += 1
            print(f"  {kode}: verifikasi gagal — {alasan}")
            continue

        out = KELUARAN / f"{kode}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        tulis_ulet(out, json.dumps({
            "kode": kode,
            "sumber": "Stockbit chartbit price/daily",
            "dipanen_pada": hari_ini,
            "kolom": KOLOM,
            "bar": baris,
        }, ensure_ascii=False, separators=(",", ":")))
        n_ok += 1
        if i % 100 == 0:
            print(f"  ...{i}/{len(kode_semua)} ({time.time()-mulai:.0f}s)")

    print(f"Selesai {time.time()-mulai:.0f}s: {n_ok} tersimpan ({n_lewat} dari arsip), {n_gagal} gagal")
    return 0 if n_ok else 1


def swauji() -> int:
    mentah = {"data": {"chartbit": [
        {"date": "2026-08-21", "unixdate": 1787245200, "open": 6400, "high": 6475, "low": 6400,
         "close": 6450, "volume": 100684300, "value": 648871165000, "frequency": 23357,
         "foreignbuy": 515049425000, "foreignsell": 245956022500, "foreignflow": -54740952267010,
         "dividend": 0, "shareoutstanding": 123275050000, "soxclose": 795124072500000,
         "freq_analyzer": 7.9, "lot": 1006843},
        {"date": "2026-08-20", "unixdate": 1787158800, "open": 6350, "high": 6400, "low": 6300,
         "close": 6400, "volume": 67749800, "value": 430960275000, "frequency": 16272,
         "foreignbuy": 285519160000, "foreignsell": 238860152500, "foreignflow": -55010045669510,
         "dividend": 0, "shareoutstanding": 123275050000, "soxclose": 788960320000000,
         "freq_analyzer": 15.7, "lot": 677498},
    ]}}
    baris = urai(mentah)
    assert [b[0] for b in baris] == ["2026-08-20", "2026-08-21"], "harus terurut naik"
    assert baris[0][KOLOM.index("close")] == 6400
    assert baris[1][KOLOM.index("lot")] == 1006843
    assert verifikasi(baris) is None

    assert verifikasi([]) == "nol bar"
    assert verifikasi([["2026-08-21"] + [0] * (len(KOLOM) - 1), ["2026-08-20"] + [0] * (len(KOLOM) - 1)]) is not None
    rusak = list(baris[0])
    idx_h, idx_l = KOLOM.index("high"), KOLOM.index("low")
    rusak[idx_h], rusak[idx_l] = 100, 200  # high < low
    # high < low TIDAK lagi membatalkan emiten — barnya saja yang dikarantina
    # (ketetapan Johan 1 Sep 2026, lihat karantina_bar).
    assert verifikasi([rusak]) is None
    sehat, buang = karantina_bar([rusak])
    assert sehat == [] and len(buang) == 1 and buang[0]["alasan"] == "high < low"
    # Bar sehat di sekitarnya TETAP terbit, dan lubangnya TIDAK ditambal.
    baik = ["2020-05-18"] + [1] * (len(KOLOM) - 1)
    sehat2, buang2 = karantina_bar([baik, rusak, baik[:]])
    assert len(sehat2) == 2 and len(buang2) == 1
    assert [b[0] for b in sehat2] == ["2020-05-18", "2020-05-18"]  # tanggal rusak absen

    dup = [baris[0], baris[0]]
    assert verifikasi(dup) is not None  # duplikat tanggal

    # Ruas kosong (mis. IPO tanpa dividend) tidak boleh menjatuhkan skrip.
    minim = {"data": {"chartbit": [{"date": "2026-08-21"}]}}
    baris2 = urai(minim)
    assert baris2[0][0] == "2026-08-21" and baris2[0][KOLOM.index("close")] is None
    assert verifikasi(baris2) is None

    print("8/8 lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen OHLCV harian penuh dari Stockbit chartbit")
    ap.add_argument("kode", nargs="*", help="kode emiten, mis. BBCA BUMI AADI")
    ap.add_argument("--semua", action="store_true", help="seluruh daftar_emiten.json")
    ap.add_argument("--jeda", type=float, default=0.4, help="detik antar permintaan")
    ap.add_argument("--paksa", action="store_true", help="abaikan arsip hari ini, tarik ulang")
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()
    return jalankan(a)


if __name__ == "__main__":
    raise SystemExit(main())
