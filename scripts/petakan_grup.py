# -*- coding: utf-8 -*-
"""Petakan emiten ke GRUP KONGLOMERAT dari data kepemilikan KSEI (#155).

Bedanya dengan daftar yang beredar: keanggotaan grup di sini **diturunkan dari
data**, bukan ditulis tangan. Yang ditulis tangan hanya POLA NAMA pengendali
tiap grup; sisanya dicocokkan ke `investor_map.json` (pemegang saham ≥1% dari
KSEI), dan tiap keanggotaan menyimpan buktinya sendiri — nama pemegang saham
yang cocok dan berapa persen.

Kenapa itu penting: daftar manual basi diam-diam. Kalau sebuah grup melepas
sahamnya, daftar tangan tetap menampilkannya sampai ada yang ingat memeriksa.
Di sini keanggotaan hilang sendiri begitu namanya tak lagi muncul di data KSEI
berikutnya.

Yang TIDAK bisa ditangkap cara ini: kepemilikan lewat lapis perusahaan yang
namanya tak menyebut grupnya sama sekali (mis. SPV bernama netral). Untuk itu
`TAMBAHAN_MANUAL` disediakan — isinya sedikit, dan tiap barisnya wajib
menyebut alasan.

Cara pakai:
  python scripts/petakan_grup.py            # tulis data-idx/json/grup_konglomerat.json
  python scripts/petakan_grup.py --lihat    # tampilkan hasil tanpa menulis
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
SUMBER = AKAR / "data-idx" / "json" / "investor_map.json"
KELUARAN = AKAR / "data-idx" / "json" / "grup_konglomerat.json"
OHLC = AKAR / "data-idx" / "json" / "ohlc"

# Pola nama pengendali per grup. Dicocokkan sebagai SUBSTRING pada nama
# pemegang saham yang sudah di-uppercase. Pola sengaja spesifik: "SALIM" saja
# akan menangkap "SALIM IVOMAS" (memang grup Salim) tapi juga nama orang lain
# yang kebetulan bermarga sama — karena itu pola diikat ke nama lengkap tokoh
# atau nama perusahaan induk yang khas.
GRUP = {
    "Bakrie": {
        "kode": "BKR",
        "pola": ["BAKRIE", "ABURIZAL", "ANINDYA NOVYAN", "LONG HAUL HOLDINGS"],
    },
    "Barito Pacific": {
        "kode": "BRT",
        "pola": ["PRAJOGO PANGESTU", "BARITO PACIFIC", "MAGNA RESOURCES"],
    },
    "Djarum": {
        "kode": "DJR",
        # "HARTONO" telanjang DIBUANG — marga umum, menangkap puluhan orang
        # yang tak ada hubungannya (DENNY HARTONO SH, HARTONO ATMADJA, ...).
        "pola": ["DWIMURIA", "DJARUM", "ROBERT BUDI HARTONO", "MICHAEL BAMBANG HARTONO"],
    },
    "Salim": {
        "kode": "SLM",
        "pola": ["ANTHONI SALIM", "SALIM IVOMAS", "INDOFOOD", "FIRST PACIFIC"],
    },
    "Sinar Mas": {
        "kode": "SMI",
        # "WIDJAJA" telanjang DIBUANG dengan alasan yang sama — marga ini
        # muncul di 30+ emiten yang bukan Sinar Mas.
        "pola": ["SINAR MAS", "SINARMAS", "PURIMAS SASMITA", "EKA TJIPTA",
                 "FRANKY OESMAN WIDJAJA", "MUKTAR WIDJAJA", "TEGUH GANDA WIDJAJA",
                 "INDRA WIDJAJA", "WIDJAJATUNGGAL"],
    },
    "MNC": {
        "kode": "MNC",
        "pola": ["HARY TANOESOEDIBJO", "MNC ", "GLOBAL MEDIACOM", "BHAKTI INVESTAMA"],
    },
    "Lippo": {
        "kode": "LPO",
        "pola": ["RIADY", "LIPPO"],
    },
    "Happy Hapsoro": {
        "kode": "HAP",
        "pola": ["HAPSORO", "RAJAWALI PARAMA", "BASIS UTAMA PRIMA"],
    },
    "Astra": {
        "kode": "AST",
        "pola": ["ASTRA INTERNATIONAL", "JARDINE", "CYCLE & CARRIAGE"],
    },
    "Thohir": {
        "kode": "THO",
        "pola": ["GARIBALDI THOHIR", "ERICK THOHIR", "SARATOGA", "TRINUGRAHA"],
    },
    "Haji Isam": {
        "kode": "ISM",
        "pola": ["JHONLIN", "SAMSUDIN ANDI ARSYAD", "ANDI SYAMSUDDIN ARSYAD"],
    },
}

# Emiten yang kepemilikannya nyata tapi TIDAK terbaca dari nama pemegang saham
# KSEI. Tiap baris wajib menyebut alasannya — tanpa alasan, tidak masuk.
TAMBAHAN_MANUAL: dict[str, list[tuple[str, str]]] = {
    # "Grup": [("KODE", "alasan"), ...]
}

# Ambang kepemilikan minimal supaya sebuah kecocokan dihitung. Di bawah ini
# namanya memang muncul, tapi pengaruhnya terlalu tipis untuk disebut
# "saham grup" — dan justru itu yang membuat daftar jadi ramai tanpa arti.
AMBANG_PCT = 1.0


def muat_emiten() -> list[dict]:
    return json.loads(SUMBER.read_text(encoding="utf-8"))


# Pola dicocokkan dengan BATAS KATA, bukan substring telanjang: "RIADY"
# sebagai substring ikut menangkap "WIRIADY WIDJAJA" yang bukan grup Lippo.
_POLA_RE = {
    g: [re.compile(rf"(?<![A-Z]){re.escape(p.strip())}(?![A-Z])") for p in cfg["pola"]]
    for g, cfg in GRUP.items()
}


def cocokkan(nama: str) -> list[str]:
    """Grup mana saja yang polanya cocok dengan satu nama pemegang saham."""
    n = nama.upper()
    return [g for g, pola in _POLA_RE.items() if any(r.search(n) for r in pola)]


def petakan(emiten: list[dict]) -> dict:
    hasil: dict[str, list[dict]] = {g: [] for g in GRUP}
    for e in emiten:
        kode = e.get("code")
        for h in e.get("holders") or []:
            pct = h.get("pct") or 0
            if pct < AMBANG_PCT:
                continue
            for g in cocokkan(h.get("name") or ""):
                # Satu emiten bisa cocok lewat beberapa pemegang saham di grup
                # yang sama — simpan yang persentasenya terbesar saja.
                lama = next((x for x in hasil[g] if x["kode"] == kode), None)
                if lama and lama["pct"] >= pct:
                    continue
                if lama:
                    hasil[g].remove(lama)
                hasil[g].append({
                    "kode": kode,
                    "lewat": h.get("name"),
                    "pct": round(pct, 2),
                    "kelas": h.get("cls"),
                })

    for g, tambahan in TAMBAHAN_MANUAL.items():
        for kode, alasan in tambahan:
            if any(x["kode"] == kode for x in hasil.get(g, [])):
                continue
            hasil.setdefault(g, []).append({"kode": kode, "lewat": None, "pct": None, "alasan": alasan})

    for g in hasil:
        hasil[g].sort(key=lambda x: (-(x["pct"] or 0), x["kode"]))
    return hasil


def harga_terakhir(kode: str) -> tuple[float | None, float | None]:
    """(close, %1D) dari berkas OHLC emiten. Ditempelkan ke berkas grup supaya
    halaman cukup mengunduh SATU berkas — memuat 80-an berkas OHLC dari
    peramban demi satu chip per emiten jelas tak sepadan."""
    p = OHLC / f"{kode}.json"
    if not p.exists():
        return None, None
    d = json.loads(p.read_text(encoding="utf-8"))["d"]
    if len(d) < 2:
        return (d[-1][4] if d else None), None
    kini, lalu = d[-1][4], d[-2][4]
    return kini, (round((kini - lalu) * 100 / lalu, 2) if lalu else None)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lihat", action="store_true", help="tampilkan hasil, jangan tulis berkas")
    arg = ap.parse_args()

    emiten = muat_emiten()
    hasil = petakan(emiten)

    for anggota in hasil.values():
        for a in anggota:
            a["harga"], a["pct1d"] = harga_terakhir(a["kode"])

    total = sum(len(v) for v in hasil.values())
    print(f"{len(emiten)} emiten dipindai · {total} keanggotaan di {len(hasil)} grup\n")
    for g, anggota in sorted(hasil.items(), key=lambda kv: -len(kv[1])):
        kode_grup = GRUP.get(g, {}).get("kode", "—")
        print(f"{g} ({kode_grup}) — {len(anggota)} emiten")
        for a in anggota:
            pct = f"{a['pct']:.2f}%" if a["pct"] is not None else "manual"
            print(f"    {a['kode']:6} {pct:>8}  lewat {a['lewat'] or a.get('alasan')}")
        print()

    if arg.lihat:
        return

    KELUARAN.write_text(json.dumps({
        "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sumber": "KSEI via investor_map.json — pemegang saham >=1%",
        "catatan": ("Keanggotaan diturunkan dari nama pemegang saham, bukan daftar tangan. "
                    "Tiap baris menyimpan buktinya: lewat siapa dan berapa persen."),
        "ambang_pct": AMBANG_PCT,
        "harga_per": max((a.get("_tgl") or "" for g in hasil.values() for a in g), default=None),
        "grup": {g: {"kode": GRUP[g]["kode"], "anggota": a} for g, a in hasil.items()},
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"-> {KELUARAN.relative_to(AKAR)} ({KELUARAN.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
