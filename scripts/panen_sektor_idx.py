"""Panen klasifikasi IDX-IC resmi per emiten → data-idx/json/emiten_sektor.json.

Menggantikan klasifikasi Yahoo yang selama ini dipakai (`fundamental/*.json`
ruas `sector`), yang bukan IDX-IC dan tak mengenal papan pencatatan.

**Jauh lebih murah dari rencana semula.** `docs/sumber-fundamental-idx.md` #157
mengasumsikan sektor harus diambil dari sheet `1000000` di dalam berkas XLSX
laporan keuangan — artinya mengunduh ratusan berkas. Diuji 17 Agu 2026:
`GetCompanyProfiles` **sudah memuat seluruh rantainya** dalam SATU permintaan:

    Sektor → SubSektor → Industri → SubIndustri

plus `PapanPencatatan` (Utama/Pengembangan/Akselerasi) dan tanggal pencatatan,
yang dua-duanya tak ada di Yahoo. Jadi #157 tak perlu menunggu A3.

Pelajarannya dicatat: rencana yang ditulis sebelum endpointnya diperiksa akan
menaksir ongkos dari asumsi, bukan dari kenyataan.

Pakai:
  python scripts/panen_sektor_idx.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "emiten_sektor.json"
WIB = timezone(timedelta(hours=7))

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HEADER = {"User-Agent": UA, "Referer": "https://www.idx.co.id/id", "Accept": "application/json"}

# Endpoint IDX menjawab 403 tanpa cookie sesi — sentuh halaman depannya dulu.
# Pola yang sama sudah dipakai `panen_kabar.py`; lihat catatannya di sana.
PEMANASAN = "https://www.idx.co.id/id"
SUMBER = ("https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles"
          "?start=0&length=1200&emitenType=s")
# DUA BAHASA (keputusan Johan 27 Agu: nilai klasifikasi tampil Inggris, empat
# tingkat; Indonesia tetap dipanen sebagai cadangan — aturan 3c). Pembeda
# HANYA `lang=en` (+Referer /en): diuji `language=en-us`/`locale=en`/Referer
# saja — semuanya tetap Indonesia. Bukti bijeksi 962x962 keempat tingkat:
# docs/spek-dev-papan/bukti_peta_sektor_idx_en.md
SUMBER_EN = SUMBER + "&lang=en"
HEADER_EN = {**HEADER, "Referer": "https://www.idx.co.id/en"}


def main() -> int:
    sesi = requests.Session()
    try:
        sesi.get(PEMANASAN, headers={"User-Agent": UA}, timeout=30)
        r = sesi.get(SUMBER, headers=HEADER, timeout=60)
        r.raise_for_status()
        r_en = sesi.get(SUMBER_EN, headers=HEADER_EN, timeout=60)
        r_en.raise_for_status()
    except Exception as e:  # noqa: BLE001
        print(f"Gagal mengambil profil emiten: {e}", file=sys.stderr)
        # Pesan ini dulu berbunyi "endpoint IDX hanya terbuka dari IP rumahan,
        # 403 dari datacenter" — dan itu menyesatkan sampai memakan waktu nyata
        # (18 Agu 2026): ia menuntun pembacanya menyalahkan ALAMAT, lalu menunggu
        # atau pindah mesin, padahal 403 hari itu datang dari bentuk permintaan dan
        # alamatnya tak pernah berubah. Pesan galat yang menyebut satu sebab dengan
        # yakin lebih buruk daripada tak ada pesan sama sekali: ia menutup arah
        # pemeriksaan lain. Sekarang menyebut uji yang MEMBEDAKAN keduanya.
        print(
            "403 di sini biasanya BENTUK permintaan, bukan alamat IP. Uji dulu: buka URL "
            "yang sama di peramban. Kalau peramban menjawab 200, yang ditolak sidik jari "
            "permintaannya \u2014 perbaiki header (lihat _HDR_PERAMBAN) atau pakai "
            "curl_cffi impersonate=chrome124. Kalau peramban IKUT 403, barulah curigai "
            "alamat/IP.",
            file=sys.stderr,
        )
        return 1

    hasil = r.json()
    hasil_en = r_en.json()
    # Arsip respons MENTAH sebelum diparse — pembeda tanggal panen karena
    # klasifikasi sektor bisa direvisi IDX dari waktu ke waktu.
    tanggal = datetime.now(WIB).strftime("%Y-%m-%d")
    arsip_mentah.simpan("sektor-idx", f"{tanggal}.json", data=hasil)
    arsip_mentah.simpan("sektor-idx", f"{tanggal}.en.json", data=hasil_en)

    baris = hasil.get("data") or []
    if not baris:
        print("Balasan kosong — berkas lama TIDAK ditimpa.", file=sys.stderr)
        return 1

    baris_en = hasil_en.get("data") or []
    en_by_kode: dict[str, dict] = {}
    for b in baris_en:
        k = (b.get("KodeEmiten") or "").strip().upper()
        if k:
            en_by_kode[k] = b

    emiten: dict[str, dict] = {}
    for b in baris:
        kode = (b.get("KodeEmiten") or "").strip().upper()
        if not kode:
            continue
        en = en_by_kode.get(kode, {})
        emiten[kode] = {
            "nama": (b.get("NamaEmiten") or "").strip(),
            "sektor": (b.get("Sektor") or "").strip() or None,
            "subsektor": (b.get("SubSektor") or "").strip() or None,
            "industri": (b.get("Industri") or "").strip() or None,
            "subindustri": (b.get("SubIndustri") or "").strip() or None,
            # Nama RESMI Inggris IDX (lang=en) — yang DITAMPILKAN sejak
            # keputusan Johan 27 Agu; Indonesia di atas jadi cadangan.
            "sektor_en": (en.get("Sektor") or "").strip() or None,
            "subsektor_en": (en.get("SubSektor") or "").strip() or None,
            "industri_en": (en.get("Industri") or "").strip() or None,
            "subindustri_en": (en.get("SubIndustri") or "").strip() or None,
            "papan": (b.get("PapanPencatatan") or "").strip() or None,
            # Tanggal pencatatan dipotong ke tanggal saja — jamnya selalu 00:00
            # dan menyimpannya utuh cuma menambah ukuran tanpa arti.
            "tercatat": (b.get("TanggalPencatatan") or "")[:10] or None,
        }

    berisi = sum(1 for v in emiten.values() if v["sektor"])
    berisi_en = sum(1 for v in emiten.values() if v["sektor_en"])
    isi = {
        "diperbarui": datetime.now(WIB).isoformat(timespec="seconds"),
        "sumber": "IDX GetCompanyProfiles (klasifikasi IDX-IC resmi)",
        "n": len(emiten),
        "n_bersektor": berisi,
        "n_bersektor_en": berisi_en,
        "emiten": dict(sorted(emiten.items())),
    }
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding="utf-8")

    sektor: dict[str, int] = {}
    papan: dict[str, int] = {}
    for v in emiten.values():
        if v["sektor"]:
            sektor[v["sektor"]] = sektor.get(v["sektor"], 0) + 1
        if v["papan"]:
            papan[v["papan"]] = papan.get(v["papan"], 0) + 1

    print(f"OK -> {KELUARAN} ({len(emiten)} emiten, {berisi} bersektor ID, {berisi_en} bersektor EN)")
    print("Sektor IDX-IC:")
    for nama, n in sorted(sektor.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {nama}")
    print("Papan pencatatan:", ", ".join(f"{k} {v}" for k, v in sorted(papan.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
