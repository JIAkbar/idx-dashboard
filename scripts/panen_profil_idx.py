# -*- coding: utf-8 -*-
"""Panen profil resmi emiten dari IDX — pemegang saham, anak usaha, pengurus, dividen.

Johan 22 Agu 2026: *"data ini ada di IDX dan KSEI bisa web search sih, terus di
parsing datanya"* — menjawab lapis "kepemilikan" yang dijual tradersaham
(pemegang ≥5%, pengendali, anak usaha) tanpa token pihak ketiga.

Endpoint (diuji dari IP rumahan 22 Agu 2026, HTTP 200, 18 KB untuk BUMI):

    GET https://www.idx.co.id/primary/ListedCompany/GetCompanyProfilesDetail
        ?KodeEmiten=BUMI&language=id-id

Kunci balasan: `Profiles` (alamat, BAE, sektor, tanggal tercatat, ...),
`PemegangSaham` (Nama · Persentase · Jumlah lembar · Kategori "Lebih dari 5%"/
"Masyarakat Non Warkat"/"Direksi"/"Saham Treasury" · **Pengendali** bool),
`AnakPerusahaan` (Nama · Persentase · BidangUsaha · JumlahAset · MataUang ·
Lokasi · StatusOperasi), `Direktur` (Jabatan · Afiliasi), `Komisaris`
(Jabatan · Independen), `KomiteAudit`, `Sekretaris`, `KAP`, `Dividen`,
`BondsAndSukuk`, `IssuedBond`.

Dua lapis seperti pemanen lain: mentah utuh ke `_arsip-mentah/profil-idx/
<KODE>/<YYYY-MM-DD>.json` (bertanggal — komposisi BERUBAH, dan perubahannya
justru yang ingin dibaca nanti), ringkas ke `data-idx/json/profil/<KODE>.json`
(snapshot terkini) + `index.json`.

Data ini jarang berubah; cukup dipanen mingguan (atau saat ada pengumuman).
963 emiten x ±0,5 detik ≈ 8 menit.

Pakai:
    python scripts/panen_profil_idx.py                # semua emiten
    python scripts/panen_profil_idx.py BUMI DSSA       # sebagian
    python scripts/panen_profil_idx.py --uji
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
DIR_JSON = AKAR / "data-idx" / "json"
DAFTAR = DIR_JSON / "daftar_emiten.json"
KELUARAN = DIR_JSON / "profil"
ARSIP = AKAR / "_arsip-mentah" / "profil-idx"
WIB = timezone(timedelta(hours=7))
URL = "https://www.idx.co.id/primary/ListedCompany/GetCompanyProfilesDetail"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def ambil(kode: str) -> tuple[int, dict | str]:
    """Lewat `idx_net` (curl_cffi impersonate + backoff) — `requests` polos kena
    Cloudflare "Just a moment" pada permintaan kedua beruntun (22 Agu 2026)."""
    sys.path.insert(0, str(AKAR / "scripts"))
    import idx_net

    try:
        r = idx_net.get(URL, params={"KodeEmiten": kode, "language": "id-id"},
                        referer="https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/")
    except RuntimeError as e:
        return 0, str(e)[:200]
    try:
        return 200, r.json()
    except ValueError:
        return 200, r.text[:200]


def _f(v):
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def ringkas(kode: str, d: dict) -> dict:
    """Balasan IDX -> bentuk ringkas. Nama ruas IDX dipertahankan dalam bahasa
    aslinya supaya gampang dicocokkan ke sumbernya; yang diubah hanya tipe."""
    prof = (d.get("Profiles") or [{}])[0]
    return {
        "kode": kode,
        "nama": prof.get("NamaEmiten"),
        "sektor": prof.get("Sektor"),
        "sub_sektor": prof.get("SubSektor"),
        "industri": prof.get("Industri"),
        "sub_industri": prof.get("SubIndustri"),
        "papan": prof.get("PapanPencatatan"),
        "tanggal_tercatat": prof.get("TanggalPencatatan"),
        "bae": prof.get("BAE"),
        "alamat": prof.get("Alamat"),
        "website": prof.get("Website"),
        "pemegang_saham": [{
            "nama": r.get("Nama"), "kategori": r.get("Kategori"),
            "persen": _f(r.get("Persentase")), "lembar": _f(r.get("Jumlah")),
            "pengendali": bool(r.get("Pengendali")),
        } for r in d.get("PemegangSaham") or []],
        "anak_usaha": [{
            "nama": r.get("Nama"), "persen": _f(r.get("Persentase")),
            "bidang": r.get("BidangUsaha"), "aset": _f(r.get("JumlahAset")),
            "mata_uang": r.get("MataUang"), "satuan": r.get("Satuan"),
            "lokasi": r.get("Lokasi"), "status": r.get("StatusOperasi"),
            "tahun_komersial": r.get("TahunKomersil") or r.get("TahunKomersial"),
        } for r in d.get("AnakPerusahaan") or []],
        "direksi": [{"nama": r.get("Nama"), "jabatan": r.get("Jabatan"), "afiliasi": bool(r.get("Afiliasi"))}
                    for r in d.get("Direktur") or []],
        "komisaris": [{"nama": r.get("Nama"), "jabatan": r.get("Jabatan"), "independen": bool(r.get("Independen"))}
                      for r in d.get("Komisaris") or []],
        "komite_audit": [{"nama": r.get("Nama"), "jabatan": r.get("Jabatan")} for r in d.get("KomiteAudit") or []],
        "kap": d.get("KAP") or [],
        "dividen": d.get("Dividen") or [],
        "obligasi": d.get("BondsAndSukuk") or [],
        "dipanen": datetime.now(WIB).isoformat(timespec="seconds"),
    }


def jalankan(kode_semua: list[str], jeda: float = 1.5) -> int:
    hari = datetime.now(WIB).strftime("%Y-%m-%d")
    n_ok = n_gagal = n_kosong = 0
    idx = baca(KELUARAN / "index.json") or {"emiten": {}}
    mulai = time.time()
    for i, kode in enumerate(kode_semua, 1):
        ark = ARSIP / kode / f"{hari}.json"
        if ark.exists():
            mentah = baca(ark)
        else:
            st, mentah = ambil(kode)
            if st != 200 or not isinstance(mentah, dict):
                n_gagal += 1
                print(f"  {kode}: HTTP {st} {str(mentah)[:80]}")
                time.sleep(jeda)
                continue
            time.sleep(jeda)
        if not mentah.get("Profiles"):
            n_kosong += 1
            print(f"  {kode}: balasan tanpa Profiles — dilewati")
            continue
        ark.parent.mkdir(parents=True, exist_ok=True)
        ark.write_text(json.dumps(mentah, ensure_ascii=False), encoding="utf-8")
        r = ringkas(kode, mentah)
        KELUARAN.mkdir(parents=True, exist_ok=True)
        (KELUARAN / f"{kode}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        pengendali = [p["nama"] for p in r["pemegang_saham"] if p["pengendali"]]
        idx["emiten"][kode] = {"nama": r["nama"], "pengendali": pengendali,
                               "n_pemegang_5pct": sum(1 for p in r["pemegang_saham"] if p["kategori"] == "Lebih dari 5%"),
                               "n_anak_usaha": len(r["anak_usaha"]), "dipanen": r["dipanen"]}
        n_ok += 1
        if i % 100 == 0:
            print(f"  ...{i}/{len(kode_semua)} ({time.time()-mulai:.0f}s)")
    idx["diperbarui"] = datetime.now(WIB).isoformat(timespec="seconds")
    idx["n"] = len(idx["emiten"])
    (KELUARAN / "index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Selesai {time.time()-mulai:.0f}s: {n_ok} tersimpan, {n_kosong} kosong, {n_gagal} gagal → {KELUARAN}")
    return 0 if n_ok else 1


def swauji() -> int:
    d = {"Profiles": [{"NamaEmiten": "Uji Tbk", "Sektor": "Energi", "PapanPencatatan": "Utama"}],
         "PemegangSaham": [{"Nama": "Induk Ltd", "Kategori": "Lebih dari 5%", "Persentase": "45.78", "Jumlah": 170000000000.0, "Pengendali": True},
                           {"Nama": "Masyarakat Non Warkat", "Kategori": "Masyarakat Non Warkat", "Persentase": 54.2, "Jumlah": 2.0, "Pengendali": False}],
         "AnakPerusahaan": [{"Nama": "PT Anak", "Persentase": "51", "BidangUsaha": "Tambang", "JumlahAset": "1.5", "MataUang": "USD"}],
         "Direktur": [{"Nama": "A", "Jabatan": "DIREKTUR", "Afiliasi": True}],
         "Komisaris": [{"Nama": "B", "Jabatan": "KOMISARIS", "Independen": False}]}
    r = ringkas("UJI", d)
    assert r["nama"] == "Uji Tbk" and r["pemegang_saham"][0]["pengendali"] is True
    assert r["pemegang_saham"][0]["persen"] == 45.78 and r["pemegang_saham"][0]["lembar"] == 170000000000.0
    assert r["anak_usaha"][0]["persen"] == 51.0 and r["anak_usaha"][0]["aset"] == 1.5
    assert r["direksi"][0]["afiliasi"] is True and r["komisaris"][0]["independen"] is False
    r2 = ringkas("KOSONG", {})
    assert r2["nama"] is None and r2["pemegang_saham"] == []
    print("5/5 lulus")
    return 0


if __name__ == "__main__":
    arg = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "--uji" in sys.argv:
        raise SystemExit(swauji())
    kode = [a.upper() for a in arg] or [e["kode"] for e in (baca(DAFTAR) or {}).get("emiten", []) if e.get("kode")]
    raise SystemExit(jalankan(kode))
