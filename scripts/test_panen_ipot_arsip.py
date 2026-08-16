"""Jalankan: python scripts/test_panen_ipot_arsip.py — nol framework, sesuai konvensi repo.

Mengunci DUA bug yang sempat kejadian:

1. Panen ulang (resume) berhenti terlalu dini karena halaman pertama isinya
   semua sudah ada di arsip lama (dedup), padahal tanggalnya belum tembus
   --sejak. Perbaikannya: berhenti hanya kalau halaman BENAR-BENAR kosong
   atau tanggal sudah lebih tua dari --sejak — bukan kalau tak ada item BARU.
2. Endpoint IPOT mengabaikan parameter `halaman` di luar batas tertentu dan
   membalas HALAMAN YANG SAMA berulang-ulang (bukan kosong) — terbukti 16
   Agu 2026, seluruh empat kanal menembak 500 halaman/`--maks-halaman` tanpa
   maju, 2443 detik untuk nol progres. Perbaikannya: bandingkan set news_id
   halaman ini dengan halaman sebelumnya, berhenti kalau persis sama.
"""
import sys, os
from datetime import date
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import panen_ipot_arsip as pia


def _halaman(entries):
    """entries: list of (news_id, "Aug 15, 2026 - 11:46", "Judul"). Bentuk potongan
    HTML persis seperti balasan endpoint IPOT (lihat panen_kabar._ITEM_IPOT)."""
    potongan = []
    for nid, tgl, judul in entries:
        potongan.append(
            f'<small>Saturday, {tgl} WIB</small> blah '
            f'<a href="newsDetail.php?jdl=x&news_id={nid}&group_news=IPOTNEWS">{judul}</a>')
    return " ".join(potongan)


class _Balasan:
    def __init__(self, teks):
        self.text = teks
        self.status_code = 200


def test_resume_tak_berhenti_dini_karena_dedup():
    # Halaman 0: dua item, KEDUANYA sudah ada di arsip lama (simulasi resume).
    # Halaman 1: satu item baru, masih dalam rentang --sejak.
    # Halaman 2: kosong -> berhenti wajar.
    halaman_teks = [
        _halaman([("1", "Aug 15, 2026 - 10:00", "Lama satu"),
                  ("2", "Aug 15, 2026 - 09:00", "Lama dua")]),
        _halaman([("3", "Aug 14, 2026 - 08:00", "Baru satu")]),
        "",
    ]

    def palsu_ambil(url, headers, percobaan=4):
        halaman = int(url.split("halaman=")[1].split("&")[0])
        return _Balasan(halaman_teks[halaman]) if halaman < len(halaman_teks) else _Balasan("")

    with patch.object(pia, "ambil_dengan_ulang", palsu_ambil):
        terlihat = {"1", "2"}  # simulasi: sudah dipanen sesi sebelumnya
        item, halaman, tertua = pia.panen_kanal("stocks", "Saham", date(2026, 1, 1), 10, terlihat)

    assert halaman == 3, f"harus lanjut sampai halaman kosong, dapat {halaman}"
    assert [i["judul"] for i in item] == ["Baru satu"], "cuma item baru yang masuk"
    assert tertua == "2026-08-14"


def test_berhenti_saat_tanggal_lewat_sejak():
    halaman_teks = [_halaman([("9", "Jan 5, 2026 - 10:00", "Masih baru"),
                               ("8", "Dec 20, 2025 - 10:00", "Sudah lewat")])]

    def palsu_ambil(url, headers, percobaan=4):
        return _Balasan(halaman_teks[0])

    with patch.object(pia, "ambil_dengan_ulang", palsu_ambil):
        item, halaman, tertua = pia.panen_kanal("stocks", "Saham", date(2026, 1, 1), 10, set())

    assert [i["judul"] for i in item] == ["Masih baru"], "item sebelum --sejak tak ikut masuk"
    assert halaman == 1, "berhenti di halaman yang sama begitu ketemu tanggal lewat"


def test_berhenti_saat_halaman_kembar():
    # Halaman 0 dan 1 (dan seterusnya kalau dibiarkan) membalas news_id yang
    # PERSIS SAMA — simulasi endpoint yang mengabaikan `halaman` di luar batas.
    kembar = _halaman([("1", "Aug 15, 2026 - 10:00", "Item A"),
                        ("2", "Aug 15, 2026 - 09:00", "Item B")])

    def palsu_ambil(url, headers, percobaan=4):
        return _Balasan(kembar)  # SELALU balasan yang sama, apa pun `halaman`-nya

    with patch.object(pia, "ambil_dengan_ulang", palsu_ambil):
        item, halaman, tertua = pia.panen_kanal("stocks", "Saham", date(2026, 1, 1), 500, set())

    assert halaman == 2, f"harus berhenti begitu halaman kedua kembar, dapat {halaman} (bukan 500)"
    assert len(item) == 2, "item halaman pertama tetap masuk, cuma pengulangannya yang dibuang"


def test_news_id():
    assert pia._news_id("newsDetail.php?jdl=x&news_id=233822&group_news=IPOTNEWS") == "233822"
    assert pia._news_id("newsDetail.php?jdl=x") is None


def main():
    test_resume_tak_berhenti_dini_karena_dedup()
    test_berhenti_saat_tanggal_lewat_sejak()
    test_berhenti_saat_halaman_kembar()
    test_news_id()
    print("OK")


if __name__ == "__main__":
    main()
