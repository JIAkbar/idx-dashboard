# -*- coding: utf-8 -*-
"""Bangun berkas broker per emiten PER TAHUN dari arsip mentah — nol jaringan.

Johan 22 Agu 2026: *"bisa gak bangun pondasi koding nya"* sambil backfill
BUMI berjalan. Ini lapis turunannya: arsip -> berkas yang dibaca halaman.

## Kenapa per tahun

Berkas ringkas `broker_harian/<KODE>.json` sengaja hanya 20 hari (ukuran repo).
Halaman Broker Summary versi kita butuh rentang sembarang — 6 bulan untuk
"floor price", setahun untuk kumulatif — dan satu berkas riwayat penuh per
emiten (±2.350 hari x 5 KB ≈ 12 MB) terlalu berat dimuat sekali klik.
Per tahun ≈ 0,75 MB mentah / ±280 KB gzip (terukur BUMI 2017, 237 hari, tanpa kolom
avg), dimuat malas hanya untuk tahun yang rentangnya menyentuh.

## Sumber kebenaran tetap arsip mentah

Berkas ini DITURUNKAN dari `_arsip-mentah/broker-harian/<KODE>/<tgl>.json`
lewat `panen_broker_harian.padatkan()` — pemadat yang sama dengan berkas
ringkas, jadi keduanya tak mungkin berbeda definisi. Menambah ruas = ubah
pemadat, jalankan ulang, tanpa jaringan.

Aturan ukuran (belum diputuskan Johan, dicatat di antrean P5): 963 emiten x
10 tahun x 0,75 MB ≈ 7 GB — MUSTAHIL untuk git. Berkas tahunan hanya untuk
emiten yang di-backfill; daftarnya adalah folder yang ada di arsip.

Pakai:
    python scripts/bangun_broker_tahunan.py            # semua emiten di arsip
    python scripts/bangun_broker_tahunan.py BUMI       # satu emiten
    python scripts/bangun_broker_tahunan.py --uji
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

import panen_broker_harian as ph  # noqa: E402
from emiten_lewati import dilewati  # noqa: E402


BENTUK_KODE = re.compile(r"^[A-Z][A-Z0-9]{2,4}$")


def periksa_kode(kode: str) -> str:
    """Kode emiten, atau mati dengan galat yang menyebutkan asalnya (#68).

    6 Sep 2026 18:27 pembangun ini melahirkan `broker_tahunan/8/index.json`
    berisi {"kode": "8", "tahun": [], "n_hari": 0}. Asalnya bukan arsip -
    `_arsip-mentah/broker-harian/` tak pernah punya direktori `8` - melainkan
    baris bat panen sore:

        bangun_broker_tahunan.py --tahun %TAHUN_KINI% --paralel 8

    dengan `%TAHUN_KINI%` KOSONG. Perintahnya menyusut jadi
    `--tahun --paralel 8`: penguraian argumen menelan `--paralel` sebagai NILAI
    dari `--tahun` (menghasilkan daftar tahun kosong), lalu `8` yang tersisa
    jatuh ke daftar positional dan diperlakukan sebagai kode emiten.

    Yang mahal bukan direktorinya - isinya kosong. Yang mahal bentuk
    kegagalannya: tak ada satu pun galat, dan kalau yang bocor lain kali
    sebuah kode yang MIRIP emiten, arsipnya akan terisi angka milik emiten
    yang salah dan tak seorang pun tahu. Karena itu penjaganya MEMATIKAN
    proses, bukan melewati kode itu diam-diam.

    3-5 huruf, bukan 4: kode bursa memang 4, tapi arsipnya memuat GOTOM (5)
    dan swauji memakai UJI (3). Yang dijaga bentuknya, bukan panjang yang
    kebetulan berlaku hari ini.
    """
    if not BENTUK_KODE.match(kode):
        raise SystemExit(
            f"kode emiten tak sah: {kode!r}. Bentuk yang diterima: 3-5 huruf/angka "
            f"berawal huruf (mis. BUMI). Kalau ini datang dari bat panen, "
            f"periksa nilai --tahun: nilai yang kosong membuat flag berikutnya "
            f"tertelan sebagai nilainya dan angkanya jatuh jadi kode emiten."
        )
    return kode


def tulis_retry(path, teks: str) -> None:
    """Windows: berkas yang sedang dibaca proses lain (Vite dev server
    mengawasi data-idx) sesekali menolak tulis dengan EINVAL/EACCES transien
    — terjadi nyata di BBKP/index.json saat backfill paralel 27 Agu. Coba
    ulang singkat sebelum menyerah."""
    import time
    for percobaan in range(5):
        try:
            path.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if percobaan == 4:
                raise
            time.sleep(0.3 * (percobaan + 1))

KELUARAN = AKAR / "data-idx" / "json" / "broker_tahunan"

# Ketetapan Johan 27 Agu 2026: BANGUN SAMPAI 2016 ("kalau tidak jadi beban
# besar yaa gpp sampai 2016 untuk data broker"). Ketetapan lama "sejak 2020"
# dibuat SAAT 2016-2019 belum dipanen — alasan itu gugur begitu panen mundur
# tuntas ke lantai sumber 2016-01-04 (26 Agu; 2016 = 100,00% hari). Dampak
# terukur pengawas: berkas broker_tahunan 6.651 -> ±10.499, data-idx ±25.900
# berkas / ±2,5 GB; batas 15.000 Vercel TIDAK berlaku (itu batas unggah CLI,
# deploy PAPAN berbasis git). Jangan panen ulang — mentahnya sudah lengkap.
TAHUN_PENUH = (
    "2016", "2017", "2018", "2019",
    "2020", "2021", "2022", "2023", "2024", "2025", "2026",
)


def bangun_emiten(kode: str, tahun_boleh: tuple[str, ...] = TAHUN_PENUH) -> dict[str, int]:
    """Tulis <KODE>/<tahun>.json untuk tiap tahun panen-penuh yang ada di arsip.

    Kembalikan {tahun: jumlah hari}. Hari yang arsipnya rusak/kosong dilewati
    dan dihitung — bukan dibuang diam-diam. Tahun di luar `tahun_boleh`
    dilewati tanpa dibaca sama sekali (hemat: arsipnya tak disentuh).
    """
    folder = ph.ARSIP / kode
    per_tahun: dict[str, dict] = defaultdict(dict)
    rusak = 0
    for p in sorted(folder.glob("????-??-??.json")):
        tgl = p.stem
        if tgl[:4] not in tahun_boleh:
            continue
        mentah = ph.baca(p)
        baris, ringkas = ph.padatkan(mentah) if mentah else ([], {})
        if not baris:
            rusak += 1
            continue
        ringkas["cocok_volume"] = ph.cocok_volume(ringkas["total_lot"], ph.volume_idx(kode, tgl))
        isi = {"ringkas": ringkas, "broker": ph.padat_baris(baris)}
        # Varian asing/nego: berkas saudara `<tgl>.<varian>.json`. Yang ada saja
        # yang disertakan — halaman membedakan "nol transaksi" (ada, kosong)
        # dari "belum dipanen" (kunci tak ada).
        for varian in ("asing", "nego"):
            pv = folder / ph.nama_arsip(tgl, varian)
            if pv.exists():
                mv = ph.baca(pv)
                bv, rv = ph.padatkan(mv) if mv else ([], {})
                isi[varian] = {"ringkas": rv, "broker": ph.padat_baris(bv)}
        per_tahun[tgl[:4]][tgl] = isi
    hasil = {}
    for tahun, hari in per_tahun.items():
        out = KELUARAN / kode / f"{tahun}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        tulis_retry(out, json.dumps({
            "kode": kode, "tahun": int(tahun), "kolom": ph.KOLOM,
            "sumber": "Stockbit marketdetectors — GROSS, reguler, semua investor",
            "dibangun": datetime.now(ph.WIB).isoformat(timespec="seconds"),
            "n_hari": len(hari),
            "hari": {t: hari[t] for t in sorted(hari)},
        }, ensure_ascii=False, separators=(",", ":")))
        hasil[tahun] = len(hari)
    if rusak:
        print(f"  {kode}: {rusak} berkas arsip kosong/rusak dilewati")
    # Indeks kecil supaya halaman tahu tahun mana yang tersedia tanpa menebak.
    # mkdir di sini juga, BUKAN cuma di perulangan tahun di atas: emiten yang
    # seluruh harinya kosong (GAMA — 385 hari, semuanya HTTP 200 berisi nol
    # karena memang tak bertransaksi) tak pernah masuk perulangan itu, jadi
    # foldernya tak pernah lahir dan penulisan indeks jatuh FileNotFoundError.
    # Indeks bertahun kosong itu justru yang benar: ia membedakan "sudah
    # dibangun, memang tak ada isinya" dari "belum pernah dibangun".
    idx = KELUARAN / kode / "index.json"
    idx.parent.mkdir(parents=True, exist_ok=True)
    # Daftar tahun dari DISK, bukan dari run ini — run ber-`--tahun` subset
    # (backfill 2016-2019) tak boleh menghapus 2020-2026 dari indeks.
    tahun_disk = sorted(int(q.stem) for q in (KELUARAN / kode).glob("????.json"))
    n_hari_disk = 0
    for th in tahun_disk:
        try:
            n_hari_disk += json.loads((KELUARAN / kode / f"{th}.json").read_text(encoding="utf-8")).get("n_hari", 0)
        except Exception:
            pass
    tulis_retry(idx, json.dumps({"kode": kode, "tahun": tahun_disk,
                                 "n_hari": n_hari_disk,
                                 "dibangun": datetime.now(ph.WIB).isoformat(timespec="seconds")}))
    return hasil


def swauji() -> int:
    import tempfile
    global KELUARAN
    asli_arsip, asli_out = ph.ARSIP, KELUARAN
    try:
        with tempfile.TemporaryDirectory() as d:
            ph.ARSIP = Path(d) / "arsip"; KELUARAN = Path(d) / "out"
            f = ph.ARSIP / "UJI"; f.mkdir(parents=True)
            mentah = {"data": {"broker_summary": {
                "brokers_buy": [{"netbs_broker_code": "AK", "blot": 10, "bval": 1000, "netbs_buy_avg_price": 100}],
                "brokers_sell": [{"netbs_broker_code": "AK", "slot": -4, "sval": -400, "netbs_sell_avg_price": 100}],
            }, "bandar_detector": {"average": 100}}}
            for tgl in ("2025-12-30", "2026-01-02", "2026-01-05"):
                (f / f"{tgl}.json").write_text(json.dumps(mentah), encoding="utf-8")
            (f / "2026-01-06.json").write_text("{}", encoding="utf-8")  # rusak
            (f / "2026-01-05.asing.json").write_text(json.dumps(mentah), encoding="utf-8")
            hasil = bangun_emiten("UJI")
            assert hasil == {"2025": 1, "2026": 2}, hasil
            b = json.loads((KELUARAN / "UJI" / "2026.json").read_text(encoding="utf-8"))
            assert list(b["hari"]) == ["2026-01-02", "2026-01-05"] and b["n_hari"] == 2
            assert b["hari"]["2026-01-02"]["broker"][0][:3] == ["AK", 10, 1000]
            assert "asing" in b["hari"]["2026-01-05"] and "asing" not in b["hari"]["2026-01-02"]
            assert b["hari"]["2026-01-05"]["asing"]["broker"][0][0] == "AK"
            idx = json.loads((KELUARAN / "UJI" / "index.json").read_text(encoding="utf-8"))
            assert idx["tahun"] == [2025, 2026] and idx["n_hari"] == 3
    finally:
        ph.ARSIP, KELUARAN = asli_arsip, asli_out

    # Penjaga bentuk kode (#68) - "8" pernah lolos jadi emiten dan
    # melahirkan direktori arsip kosong tanpa satu pun galat.
    assert periksa_kode("BUMI") == "BUMI"
    assert periksa_kode("UJI") == "UJI"      # swauji sendiri 3 huruf
    assert periksa_kode("GOTOM") == "GOTOM"  # ada di arsip, 5 huruf
    for buruk in ("8", "", "2026", "--paralel", "bumi.json", "AB"):
        try:
            periksa_kode(buruk)
        except SystemExit:
            pass
        else:
            raise AssertionError(f"kode {buruk!r} mestinya ditolak")
    print("8/8 lulus")
    return 0


def _kerja(pasang: tuple[str, tuple[str, ...]]) -> str:
    kode, tahun = pasang
    try:
        hasil = bangun_emiten(kode, tahun)
    except Exception as exc:  # satu emiten gagal jangan mematikan seluruh pool
        return f"{kode}: GAGAL {type(exc).__name__}: {exc}"
    return f"{kode}: " + ", ".join(f"{t}:{n}" for t, n in sorted(hasil.items())) if hasil else f"{kode}: arsip kosong"


def main() -> int:
    """Tanpa flag = seluruh TAHUN_PENUH. `--tahun 2016,2017` membatasi tahun
    yang DITULIS (tahun lain tak disentuh — dipakai backfill 2016-2019 supaya
    tak menulis ulang 2020-2026 yang sudah benar). `--paralel N` menyebar
    emiten ke N proses (IO-bound baca ribuan JSON arsip; serial terukur
    ±2 menit/8 emiten = ±30 jam untuk 962)."""
    if "--uji" in sys.argv:
        return swauji()
    if "-h" in sys.argv or "--help" in sys.argv:
        print(main.__doc__)
        return 0
    argv = sys.argv[1:]
    tahun: tuple[str, ...] = TAHUN_PENUH
    paralel = 1
    arg: list[str] = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--tahun":
            i += 1
            # Nilai yang hilang (variabel bat kosong) dulu menelan flag
            # BERIKUTNYA sebagai nilainya, dan sisa barisnya jatuh jadi kode
            # emiten - itu asal direktori `8` (#68). Sekarang mati di sini.
            if i >= len(argv) or argv[i].startswith("-"):
                raise SystemExit("--tahun butuh nilai, mis. --tahun 2026")
            tahun = tuple(t for t in argv[i].split(",") if t in TAHUN_PENUH)
            if not tahun:
                raise SystemExit(f"--tahun {argv[i]!r} tak memuat satu pun tahun yang dikenal")
        elif a == "--paralel":
            i += 1
            if i >= len(argv) or argv[i].startswith("-"):
                raise SystemExit("--paralel butuh nilai, mis. --paralel 8")
            paralel = max(1, int(argv[i]))
        elif a == "--lanjut":
            pass  # ditangani setelah daftar kode tersusun
        elif a.startswith("-"):
            # Flag tak dikenal DULU diabaikan diam-diam, dan itu mahal:
            # `--help` (flag yang wajar dicoba siapa pun) melewati semua
            # cabang di atas, tak menyisakan satu pun kode emiten di `arg`,
            # lalu daftar emiten jatuh ke "semua direktori arsip" — jalan
            # penuh 963 emiten x 11 tahun, ±30 jam serial, tanpa satu pun
            # kata peringatan. Salah ketik flag akan melakukan hal yang sama.
            raise SystemExit(
                f"flag tak dikenal: {a}. Yang ada: --tahun, --paralel, --lanjut, --uji. "
                "Tanpa flag = seluruh tahun, seluruh emiten."
            )
        else:
            arg.append(a)
        i += 1
    # Daftar-lewati ikut dipatuhi di sini (#75), bukan cuma di
    # `sinkron_emiten.py`. Pemanen broker aman karena membaca daftar emiten
    # yang sudah tersaring, tapi pembangun ini menyusun daftarnya dari NAMA
    # DIREKTORI arsip - jadi sisa arsip lama (GOTOM, dipanen 25-27 Agu,
    # sebelum keputusan Johan 28 Agu) tetap melahirkan direktori keluaran
    # kosong tiap kali ia jalan. Penjaga bentuk kode #68 tak menangkapnya:
    # bentuk GOTOM sah, yang tidak sah PERANNYA sebagai emiten biasa.
    kode_semua = [periksa_kode(a.upper()) for a in arg] or [
        periksa_kode(p.name) for p in sorted(ph.ARSIP.iterdir())
        if p.is_dir() and not dilewati(p.name)
    ]
    if arg:
        ditolak = [k for k in kode_semua if dilewati(k)]
        if ditolak:
            raise SystemExit(
                f"kode ada di daftar-lewati: {', '.join(ditolak)}. "
                "Lihat scripts/emiten_lewati.py untuk alasannya."
            )
    if "--lanjut" in argv:
        # Lewati emiten yang SUDAH punya salah satu berkas tahun yang diminta
        # (resume backfill). Emiten yang mentahnya memang kosong akan discan
        # ulang murah (glob saja).
        sisa = [k for k in kode_semua
                if not any((KELUARAN / k / f"{t}.json").exists() for t in tahun)]
        print(f"--lanjut: {len(kode_semua) - len(sisa)} dilewati, {len(sisa)} tersisa", flush=True)
        kode_semua = sisa
    tugas = [(k, tahun) for k in kode_semua]
    if paralel == 1:
        for t in tugas:
            print(_kerja(t), flush=True)
    else:
        from concurrent.futures import ProcessPoolExecutor
        with ProcessPoolExecutor(max_workers=paralel) as ex:
            for baris in ex.map(_kerja, tugas, chunksize=8):
                print(baris, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
