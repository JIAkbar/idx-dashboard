"""Tinjauan H+5 otomatis untuk tiap Deep Dive — menutup lingkaran Analisa PAPAN v1.

Johan 22 Agu 2026 meminta U1 dijelaskan lalu dikerjakan. Aturan Analisa PAPAN
v1 §5 mewajibkan tiap Deep Dive ditinjau ulang lima hari bursa sesudah tanggal
datanya: level mana yang tercapai dan dalam urutan apa, invalidasi tersentuh
atau tidak. Sampai sekarang itu dikerjakan tangan — artinya bergantung ingatan,
dan yang gagal gampang tak pernah dicatat.

## Yang dibaca

`arus-pasar/bedah/<TICKER>-<tanggal>.json` — blok `em.skenario` (bull/retest/
invalid, tiap satu punya `konfirmasi` & `rute` berisi ANGKA) dan `em.pivot`
(P, R1-R3, S1-S3). Kalau skenarionya tak menyebut angka sama sekali, tinjauan
untuk berkas itu DILEWATI dengan alasan tertulis — bukan ditebak dari narasi.

## Cara menilai — tak ada tafsir

1. Level diambil dari `em.pivot` (sumber angka yang sama dengan yang dicetak
   di terbitan), dan dari angka yang muncul di teks konfirmasi/rute.
2. Untuk tiap level: TERCAPAI kalau high salah satu bar H+1..H+5 >= level
   (untuk level di atas harga) atau low <= level (untuk yang di bawah).
3. Urutannya dicatat: level pertama yang tersentuh, lalu berikutnya. "Terbukti"
   hanya kalau konfirmasi bull tercapai DAN invalidasi tidak pernah tersentuh
   — dua syarat, bukan satu.
4. Semua diukur dari bar SESUDAH tanggal data (`bd["tanggal"]`), tak pernah
   dari bar yang sudah masuk terbitan.

## Keluaran

- `data-idx/json/tinjauan_deepdive.json` — satu baris per terbitan, siap
  dijumlahkan nanti untuk kalibrasi (U2).
- Ringkasan tabel Markdown ke stdout, siap ditempel ke §5
  `docs/analisa-papan-v1.md`. Sengaja TIDAK menulis ke dokumen itu sendiri:
  log §5 memuat kalimat analis yang tak boleh ditimpa mesin.

Pakai:
    python scripts/riset/tinjau_deepdive.py           # semua terbitan
    python scripts/riset/tinjau_deepdive.py BUMI      # satu ticker
    python scripts/riset/tinjau_deepdive.py --uji     # swauji
"""
from __future__ import annotations

import io
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# Keluaran dipaksa UTF-8. Tanpa ini skrip MATI dengan UnicodeEncodeError
# begitu dijalankan di luar konsol UTF-8 - panah dan tanda kutip lengkung di
# laporannya cukup untuk menjatuhkannya. Ketahuan 7 Sep 2026 saat hendak
# menjadwalkannya: dijalankan dari bat, ia akan gagal TIAP JALAN. Diperbaiki
# di sumbernya, bukan lewat PYTHONIOENCODING di pemanggil - variabel
# lingkungan bisa lupa dipasang di pemanggil berikutnya, baris ini tidak.
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

AKAR = Path(__file__).resolve().parent.parent.parent
DIR_BEDAH = AKAR / "arus-pasar" / "bedah"
DIR_OHLC = AKAR / "data-idx" / "json" / "ohlc"
KELUARAN = AKAR / "data-idx" / "json" / "tinjauan_deepdive.json"

HORIZON = 5  # hari bursa


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def angka_dari(teks: str) -> list[float]:
    """Angka harga di dalam kalimat skenario. Format Indonesia: '1.025' ribuan,
    '1.025,5' desimal. Angka < 10 diabaikan — itu hampir selalu nomor urut atau
    persen, bukan harga."""
    if not isinstance(teks, str):
        return []
    keluar = []
    for m in re.findall(r"\d[\d.]*(?:,\d+)?", teks):
        try:
            v = float(m.replace(".", "").replace(",", "."))
        except ValueError:
            continue
        if v >= 10:
            keluar.append(v)
    return keluar


def bar_sesudah(kode: str, tanggal: str, n: int = HORIZON) -> list:
    d = baca(DIR_OHLC / f"{kode}.json")
    baris = [b for b in (d or {}).get("d", []) if b and b[4]]
    return [b for b in baris if b[0] > tanggal][:n]


def tinjau(bd: dict) -> dict | None:
    """Satu terbitan → hasil tinjauan, atau None kalau tak bisa dinilai."""
    kode = bd.get("ticker")
    tanggal = bd.get("tanggal")
    em = dict(bd.get("em") or {})
    # Terbitan yang menumpang edisi harian menyimpan skenario & pivot DI EDISI
    # ITU, bukan di berkas bedahnya (mis. DSSA 14 Agu, `edisi_sumber` 13 Agu).
    # Tanpa ini mereka dilaporkan "tak bisa dinilai" padahal datanya lengkap —
    # dan justru terbitan seperti itulah yang paling sering ditinjau.
    if bd.get("edisi_sumber") and not em.get("pivot"):
        ed = baca(AKAR / "arus-pasar" / "edisi" / f'{bd["edisi_sumber"]}.json')
        sumber = next((e for e in (ed or {}).get("emiten", []) if e.get("ticker") == kode), None)
        if sumber:
            digabung = dict(sumber)
            digabung.update(em)          # blok `em` bedah tetap menang
            em = digabung
    pivot = em.get("pivot") or {}
    sk = em.get("skenario") or {}
    if not kode or not tanggal:
        return None

    depan = bar_sesudah(kode, tanggal)
    if not depan:
        return {"kode": kode, "tanggal": tanggal, "status": "belum ada data",
                "alasan": f"belum ada hari bursa sesudah {tanggal}"}
    # Hari belum genap TETAP dinilai, tapi statusnya ditandai SEMENTARA berikut
    # jumlah harinya. Menolak menilai sama sekali membuat tinjauan menganggur
    # justru di hari-hari yang paling ingin dibaca; menilai tanpa penanda
    # membuat H+4 terbaca seolah H+5 — dan itu persis yang terjadi pada klaim
    # "terbukti" BUMI & DSSA 21 Agu 2026 (17 Agu libur HUT RI, jadi hari kelima
    # baru jatuh 24 Agu). Statusnya masih bisa berubah: invalidasi belum lewat.
    belum_genap = len(depan) < HORIZON

    # Level: dari pivot (sumber angka terbitan) + angka yang disebut skenario.
    bull = sk.get("bull") or {}
    invalid = sk.get("invalid") or sk.get("bear") or {}
    lv_bull = angka_dari(bull.get("konfirmasi", "")) + angka_dari(bull.get("rute", ""))
    lv_invalid = angka_dari(invalid.get("konfirmasi", "")) or (
        angka_dari(em.get("invalidation", "")))
    if not lv_bull and pivot.get("R1"):
        lv_bull = [pivot["R1"]]
    if not lv_invalid and pivot.get("S1"):
        lv_invalid = [pivot["S1"]]
    if not lv_bull and not lv_invalid:
        return {"kode": kode, "tanggal": tanggal, "status": "tak bisa dinilai",
                "alasan": "skenario tak menyebut satu pun angka dan pivot kosong"}

    c0 = None
    ohlc_hari = em.get("ohlc_hari") or {}
    c0 = ohlc_hari.get("c")
    if c0 is None:
        d = baca(DIR_OHLC / f"{kode}.json")
        baris = [b for b in (d or {}).get("d", []) if b and b[4] and b[0] <= tanggal]
        c0 = baris[-1][4] if baris else None
    if not c0:
        return {"kode": kode, "tanggal": tanggal, "status": "tak bisa dinilai",
                "alasan": "harga acuan tak ditemukan"}

    urutan: list[dict] = []
    for b in depan:
        for lv in sorted(set(lv_bull)):
            if lv > c0 and b[2] >= lv and not any(x["level"] == lv for x in urutan):
                urutan.append({"tanggal": b[0], "level": lv, "arah": "atas"})
        for lv in sorted(set(lv_invalid)):
            if lv < c0 and b[3] <= lv and not any(x["level"] == lv for x in urutan):
                urutan.append({"tanggal": b[0], "level": lv, "arah": "bawah"})

    tercapai_bull = [x for x in urutan if x["arah"] == "atas"]
    kena_invalid = [x for x in urutan if x["arah"] == "bawah"]
    akhir = depan[-1][4]
    gerak = (akhir / c0 - 1) * 100
    tertinggi = max(b[2] for b in depan)

    if kena_invalid:
        status = "invalid"
    elif tercapai_bull:
        status = "terbukti" if len(tercapai_bull) == len(set(x for x in lv_bull if x > c0)) else "sebagian"
    else:
        status = "belum terjadi"
    if belum_genap:
        status += f" (sementara, {len(depan)}/{HORIZON} hari)"

    return {
        "kode": kode, "tanggal": tanggal, "edisi": bd.get("edisi"),
        "harga_acuan": c0,
        "level_bull": sorted(set(x for x in lv_bull if x > c0)),
        "level_invalid": sorted(set(x for x in lv_invalid if x < c0)),
        "urutan_tersentuh": urutan,
        "harga_h5": akhir,
        "tertinggi_h5": tertinggi,
        "gerak_pct": round(gerak, 2),
        "status": status,
    }


def jalankan(pilih: list[str] | None = None) -> dict:
    hasil = []
    for p in sorted(DIR_BEDAH.glob("*.json")):
        if p.stem.startswith(("flow-", "katalis-")):
            continue
        bd = baca(p)
        if not bd or bd.get("tipe") not in (None, "bedah", "deepdive"):
            continue
        if pilih and bd.get("ticker") not in pilih:
            continue
        t = tinjau(bd)
        if t:
            hasil.append(t)
    hasil.sort(key=lambda x: (x.get("tanggal") or "", x.get("kode") or ""))
    keluar = {"diperbarui": datetime.now().strftime("%Y-%m-%d %H:%M"),
              "horizon_hari": HORIZON, "n": len(hasil), "terbitan": hasil}
    KELUARAN.write_text(json.dumps(keluar, ensure_ascii=False), encoding="utf-8")
    return keluar


def tabel(hasil: dict) -> str:
    baris = ["| Terbitan | Data s.d. | Level bull | Tersentuh (urut) | Invalidasi | Gerak H+5 | Status |",
             "|---|---|---|---|---|---|---|"]
    for t in hasil["terbitan"]:
        if t.get("status") in ("belum ada data", "tak bisa dinilai"):
            baris.append(f"| {t.get('edisi') or t['kode']} | {t['tanggal']} | — | — | — | — | {t['status']} ({t.get('alasan','')}) |")
            continue
        urut = " → ".join(f"{x['level']:.0f} ({x['tanggal'][5:]})" for x in t["urutan_tersentuh"] if x["arah"] == "atas") or "—"
        inv = " · ".join(f"{x['level']:.0f}" for x in t["urutan_tersentuh"] if x["arah"] == "bawah") or "utuh"
        lv = " · ".join(f"{x:.0f}" for x in t["level_bull"]) or "—"
        baris.append(f"| {t.get('edisi') or t['kode']} | {t['tanggal']} | {lv} | {urut} | {inv} | {t['gerak_pct']:+.1f}% | **{t['status']}** |")
    return "\n".join(baris)


def uji() -> None:
    assert angka_dari("Close di atas 1.025 (R1)") == [1025.0]
    assert angka_dari("1.025 -> 1.060 -> 1.095") == [1025.0, 1060.0, 1095.0]
    assert angka_dari("naik 3% dalam 5 hari") == []          # persen & horizon diabaikan
    assert angka_dari("Close <955") == [955.0]
    assert angka_dari(None) == [] and angka_dari("") == []

    # Skenario buatan: bull 110 & 120, invalid 90; harga acuan 100.
    # Bar depan menyentuh 110 lalu 120, low tak pernah <= 90 → terbukti.
    bd = {"ticker": "UJI", "tanggal": "2026-01-10", "edisi": "DD-UJI",
          "em": {"ohlc_hari": {"c": 100}, "pivot": {"R1": 110, "S1": 90},
                 "skenario": {"bull": {"konfirmasi": "Close di atas 110", "rute": "110 -> 120"},
                              "invalid": {"konfirmasi": "Close di bawah 90"}}}}
    import types
    asli = globals()["bar_sesudah"]
    globals()["bar_sesudah"] = lambda k, t, n=HORIZON: [
        ["2026-01-11", 100, 112, 99, 111, 1], ["2026-01-12", 111, 121, 108, 120, 1],
        ["2026-01-13", 120, 122, 118, 121, 1], ["2026-01-14", 121, 123, 119, 122, 1],
        ["2026-01-15", 122, 124, 120, 123, 1]]
    t = tinjau(bd)
    assert t["status"] == "terbukti", t
    assert [x["level"] for x in t["urutan_tersentuh"]] == [110.0, 120.0], t["urutan_tersentuh"]
    assert abs(t["gerak_pct"] - 23.0) < 1e-9

    # Invalidasi tersentuh → status invalid walau level bull juga kena
    globals()["bar_sesudah"] = lambda k, t, n=HORIZON: [
        ["2026-01-11", 100, 112, 89, 95, 1], ["2026-01-12", 95, 96, 94, 95, 1],
        ["2026-01-13", 95, 96, 94, 95, 1], ["2026-01-14", 95, 96, 94, 95, 1],
        ["2026-01-15", 95, 96, 94, 95, 1]]
    assert tinjau(bd)["status"] == "invalid"

    # Hari belum cukup → dinyatakan apa adanya, bukan dinilai
    # Hari belum genap: TETAP dinilai, ditandai sementara + jumlah harinya
    globals()["bar_sesudah"] = lambda k, t, n=HORIZON: [["2026-01-11", 100, 112, 99, 111, 1]]
    st = tinjau(bd)["status"]
    assert st.startswith("sebagian") and "1/5 hari" in st, st
    globals()["bar_sesudah"] = asli
    print("OK  tinjau_deepdive: 10 pemeriksaan lolos")


if __name__ == "__main__":
    if "--uji" in sys.argv:
        uji()
        raise SystemExit(0)
    pilih = [a.upper() for a in sys.argv[1:] if not a.startswith("--")] or None
    h = jalankan(pilih)
    print(f"tinjauan H+{HORIZON}: {h['n']} terbitan -> {KELUARAN}\n")
    print(tabel(h))
