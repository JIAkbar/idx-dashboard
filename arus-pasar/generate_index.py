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


def main():
    entri = []
    for berkas in sorted((AKAR / "edisi").glob("*.json")):
        ed = json.loads(berkas.read_text(encoding="utf-8"))
        kode = ed["edisi"]
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
    entri.sort(key=lambda e: e["tanggal"], reverse=True)

    keluar = AKAR / "keluaran" / "index.json"
    keluar.write_text(json.dumps({"edisi": entri}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK -> {keluar} ({len(entri)} edisi)")


if __name__ == "__main__":
    main()
