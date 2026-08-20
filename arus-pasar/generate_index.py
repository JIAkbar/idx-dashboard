"""Arus Pasar — generator manifest publik (keluaran/index.json).

Scan edisi/*.json, cocokkan dengan keluaran/<kode>.pdf yang sudah dirender,
tulis daftar edisi terbit (kode, tanggal, judul, emiten, nama file PDF) buat
halaman Bulletin di dasbor React (app/src/views/dasbor/Bulletin.tsx). Edisi
tanpa PDF di keluaran/ dilewati — belum siap dipublikasikan.

Pakai: python generate_index.py
"""
import json
from pathlib import Path

AKAR = Path(__file__).parent

# Edisi yang PDF-nya sudah ada tapi SENGAJA tidak diterbitkan.
#
# Sebelum berkas ini ada, satu-satunya cara menahan edisi adalah dengan tidak
# merender PDF-nya — jadi setiap kali `generate_index.py` dijalankan untuk
# menerbitkan edisi lain, ia menyapu SELURUH `keluaran/` dan menerbitkan apa
# pun yang kebetulan ada di sana. Itu yang terjadi 20 Agu 2026: menerbitkan
# edisi harian 19 Agustus ikut menerbitkan `BA-INET-180826-E01`, padahal Johan
# menyatakan "INET skip saja dlu". Tak ada galat, tak ada peringatan — edisinya
# cuma muncul di Rak Terbitan publik dan baru ketahuan karena ia melihatnya.
#
# Aturan proyek "jangan terbitkan yang tak diminta" tak bisa dijaga oleh niat
# saja selama penerbitannya sapu-rata; ia butuh daftar tahan yang eksplisit.
TAHAN = AKAR / "edisi" / "_tahan.json"


def dibekukan() -> dict[str, str]:
    """{kode: alasan} — edisi yang ditahan, beserta sebabnya.

    Alasannya wajib ikut tersimpan: daftar kode telanjang tak bisa dibedakan
    antara "ditahan karena diminta" dan "ditahan karena rusak", dan setahun
    lagi tak seorang pun ingat yang mana.
    """
    if not TAHAN.exists():
        return {}
    try:
        return json.loads(TAHAN.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        # Gagal baca TIDAK boleh diam-diam berarti "tak ada yang ditahan" —
        # itu justru membuat edisi tertahan ikut terbit.
        raise SystemExit(f"{TAHAN.name} tak terbaca ({e}). Betulkan dulu; "
                         "menerbitkan tanpa daftar tahan tidak aman.")


def main():
    tahan = dibekukan()
    entri = []
    for berkas in sorted((AKAR / "edisi").glob("*.json")):
        # Berkas ber-awalan garis bawah itu berkas KENDALI, bukan edisi
        # (`_tahan.json`). Tanpa saringan ini generator mencoba membacanya
        # sebagai edisi dan mati di `ed["edisi"]`.
        if berkas.name.startswith("_"):
            continue
        ed = json.loads(berkas.read_text(encoding="utf-8"))
        kode = ed["edisi"]
        if kode in tahan:
            print(f"  DITAHAN {kode} — {tahan[kode]}")
            continue
        if not (AKAR / "keluaran" / f"{kode}.pdf").exists():
            continue
        baris = {
            "kode": kode,
            "tanggal": ed["tanggal"],
            "tanggal_id": ed["tanggal_id"],
            "judul": f"Arus Pasar — {ed['tanggal_id']}",
            "emiten": [e["ticker"] for e in ed["emiten"]],
            "pdf": f"{kode}.pdf",
        }
        # Rilis ulang: edisi diperluas cakupannya — dashboard render badge Update N→M.
        if "update_dari" in ed:
            baris["update_dari"] = ed["update_dari"]
        # Sidecar analitik (build.py): skor + probabilitas per emiten — tabel
        # bulletin web menampilkannya sebagai baris detail edisi.
        sc = AKAR / "keluaran" / f"{kode}.analisa.json"
        if sc.exists():
            baris["analisa"] = json.loads(sc.read_text(encoding="utf-8"))
        entri.append(baris)

    # Bedah Arus Saham (BA-*): satu emiten satu terbitan, berkas di bedah/.
    for berkas in sorted((AKAR / "bedah").glob("*.json")):
        bd = json.loads(berkas.read_text(encoding="utf-8"))
        if "edisi" not in bd:
            continue  # sidecar (flow-<TICKER>.json dkk), bukan terbitan
        kode = bd["edisi"]
        # Daftar tahan berlaku di SINI juga, bukan cuma untuk edisi harian.
        # Versi pertama tambalan ini cuma menyaring loop `edisi/`, dan edisi
        # Bedah INET tetap terbit — daftar tahan yang berlaku separuh sama
        # tak bergunanya dengan tak ada daftar tahan.
        if kode in tahan:
            print(f"  DITAHAN {kode} — {tahan[kode]}")
            continue
        if not (AKAR / "keluaran" / f"{kode}.pdf").exists():
            continue
        entri.append({
            "kode": kode,
            "tipe": "Bedah",
            "tanggal": bd["tanggal"],
            "tanggal_id": bd["tanggal_id"],
            "judul": f"Bedah Arus Saham {bd['ticker']} — {bd['tanggal_id']}",
            "emiten": [bd["ticker"]],
            "pdf": f"{kode}.pdf",
        })
    # Terbitan turunan (mingguan AP-W*, bulanan AP-M*) tak punya berkas di
    # edisi/ — identitasnya datang dari sidecar <kode>.meta.json yang ditulis
    # build_weekly.py / build_monthly.py (lihat build.tulis_meta).
    for berkas in sorted((AKAR / "keluaran").glob("*.meta.json")):
        meta = json.loads(berkas.read_text(encoding="utf-8"))
        if not (AKAR / "keluaran" / meta["pdf"]).exists():
            continue
        entri.append(meta)

    entri.sort(key=lambda e: e["tanggal"], reverse=True)

    keluar = AKAR / "keluaran" / "index.json"
    keluar.write_text(json.dumps({"edisi": entri}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK -> {keluar} ({len(entri)} edisi)")


if __name__ == "__main__":
    main()
