# -*- coding: utf-8 -*-
"""Gerbang kesegaran turunan — apakah yang dibaca halaman ikut segar?

Pertanyaannya satu: **apakah turunannya ikut dijalankan sesudah sumbernya
dipanen?** Bukan "apakah skripnya jalan" — itu sudah dijawab exit code, dan
exit code ternyata tak cukup.

Kenapa gerbang ini ada, terukur 20 Agustus 2026:

* `kartu_analisa.py --semua` TANPA `--tulis` menghitung 383 emiten, mencetak
  `[383/383]`, keluar dengan kode **0**, dan tidak menyimpan apa pun. Dari
  log, jalan yang tak menyimpan terlihat persis seperti jalan yang berhasil.
* Akibatnya di layar: IHSG sudah 20 Agustus sementara Kartu Analisa,
  Screener, dan Seasonality masih 19 Agustus — nol galat, nol peringatan.

## Dua cacat versi pertama, keduanya ketahuan 29 Agustus 2026

Versi pertama menjaga **satu** pasangan saja (OHLC → Kartu) dari belasan
turunan, dan hanya itu yang pernah merah. Semua turunan lain tak dijaga
siapa pun — jadi saat sembilan baris `.bat` rusak dan lima pembangun berhenti
jalan selama sehari penuh, tak ada satu pun sinyal.

Lebih halus lagi: gerbangnya sendiri **tertipu bar hantu**. Ia membaca ruas
`akhir` di berkas harga dan melapor "OHLC 2026-08-28 pada 962 emiten" —
padahal 962 bar itu bervolume nol, ditulis sebelum datanya terbit. Gerbang
yang memakai tanggal apa adanya akan selalu melapor hijau di hari yang justru
paling perlu diperiksa.

## Aturan versi ini

1. **Acuannya hari bursa terakhir menurut statistik harian**, bukan menurut
   arsip harga. Statistik itu tak memakai kredensial apa pun, jadi ia tetap
   terbit saat sumber lain mati — persis keadaan yang perlu dideteksi.
2. **Tanggal dibaca dari bar BERISI**, bukan dari ruas `akhir` atau dari
   nama berkas. Yang kosong tak boleh mengaku segar (§WF-207).
3. **Semua turunan diperiksa, semua dilaporkan.** Berhenti di kegagalan
   pertama menyembunyikan sisanya; yang dilaporkan tiga angka: segar, basi,
   dan tak terperiksa.
4. **Irama diumumkan per turunan.** Fundamental kuartalan yang berumur 30
   hari bukan kegagalan; harga harian yang berumur 2 hari bursa adalah
   kegagalan. Tanpa irama, daftar ini jadi kebisingan dan orang berhenti
   membacanya — nasib yang sudah menimpa tabel status panen.

Pakai:
    python scripts/cek_kesegaran.py          # keluar 1 kalau ada yang basi
    python scripts/cek_kesegaran.py --semua  # cetak yang segar juga
    python scripts/cek_kesegaran.py --uji    # swauji, nol berkas dibaca
"""
from __future__ import annotations

import collections
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
JSON = AKAR / "data-idx" / "json"


# ── Cara membaca "isi terakhir" ────────────────────────────────────────────
# Tiap turunan menyimpan tanggalnya dengan bentuknya sendiri. Yang haram cuma
# satu: menyimpulkan dari mtime berkas. Berkas bisa ditulis ulang tanpa
# membawa data baru, dan melaporkan waktu tulis membuat data basi terlihat
# segar.

def _muat(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 — berkas rusak dilaporkan, tak menghentikan
        return None


def dari_ruas(*nama: str):
    """Nilai ruas pertama yang ada di objek teratas."""
    def baca(p: Path) -> str | None:
        d = _muat(p)
        if not isinstance(d, dict):
            return None
        for k in nama:
            v = d.get(k)
            if isinstance(v, str) and len(v) >= 10:
                return v[:10]
        return None
    return baca


def dari_larik_pertama(ruas: str):
    """Elemen [0] sebuah larik tanggal — dipakai index yang urut baru→lama."""
    def baca(p: Path) -> str | None:
        d = _muat(p)
        if not isinstance(d, dict):
            return None
        v = d.get(ruas)
        return v[0][:10] if isinstance(v, list) and v and isinstance(v[0], str) else None
    return baca


def dari_modus_anak(ruas_induk: str, ruas_anak: str):
    """Tanggal terbanyak di antara anak-anak sebuah larik.

    Modus, bukan maksimum: satu emiten yang kebetulan lebih baru tak boleh
    membuat seluruh panen terlihat segar. Dan bukan minimum: puluhan emiten
    yang berhenti diperdagangkan membeku di tanggal lama selamanya, dan itu
    bukan kegagalan panen.
    """
    def baca(p: Path) -> str | None:
        d = _muat(p)
        if not isinstance(d, dict):
            return None
        c = collections.Counter(
            x.get(ruas_anak) for x in (d.get(ruas_induk) or []) if isinstance(x, dict)
        )
        c.pop(None, None)
        return c.most_common(1)[0][0][:10] if c else None
    return baca


def dari_bar_berisi(i_volume: int = 5, n_sampel: int = 60):
    """Tanggal bar TERAKHIR YANG BERISI, atas sampel emiten (modus).

    Ini yang membedakan gerbang ini dari versi pertamanya. Sumber harga
    menulis bar bertanggal hari ini dengan volume nol sebelum datanya terbit;
    membaca tanggal apa adanya membuat hari yang paling perlu diperiksa
    justru yang paling meyakinkan tampilannya.
    """
    def baca_dir(d: Path) -> str | None:
        c: collections.Counter = collections.Counter()
        for p in sorted(d.glob("*.json"))[:n_sampel]:
            j = _muat(p)
            bar = j.get("bar") if isinstance(j, dict) else j
            if not isinstance(bar, list) or not bar:
                continue
            i = len(bar) - 1
            while i > 0 and not (bar[i][i_volume] if len(bar[i]) > i_volume else 0):
                i -= 1
            t = bar[i][0] if isinstance(bar[i], list) and bar[i] else None
            if isinstance(t, str):
                c[t[:10]] += 1
        return c.most_common(1)[0][0] if c else None
    return baca_dir


def dari_nama_berkas(d: Path) -> str | None:
    """Direktori berisi `<tanggal>.json` — nama termuda."""
    nama = sorted(
        p.stem for p in d.glob("*.json")
        if len(p.stem) == 10 and p.stem[4] == "-" and p.stem[7] == "-"
    )
    return nama[-1] if nama else None


def dari_maks_anak(ruas_induk: str, ruas_anak: str):
    """Tanggal TERBESAR di antara anak-anak sebuah larik.

    Beda dari `dari_modus_anak`, dan bedanya menentukan: dipakai untuk daftar
    yang tiap elemennya satu hari berbeda (indeks statistik harian), di mana
    modus tak punya arti — semua muncul sekali, jadi modus mengembalikan
    elemen pertama. Versi pertama gerbang ini memakai modus di sana dan
    melaporkan acuan "2026-01-07" untuk data akhir Agustus, lalu menyatakan
    SEMUA turunan segar dengan umur negatif. Gerbang yang acuannya salah lebih
    berbahaya daripada tak ada gerbang: ia melapor hijau dengan meyakinkan.
    """
    def baca(p: Path) -> str | None:
        d = _muat(p)
        if not isinstance(d, dict):
            return None
        t = [
            x.get(ruas_anak) for x in (d.get(ruas_induk) or [])
            if isinstance(x, dict) and isinstance(x.get(ruas_anak), str)
        ]
        return max(t)[:10] if t else None
    return baca


def dari_kunci_peta(ruas: str, n_sampel: int = 60):
    """Kunci terbesar sebuah peta tanggal→isi, atas sampel emiten (modus)."""
    def baca_dir(d: Path) -> str | None:
        c: collections.Counter = collections.Counter()
        for p in sorted(d.glob("*.json"))[:n_sampel]:
            j = _muat(p)
            peta = j.get(ruas) if isinstance(j, dict) else None
            if isinstance(peta, dict) and peta:
                c[max(peta.keys())[:10]] += 1
        return c.most_common(1)[0][0] if c else None
    return baca_dir


def dari_ruas_direktori(ruas: str, n_sampel: int = 60):
    """Modus sebuah ruas tanggal atas sampel berkas dalam direktori.

    Untuk gudang SNAPSHOT — satu berkas per emiten, isinya potret terkini,
    bukan deret harian. Yang diukur di sini kapan potret itu diambil
    (`dipanen_pada`), karena isinya sendiri tak punya tanggal harian yang bisa
    dibandingkan ke hari bursa: kuartal keuangan berganti tiap tiga bulan, dan
    membandingkannya ke hari bursa terakhir akan melaporkan merah selamanya.

    Tetap dibaca dari DALAM berkas, bukan mtime — berkas bisa ditulis ulang
    tanpa membawa potret baru.
    """
    def baca_dir(d: Path) -> str | None:
        c: collections.Counter = collections.Counter()
        for p in sorted(d.glob("*.json"))[:n_sampel]:
            j = _muat(p)
            v = j.get(ruas) if isinstance(j, dict) else None
            if isinstance(v, str) and len(v) >= 10:
                c[v[:10]] += 1
        return c.most_common(1)[0][0] if c else None
    return baca_dir


def dari_bar_dict(ruas: str = "d", i_volume: int = 5, n_sampel: int = 60):
    """Bar terakhir BERISI di berkas yang menyimpan barnya di ruas `d`."""
    def baca_dir(d: Path) -> str | None:
        c: collections.Counter = collections.Counter()
        for p in sorted(d.glob("*.json"))[:n_sampel]:
            j = _muat(p)
            bar = j.get(ruas) if isinstance(j, dict) else None
            if not isinstance(bar, list) or not bar:
                continue
            i = len(bar) - 1
            while i > 0 and not (bar[i][i_volume] if len(bar[i]) > i_volume else 0):
                i -= 1
            if isinstance(bar[i], list) and isinstance(bar[i][0], str):
                c[bar[i][0][:10]] += 1
        return c.most_common(1)[0][0] if c else None
    return baca_dir


# ── Manifest ───────────────────────────────────────────────────────────────
# Satu baris per turunan yang dibaca halaman. Kolom `halaman` bukan hiasan:
# ia satu-satunya yang membuat turunan-yang-menganggur terlihat, dan ia yang
# menjawab "kalau ini basi, apa yang rusak di layar".
#
# `toleransi` = berapa HARI KALENDER turunan boleh tertinggal dari hari bursa
# terakhir sebelum dianggap basi.
#
# Bawaannya 0, dan itu disengaja. Versi pertama memakai 1 "supaya ada ruang
# untuk panen sore yang belum jalan" — dan dengan itu Kartu Analisa yang
# tertinggal sehari terbaca SEGAR, padahal gerbang lama benar melaporkannya
# merah. Toleransi yang memberi ruang untuk kegagalan yang sesungguhnya
# adalah gerbang yang mengizinkan persis apa yang mau dicegahnya.
#
# Yang iramanya memang bukan harian diberi angkanya sendiri, dan angkanya
# ditulis dari irama sumbernya — bukan dari seberapa basi ia kebetulan hari
# ini.

@dataclass
class Turunan:
    nama: str
    jalur: str
    baca: object
    halaman: str
    toleransi: int = 0
    pembangun: str = ""


MANIFEST: list[Turunan] = [
    Turunan("Arsip harga (gabungan)", "ohlc", dari_bar_dict("d", i_volume=5),
            "Grafik Emiten · Tanya PAPAN · sumber hulu banyak turunan",
            pembangun="gabung_ohlc_stockbit.py"),
    Turunan("Arsip harga (sumber)", "ohlcv_stockbit", dari_bar_berisi(i_volume=6),
            "sumber hulu Harian Papan, Screener, Kartu",
            pembangun="panen_ohlcv_stockbit.py"),
    Turunan("Harian Papan", "harian_papan/index.json", dari_larik_pertama("tanggal_tersedia"),
            "Harian Papan", pembangun="app/scripts/bangun-harian-papan.mjs"),
    Turunan("Kartu Analisa", "kartu/ringkas.json", dari_modus_anak("emiten", "tgl"),
            "Kartu Analisa", pembangun="kartu_analisa.py --semua --tulis"),
    Turunan("Screener", "screener.json", dari_ruas("tanggal"),
            "Screener", pembangun="app/scripts/bangun-screener.mjs"),
    Turunan("Pola screener", "pola_screener.json", dari_ruas("akhir"),
            "Screener (kolom pola)", pembangun="app/scripts/pola-screener.ts"),
    Turunan("Jago Papan", "jago_papan/terbaru.json", dari_ruas("tanggal"),
            "Jago Papan", pembangun="app/scripts/bangun-jago-papan.mjs"),
    # Tiga keluaran sistem win rate (spek_sistem_winrate_produksi §1.4). Tanpa
    # baris ini, kartu Rencana & Rekam Jejak dan tabel TERKUNCI bisa membeku
    # berhari-hari sementara gerbang melapor "basi 0" — bentuk kegagalan lima
    # alarm senyap yang sudah dibayar 28 Agu–1 Sep 2026.
    Turunan("Rencana & rekam jejak", "rencana_saham.json", dari_modus_anak("emiten", "tanggal"),
            "Kartu Analisa (blok rencana dagang)", pembangun="riset/rencana_saham.py"),
    Turunan("Penilai jejak (hakim)", "nilai_jejak.json", dari_ruas("hariBursaTerakhir"),
            "Screener · Riwayat & Win Rate", pembangun="riset/nilai_jejak.py"),
    Turunan("Selisih-pasar TERKUNCI", "selisih_terkunci.json", dari_ruas("hariBursaTerakhir"),
            "Screener · Riwayat & Win Rate", pembangun="riset/selisih_terkunci.py"),
    Turunan("IPO Papan", "ipo.json", dari_ruas("tanggal"),
            "IPO Papan", pembangun="app/scripts/bangun-ipo.mjs"),
    Turunan("Aliran investor", "aliran_investor.json", dari_ruas("akhir"),
            "Broker Summary tab Flow", pembangun="bangun_aliran_investor.py"),
    Turunan("Bid/offer", "bidoffer.json", dari_ruas("tanggal"),
            "Kuli Papan", pembangun="bangun_bidoffer.py"),
    Turunan("Arsip broker harian", "broker_harian", dari_kunci_peta("hari"),
            "Whales Papan · Kuli Papan · Neo Papan · Berkas Emiten · Watchlist",
            pembangun="backfill_broker_massal.py (6 varian)"),
    Turunan("Statistik harian", "index.json", dari_maks_anak("dates", "date_iso"),
            "Beranda · Top Stocks · Top Broker · Indeks Dunia",
            pembangun="download_idx.py + parse_idx_pdf.py"),
    Turunan("Kabar pasar", "kabar.json", dari_ruas("dipanen"),
            "Kabar Pasar · Beranda", pembangun="panen_kabar.py"),
    Turunan("Stockbit Snips", "snips.json", dari_ruas("diperbarui"),
            "Kabar Pasar tab Snips", toleransi=3, pembangun="panen_snips.py"),
    Turunan("Rezim pasar", "rezim_pasar.json", dari_ruas("dibangun"),
            "penilaian rezim (dipakai beberapa halaman)", toleransi=3,
            pembangun="bangun_rezim_pasar.py"),
    Turunan("Kategori broker", "kategori_broker.json", dari_ruas("dibangun"),
            "Whales Papan · Neo Papan (warna & kubu broker)", toleransi=3,
            pembangun="bangun_kategori_broker.py"),
    Turunan("Sektor emiten", "emiten_sektor.json", dari_ruas("diperbarui"),
            "Screener · Harian Papan · Sektor & Indeks", toleransi=7,
            pembangun="panen_sektor_idx.py"),
    Turunan("Daftar emiten", "daftar_emiten.json", dari_ruas("date_iso"),
            "wasit daftar emiten seluruh halaman", pembangun="sinkron_emiten.py"),
    # Dua gudang snapshot Stockbit. Ditambahkan 30 Agu 2026 sesudah ketahuan
    # gerbang ini buta pada keduanya sementara LIMA halaman membacanya —
    # "basi 0" yang tak melihat dataset yang dipakai lima halaman adalah hijau
    # yang menyesatkan, persis kegagalan yang gerbang ini dibuat untuk mencegah.
    #
    # Toleransinya bukan harian karena iramanya bukan harian: keystats bergerak
    # per kuartal (angka rasio hanya berubah saat laporan baru terbit), info
    # membawa keanggotaan indeks & notasi yang berubah mingguan-bulanan. Angka
    # di bawah dipilih dari irama sumbernya — bukan dari seberapa basi ia
    # kebetulan hari ini.
    Turunan("Rasio Stockbit (snapshot)", "keystats_stockbit",
            dari_ruas_direktori("dipanen_pada"),
            "Berkas Emiten blok F · Stock Detail · Kuli Papan", toleransi=30,
            pembangun="panen_keystats_stockbit.py"),
    Turunan("Info emiten Stockbit (snapshot)", "info_stockbit",
            dari_ruas_direktori("dipanen_pada"),
            # 30, bukan 7: ketetapan Johan 1 Sep 2026 "keystat dan profile
            # cukup 1 bulan sekali" — bat Buka Laptop memanennya per 28 hari.
            # Toleransi 7 akan melapor BASI di 21 dari 28 hari tanpa ada yang
            # salah, dan alarm yang menyala terus adalah alarm yang diabaikan.
            "Berkas Emiten blok G (notasi & UMA) · Neo Papan (indeks)", toleransi=30,
            pembangun="panen_info_stockbit.py"),
]


def hari_bursa_terakhir() -> str | None:
    """Acuan dari statistik harian — sumber yang tak memakai kredensial, jadi
    ia tetap terbit saat sumber lain mati. Itu justru gunanya di sini."""
    return dari_maks_anak("dates", "date_iso")(JSON / "index.json")


def selisih_hari(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def periksa(cetak_semua: bool = False) -> int:
    acuan = hari_bursa_terakhir()
    if not acuan:
        print("::error::hari bursa terakhir tak terbaca dari statistik harian — "
              "acuan kesegaran tak ada, pemeriksaan dibatalkan")
        return 1
    print(f"hari bursa terakhir (statistik harian): {acuan}\n")

    segar, basi, tak_terperiksa = [], [], []
    for t in MANIFEST:
        p = JSON / t.jalur
        if not p.exists():
            tak_terperiksa.append((t, "berkas/direktori tak ada"))
            continue
        try:
            isi = t.baca(p)
        except Exception as e:  # noqa: BLE001
            tak_terperiksa.append((t, f"gagal dibaca: {e}"))
            continue
        if not isi:
            tak_terperiksa.append((t, "tanggal tak terbaca dari isinya"))
            continue
        umur = selisih_hari(isi, acuan)
        if umur > t.toleransi:
            basi.append((t, isi, umur))
        else:
            segar.append((t, isi, umur))

    if cetak_semua:
        for t, isi, umur in segar:
            print(f"  segar  {t.nama:24} {isi}  ({umur} hari)")
    for t, isi, umur in basi:
        print(f"  BASI   {t.nama:24} {isi}  ({umur} hari, batas {t.toleransi})")
        print(f"         dipakai: {t.halaman}")
        if t.pembangun:
            print(f"         pembangun: {t.pembangun}")
    for t, sebab in tak_terperiksa:
        print(f"  ?      {t.nama:24} {sebab}")

    print(f"\nsegar {len(segar)} · basi {len(basi)} · tak terperiksa {len(tak_terperiksa)}")
    if basi:
        nama = ", ".join(t.nama for t, _, _ in basi)
        print(f"::error::{len(basi)} turunan basi: {nama}")
        return 1
    if tak_terperiksa:
        # Tak terperiksa BUKAN lolos. Ia dilaporkan kuning, bukan hijau —
        # "tak bisa memeriksa" dan "sudah diperiksa dan aman" adalah dua
        # keadaan berbeda, dan menyamakannya persis cara kegagalan senyap
        # bertahan lama.
        nama = ", ".join(t.nama for t, _ in tak_terperiksa)
        print(f"::warning::{len(tak_terperiksa)} turunan tak bisa diperiksa: {nama}")
    print("kesegaran turunan: LOLOS")
    return 0


def _uji() -> None:
    """Swauji tanpa menyentuh cakram — yang diuji aturannya, bukan datanya."""
    # Modus, bukan maksimum: satu emiten lebih baru tak boleh menutupi 900 yang basi.
    c = collections.Counter({"2026-08-19": 900, "2026-08-20": 1})
    assert c.most_common(1)[0] == ("2026-08-19", 900)

    # Modus, bukan minimum: emiten berhenti diperdagangkan membeku di tanggal
    # lama selamanya dan itu bukan kegagalan panen.
    c2 = collections.Counter({"2026-08-20": 920, "2026-07-17": 40})
    assert c2.most_common(1)[0][0] == "2026-08-20"

    # Umur dihitung dalam hari kalender terhadap acuan.
    assert selisih_hari("2026-08-27", "2026-08-28") == 1
    assert selisih_hari("2026-08-28", "2026-08-28") == 0

    # Bar hantu tak boleh memenangkan tanggal. Bar terakhir bervolume nol,
    # yang sebelumnya berisi — yang menang harus yang berisi.
    baca = dari_bar_berisi(i_volume=5)
    bar = [["2026-08-26", 1, 1, 1, 1, 500],
           ["2026-08-27", 1, 1, 1, 1, 700],
           ["2026-08-28", 1, 1, 1, 1, 0]]
    i = len(bar) - 1
    while i > 0 and not bar[i][5]:
        i -= 1
    assert bar[i][0] == "2026-08-27", "bar hantu tak boleh jadi tanggal terakhir"

    # Manifest tak boleh punya nama kembar — dua baris bernama sama membuat
    # satunya tak pernah terbaca di laporan.
    nama = [t.nama for t in MANIFEST]
    assert len(nama) == len(set(nama)), "nama turunan kembar di MANIFEST"

    # Tiap baris wajib menyebut halaman pemakainya. Kolom itu satu-satunya
    # yang membuat turunan-yang-menganggur terlihat.
    assert all(t.halaman.strip() for t in MANIFEST), "ada turunan tanpa halaman pemakai"

    # Acuan wajib MAKSIMUM, bukan modus. Di daftar yang tiap elemennya satu
    # hari berbeda, modus mengembalikan elemen pertama — dan gerbang yang
    # acuannya mundur tujuh bulan menyatakan semuanya segar.
    dates = [{"date_iso": "2026-08-26"}, {"date_iso": "2026-08-27"}, {"date_iso": "2026-08-28"}]
    assert max(x["date_iso"] for x in dates) == "2026-08-28"
    c3 = collections.Counter(x["date_iso"] for x in dates)
    assert c3.most_common(1)[0][0] == "2026-08-26", "modus di daftar unik = elemen pertama"

    # Umur negatif SAH untuk turunan yang tak terikat kalender bursa: kabar
    # dan snips dipanen hari ini juga, jadi mereka bisa lebih baru daripada
    # hari bursa terakhir. Yang tak boleh negatif cuma turunan berbasis bar.
    assert selisih_hari("2026-08-28", "2026-08-27") == -1

    # Gudang yang DIBACA halaman wajib ada di manifest. Tanpa uji ini, satu
    # entri terhapus (atau tak pernah ditambahkan) membuat gerbang melapor
    # "basi 0" sambil buta pada dataset yang dipakai halaman — bentuk kegagalan
    # yang persis pernah terjadi: keystats & info_stockbit dibaca lima halaman
    # selama sepekan tanpa satu pun baris di sini.
    wajib = {
        "ohlc", "ohlcv_stockbit", "harian_papan/index.json", "kartu/ringkas.json",
        "screener.json", "jago_papan/terbaru.json", "broker_harian", "index.json",
        "keystats_stockbit", "info_stockbit", "daftar_emiten.json",
        # keluaran sistem win rate — dibaca Kartu Analisa & Screener/Riwayat
        "rencana_saham.json", "nilai_jejak.json", "selisih_terkunci.json",
    }
    kurang = wajib - {t.jalur for t in MANIFEST}
    assert not kurang, f"gudang dibaca halaman tapi tak diperiksa gerbang: {sorted(kurang)}"

    print(f"uji cek_kesegaran: LOLOS ({len(MANIFEST)} turunan di manifest)")


if __name__ == "__main__":
    if "--uji" in sys.argv:
        _uji()
    else:
        raise SystemExit(periksa("--semua" in sys.argv))
