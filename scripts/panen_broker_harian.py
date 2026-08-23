# -*- coding: utf-8 -*-
"""Panen Broker Summary GROSS per emiten, satu hari bursa, seluruh pasar.

Johan 22 Agu 2026: *"saya ingin membangun pondasi dulu terkait data broker
summary ini mengingat dengan adanya data autentik ini maka sistem kita
seharusnya bnyk yang dirombak total"*.

## Kenapa GROSS, reguler, per hari

Diukur 22 Agu 2026 (`docs/riset/`):

- Mode **GROSS** reguler menjumlah tepat 1,0000 ke `Volume` IDX di OHLC kita
  pada tiga hari berbeda — jadi ini SELURUH arus order per broker, dua sisi,
  bukan ringkasan top-N. NET bisa diturunkan dari GROSS; kebalikannya tidak.
- Rentang dari server **tidak aditif di atas ±2 tahun** (lima potongan setahun
  = 117,7 jt lot; rentang utuh = 84,2 jt) dan dipotong di 100 broker tanpa
  tanda. Maka yang disimpan adalah HARI, dan rentang dijumlahkan sendiri.
- Hari libur dijawab nol broker, bukan galat. Nol dari API cuma dipercaya
  kalau OHLC kita juga menyatakan tak ada volume hari itu.

## Dua lapis penyimpanan

1. `_arsip-mentah/broker-harian/<KODE>/<YYYY-MM-DD>.json` — balasan utuh, di
   luar git. Yang mahal itu MENGAMBIL; sekali tersimpan, ruas apa pun yang
   nanti dibutuhkan tak berbiaya jaringan. Berkas yang sudah ada dilewati
   (idempoten), jadi jalan ulang hanya menambal yang bolong.
2. `data-idx/json/broker_harian/<KODE>.json` — ringkas, JENDELA_HARI hari
   terakhir, larik padat per broker. Ukurannya dijaga: ±137 baris x 40 byte
   = ±5 KB/hari/emiten; 20 hari x 963 emiten ≈ 95 MB di repo. Memperlebar
   jendela = memperbesar repo secara linear — putuskan sadar, jangan geser
   angkanya diam-diam.

## Cek silang yang dicetak, bukan dipercaya

Tiap hari-emiten: `Σ beli_lot x 100` dibandingkan ke `Volume` OHLC tanggal
itu, rasionya disimpan sebagai `cocok_volume`. Kalau melenceng >1% dicetak
sebagai peringatan — itu tanda datanya belum lengkap di sisi Stockbit (panen
terlalu awal) atau OHLC kita yang bolong.

Pakai:
    python scripts/panen_broker_harian.py                   # tanggal = bar OHLC terakhir
    python scripts/panen_broker_harian.py --tanggal 2026-08-21
    python scripts/panen_broker_harian.py --hanya BUMI,DSSA --jeda 0.5
    python scripts/panen_broker_harian.py --uji             # swauji, nol jaringan
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
DIR_OHLC = DIR_JSON / "ohlc"
DAFTAR = DIR_JSON / "daftar_emiten.json"
KELUARAN = DIR_JSON / "broker_harian"
ARSIP = AKAR / "_arsip-mentah" / "broker-harian"
WIB = timezone(timedelta(hours=7))

URL = "https://exodus.stockbit.com/marketdetectors/{kode}"
# Varian panen per hari. `reguler` = dasar (semua investor, pasar reguler) dan
# satu-satunya yang masuk cek silang volume. `asing` & `nego` diminta Johan
# 22 Agu 2026 ("panen juga asing dan nego") sesudah layar Stockbit membuktikan
# pecahannya konsisten. Domestik TIDAK dipanen — itu reguler dikurangi asing.
#
# 23 Agu 2026 — Johan: "ayolah ambil semua data itu". Diperluas jadi 12 varian:
# 3 papan x {ALL, FOREIGN} x {GROSS, NET}. Yang SENGAJA tidak dipanen:
#   * DOMESTIC — terukur = ALL - FOREIGN, cocok persis (BUMI 21 Agu: beli
#     997.576.688.400 dan jual 48.185.368 dua-duanya sama). Diturunkan gratis.
#   * TUNAI ternyata TIDAK selalu kosong (3 dari 12 sampel ada isi: BUMI 15 Jul
#     2 broker, TPIA 21 Agu 3 broker) — karena itu ikut dipanen, bukan dilewat.
# NET dipanen TERPISAH karena definisinya belum terpecahkan: dua percobaan
# menurunkannya dari GROSS gagal untuk mayoritas broker (BUMI 9/80 cocok,
# BBCA 19/69, TPIA 19/74) walau sebagian cocok persis. Aman dipanen, bukan
# terbukti mustahil diturunkan.
VARIAN = {
    "reguler":      ("MARKET_BOARD_REGULER", "INVESTOR_TYPE_ALL",     "TRANSACTION_TYPE_GROSS"),
    "asing":        ("MARKET_BOARD_REGULER", "INVESTOR_TYPE_FOREIGN", "TRANSACTION_TYPE_GROSS"),
    "nego":         ("MARKET_BOARD_NEGO",    "INVESTOR_TYPE_ALL",     "TRANSACTION_TYPE_GROSS"),
    "nego-asing":   ("MARKET_BOARD_NEGO",    "INVESTOR_TYPE_FOREIGN", "TRANSACTION_TYPE_GROSS"),
    "tunai":        ("MARKET_BOARD_TUNAI",   "INVESTOR_TYPE_ALL",     "TRANSACTION_TYPE_GROSS"),
    "tunai-asing":  ("MARKET_BOARD_TUNAI",   "INVESTOR_TYPE_FOREIGN", "TRANSACTION_TYPE_GROSS"),
    "net":          ("MARKET_BOARD_REGULER", "INVESTOR_TYPE_ALL",     "TRANSACTION_TYPE_NET"),
    "net-asing":    ("MARKET_BOARD_REGULER", "INVESTOR_TYPE_FOREIGN", "TRANSACTION_TYPE_NET"),
    "net-nego":     ("MARKET_BOARD_NEGO",    "INVESTOR_TYPE_ALL",     "TRANSACTION_TYPE_NET"),
    "net-nego-asing": ("MARKET_BOARD_NEGO",  "INVESTOR_TYPE_FOREIGN", "TRANSACTION_TYPE_NET"),
    "net-tunai":    ("MARKET_BOARD_TUNAI",   "INVESTOR_TYPE_ALL",     "TRANSACTION_TYPE_NET"),
    "net-tunai-asing": ("MARKET_BOARD_TUNAI","INVESTOR_TYPE_FOREIGN", "TRANSACTION_TYPE_NET"),
}


def nama_arsip(tanggal: str, varian: str) -> str:
    """reguler tetap `<tgl>.json` (kompatibel 2.318 berkas BUMI yang sudah ada)."""
    return f"{tanggal}.json" if varian == "reguler" else f"{tanggal}.{varian}.json"
JENDELA_HARI = 20
# Tanpa kolom avg: terukur 22 Agu 2026 atas 26.172 baris, avg Stockbit = nilai ÷
# (lot × 100) dengan selisih maks 0,3% (pembulatan ke rupiah bulat). Diturunkan
# di pembaca lebih teliti DAN memangkas berkas 38%. Mentah di arsip tetap utuh.
# `avg` per broker (netbs_buy_avg_price / netbs_sell_avg_price) TIDAK disimpan
# — bisa diturunkan, dan itu sekarang TERUKUR, bukan diasumsikan:
#
#     avg = nilai / (lot * 100)
#
# Diuji 23 Agu 2026 atas 120 hari BUMI: 8.384 baris beli dan 7.995 baris jual,
# median rasio hitung-ulang/tersimpan tepat 1,000000 dengan p1 dan p99 juga
# 1,0000 — cocok 100,00%, dan nol baris ber-lot nol yang membuat pembagian tak
# terdefinisi.
#
# JEBAKANNYA `* 100`: lot harus dikonversi ke lembar dulu. Yang memakai
# `nilai / lot` mentah meleset tepat 100x — dan 100x itu besaran yang mudah
# disangka "satuan lain" alih-alih dikenali sebagai salah rumus.
#
# Catatan proses: penghapusan ruas ini dilakukan LEBIH DULU dan baru diuji
# sesudah Johan bertanya "sudah di uji dulu? sebelum dibuang?". Urutan yang
# benar kebalikannya (aturan proyek: ukur definisinya dulu sebelum menurunkan
# satu ruas dari ruas lain). Hasilnya kebetulan membenarkan keputusannya.
KOLOM = ["broker", "beli_lot", "beli_nilai", "jual_lot", "jual_nilai"]
TOLERANSI_VOLUME = 0.01


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def _angka(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip())
    except ValueError:
        return 0.0


# ── Normalisasi ─────────────────────────────────────────────────────────────
def padatkan(mentah: dict) -> tuple[list[list], dict]:
    """Balasan GROSS -> (baris padat per broker, ringkasan bandar_detector).

    Mode GROSS menaruh satu broker di KEDUA daftar (beli dan jual) dengan ruas
    masing-masing; keduanya digabung per kode jadi satu baris tujuh kolom.
    Tanda negatif sisi jual dibuang — besaran disimpan, arah sudah jelas dari
    kolomnya.
    """
    data = (mentah or {}).get("data") or {}
    bs = data.get("broker_summary") or {}
    per: dict[str, list] = {}

    def baris(kode: str) -> list:
        return per.setdefault(kode, [kode, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])

    for b in bs.get("brokers_buy") or []:
        kode = (b.get("netbs_broker_code") or "").strip().upper()
        if kode:
            r = baris(kode)
            r[1] += _angka(b.get("blot"))
            r[2] += _angka(b.get("bval"))
            r[3] = r[3] or _angka(b.get("netbs_buy_avg_price"))
    for b in bs.get("brokers_sell") or []:
        kode = (b.get("netbs_broker_code") or "").strip().upper()
        if kode:
            r = baris(kode)
            r[4] += abs(_angka(b.get("slot")))
            r[5] += abs(_angka(b.get("sval")))
            r[6] = r[6] or _angka(b.get("netbs_sell_avg_price"))

    urut = sorted(per.values(), key=lambda r: (r[2] - r[5]), reverse=True)
    bd = data.get("bandar_detector") or {}
    ringkas = {
        "n_beli": len(bs.get("brokers_buy") or []),
        "n_jual": len(bs.get("brokers_sell") or []),
        "total_lot": round(sum(r[1] for r in urut)),
        "total_nilai": round(sum(r[2] for r in urut)),
        "avg": bd.get("average"),
        "top1_pct": (bd.get("top1") or {}).get("percent"),
        "top3_pct": (bd.get("top3") or {}).get("percent"),
        "top5_pct": (bd.get("top5") or {}).get("percent"),
        "accdist": bd.get("broker_accdist"),
    }
    return urut, ringkas


def cocok_volume(total_lot: float, volume_idx) -> float | None:
    """Σ beli_lot x 100 dibagi Volume IDX; None kalau OHLC tak punya volume."""
    if not volume_idx:
        return None
    return round(total_lot * 100 / volume_idx, 4)


def padat_baris(baris: list[list]) -> list[list]:
    return [[r[0], round(r[1]), round(r[2]), round(r[4]), round(r[5])] for r in baris]


def perbarui_ringkas(lama: dict | None, kode: str, tanggal: str, baris: list[list],
                     ringkas: dict, jendela: int = JENDELA_HARI, varian: str = "reguler") -> dict:
    """Sisipkan satu hari (satu varian) ke berkas ringkas per emiten, potong ke `jendela`.

    `reguler` mengisi `ringkas`/`broker` di akar hari itu (bentuk lama); varian
    lain bersarang di bawah namanya — `hari[tgl]["asing"]`, `hari[tgl]["nego"]`.
    """
    d = lama if isinstance(lama, dict) and lama.get("kode") == kode else {}
    hari = dict(d.get("hari") or {})
    isi = {"ringkas": ringkas, "broker": padat_baris(baris)}
    if varian == "reguler":
        hari[tanggal] = {**(hari.get(tanggal) or {}), **isi}
    else:
        hari[tanggal] = {**(hari.get(tanggal) or {}), varian: isi}
    tgl = sorted(hari)[-jendela:]
    return {
        "kode": kode,
        "jendela_hari": jendela,
        "kolom": KOLOM,
        "sumber": "Stockbit marketdetectors — GROSS, reguler, semua investor",
        "diperbarui": datetime.now(WIB).isoformat(timespec="seconds"),
        "hari": {t: hari[t] for t in tgl},
    }


# ── Jaringan ────────────────────────────────────────────────────────────────
def ambil(token: str, kode: str, tanggal: str, pasar: str = "MARKET_BOARD_REGULER",
          investor: str = "INVESTOR_TYPE_ALL",
          transaksi: str = "TRANSACTION_TYPE_GROSS"):
    import requests

    r = requests.get(URL.format(kode=kode), headers={
        "Authorization": f"Bearer {token}", "Origin": "https://stockbit.com",
        "Referer": "https://stockbit.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }, params={
        "from": tanggal, "to": tanggal,
        "transaction_type": transaksi,
        "market_board": pasar,
        "investor_type": investor,
        "limit": 100,
    }, timeout=60)
    return r.status_code, (r.json() if r.status_code == 200 else r.text[:200])


def tulis_ulet(p: Path, teks: str, coba: int = 5) -> None:
    """Tulis berkas dengan coba ulang — Windows kadang menolak sesaat (Errno 22/13)
    saat berkas yang sama sedang dibaca/ditulis proses lain (pemindai, sinkron,
    atau panen lain yang menyentuh emiten yang sama). 22 Agu 2026 satu penolakan
    sesaat pada `broker_harian/BUMI.json` mematikan backfill 40 menit di hari
    ke-1.900 dari 2.352. Pola sama dengan `_tulis_ulet` di panen_ohlc.py."""
    for i in range(coba):
        try:
            p.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if i == coba - 1:
                raise
            time.sleep(0.5 * (i + 1))


def tanggal_bawaan() -> str:
    """Bar OHLC terakhir BBCA — hari bursa terakhir yang sudah kita punya."""
    d = baca(DIR_OHLC / "BBCA.json") or {}
    bar = [b for b in d.get("d", []) if b]
    if not bar:
        raise SystemExit("OHLC BBCA kosong — jalankan panen_ohlc.py dulu.")
    return bar[-1][0]


def volume_idx(kode: str, tanggal: str):
    d = baca(DIR_OHLC / f"{kode}.json") or {}
    for b in d.get("d", []):
        if b and b[0] == tanggal:
            return b[5]
    return None


def jalankan(a) -> int:
    from stockbit_token import token_segar

    tanggal = a.tanggal or tanggal_bawaan()
    daftar = (baca(DAFTAR) or {}).get("emiten") or []
    kode_semua = [e["kode"] for e in daftar if e.get("kode")]
    if a.hanya:
        pilih = {k.strip().upper() for k in a.hanya.split(",") if k.strip()}
        kode_semua = [k for k in kode_semua if k in pilih] or sorted(pilih)
    if a.batas:
        kode_semua = kode_semua[: a.batas]

    token = token_segar()
    if len(kode_semua) > 1:
        print(f"Panen broker GROSS {tanggal} — {len(kode_semua)} emiten, jeda {a.jeda}s")
    n_ok = n_lewat = n_kosong = n_gagal = n_meleset = 0
    mulai = time.time()

    varian_semua = [v.strip() for v in (getattr(a, "varian", None) or "reguler").split(",") if v.strip()]
    for v in varian_semua:
        if v not in VARIAN:
            raise SystemExit(f"varian tak dikenal: {v} (pilihan: {', '.join(VARIAN)})")

    for i, kode in enumerate(kode_semua, 1):
      for varian in varian_semua:
        pasar, investor, transaksi = VARIAN[varian]
        ark = ARSIP / kode / nama_arsip(tanggal, varian)
        if ark.exists() and not a.ulang:
            n_lewat += 1
            mentah = baca(ark)
        else:
            st, isi = ambil(token, kode, tanggal, pasar, investor, transaksi)
            if st == 401:
                token = token_segar(margin=10**9)  # paksa refresh
                st, isi = ambil(token, kode, tanggal, pasar, investor, transaksi)
            if st == 429:
                print(f"  {kode}: 429 — jeda 30 detik")
                time.sleep(30)
                st, isi = ambil(token, kode, tanggal, pasar, investor, transaksi)
            if st != 200:
                n_gagal += 1
                print(f"  {kode} {varian}: HTTP {st} {str(isi)[:80]}")
                time.sleep(a.jeda)
                continue
            mentah = isi
            dijawab = (mentah.get("data") or {}).get("from")
            if dijawab and dijawab != tanggal:
                n_gagal += 1
                print(f"  {kode}: server menjawab {dijawab}, diminta {tanggal} — dibuang")
                time.sleep(a.jeda)
                continue
            time.sleep(a.jeda)

        baris, ringkas = padatkan(mentah)
        vol = volume_idx(kode, tanggal)
        if not baris:
            # Reguler nol hanya sah kalau IDX juga nol. Asing/nego nol itu WAJAR
            # (hari tanpa transaksi asing atau tanpa nego) — tetap diarsipkan
            # supaya tak diminta ulang tiap jalan.
            if varian == "reguler":
                n_kosong += 1
                if vol:
                    print(f"  {kode}: API nol broker padahal IDX volume {vol:,} — belum siap, tak disimpan")
                continue
            if not ark.exists():
                ark.parent.mkdir(parents=True, exist_ok=True)
                tulis_ulet(ark, json.dumps(mentah, ensure_ascii=False))
            out = KELUARAN / f"{kode}.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            tulis_ulet(out, json.dumps(perbarui_ringkas(baca(out), kode, tanggal, [], ringkas, varian=varian),
                                       ensure_ascii=False, separators=(",", ":")))
            continue

        if not ark.exists() or a.ulang:
            ark.parent.mkdir(parents=True, exist_ok=True)
            tulis_ulet(ark, json.dumps(mentah, ensure_ascii=False))

        if varian == "reguler":
            ringkas["cocok_volume"] = cocok_volume(ringkas["total_lot"], vol)
            if ringkas["cocok_volume"] is not None and abs(ringkas["cocok_volume"] - 1) > TOLERANSI_VOLUME:
                n_meleset += 1
                print(f"  {kode}: Σlot x100 = {ringkas['total_lot']*100:,} vs IDX {vol:,} "
                      f"(rasio {ringkas['cocok_volume']})")

        out = KELUARAN / f"{kode}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        tulis_ulet(out, json.dumps(perbarui_ringkas(baca(out), kode, tanggal, baris, ringkas, varian=varian),
                                   ensure_ascii=False, separators=(",", ":")))
        n_ok += 1
      if i % 100 == 0:
            print(f"  ...{i}/{len(kode_semua)} ({time.time()-mulai:.0f}s)")

    print(f"Selesai {time.time()-mulai:.0f}s: {n_ok} tersimpan ({n_lewat} dari arsip), "
          f"{n_kosong} kosong, {n_gagal} gagal, {n_meleset} volume meleset >{TOLERANSI_VOLUME:.0%}")
    return 0 if n_ok else 1


def swauji() -> int:
    mentah = {"data": {
        "from": "2026-08-21", "to": "2026-08-21",
        "broker_summary": {
            "brokers_buy": [
                {"netbs_broker_code": "AK", "blot": 450276, "bval": 47472579000, "netbs_buy_avg_price": 1053},
                {"netbs_broker_code": "OD", "blot": 1000, "bval": 1053000, "netbs_buy_avg_price": 1053},
            ],
            "brokers_sell": [
                {"netbs_broker_code": "OD", "slot": -429953, "sval": -45226967500, "netbs_sell_avg_price": 1053},
                {"netbs_broker_code": "AK", "slot": -10, "sval": -10530, "netbs_sell_avg_price": 1053},
            ],
        },
        "bandar_detector": {"average": 1055.17, "broker_accdist": "Acc",
                            "top1": {"percent": 1.06}, "top3": {"percent": -4.69}, "top5": {"percent": 0.28}},
    }}
    baris, ringkas = padatkan(mentah)
    assert [r[0] for r in baris] == ["AK", "OD"], baris
    ak = baris[0]
    assert ak[1] == 450276 and ak[4] == 10 and ak[5] == 10530, ak
    od = baris[1]
    assert od[4] == 429953 and od[5] == 45226967500 and od[1] == 1000, "dua sisi harus digabung"
    assert ringkas["n_beli"] == 2 and ringkas["accdist"] == "Acc" and ringkas["top3_pct"] == -4.69
    assert ringkas["total_lot"] == 451276

    assert cocok_volume(6093831, 609383100) == 1.0
    assert cocok_volume(100, None) is None

    r1 = perbarui_ringkas(None, "DSSA", "2026-08-21", baris, ringkas, jendela=2)
    r2 = perbarui_ringkas(r1, "DSSA", "2026-08-22", baris, ringkas, jendela=2)
    r3 = perbarui_ringkas(r2, "DSSA", "2026-08-23", baris, ringkas, jendela=2)
    assert list(r3["hari"]) == ["2026-08-22", "2026-08-23"], "jendela tak memotong yang tertua"
    assert r3["kolom"] == KOLOM and r3["hari"]["2026-08-23"]["broker"][0][0] == "AK"
    # Varian asing/nego bersarang di bawah hari yang sama, reguler tetap di akar.
    r5 = perbarui_ringkas(r3, "DSSA", "2026-08-23", baris, ringkas, jendela=2, varian="asing")
    assert r5["hari"]["2026-08-23"]["broker"][0][0] == "AK", "reguler ikut hilang saat varian masuk"
    assert r5["hari"]["2026-08-23"]["asing"]["broker"][0][0] == "AK"
    r6 = perbarui_ringkas(None, "X", "2026-01-02", baris, ringkas, varian="nego")
    assert "broker" not in r6["hari"]["2026-01-02"] and "nego" in r6["hari"]["2026-01-02"]
    assert nama_arsip("2026-01-02", "reguler") == "2026-01-02.json" and nama_arsip("2026-01-02", "nego") == "2026-01-02.nego.json"
    # Berkas milik emiten lain tak boleh ditimpa-gabung.
    r4 = perbarui_ringkas(r3, "BUMI", "2026-08-23", baris, ringkas, jendela=2)
    assert list(r4["hari"]) == ["2026-08-23"] and r4["kode"] == "BUMI"

    print("12/12 lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen broker summary GROSS per emiten per hari")
    ap.add_argument("--tanggal", help="YYYY-MM-DD (bawaan: bar OHLC terakhir)")
    ap.add_argument("--hanya", help="kode dipisah koma")
    ap.add_argument("--batas", type=int, help="maksimum emiten (untuk uji)")
    ap.add_argument("--jeda", type=float, default=1.0, help="detik antar permintaan")
    ap.add_argument("--ulang", action="store_true", help="ambil ulang walau arsip ada")
    ap.add_argument("--varian", default="reguler", help="dipisah koma: reguler,asing,nego (bawaan reguler)")
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        return swauji()
    return jalankan(a)


if __name__ == "__main__":
    raise SystemExit(main())
