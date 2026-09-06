# -*- coding: utf-8 -*-
"""Probabilitas historis untuk SELURUH emiten — bukan hanya yang masuk Deep Dive.

Asal (Johan, 29 Agu 2026): *"P di isi kan datanya sudah ada tidak selalu pakai
deep dive biarkan dia berdiri disana sendiri"*.

Mesinnya (`arus-pasar/prob.py`) sudah ada dan sudah dipakai tiap Deep Dive.
Yang belum ada cuma jembatannya: mesin itu dipanggil dengan daftar ticker satu
edisi, jadi emiten di luar daftar itu tak pernah punya angkanya walau seluruh
bahannya tersimpan. Skrip ini memanggil mesin yang SAMA dengan daftar seluruh
emiten, lalu menulis hasilnya per emiten.

## Kenapa memanggil mesin yang sama, bukan menyalin rumusnya

Probabilitas yang dihitung dua tempat akan berbeda diam-diam begitu salah
satunya disesuaikan — dan bedanya baru ketahuan saat seseorang membandingkan
halaman dengan Deep Dive dan menemukan dua angka untuk hal yang sama. Skrip
ini nol rumus; ia cuma memuat, memanggil, dan menulis.

## Yang ikut ditulis, dan kenapa tak boleh dibuang

Bersama tiap probabilitas: jumlah sampel (`n`), berapa faktor yang cocok
(`cocok`/`total_fitur`), ANGKA DASAR pool (`base5`), lift, dan selang
kepercayaan (`ci5`). Tanpa kelimanya, "62%" tak berarti apa-apa — bisa jadi
62% dari 8 sampel dengan angka dasar 61%. Mesinnya memang menghasilkan
semuanya; tugas skrip ini tidak membuangnya di tengah jalan.

Uji luar sampel (`evaluasi`) ditulis SEKALI di index, bukan diulang di 962
berkas: ia menilai penaksirnya, bukan emitennya.

## Dua stempel, bukan satu

`dibangun` = kapan dihitung. `harga_pada` = tanggal bar harga terakhir yang
ikut dihitung. Keduanya WAJIB ada dan tak boleh disatukan: berkas bisa ditulis
ulang tanpa membawa bar baru (emiten disuspend, atau pembangun dijalankan dua
kali di hari yang sama), dan satu stempel saja membuat angka lama terbaca
sesegar hari ia ditulis. Nama `harga_pada` mengikuti `fundamental/*.json`
yang sudah memakai pasangan yang sama (`updated` + `harga_pada`) untuk
persoalan persis ini — bukan nama baru.

`harga_pada` di tiap berkas emiten adalah bar terakhir EMITEN ITU; yang di
`index.json` adalah bar terakhir PASAR. Bedanya justru yang berguna: emiten
yang berhenti diperdagangkan akan tertinggal dari index, dan itu terbaca
tanpa perlu membuka arsip harga.

Pakai:
    python scripts/bangun_prob.py            # seluruh emiten
    python scripts/bangun_prob.py BBCA BUMI  # sebagian, untuk uji cepat
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "arus-pasar"))

import prob  # noqa: E402  — jembatan ke mesin yang sudah ada

JSON = AKAR / "data-idx" / "json"
DIR_OHLC = JSON / "ohlc"
KELUARAN = JSON / "prob"
WIB = timezone(timedelta(hours=7))

#: Ruas yang ditulis per emiten. Sengaja daftar putih, bukan "semua kecuali":
#: `analisa_edisi` mengembalikan pool mentah dan larik faktor penuh yang
#: berukuran belasan kali hasil akhirnya, dan menulis semuanya × 962 emiten
#: menghasilkan ratusan megabita untuk data yang tak dibaca siapa pun.
RUAS = (
    "p5", "p3", "n", "cocok", "total_fitur",
    "base5", "lift5", "ci5",
    "pR1", "pR2", "pS1",
    "ret_p25", "ret_p50", "ret_p75",
    "pivot", "jarak", "fitur", "faktor",
    "volval", "vv_hit", "vv_n",
    "pool_n", "pool_emiten", "pool_sumber",
)


def muat_ohlc(kode_terpilih: list[str] | None) -> dict[str, list]:
    """Seri harga per emiten dalam bentuk yang diterima mesin."""
    out: dict[str, list] = {}
    berkas = sorted(DIR_OHLC.glob("*.json"))
    for p in berkas:
        kode = p.stem
        if kode.startswith("_") or kode == "IHSG":
            continue
        if kode_terpilih and kode not in kode_terpilih:
            continue
        d = prob._baca_ohlc_idx(p)  # noqa: SLF001 — jembatan sengaja memakai pembaca mesin
        if d:
            out[kode] = d
    return out


def main() -> int:
    pilih = [a.upper() for a in sys.argv[1:] if not a.startswith("-")]
    t0 = time.time()

    print("memuat arsip harga…")
    ohlc = muat_ohlc(pilih or None)
    if not ohlc:
        print("::error::tak ada satu pun seri harga terbaca")
        return 1
    print(f"  {len(ohlc)} emiten")

    print("menghitung (pool dibangun sekali, lalu dipakai ulang)…")
    hasil = prob.analisa_edisi(ohlc, sorted(ohlc.keys()))

    KELUARAN.mkdir(parents=True, exist_ok=True)
    ditulis, kosong = 0, []
    evaluasi = None
    pool_n = pool_emiten = None
    for kode, h in sorted(hasil.items()):
        if not h:
            # Seri terlalu pendek untuk jendela kejadian — bukan kegagalan,
            # dan emiten itu memang tak boleh punya angka.
            kosong.append(kode)
            continue
        evaluasi = evaluasi or h.get("evaluasi")
        pool_n = pool_n or h.get("pool_n")
        pool_emiten = pool_emiten or h.get("pool_emiten")
        isi = {k: h.get(k) for k in RUAS if k in h}
        isi["kode"] = kode
        isi["dibangun"] = datetime.now(WIB).isoformat(timespec="seconds")
        # Bar terakhir emiten INI — seri yang sama yang dipakai mesin (sudah
        # tersaring dari bar berharga nol), jadi stempelnya tak bisa melenceng
        # dari angka yang baru saja dihitung di atasnya.
        isi["harga_pada"] = ohlc[kode][-1][0]
        (KELUARAN / f"{kode}.json").write_text(
            json.dumps(isi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        ditulis += 1

    (KELUARAN / "index.json").write_text(
        json.dumps(
            {
                "dibangun": datetime.now(WIB).isoformat(timespec="seconds"),
                # Bar terakhir PASAR = bar termuda di antara seluruh emiten.
                # Ini yang dipakai mesin sebagai batas pool.
                "harga_pada": max((s[-1][0] for s in ohlc.values() if s), default=None),
                "n": ditulis,
                "tanpa_angka": kosong,
                "pool_n": pool_n,
                "pool_emiten": pool_emiten,
                # Uji luar sampel menilai PENAKSIRNYA, bukan emitennya — jadi
                # satu salinan di sini, bukan 962 salinan yang sama persis.
                "evaluasi": evaluasi,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(f"selesai {time.time() - t0:.0f}s: {ditulis} emiten -> {KELUARAN}")
    print(f"  harga sampai {max((s[-1][0] for s in ohlc.values() if s), default='?')}")
    if kosong:
        print(f"  {len(kosong)} tanpa angka (riwayat terlalu pendek): {', '.join(kosong[:8])}"
              + (" …" if len(kosong) > 8 else ""))
    if evaluasi:
        skill = evaluasi.get("skill")
        print(f"  uji luar sampel: n={evaluasi.get('n_uji')} · Brier {evaluasi.get('brier'):.4f} "
              f"vs dasar {evaluasi.get('brier_dasar'):.4f} · skill "
              f"{'—' if skill is None else f'{skill:+.4f}'}")
        if skill is not None and skill <= 0:
            # Dicetak sebagai peringatan, bukan disembunyikan: penaksir yang
            # tak mengalahkan angka dasar tetap ditulis, tapi halaman yang
            # memakainya berhak tahu.
            print("::warning::penaksir TIDAK lebih baik daripada angka dasar pada uji luar sampel")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
