# -*- coding: utf-8 -*-
"""Hasil verifikasi: adakah broker summary PER EMITEN di endpoint publik IDX?

Dijalankan 15 Agustus 2026 lewat browser (endpoint IDX menolak permintaan
tanpa sesi halaman, jadi dipanggil dari dalam idx.co.id sendiri).

JAWABANNYA: TIDAK ADA — tapi ada temuan lain yang lebih berharga.

    GetBrokerSummary?code=DART      200  parameter `code` DIABAIKAN;
                                         tetap mengembalikan 88 broker
                                         se-pasar, bukan per emiten
    GetBrokerSummaryByStock         503  tidak ada
    GetTradingInfoSS                503  tidak ada
    GetStockSummary                 200  963 emiten, 30+ ruas PER EMITEN

Artinya lima panel bandarmologi di chart rujukan (Net Vol, Net Lot, Net
Rasio) TIDAK bisa dibangun dari sumber resmi gratis: semuanya butuh tahu
broker mana membeli berapa di emiten tertentu, dan IDX tak membukanya di
sini.

TAPI GetStockSummary memberi yang selama ini kita kira tak ada:

    OpenPrice, High, Low, Close, Previous   -> OHLC LENGKAP per emiten
    Frequency                                -> frekuensi per emiten
    ForeignBuy, ForeignSell                  -> asing masuk/keluar per emiten
    Bid, BidVolume, Offer, OfferVolume       -> antrean penutupan
    ListedShares, TradebleShares             -> dasar hitung kapitalisasi
    NonRegularVolume/Value/Frequency         -> pasar negosiasi

Contoh DART 13 Agu 2026: Open 188, High 195, Low 182, Close 182,
Frequency 1.217, ForeignBuy 226.500, ForeignSell 21.500.

Konsekuensinya untuk PAPAN:

1. #108 (harga BUKA IHSG) — sumbernya ternyata ada di sini, dan sekalian
   untuk SELURUH emiten, bukan cuma indeks.
2. #122 (OHLC emiten) — tak perlu Yahoo sama sekali untuk data harian ke
   depan: satu permintaan sehari memberi 963 emiten sekaligus, dari sumber
   RESMI. Yahoo tetap dipakai untuk riwayat ke belakang.
3. "Freq. Analyzer" dan aliran asing per emiten jadi mungkin — dua panel
   yang tadinya kukira mustahil.
"""
