# -*- coding: utf-8 -*-
"""Panen candle HARIAN IHSG (^JKSE) — #108.

Sebelum ini `ihsg_harian.json` cuma menyimpan PENUTUPAN, jadi lilin IHSG di
mana pun terpaksa digambar sebagai aproksimasi (buka = tutup kemarin). Skrip
ini menarik OHLCV penuh dan menulis dua berkas:

* `data-idx/json/ohlc/IHSG.json` — bentuknya SAMA PERSIS dengan berkas emiten
  keluaran `panen_ohlc.py`, jadi chart bisa memperlakukan IHSG seperti emiten
  biasa tanpa cabang khusus.
* `data-idx/json/ihsg_harian.json` — kunci `tutup` DIPERTAHANKAN apa adanya
  (SeasonalityHarian.tsx membacanya), ditambah kunci `buka`. Menghapus `tutup`
  demi bentuk yang lebih rapi akan mematikan halaman yang sudah jalan.

Mesin permintaannya (User-Agent, jeda, backoff yang menghormati Retry-After)
dipinjam dari `panen_ohlc.py` — bukan disalin. Satu-satunya beda: simbolnya
`%5EJKSE`, bukan `<KODE>.JK`.

RANGE=MAX TERLARANG
-------------------
`range=max` diam-diam menurunkan resolusi jadi BULANAN walau `interval=1d`
(ketahuan pada ^JKSE: 437 titik untuk 36 tahun). Riwayat penuh karena itu
ditarik per POTONGAN 5 TAHUN dengan period1/period2.

CADANGAN INDEX.JSON (B28)
-------------------------
Statistik harian IDX (`ds_*.json`, dari PDF resmi bursa lewat
`download_idx.py` + `parse_idx_pdf.py`) kadang gagal total — IDX menolak IP
runner GitHub, bukan cuma lambat. Begitu itu terjadi, Kalender Bursa
menampilkan "Tanpa data" sampai ada yang memanen manual dari IP rumahan.

`isi_cadangan_index()` menambal `index.json` (dan menulis `ds_<stem>.json`
minimal) dari penutupan ^JKSE Yahoo untuk hari bursa yang IDX-nya belum ada —
CADANGAN, bukan pengganti: dilewati kalau `ds_<stem>.json` ASLI sudah ada,
dan dibatasi jendela `hari_window` hari terakhir (proyek ini sengaja TIDAK
punya arsip PDF sebelum awal index.json — tanpa batas ini skrip akan
"menambal" ribuan hari yang memang tak pernah dipanen, terukur 8707).
Entri cadangan diberi `sumber: "yahoo"`; begitu PDF asli berhasil diparse,
`update_index()` menimpa entri yang sama (kunci `stem`) tanpa ruas itu —
tanda cadangan hilang sendiri, tak perlu dibersihkan manual.

Diverifikasi 20 Agu 2026 dari 144 hari yang tersedia dua-duanya (IDX & Yahoo):
142 cocok, 2 belum masuk cache Yahoo lokal saat itu. Selisih terbesar 0.005
poin (galat pembulatan Yahoo, bukan beda sumber) — median 0.00003%.

Cara pakai:
  python scripts/panen_ihsg.py --penuh     # riwayat 1990-sekarang (sekali)
  python scripts/panen_ihsg.py             # harian: tambah hari baru + tambal index.json
  python scripts/panen_ihsg.py --swauji    # uji gabung & cadangan, tanpa jaringan
"""
import argparse
import json
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from panen_ohlc import JEDA, Ditolak, ambil, ke_baris
from gabung_ohlc_stockbit import padatkan_rentang

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
OHLC = AKAR / "data-idx" / "json" / "ohlc" / "IHSG.json"
HARIAN = AKAR / "data-idx" / "json" / "ihsg_harian.json"
# Potongan ringkas untuk halaman depan: lilin hari ini cuma butuh SATU harga
# buka, dan memaksa pengunjung mengunduh 36 tahun riwayat (354 KB) demi satu
# angka itu tak sebanding. 250 hari bursa ≈ satu tahun, ±15 KB.
RINGKAS = AKAR / "data-idx" / "json" / "ihsg_ohlc_ringkas.json"
HARI_RINGKAS = 250
SIMBOL = "%5EJKSE"

# Yahoo melaporkan volume INDEKS dalam lot; bursa dan sumber harga memakai
# lembar. Rasionya terukur tepat 100,00 (lihat jahit_ihsg).
LOT_KE_LEMBAR = 100
MULAI = datetime(1990, 1, 1, tzinfo=timezone.utc)


def gabung(lama: list[list], baru: list[list]) -> list[list]:
    """Gabung menurut tanggal — hari yang sudah ada DITIMPA, bukan ditambahkan.
    Panen dua kali di hari yang sama tidak boleh menggandakan barisnya."""
    peta = {b[0]: b for b in lama}
    for b in baru:
        peta[b[0]] = b
    return [peta[k] for k in sorted(peta)]


def tarik_penuh() -> list[list]:
    """Potongan 5 tahun berturut-turut sampai hari ini."""
    baris: list[list] = []
    awal = MULAI
    kini = datetime.now(timezone.utc)
    while awal < kini:
        akhir = min(awal + timedelta(days=365 * 5 + 2), kini)
        print(f"  {awal:%Y-%m-%d} … {akhir:%Y-%m-%d}")
        potong = ke_baris(ambil(SIMBOL, int(awal.timestamp()), int(akhir.timestamp()), None))
        print(f"    {len(potong)} hari")
        baris = gabung(baris, potong)
        awal = akhir
        time.sleep(random.uniform(*JEDA))
    return baris


def _kode_lama(tgl: str, rentang: list[list] | None) -> str | None:
    """Kode sumber sebuah tanggal menurut penanda LAMA, atau None."""
    for dari, sampai, kode in (rentang or []):
        if dari <= tgl <= sampai:
            return kode
    return None


def tulis(baris: list[list], sumber_lama: list[list] | None = None,
          tanggal_ditulis: set[str] | None = None) -> None:
    OHLC.parent.mkdir(parents=True, exist_ok=True)
    # Penanda sumber per bar. Skrip ini memanen SATU penyedia saja, jadi seluruh
    # bar yang ditulisnya memang berasal dari penyedia itu — dan ia menyatakannya,
    # bukan diam.
    #
    # Kenapa dinyatakan dan bukan dibiarkan kosong (terukur 5 Sep 2026): berkas
    # ini punya DUA penulis di dua rantai yang tak bisa diurutkan satu sama lain —
    # penjahit IHSG dijalankan panen lokal, pemanen ini dijalankan CI di awan.
    # Hari itu CI menulis terakhir; karena blok tulis ini membangun berkas dari
    # nol dengan lima ruas saja, penanda hasil penjahitan (26 blok, 1.811 bar
    # cadangan) TERHAPUS tanpa satu pun galat, dan halaman kehilangan keterangan
    # sumbernya diam-diam.
    #
    # Membiarkan penanda lama bertahan justru LEBIH buruk: bar-barnya baru saja
    # ditimpa penyedia ini, jadi penanda lama akan mengklaim asal yang salah
    # dengan percaya diri. Yang benar: tiap penulis menyatakan kebenaran tentang
    # apa yang IA tulis. Penjahit akan memperhalusnya lagi saat ia jalan.
    def _kode(tgl: str) -> str:
        if tanggal_ditulis is not None and tgl in tanggal_ditulis:
            return "yh"
        return _kode_lama(tgl, sumber_lama) or "yh"

    OHLC.write_text(json.dumps({
        "kode": "IHSG", "mulai": baris[0][0], "akhir": baris[-1][0], "n": len(baris), "d": baris,
        "sumber_bar": padatkan_rentang(baris, _kode),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    HARIAN.write_text(json.dumps({
        "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sumber": "Yahoo Finance ^JKSE, OHLCV harian",
        "catatan": "Diminta per potongan 5 tahun: range=max menurunkan resolusi jadi bulanan walau interval=1d.",
        "mulai": baris[0][0], "akhir": baris[-1][0], "n": len(baris),
        "tutup": {b[0]: b[4] for b in baris},
        "buka": {b[0]: b[1] for b in baris},
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    ekor = baris[-HARI_RINGKAS:]
    RINGKAS.write_text(json.dumps({
        "kode": "IHSG", "mulai": ekor[0][0], "akhir": ekor[-1][0], "n": len(ekor), "d": ekor,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"\n{len(baris)} hari · {baris[0][0]} … {baris[-1][0]}")
    print(f"  {OHLC.name} {OHLC.stat().st_size/1024:.0f} KB · {HARIAN.name} {HARIAN.stat().st_size/1024:.0f} KB"
          f" · {RINGKAS.name} {RINGKAS.stat().st_size/1024:.0f} KB")


DOW_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MON_EN = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


def isi_cadangan_index(baris: list[list], hari_window: int = 14, kini: datetime | None = None) -> int:
    """Tambal index.json + tulis ds_<stem>.json minimal untuk hari bursa yang
    IDX-nya gagal tapi Yahoo punya. Lihat penjelasan panjang di docstring
    modul. Mengembalikan jumlah hari yang ditambal."""
    from parse_idx_pdf import HARI_ID, BULAN_ID, save_json, update_index

    idx_file = AKAR / "data-idx" / "json" / "index.json"
    idx = json.loads(idx_file.read_text(encoding="utf-8")) if idx_file.exists() else {"dates": []}
    ada = {d["date_iso"] for d in idx["dates"]}
    maks_hari = max((d.get("trading_day", 0) for d in idx["dates"]), default=0)

    kini = kini or datetime.now(timezone.utc)
    batas = (kini - timedelta(days=hari_window)).strftime("%Y-%m-%d")
    hari_ini = kini.strftime("%Y-%m-%d")
    peta = {b[0]: b for b in baris}
    urut = sorted(peta)

    ditambal = 0
    for i, tgl in enumerate(urut):
        if tgl < batas or tgl > hari_ini or tgl in ada:
            continue
        stem = f"ds_{tgl[2:4]}{tgl[5:7]}{tgl[8:10]}"
        if (AKAR / "data-idx" / "json" / f"{stem}.json").exists():
            continue  # berkas IDX asli sudah ada (mis. dipanen manual) — jangan ditimpa
        _o, h, l, c, _v = peta[tgl][1:]
        sebelum = peta[urut[i - 1]][4] if i > 0 else c
        d = datetime.strptime(tgl, "%Y-%m-%d")
        dow_en, mon_en = DOW_EN[d.weekday()], MON_EN[d.month - 1]
        data = {
            "date_raw": f"{dow_en}, {d.day} {mon_en} {d.year}",
            "date_id": f"{HARI_ID[dow_en]}, {d.day} {BULAN_ID[mon_en]} {d.year}",
            "date_iso": tgl,
            "trading_day": maks_hari + 1,
            "ihsg_value": round(c, 3),
            "ihsg_change": round(c - sebelum, 3),
            "ihsg_pct": round((c - sebelum) / sebelum * 100, 2) if sebelum else 0.0,
            "ihsg_prev": round(sebelum, 3),
            "ihsg_high": round(h, 3),
            "ihsg_low": round(l, 3),
            "sumber": "yahoo",
            # Hari BERJALAN ditandai terpisah, dan bedanya terukur.
            #
            # Kecocokan Yahoo terhadap IDX diukur atas 144 hari: 142 cocok,
            # selisih terbesar 0,005 poin. Tapi seluruhnya hari LAMPAU, yang
            # penutupannya sudah final. Untuk hari berjalan Yahoo memberi
            # nilai TERAKHIR SAAT DIBACA — kalau bursa masih buka, itu bukan
            # penutupan.
            #
            # Terukur 20 Agu 2026: cadangan menulis 6.498,60 (+1,63%) sore
            # hari; PDF resmi IDX yang terbit kemudian menyebut 6.501,585
            # (+1,68%). Meleset 2,985 poin — kecil, tapi bukan nol, dan tanpa
            # penanda ini ia terbaca sama pastinya dengan angka resmi bursa.
            "sementara": tgl == hari_ini,
        }
        save_json(data, stem)
        update_index(stem, data)  # tak tahu ruas `sumber` — ditambal manual di bawah
        idx2 = json.loads(idx_file.read_text(encoding="utf-8"))
        for e in idx2["dates"]:
            if e["stem"] == stem:
                e["sumber"] = "yahoo"
        idx_file.write_text(json.dumps(idx2, ensure_ascii=False, indent=2), encoding="utf-8")
        maks_hari += 1
        ada.add(tgl)
        ditambal += 1
        print(f"  cadangan Yahoo: {stem} ({tgl}) ihsg={c}")
    return ditambal


def swauji() -> None:
    a = [["2026-08-13", 1, 2, 0, 1, 10], ["2026-08-14", 2, 3, 1, 2, 20]]
    b = [["2026-08-14", 9, 9, 9, 9, 99], ["2026-08-17", 3, 4, 2, 3, 30]]
    g = gabung(a, b)
    assert [x[0] for x in g] == ["2026-08-13", "2026-08-14", "2026-08-17"], g
    assert g[1][4] == 9, "hari yang sama harus DITIMPA nilai baru"
    assert len(g) == 3, "penggabungan tidak boleh menggandakan baris"

    # isi_cadangan_index: pakai index.json & folder data-idx/json ASLI (baca
    # saja + tulis ke stem palsu yang dibersihkan lagi) supaya swauji tetap
    # tanpa jaringan tapi menguji jalur nyata (save_json/update_index asli).
    kini = datetime(2099, 1, 8, tzinfo=timezone.utc)  # Kamis rekaan, jauh dari data asli
    stem = "ds_990107"
    ds_path = AKAR / "data-idx" / "json" / f"{stem}.json"
    idx_file = AKAR / "data-idx" / "json" / "index.json"
    idx_sebelum = idx_file.read_text(encoding="utf-8")
    assert not ds_path.exists(), f"{ds_path} sudah ada — swauji butuh stem yang bersih"
    try:
        palsu = [["2099-01-06", 100, 101, 99, 100, 1], ["2099-01-07", 101, 102, 100, 101.5, 1]]
        n = isi_cadangan_index(palsu, hari_window=1, kini=kini)
        assert n == 1, f"window=1 hari harus menambal cuma 01-07, dapat {n}"
        assert ds_path.exists(), "ds_<stem>.json cadangan harus ditulis"
        tulisan = json.loads(ds_path.read_text(encoding="utf-8"))
        assert tulisan["sumber"] == "yahoo"
        assert tulisan["ihsg_value"] == 101.5
        idx = json.loads(idx_file.read_text(encoding="utf-8"))
        entri = next(e for e in idx["dates"] if e["stem"] == stem)
        assert entri["sumber"] == "yahoo", "index.json juga harus ditandai"
        # jalan kedua: berkas ASLI sudah ada → tak boleh ditimpa, hitungannya 0
        n2 = isi_cadangan_index(palsu, hari_window=1, kini=kini)
        assert n2 == 0, "berkas cadangan yang sudah ada tak boleh ditambal ulang"
    finally:
        ds_path.unlink(missing_ok=True)
        idx_file.write_text(idx_sebelum, encoding="utf-8")  # kembalikan index.json persis semula
    print("swauji lolos")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--penuh", action="store_true", help="tarik riwayat 1990-sekarang")
    ap.add_argument("--swauji", action="store_true", help="uji gabung saja, tanpa jaringan")
    arg = ap.parse_args()
    if arg.swauji:
        swauji()
        return

    lama = json.loads(OHLC.read_text(encoding="utf-8"))["d"] if OHLC.exists() else []
    sumber_lama = (json.loads(OHLC.read_text(encoding="utf-8")).get("sumber_bar")
                   if OHLC.exists() else None)
    try:
        baru = tarik_penuh() if (arg.penuh or not lama) else ke_baris(ambil(SIMBOL, None, None, "5d"))
    except Ditolak as e:
        print(f"Yahoo menolak ({e}) — tidak ada yang ditulis, coba lagi nanti.")
        sys.exit(1)
    if not baru:
        print("seri kosong — tidak ada yang ditulis.")
        sys.exit(1)
    # Volume Yahoo untuk INDEKS dilaporkan dalam lot; seluruh berkas ini
    # bersatuan lembar, jadi konversinya di sini - di titik masuk, sekali.
    #
    # Dulu konversi ini dikerjakan penjahit, dan itulah akar kerusakan yang
    # ditemukan 5 Sep 2026: penjahit membaca berkas yang ditulisnya sendiri,
    # jadi tiap jalan mengali 100 LAGI. Terukur 551 bar (1995-2006) menggembung
    # sampai 61 digit - 24 Juli 2001 tercatat 2,3 x 10^59 lembar. Mengonversi
    # di titik masuk membuat pengaliannya mustahil menumpuk: bar yang sudah ada
    # di berkas tak pernah disentuh lagi oleh siapa pun.
    baru_lembar = [[r[0], r[1], r[2], r[3], r[4], (r[5] or 0) * LOT_KE_LEMBAR] for r in baru]
    gabungan = gabung(lama, baru_lembar)
    tulis(gabungan, sumber_lama=sumber_lama, tanggal_ditulis={r[0] for r in baru_lembar})

    n = isi_cadangan_index(gabungan)
    print(f"\ncadangan index.json: {n} hari ditambal dari Yahoo" if n else "\ncadangan index.json: tak ada yang perlu ditambal")


if __name__ == "__main__":
    main()
