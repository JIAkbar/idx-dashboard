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
from bar_berisi import tutup_dan_ubah

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


def harga_terakhir(kode: str) -> tuple[float | None, float | None, str | None]:
    """(close, %1D) dari berkas OHLC emiten. Ditempelkan ke berkas grup supaya
    halaman cukup mengunduh SATU berkas — memuat 80-an berkas OHLC dari
    peramban demi satu chip per emiten jelas tak sepadan."""
    p = OHLC / f"{kode}.json"
    if not p.exists():
        return None, None, None
    d = json.loads(p.read_text(encoding="utf-8"))["d"]
    # Bar hari BERJALAN ada sejak pagi tapi masih kosong (volume 0, tutup =
    # tutup kemarin). Mengambilnya apa adanya membuat SELURUH anggota tampil
    # 0,00% — terjadi 3 Sep 2026, 82 dari 82 anggota, tanpa satu pun galat.
    tutup, ubah, tgl = tutup_dan_ubah(d)
    return tutup, ubah, tgl


# ── Arus dana per anggota: OHLCV + 6 varian broker ──────────────────────────
# Johan 3 Sep 2026: *"data nya di sambungin ke data realtime 6 varian + OHLCV"*.
# Ditempel ke berkas grup (82 anggota saja) supaya halaman cukup mengunduh SATU
# berkas — memuat 82 berkas broker dari peramban demi satu ubin jelas tak
# sepadan, alasan yang sama dengan `harga_terakhir` di atas.
BROKER = AKAR / "data-idx" / "json" / "broker_harian"
VARIAN_TAMPIL = ["broker", "asing", "nego", "nego-asing", "tunai", "tunai-asing"]
# Nama yang dipakai berkas untuk varian reguler adalah `broker`; di layar ia
# disebut "reguler" supaya sejajar dengan lima lainnya.


def _net(baris: list | None) -> float:
    """Σ(beli_nilai − jual_nilai) satu varian. Untuk varian ALL angkanya nol
    menurut definisi (tiap transaksi punya dua sisi); yang bermakna adalah
    varian ASING — di situ hanya sisi asing yang tercatat, jadi netnya nyata."""
    if not baris:
        return 0.0
    return sum((b[2] or 0) - (b[4] or 0) for b in baris if len(b) > 4)


def arus_emiten(kode: str, tanggal: str | None) -> dict:
    """Volume/nilai OHLC + ringkasan 6 varian broker untuk satu hari."""
    kosong = {"vol": None, "nilai": None, "net_asing": None,
              "accdist": None, "varian_ada": [], "top3_pct": None}
    if not tanggal:
        return kosong
    o = OHLC / f"{kode}.json"
    vol = nilai = None
    if o.exists():
        for b in reversed(json.loads(o.read_text(encoding="utf-8"))["d"]):
            if b and b[0] == tanggal:
                vol = b[5]
                nilai = round(b[4] * b[5]) if b[4] and b[5] else None
                break
    bp = BROKER / f"{kode}.json"
    if not bp.exists():
        return {**kosong, "vol": vol, "nilai": nilai}
    hari = (json.loads(bp.read_text(encoding="utf-8")).get("hari") or {}).get(tanggal) or {}
    ada = [v for v in VARIAN_TAMPIL if hari.get(v)]
    rg = hari.get("ringkas") or {}
    return {
        "vol": vol,
        "nilai": nilai,
        # Net asing dalam rupiah — varian ASING, satu-satunya yang netnya
        # bermakna (lihat `_net`).
        "net_asing": round(_net((hari.get("asing") or {}).get("broker")
                                if isinstance(hari.get("asing"), dict) else None)) or None,
        "accdist": rg.get("accdist"),
        "top3_pct": rg.get("top3_pct"),
        "varian_ada": ada,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lihat", action="store_true", help="tampilkan hasil, jangan tulis berkas")
    arg = ap.parse_args()

    emiten = muat_emiten()
    hasil = petakan(emiten)

    for anggota in hasil.values():
        for a in anggota:
            a["harga"], a["pct1d"], a["_tgl"] = harga_terakhir(a["kode"])
            a.update(arus_emiten(a["kode"], a["_tgl"]))

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
