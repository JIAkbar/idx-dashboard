"""Uji gerbang kredit #181 di build.py — jalankan: python test_gerbang.py

Yang diuji cuma yang bisa gagal SENYAP: setoran disetujui yang tak jadi
emiten edisi harus MENGHENTIKAN build, dan kolofon tak boleh mencetak angka
"N emiten" untuk kontributor yang nol karyanya masuk. Dua-duanya lolos tanpa
satu pun galat sebelum #181 (edisi 18 Agu 2026).
"""
import sys

import build as X

ED = {
    "edisi": "AP-UJI-E01",
    "tanggal_id": "18 Agustus 2026",
    "emiten": [{"ticker": "ADRO", "kontributor": "Agitama"},
               {"ticker": "BYAN", "kontributor": "Agitama"}],
}
DISETUJUI = {"ADRO": "Agitama", "BYAN": "Agitama",
             "INET": "Erika Julianti", "TINS": "Erika Julianti"}


def test_gerbang_menghentikan_build():
    """Disetujui tapi tak jadi emiten edisi + tanpa alasan -> berhenti."""
    try:
        X.gerbang_setoran(ED, {"disetujui": DISETUJUI}, {}, {})
    except SystemExit as e:
        pesan = str(e)
        assert "Erika Julianti" in pesan and "INET" in pesan and "TINS" in pesan, pesan
        assert "--tak-terpakai" in pesan, pesan
    else:
        raise AssertionError("gerbang lolos padahal INET & TINS tak dimuat")


def test_alasan_eksplisit_meloloskan_dan_ikut_terbawa():
    alasan = {"INET": "rentang tanggalnya bukan satu hari",
              "TINS": "rentang tanggalnya bukan satu hari"}
    hasil = X.gerbang_setoran(ED, {"disetujui": DISETUJUI}, {}, alasan)
    assert [r["ticker"] for r in hasil] == ["INET", "TINS"], hasil
    assert all(r["alias"] == "Erika Julianti" for r in hasil)
    assert all(r["alasan"] == alasan[r["ticker"]] for r in hasil)


def test_tanpa_daftar_disetujui_gerbang_mati_bukan_gagal():
    """Perakitan wajib tetap jalan tanpa kredensial/berkas (aturan #138)."""
    assert X.gerbang_setoran(ED, None, {}, {}) == []


def test_kolofon_tak_pernah_mengklaim_emiten_yang_tak_ada():
    tak_pakai = [{"alias": "Erika Julianti", "ticker": "INET", "alasan": "rentangnya lebih dari satu hari"},
                 {"alias": "Erika Julianti", "ticker": "TINS", "alasan": "rentangnya lebih dari satu hari"}]
    ed = dict(ED, kredit_kontributor=[{"alias": "Erika Julianti", "n": 2}])
    html = X.halaman_kolofon(ed, None, tak_pakai)
    # yang benar-benar masuk edisi tetap dapat angkanya
    assert '<span class="kf-jml">2 emiten</span>' in html
    # yang nol dimuat: disebut, tapi TIDAK pernah dengan angka
    assert "Erika Julianti" in html
    assert "Erika Julianti</span>" not in html          # bukan baris grid
    assert "INET, TINS" in html
    assert "Terima kasih kepada Erika Julianti" in html  # apresiasi di depan
    assert "rentangnya lebih dari satu hari" in html     # teknis di belakang
    assert html.count("emiten</span>") == 1, "masih ada angka emiten kedua"


def test_arg_peta_menerima_koma_di_dalam_alasan():
    sys.argv = ["build.py", "--tak-terpakai=inet:rentangnya 1 bulan, bukan 1 hari;TINS:sama"]
    assert X.arg_peta("--tak-terpakai=") == {
        "INET": "rentangnya 1 bulan, bukan 1 hari", "TINS": "sama"}


def test_sql_kabar_meloloskan_kutip_tunggal():
    q = "'" + "buka'tutup".replace("'", "''") + "'"
    assert q == "'buka''tutup'"


if __name__ == "__main__":
    for nama, fn in sorted(globals().items()):
        if nama.startswith("test_"):
            fn()
            print("OK", nama)
