# -*- coding: utf-8 -*-
"""Runner backfill Broker Summary GROSS untuk BANYAK emiten, urut likuiditas.

Johan 22-23 Agu 2026: bangun pondasi broker summary. Script ini MEMBUNGKUS
`backfill_broker_harian.py` (mesin per-emiten yang sudah terbukti — BUMI
2.310/2.372 hari) supaya jalan berurutan untuk 963 emiten. Logika ambil data
(`panen_broker_harian.jalankan`) TIDAK ditulis ulang, hanya diorkestrasi.

## Urutan kerja: likuiditas dulu

Kunci urut = rata-rata `value` (nilai transaksi rupiah, pasar reguler) 20
hari terakhir dari `data-idx/json/asing/<KODE>.json` — ruas itu Value IDX
ASLI (bukan taksiran), sudah ada di sana sebagai hasil panen aliran asing.
`data-idx/json/ringkas.json` yang disebut di brief tidak ada di repo ini.
Emiten tanpa berkas asing jatuh ke fallback `volume x close` dari
`ohlc/<KODE>.json`; yang dua-duanya kosong ditaruh paling belakang.

## Resume

Sebelum menembak jaringan, tiap emiten dihitung dulu hari bursa yang SUDAH
lengkap di `_arsip-mentah/broker-harian/<KODE>/` (lewat
`panen_broker_harian.jalankan`, yang melewati hari yang arsipnya sudah ada —
ini jalan tiap kali, bukan cuma saat `--lanjut`). `--lanjut` menambah jalan
pintas: emiten yang `_progres_backfill_broker.json` sudah tandai "selesai"
dilewati tanpa dihitung ulang sama sekali.

Pakai:
    python scripts/backfill_broker_massal.py --swauji
    python scripts/backfill_broker_massal.py --batas 2 --dari 2026-08-18 --sampai 2026-08-21
    python scripts/backfill_broker_massal.py --paralel 8 --lanjut
"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

import panen_broker_harian as ph  # noqa: E402
import backfill_broker_harian as bbh  # noqa: E402

DIR_JSON = AKAR / "data-idx" / "json"
DIR_ASING = DIR_JSON / "asing"
DAFTAR = DIR_JSON / "daftar_emiten.json"
PROGRES = DIR_JSON / "_progres_backfill_broker.json"
WIB = timezone(timedelta(hours=7))

# ponytail: refresh token Stockbit lintas thread belum dikunci (margin 1 jam
# di stockbit_token.py membuat tabrakan jarang). Kalau kena, emiten itu
# tercatat 'gagal'/'sebagian' dan aman diulang jalan berikutnya (arsip yang
# sudah ada dilewati). Upgrade: threading.Lock global di sekeliling
# token_segar() kalau tabrakan ternyata sering di paralel tinggi.


def nilai_transaksi_20hari(kode: str) -> float | None:
    """Rata-rata nilai transaksi reguler 20 hari terakhir; None = tak ada sumber."""
    d = ph.baca(DIR_ASING / f"{kode}.json")
    if d and d.get("d"):
        nilai = [b[4] for b in d["d"][-20:] if b and len(b) > 4 and b[4] is not None]
        if nilai:
            return sum(nilai) / len(nilai)
    d2 = ph.baca(ph.DIR_OHLC / f"{kode}.json")
    if d2 and d2.get("d"):
        nilai = [b[4] * b[5] for b in d2["d"][-20:] if b and len(b) > 5 and b[4] and b[5]]
        if nilai:
            return sum(nilai) / len(nilai)
    return None


def urutkan_likuiditas(emiten: list[dict]) -> list[tuple[dict, float | None]]:
    """(emiten, nilai) urut nilai transaksi menurun; tanpa data -> belakang, urutan asal stabil."""
    berpasangan = [(e, nilai_transaksi_20hari(e["kode"])) for e in emiten]
    berpasangan.sort(key=lambda p: (p[1] is None, -(p[1] or 0)))
    return berpasangan


def lengkap_hari(folder: Path, tanggal: str, varian: list[str]) -> bool:
    return all((folder / ph.nama_arsip(tanggal, v)).exists() for v in varian)


def tulis_progres_atomik(path: Path, data: dict) -> None:
    """Tulis-lalu-ganti-nama supaya pembaca luar tak pernah lihat JSON separuh.

    `os.replace` di Windows menolak WinError 5 saat tujuannya sedang dipegang
    proses lain SESAAT (paralel 192, 27 Agu 2026: crash di menit pertama
    padahal panennya sendiri sehat — 5.777 arsip tanggal 26 selamat). Progres
    itu catatan bantu, bukan data: coba ulang sebentar, dan kalau tetap
    ditolak LEWATI — jangan matikan panen demi berkas progres."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    for percobaan in range(6):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05 * (percobaan + 1))
    with contextlib.suppress(OSError):
        tmp.unlink()


def proses_emiten(kode: str, dari: str, sampai: str, varian_list: list[str],
                   varian_str: str, jeda: float) -> dict:
    """Backfill satu emiten — pola sama seperti `backfill_broker_harian.main()`."""
    mulai = time.time()
    tanggal = bbh.hari_bursa(kode, dari, sampai)
    folder = ph.ARSIP / kode
    sudah = {t for t in tanggal if lengkap_hari(folder, t, varian_list)}
    sisa = [t for t in tanggal if t not in sudah]
    ok = gagal = beruntun = 0
    for i, t in enumerate(sisa):
        try:
            rc = ph.jalankan(SimpleNamespace(tanggal=t, hanya=kode, batas=None,
                                              jeda=jeda, ulang=False, varian=varian_str))
            if rc == 0:
                ok += 1
                beruntun = 0
            else:
                gagal += 1
                beruntun += 1
        except SystemExit as e:  # token mati/ditolak — berhenti untuk emiten ini
            gagal += len(sisa) - i
            print(f"  {kode}: BERHENTI di {t}: {e}")
            break
        except Exception as e:  # noqa: BLE001 — satu hari gagal tak boleh menghentikan yang lain
            gagal += 1
            beruntun += 1
            print(f"  {kode} {t}: GAGAL {type(e).__name__}: {str(e)[:120]}")
        if beruntun >= 3:  # mundur-bertahap saat galat jaringan beruntun
            time.sleep(min(60.0, jeda * (2 ** beruntun)))
    total = len(tanggal)
    hari_tersimpan = len(sudah) + ok
    if total == 0 or hari_tersimpan >= total:
        status = "selesai"
    elif hari_tersimpan == 0:
        status = "gagal"
    else:
        status = "sebagian"
    return {
        "kode": kode, "status": status, "hari_tersimpan": hari_tersimpan,
        "hari_gagal": gagal, "detik": round(time.time() - mulai, 1),
        # Rentang WAJIB ikut tersimpan. Tanpa ini, "selesai" dari uji rentang
        # pendek terbaca sebagai selesai untuk rentang panjang, dan `--lanjut`
        # diam-diam melewati emiten yang belum dipanen (kejadian 23 Agu 2026:
        # TPIA & BBCA tercatat selesai dengan 4 hari, detik 0.0).
        "dari": dari, "sampai": sampai, "varian": varian_str,
        "waktu_selesai": datetime.now(WIB).isoformat(timespec="seconds"),
    }


def buat_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Backfill broker summary massal, urut likuiditas")
    ap.add_argument("--dari", default="2020-01-02")
    ap.add_argument("--sampai", default=None, help="bawaan: bar OHLC BBCA terakhir, atau hari ini")
    ap.add_argument("--varian", default="reguler,asing,nego")
    ap.add_argument("--paralel", type=int, default=4)
    ap.add_argument("--mulai-dari", dest="mulai_dari", default=None,
                     help="kode emiten, mulai dari sini di urutan likuiditas")
    ap.add_argument("--batas", type=int, default=None, help="maksimum emiten yang dikerjakan")
    ap.add_argument("--lanjut", action="store_true", help="lewati emiten yang progresnya 'selesai'")
    ap.add_argument("--jeda", type=float, default=0.8)
    ap.add_argument("--swauji", action="store_true")
    return ap


def main() -> int:
    a = buat_parser().parse_args()
    if a.swauji:
        return swauji()

    try:
        sampai = a.sampai or ph.tanggal_bawaan()
    except SystemExit:
        sampai = datetime.now(WIB).strftime("%Y-%m-%d")
    varian_list = [v.strip() for v in a.varian.split(",") if v.strip()]
    for v in varian_list:
        if v not in ph.VARIAN:
            raise SystemExit(f"varian tak dikenal: {v} (pilihan: {', '.join(ph.VARIAN)})")

    daftar = (ph.baca(DAFTAR) or {}).get("emiten") or []
    print(f"Mengurutkan {len(daftar)} emiten berdasar rata-rata nilai transaksi 20 hari terakhir...")
    urut = urutkan_likuiditas(daftar)
    print("10 teratas: " + ", ".join(
        f"{e['kode']}({n:,.0f})" if n is not None else f"{e['kode']}(-)" for e, n in urut[:10]))

    kode_urut = [e["kode"] for e, _ in urut]
    if a.mulai_dari:
        target = a.mulai_dari.strip().upper()
        if target not in kode_urut:
            raise SystemExit(f"--mulai-dari {target}: kode tak ditemukan di daftar emiten")
        kode_urut = kode_urut[kode_urut.index(target):]
    if a.batas:
        kode_urut = kode_urut[: a.batas]

    progres_data = {"mulai": datetime.now(WIB).isoformat(timespec="seconds"), "diperbarui": None,
                     "total_emiten": len(kode_urut), "dari": a.dari, "sampai": sampai,
                     "varian": a.varian, "emiten": {}}
    if a.lanjut and PROGRES.exists():
        lama = ph.baca(PROGRES) or {}
        # "selesai" hanya sah kalau rentang & varian entri lama SAMA dengan
        # jalan ini. Entri tanpa ruas rentang berasal dari versi lama skrip
        # (atau dari uji rentang pendek) dan tak boleh dipercaya.
        progres_data["emiten"] = {
            k: v for k, v in (lama.get("emiten") or {}).items()
            if v.get("status") == "selesai"
            and v.get("dari") == a.dari and v.get("sampai") == sampai
            and v.get("varian") == a.varian
        }

    sudah_selesai = set(progres_data["emiten"]) if a.lanjut else set()
    dikerjakan = [k for k in kode_urut if k not in sudah_selesai]
    if sudah_selesai:
        print(f"{len(kode_urut) - len(dikerjakan)} emiten sudah 'selesai' di progres lama dilewati")
    print(f"Mengerjakan {len(dikerjakan)} emiten, {a.dari}..{sampai}, "
          f"varian [{a.varian}], paralel {a.paralel}")

    kunci = threading.Lock()
    n_selesai = 0
    mulai_jalan = time.time()
    gagal_semua: list[str] = []

    def satu(kode: str) -> dict:
        return proses_emiten(kode, a.dari, sampai, varian_list, a.varian, a.jeda)

    with ThreadPoolExecutor(max_workers=max(1, a.paralel)) as kolam:
        tugas = {kolam.submit(satu, k): k for k in dikerjakan}
        for depan in as_completed(tugas):
            hasil = depan.result()
            with kunci:
                n_selesai += 1
                progres_data["emiten"][hasil["kode"]] = hasil
                progres_data["diperbarui"] = datetime.now(WIB).isoformat(timespec="seconds")
                tulis_progres_atomik(PROGRES, progres_data)
                if hasil["status"] != "selesai":
                    gagal_semua.append(hasil["kode"])
                laju = (time.time() - mulai_jalan) / n_selesai
                sisa_jam = laju * (len(dikerjakan) - n_selesai) / 3600
                tanda = f" [{hasil['status'].upper()}]" if hasil["status"] != "selesai" else ""
                print(f"[{n_selesai}/{len(dikerjakan)}] {hasil['kode']} {a.dari}..{sampai} · "
                      f"{hasil['hari_tersimpan']} hari · {len(varian_list)} varian · "
                      f"{hasil['detik']:.0f} dtk · sisa ±{sisa_jam:.1f} jam{tanda}")

    ringkas_gagal = (f" — {len(gagal_semua)} bermasalah: {', '.join(gagal_semua[:20])}"
                      + ("..." if len(gagal_semua) > 20 else "")) if gagal_semua else ""
    print(f"\nSELESAI: {n_selesai} emiten dalam {(time.time()-mulai_jalan)/60:.1f} menit{ringkas_gagal}")
    return 1 if gagal_semua else 0


def swauji() -> int:
    import tempfile

    global DIR_ASING
    asli_asing, asli_ohlc = DIR_ASING, ph.DIR_OHLC
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / "asing").mkdir()
        (d / "ohlc").mkdir()
        DIR_ASING = d / "asing"
        ph.DIR_OHLC = d / "ohlc"
        try:
            def tulis_asing(kode: str, nilai_list: list[int]) -> None:
                isi = {"d": [[f"2026-08-{i+1:02d}", 0, 0, 0, v, 0] for i, v in enumerate(nilai_list)]}
                (DIR_ASING / f"{kode}.json").write_text(json.dumps(isi), encoding="utf-8")

            # 1) Urutan likuiditas: nilai besar duluan, tanpa data (CCCC) di belakang.
            tulis_asing("AAAA", [1000] * 20)
            tulis_asing("BBBB", [3000] * 20)
            urut = urutkan_likuiditas([{"kode": "AAAA"}, {"kode": "BBBB"}, {"kode": "CCCC"}])
            assert [e["kode"] for e, _ in urut] == ["BBBB", "AAAA", "CCCC"], urut
            assert nilai_transaksi_20hari("AAAA") == 1000.0
            assert nilai_transaksi_20hari("CCCC") is None

            # Fallback ke ohlc (volume x close) kalau berkas asing tak ada.
            (ph.DIR_OHLC / "DDDD.json").write_text(
                json.dumps({"d": [["2026-08-01", 0, 0, 0, 100, 50]] * 20}), encoding="utf-8")
            assert nilai_transaksi_20hari("DDDD") == 5000.0

            # 2) Deteksi "sudah lengkap" per varian.
            arsip_tmp = d / "arsip" / "ZZZZ"
            arsip_tmp.mkdir(parents=True)
            (arsip_tmp / "2026-08-20.json").write_text("{}", encoding="utf-8")
            (arsip_tmp / "2026-08-20.asing.json").write_text("{}", encoding="utf-8")
            assert lengkap_hari(arsip_tmp, "2026-08-20", ["reguler", "asing"]) is True
            assert lengkap_hari(arsip_tmp, "2026-08-20", ["reguler", "asing", "nego"]) is False
            assert lengkap_hari(arsip_tmp, "2026-08-21", ["reguler"]) is False

            # 3) Penulisan progres atomik — tak menyisakan berkas .tmp.
            p = d / "progres.json"
            tulis_progres_atomik(p, {"a": 1})
            assert json.loads(p.read_text(encoding="utf-8")) == {"a": 1}
            assert not (p.parent / (p.name + ".tmp")).exists()
            tulis_progres_atomik(p, {"a": 2})
            assert json.loads(p.read_text(encoding="utf-8")) == {"a": 2}
        finally:
            DIR_ASING, ph.DIR_OHLC = asli_asing, asli_ohlc

    # 4) Parsing argumen — bawaan dan override.
    ap = buat_parser()
    a0 = ap.parse_args([])
    assert a0.dari == "2020-01-02" and a0.paralel == 4 and a0.varian == "reguler,asing,nego"
    assert a0.mulai_dari is None and a0.batas is None and a0.lanjut is False
    a1 = ap.parse_args(["--mulai-dari", "BUMI", "--batas", "5", "--paralel", "8", "--lanjut"])
    assert a1.mulai_dari == "BUMI" and a1.batas == 5 and a1.paralel == 8 and a1.lanjut is True

    print("11/11 lulus")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
