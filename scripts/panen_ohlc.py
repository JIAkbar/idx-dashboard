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
  python scripts/panen_ohlc.py --penuh --paksa  # tarik ulang SEMUA walau sudah cukup

Pengaman terhadap Yahoo sama persis dengan panen_seasonality.py: satu
permintaan pada satu waktu, jeda acak, backoff yang menghormati Retry-After,
dan berhenti setelah tiga penolakan beruntun.

LANJUTKAN SETELAH BERHENTI
--------------------------
Panen --penuh --tahun 10 atas ~960 emiten makan berjam-jam dan Yahoo bisa
menolak (429/403) di tengah jalan. --lewati-cukup nyala OTOMATIS saat --penuh
(matikan dengan --paksa): emiten yang berkasnya sudah tercatat pernah ditarik
sedalam --tahun (ruas "th_full", diisi tiap kali panen penuh berhasil) tidak
ditarik ulang. Cukup jalankan perintah yang sama lagi — ia melanjutkan dari
emiten yang belum kebagian, bukan mengulang dari awal.
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2
from gabung_ohlc_stockbit import padatkan_rentang  # noqa: E402 — satu pemadat, bukan salinan kedua

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


def ambil(simbol: str, p1: int | None, p2: int | None, rentang: str | None) -> dict:
    """`simbol` = simbol Yahoo LENGKAP ("BBCA.JK", "%5EJKSE") — akhiran `.JK`
    sengaja tidak ditempel di sini supaya indeks (^JKSE, dipanen
    `panen_ihsg.py`) bisa memakai mesin permintaan yang sama."""
    dasar = f"https://query1.finance.yahoo.com/v8/finance/chart/{simbol}?interval=1d"
    url = f"{dasar}&period1={p1}&period2={p2}" if rentang is None else f"{dasar}&range={rentang}"
    req = urllib.request.Request(url, headers=KEPALA)
    galat = None
    for n in range(len(TUNGGU_ULANG)):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                hasil = json.load(r)
                # Arsip respons MENTAH Yahoo sebelum diparse — dipakai bersama
                # panen_ihsg.py (yang memanggil fungsi ini juga). Pembeda pakai
                # TANGGAL PANEN + rentang/periode: hari yang berbeda tak boleh
                # saling menimpa (harga bisa direvisi Yahoo di kemudian hari).
                kode = simbol.replace(".JK", "").replace("%5E", "")
                pembeda = rentang or f"{p1}-{p2}"
                tanggal = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                arsip_mentah.simpan("ohlc", kode, f"{tanggal}_{pembeda}.json", data=hasil)
                return hasil
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
    from bar_berisi import buang_bar_hari_berjalan
    return buang_bar_hari_berjalan(baris)



def _kode_lama(tgl: str, rentang: list[list] | None) -> str | None:
    """Kode sumber sebuah tanggal menurut penanda LAMA, atau None."""
    for dari, sampai, kode in (rentang or []):
        if dari <= tgl <= sampai:
            return kode
    return None


def simpan(kode: str, baris: list[list], th_full: int | None = None,
           sumber_lama: list[list] | None = None,
           tanggal_ditulis: set[str] | None = None) -> int:
    """Tulis satu berkas emiten, LENGKAP dengan penanda sumber per bar.

    Kenapa pemanen ini ikut menulis penanda, padahal ia cuma tahu satu
    penyedia: arsip `ohlc/` punya lebih dari satu penulis di rantai yang tak
    bisa diurutkan satu sama lain — pemanen ini dijalankan CI di awan,
    penggabung dijalankan panen lokal. Terukur 5 Sep 2026 pada berkas IHSG:
    penulis yang membangun berkas dari nol dengan lima ruas saja MENGHAPUS
    penanda 26 blok (1.811 bar cadangan) tanpa satu pun galat, dan halaman
    kehilangan keterangan sumbernya diam-diam.

    Membiarkan penanda lama bertahan apa adanya justru lebih buruk: tanggal
    yang baru saja ditimpa penyedia ini akan mengklaim asal yang salah dengan
    percaya diri. Yang benar: tanggal yang BARU DITULIS di sini menjadi
    cadangan (`yh`), sisanya mempertahankan kode lamanya. Penggabung akan
    memperhalusnya lagi saat ia jalan.

    `sumber_lama` = ruas `sumber_bar` berkas sebelumnya (None kalau tak ada).
    `tanggal_ditulis` = tanggal yang penyedia ini kirim pada jalan ini; None
    berarti seluruh deret berasal dari penyedia ini (panen penuh).
    """
    KELUARAN.mkdir(parents=True, exist_ok=True)
    p = KELUARAN / f"{kode}.json"
    def kode_untuk(tgl: str) -> str:
        if tanggal_ditulis is None or tgl in tanggal_ditulis:
            return "yh"
        return _kode_lama(tgl, sumber_lama) or "yh"

    obj = {"kode": kode, "mulai": baris[0][0], "akhir": baris[-1][0], "n": len(baris), "d": baris,
           "sumber_bar": padatkan_rentang(baris, kode_untuk)}
    if th_full is not None:
        # Dicatat SETIAP kali (penuh maupun refresh harian yang meneruskan nilai
        # lama) supaya `cukup()` di bawah tahu seberapa dalam emiten ini PERNAH
        # diminta — dipakai --lewati-cukup, lihat penjelasan di sana.
        obj["th_full"] = th_full
    _tulis_ulet(p, json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    return p.stat().st_size


def _tulis_ulet(p: Path, teks: str, coba: int = 4) -> None:
    """Tulis dengan beberapa kali percobaan.

    Windows sesekali menolak tulis dengan `OSError: [Errno 22]` ketika berkasnya
    sedang dipegang proses lain sesaat -- pengindeks, pemindai virus, atau
    pengawas berkas dev server yang memang menyajikan folder ini. Kegagalannya
    ACAK: 20 Agu 2026 dua jalan berturut-turut mati di emiten yang berbeda
    (ESTA lalu AGII).

    Yang membuatnya mahal bukan kegagalan tulisnya, melainkan akibatnya: satu
    berkas gagal menjatuhkan SELURUH sisa panen. Jalan kedua berhenti di AGII
    dan meninggalkan 400 emiten tertahan di tanggal kemarin -- tanpa satu pun
    dari mereka bermasalah.
    """
    for ke in range(coba):
        try:
            p.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if ke == coba - 1:
                raise
            time.sleep(0.25 * (ke + 1))


def cukup(lama: dict, tahun_target: int) -> bool:
    """True kalau berkas ini sudah PERNAH ditarik sedalam (atau lebih dalam)
    dari `tahun_target` — dipakai --lewati-cukup supaya panen 10-tahun yang
    berhenti di tengah jalan (penolakan Yahoo) bisa dilanjutkan tanpa menarik
    ulang emiten yang sudah beres.

    Sengaja dicek dari ruas `th_full` (kedalaman yang PERNAH diminta), BUKAN
    dari selisih tanggal `mulai` ke target: emiten yang IPO-nya belum 10 tahun
    tak akan pernah punya `mulai` sedalam target walau sudah ditarik semaksimal
    mungkin, dan kalau patokannya tanggal, emiten begitu akan ditarik ulang
    setiap kali skrip ini jalan — sia-sia, karena Yahoo tak akan pernah
    mengembalikan riwayat yang memang belum ada.
    """
    th = lama.get("th_full")
    if th is None:
        return False  # berkas lama dari sebelum ruas ini ada — kedalamannya tak tercatat
    if th == 0:
        return True  # pernah ditarik SEMAKSIMAL Yahoo (range 1996-sekarang), tak mungkin lebih
    return th >= tahun_target


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--penuh", action="store_true", help="tarik riwayat penuh, bukan hari baru saja")
    ap.add_argument("--tahun", type=int, default=5, help="riwayat berapa tahun saat --penuh (0 = maksimum)")
    ap.add_argument("--batas", type=int, default=0, help="berhenti setelah sekian emiten (uji)")
    ap.add_argument("--cermin", action="store_true", help="salin juga ke app/public")
    ap.add_argument("--lewati-cukup", action="store_true",
                     help="lewati emiten yang riwayatnya sudah sedalam --tahun (nyala default saat --penuh)")
    ap.add_argument("--paksa", action="store_true",
                     help="matikan --lewati-cukup — tarik ulang semua emiten walau sudah cukup")
    arg = ap.parse_args()
    # --penuh menyalakan --lewati-cukup secara default (panen 10-tahun makan
    # berjam-jam dan sering berhenti di tengah karena penolakan Yahoo —
    # melanjutkan tanpa menarik ulang yang sudah beres itu intinya). --paksa
    # selalu menang, dipakai kalau memang mau menarik ulang semuanya.
    lewati_cukup = (not arg.paksa) and (arg.lewati_cukup or arg.penuh)

    kode_semua = [e["kode"] for e in json.loads(DAFTAR.read_text(encoding="utf-8"))["emiten"]]
    if arg.batas:
        kode_semua = kode_semua[: arg.batas]

    KELUARAN.mkdir(parents=True, exist_ok=True)
    tolak_beruntun = 0
    baru = segar = lewat = sudah_cukup = 0
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

        if penuh and lewati_cukup and lama is not None and cukup(lama, arg.tahun):
            sudah_cukup += 1
            continue

        try:
            if penuh:
                if arg.tahun:
                    # range=max menurunkan resolusi jadi bulanan walau interval=1d
                    # (ketahuan 15 Agu 2026 pada ^JKSE: 437 titik untuk 36 tahun).
                    # Karena itu selalu period1/period2, tak pernah range=max.
                    p2 = int(datetime.now(timezone.utc).timestamp())
                    p1 = int((datetime.now(timezone.utc) - timedelta(days=365 * arg.tahun + 10)).timestamp())
                    data = ambil(f"{kode}.JK", p1, p2, None)
                else:
                    p2 = int(datetime.now(timezone.utc).timestamp())
                    p1 = int(datetime(1996, 1, 1, tzinfo=timezone.utc).timestamp())
                    data = ambil(f"{kode}.JK", p1, p2, None)
            else:
                # Harian: 5 hari terakhir sudah lebih dari cukup untuk menambal
                # libur panjang, dan muatannya sepersekian riwayat penuh.
                data = ambil(f"{kode}.JK", None, None, "5d")
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
            total_byte += simpan(kode, baris, th_full=arg.tahun)
            baru += 1
        else:
            # Gabung menurut tanggal: hari yang sudah ada DITIMPA, bukan
            # ditambahkan — panen ulang di hari yang sama tidak boleh
            # menggandakan barisnya.
            peta = {b[0]: b for b in lama["d"]}
            for b in baris:
                peta[b[0]] = b
            # th_full diteruskan dari berkas lama (bukan diisi ulang) — refresh
            # harian cuma menambah hari baru, bukan menyelami lebih dalam.
            # Penanda sumber juga diteruskan: hanya tanggal yang BARU ditulis
            # di sini yang berubah jadi cadangan, sisanya mempertahankan
            # asalnya. Tanpa ini, refresh harian menghapus penanda seluruh
            # riwayat — lihat docstring `simpan`.
            total_byte += simpan(kode, [peta[k] for k in sorted(peta)], th_full=lama.get("th_full"),
                                 sumber_lama=lama.get("sumber_bar"),
                                 tanggal_ditulis={b[0] for b in baris})
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
    print(f"{baru} ditarik penuh · {segar} disegarkan · {sudah_cukup} sudah cukup (dilewati) · "
          f"{lewat} dilewati (gagal) · {len(gagal)} gagal")
    print(f"Durasi {int(time.time() - t0)}s")
    if gagal:
        (KELUARAN / "_gagal.json").write_text(json.dumps(gagal, ensure_ascii=False, indent=2), encoding="utf-8")


def swauji() -> int:
    """Uji penanda sumber saat refresh harian — bagian yang gagal SENYAP.

    Kelas kesalahannya sudah dibayar 5 Sep 2026: penulis yang membangun berkas
    dari nol menghapus penanda hasil penggabungan tanpa satu pun galat. Uji ini
    menjaga dua sifat yang mencegahnya terulang.
    """
    lama = [["2020-01-01", "2020-06-30", "yh"], ["2020-07-01", "2026-09-03", "sb"]]

    # 1. Bar lama MEMPERTAHANKAN asalnya; hanya tanggal yang baru ditulis
    #    penyedia ini yang jadi cadangan.
    assert _kode_lama("2020-03-01", lama) == "yh"
    assert _kode_lama("2021-01-01", lama) == "sb"
    assert _kode_lama("1999-01-01", lama) is None, "di luar rentang harus None, bukan menebak"
    assert _kode_lama("2020-01-01", None) is None, "tanpa penanda lama harus None"

    bar = [["2020-03-01"], ["2021-01-01"], ["2026-09-04"]]
    ditulis = {"2026-09-04"}
    r = padatkan_rentang(bar, lambda t: "yh" if t in ditulis else (_kode_lama(t, lama) or "yh"))
    assert r == [["2020-03-01", "2020-03-01", "yh"],
                 ["2021-01-01", "2021-01-01", "sb"],
                 ["2026-09-04", "2026-09-04", "yh"]], r

    # 2. Panen PENUH: seluruh deret memang dari penyedia ini, jadi satu rentang.
    penuh = padatkan_rentang(bar, lambda t: "yh")
    assert penuh == [["2020-03-01", "2026-09-04", "yh"]], penuh

    # 3. Penanda wajib menutup SETIAP bar — tak boleh ada yang jatuh di celah.
    for b in bar:
        assert any(a <= b[0] <= z for a, z, _ in r), f"bar {b[0]} tak berpenanda"

    print("swauji OK — 8/8 assert lulus")
    return 0


if __name__ == "__main__":
    sys.exit(swauji() if "--swauji" in sys.argv else (main() or 0))
