"""Jalankan: python scripts/test_panen_google_news.py — nol framework, sesuai konvensi repo.

Mengunci DUA bug yang sempat kejadian saat menambah sumber Google News RSS
(20 Agu 2026):

1. `rss()` membalas `waktu=None` untuk pubDate berzona NAMA ("... GMT"), bukan
   offset angka — Google News memakainya, Kontan tidak, jadi bug ini lolos
   dari uji manual Kontan. Akibatnya seluruh item Google News dibuang oleh
   filter retensi `panen_kabar.main()` (butuh `waktu`), dan `cek_kabar.py`
   membaca sumbernya seolah kosong walau panennya "OK, 41 item".
2. `google_news()` memanggil tiga kueri yang tumpang tindih — dedup wajib
   pakai tautan+judul+waktu (aturan proyek), bukan cuma salah satunya.
"""
import sys, os
from datetime import timezone
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import panen_kabar as pk


def test_rss_zona_gmt_terbaca_bukan_none():
    """`%z` menolak 'GMT' literal; harus jatuh ke `%Z` dan diberi tzinfo UTC
    eksplisit — BUKAN diam-diam ditandai WIB seperti fallback naive biasa
    (itu akan menggeser waktunya 7 jam)."""
    xml = (b'<rss><channel><item>'
           b'<title>Judul uji</title>'
           b'<link>https://news.google.com/rss/articles/abc</link>'
           b'<pubDate>Wed, 19 Aug 2026 23:54:00 GMT</pubDate>'
           b'</item></channel></rss>')

    class _Balasan:
        content = xml
        headers = {}
        text = xml.decode()

    with patch.object(pk, "ambil", lambda *a, **kw: _Balasan()):
        item = pk.rss("Google News", "http://x", 5)

    assert len(item) == 1
    assert item[0]["waktu"] == "2026-08-19T23:54:00+00:00", item[0]["waktu"]


def test_rss_zona_numerik_tetap_jalan():
    """Tak boleh regresi: pubDate berzona angka (dipakai Kontan) tetap parse."""
    xml = (b'<rss><channel><item>'
           b'<title>Judul</title><link>http://x</link>'
           b'<pubDate>Thu, 20 Aug 2026 08:22:57 +0700</pubDate>'
           b'</item></channel></rss>')

    class _Balasan:
        content = xml

    with patch.object(pk, "ambil", lambda *a, **kw: _Balasan()):
        item = pk.rss("Kontan", "http://x", 5)
    assert item[0]["waktu"] == "2026-08-20T08:22:57+07:00"


def test_google_news_dedup_tautan_judul_waktu():
    """Tiga kueri, dua di antaranya menemukan artikel yang sama (tautan +
    judul + waktu identik) — harus tersisa satu, bukan tiga."""
    sama = {"sumber": "Google News", "jenis": "berita", "judul": "IHSG menguat",
            "tautan": "https://news.google.com/rss/articles/tok1", "waktu": "2026-08-20T01:00:00+00:00",
            "emiten": []}
    beda_tautan_artikel_beda = {**sama, "tautan": "https://news.google.com/rss/articles/tok2",
                                 "judul": "Analis: IHSG berpotensi rebound"}  # bukan duplikat, artikel lain

    panggilan = iter([
        [sama, beda_tautan_artikel_beda],  # kueri "umum"
        [dict(sama)],                       # kueri "bei" — nemu sama lagi
        [],                                  # kueri "emiten" — kosong
    ])

    with patch.object(pk, "rss", lambda *a, **kw: next(panggilan)):
        out = pk.google_news(30)

    assert len(out) == 2, f"harus 2 (1 dibuang duplikat), dapat {len(out)}: {out}"
    tautan = {i["tautan"] for i in out}
    assert tautan == {"https://news.google.com/rss/articles/tok1",
                       "https://news.google.com/rss/articles/tok2"}


def main():
    test_rss_zona_gmt_terbaca_bukan_none()
    test_rss_zona_numerik_tetap_jalan()
    test_google_news_dedup_tautan_judul_waktu()
    print("OK")


if __name__ == "__main__":
    main()
