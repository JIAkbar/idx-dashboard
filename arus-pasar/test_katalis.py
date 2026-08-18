"""Uji halaman Katalis build_bedah.py — jalankan: py -3.14 test_katalis.py

Yang diuji cuma logika yang bisa gagal SENYAP: penyaringan jendela tanggal,
batas kata pada pencocokan kode, pemeringkatan sumber, dan kunci dedup. Tampilan
tidak diuji di sini — itu diperiksa dengan membaca terbitannya.
"""
import build_bedah as X

ITEM = [
    {"sumber": "IDX", "jenis": "pengumuman", "judul": "Pengumuman Perubahan Pengendali",
     "tautan": "https://idx/a.pdf", "waktu": "2026-08-14T18:12:00+07:00", "emiten": ["DOOH", "INET"]},
    {"sumber": "Kontan", "jenis": "berita", "judul": "Pengendali Anyar DOOH Kuasai 51% Saham",
     "tautan": "https://kontan/x", "waktu": "2026-08-14T20:49:00+07:00", "emiten": []},
    {"sumber": "IPOT News", "jenis": "berita", "judul": "MINET dan INETRA Menguat",
     "tautan": "https://ipot/y", "waktu": "2026-08-14T09:00:00+07:00", "emiten": []},
    {"sumber": "Kontan", "jenis": "berita", "judul": "DOOH Bergerak",
     "tautan": "https://kontan/lama", "waktu": "2026-07-20T09:00:00+07:00", "emiten": []},
]


def test_jendela_dan_batas_kata():
    h = X.kabar_emiten("DOOH", "2026-08-14", 14, ITEM)
    assert [i["tautan"] for i in h] == ["https://idx/a.pdf", "https://kontan/x"], h
    # 20 Juli di luar jendela 14 hari — tak boleh ikut.
    assert all(i["tanggal"] >= "2026-07-31" for i in h)
    # 'MINET'/'INETRA' bukan INET: pencocokan judul memakai batas kata.
    assert [i["tautan"] for i in X.kabar_emiten("INET", "2026-08-14", 14, ITEM)] == \
        ["https://idx/a.pdf"]


def test_tingkat_dan_sumber():
    h = X.kabar_emiten("DOOH", "2026-08-14", 14, ITEM)
    assert h[0]["tingkat"] == "a" and h[0]["sumber"] == "IDX — Keterbukaan Informasi"
    assert h[1]["tingkat"] == "b" and h[1]["sumber"] == "Kontan"
    # Emiten lain yang disebut di pengumuman yang sama jadi calon "setema".
    assert h[0]["terkait"] == ["INET"]


def test_kunci_dedup_bukan_tautan_saja():
    """Pengumuman IDX tanpa lampiran memakai satu URL generik yang sama —
    dedup ber-tautan meringkas beberapa pengumuman berbeda jadi satu baris."""
    generik = "https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi"
    a = {"tautan": generik, "judul": "Perubahan Pengendali", "tanggal": "2026-08-14"}
    b = {"tautan": generik, "judul": "Perubahan Komite Audit", "tanggal": "2026-08-14"}
    assert X._kunci(a) != X._kunci(b)
    assert X._kunci(a) == X._kunci(dict(a))


if __name__ == "__main__":
    for nama, fn in sorted(globals().items()):
        if nama.startswith("test_"):
            fn()
            print("OK", nama)
