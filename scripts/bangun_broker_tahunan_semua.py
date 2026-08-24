# -*- coding: utf-8 -*-
"""Bangun berkas broker tahunan untuk SELURUH emiten di arsip, paralel.

Kenapa terpisah dari `bangun_broker_tahunan.py`: yang itu memproses satu
emiten per panggilan dan seri. Terukur 24 Agu 2026 atas 10 emiten khas:
10,9 detik/emiten, jadi 962 emiten seri = 175 menit. Beban ini murni CPU +
baca cakram (mengurai ±2,2 juta berkas JSON arsip) — nol jaringan, tak
menyentuh token Stockbit sama sekali — sehingga membaginya ke banyak proses
benar-benar membagi waktunya. Mesin ini 16 inti; 8 proses ≈ 22 menit.

Memakai proses, bukan thread, karena penghambatnya penguraian JSON di
Python — GIL membuat thread tak menolong di sini.

Membersihkan juga berkas tahun yang TIDAK lagi dibangun (lihat
`TAHUN_PENUH`): tanpa itu, sisa gelombang lama (BUMI 2017-2024, ±20 emiten
2020-2024) tetap tergeletak di keluaran dan terbaca halaman sebagai tahun
yang tersedia, padahal justru tahun-tahun itu yang ditutup.

Pakai:
    python scripts/bangun_broker_tahunan_semua.py            # 8 proses
    python scripts/bangun_broker_tahunan_semua.py --proses 12
    python scripts/bangun_broker_tahunan_semua.py --uji      # 3 emiten saja
"""
from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))


def _satu(kode: str) -> tuple[str, dict, int]:
    """Dijalankan di proses anak. Impor di dalam supaya tiap proses mandiri."""
    import bangun_broker_tahunan as bt

    try:
        hasil = bt.bangun_emiten(kode)
    except Exception as e:  # satu emiten gagal tak boleh menjatuhkan sisanya
        return kode, {"__galat__": str(e)}, 0
    # Buang berkas tahun yang tak lagi dibangun — sisa gelombang lama.
    dibuang = 0
    folder = bt.KELUARAN / kode
    if folder.exists():
        for p in folder.glob("[0-9][0-9][0-9][0-9].json"):
            if p.stem not in hasil:
                p.unlink()
                dibuang += 1
    return kode, hasil, dibuang


def main() -> int:
    import bangun_broker_tahunan as bt

    a = argparse.ArgumentParser()
    a.add_argument("--proses", type=int, default=8)
    a.add_argument("--uji", action="store_true")
    args = a.parse_args()

    kodes = sorted(d.name for d in bt.ph.ARSIP.iterdir() if d.is_dir())
    if args.uji:
        kodes = kodes[:3]
    print(f"{len(kodes)} emiten · {args.proses} proses · tahun {', '.join(bt.TAHUN_PENUH)}")

    t0 = time.time()
    n_ok = n_kosong = n_galat = n_buang = 0
    tahun_total: dict[str, int] = {}
    with ProcessPoolExecutor(max_workers=args.proses) as ex:
        tugas = {ex.submit(_satu, k): k for k in kodes}
        for i, fut in enumerate(as_completed(tugas), 1):
            kode, hasil, dibuang = fut.result()
            n_buang += dibuang
            if "__galat__" in hasil:
                n_galat += 1
                print(f"  GALAT {kode}: {hasil['__galat__']}")
            elif hasil:
                n_ok += 1
                for t, n in hasil.items():
                    tahun_total[t] = tahun_total.get(t, 0) + n
            else:
                n_kosong += 1
            if i % 50 == 0 or i == len(kodes):
                lewat = time.time() - t0
                sisa = lewat / i * (len(kodes) - i)
                print(f"  [{i}/{len(kodes)}] {lewat/60:.1f} mnt · sisa ±{sisa/60:.1f} mnt", flush=True)

    print()
    print(f"SELESAI {(time.time()-t0)/60:.1f} menit — {n_ok} emiten berisi, "
          f"{n_kosong} kosong (tak bertransaksi), {n_galat} galat, "
          f"{n_buang} berkas tahun lama dibuang")
    for t in sorted(tahun_total):
        print(f"  {t}: {tahun_total[t]:,} hari-emiten")
    return 1 if n_galat else 0


if __name__ == "__main__":
    raise SystemExit(main())
