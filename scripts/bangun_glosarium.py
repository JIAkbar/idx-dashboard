"""Arus Pasar — bangun glosarium istilah pasar dari korpus PAPAN sendiri.

Daftar istilah & definisinya dikurasi manual di KANDIDAT di bawah (supaya
definisinya BENAR, bukan hasil tebakan mesin). Yang dikerjakan skrip ini:
menghitung FREKUENSI tiap istilah di korpus asli, menarik satu kutipan pendek
nyata sebagai contoh, lalu membuang kandidat yang frekuensinya nol — istilah
yang tak pernah dipakai PAPAN tidak masuk glosarium, walau "lazim" di kamus
umum.

Korpus yang ditambang (lihat SUMBER di bawah):
  - arus-pasar/edisi/*.json          (edisi Arus Pasar harian)
  - arus-pasar/keluaran/*.analisa.json (label/risiko/arah hasil analisa)
  - arus-pasar/bedah/*.json          (bedah arus saham per emiten)
  - docs/pedoman-harga-bei.md, docs/rencana-berjalan.md,
    docs/sumber-fundamental-idx.md
  - app/src/lib/radar/*.ts, app/src/lib/skor/*.ts, app/src/lib/fraksiHarga.ts

Jalankan: python scripts/bangun_glosarium.py
"""
from __future__ import annotations

import glob
import json
import os
import re
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "app", "src", "lib", "dasbor", "glosarium.json")

SUMBER = [
    "arus-pasar/edisi",
    "arus-pasar/keluaran (*.analisa.json)",
    "arus-pasar/bedah",
    "docs/pedoman-harga-bei.md",
    "docs/rencana-berjalan.md",
    "docs/sumber-fundamental-idx.md",
    "app/src/lib/radar",
    "app/src/lib/skor",
    "app/src/lib/fraksiHarga.ts",
]

JSON_GLOBS = [
    "arus-pasar/edisi/*.json",
    "arus-pasar/keluaran/*.analisa.json",
    "arus-pasar/bedah/*.json",
]
MD_FILES = [
    "docs/pedoman-harga-bei.md",
    "docs/rencana-berjalan.md",
    "docs/sumber-fundamental-idx.md",
]
TS_FILES = [
    "app/src/lib/radar/arsip.ts",
    "app/src/lib/radar/rollup.ts",
    "app/src/lib/radar/skor.ts",
    "app/src/lib/skor/skor.ts",
    "app/src/lib/skor/types.ts",
    "app/src/lib/fraksiHarga.ts",
]

# ── Kandidat istilah — kurasi manual, dibuktikan lewat frekuensi ───────────
# kunci: pola pencarian (kata tunggal dibatasi \b...\b, frasa dicari sebagai
#   substring). cs=True → dicocokkan case-sensitive (akronim pendek yang
#   gampang salah tangkap kata Indonesia biasa, mis. "per", "ara" di "sekarang").
KANDIDAT = [
    # ── Arus dana ──────────────────────────────────────────────────────
    dict(id="akumulasi", istilah="Akumulasi", kunci=["akumulasi", "mengakumulasi", "menyerap"],
         definisi="Pembelian bertahap yang membuat kepemilikan suatu pihak bertambah, biasanya dibaca dari pola beli institusi/bandar yang konsisten pada satu saham selama beberapa hari.",
         ke="/broker-summary"),
    dict(id="distribusi", istilah="Distribusi", kunci=["distribusi", "mendistribusi"],
         definisi="Penjualan bertahap yang mengurangi kepemilikan suatu pihak — kebalikan akumulasi. Distribusi di harga tinggi sering jadi peringatan bahwa kenaikan harga kehabisan sponsor.",
         ke="/broker-summary"),
    dict(id="net-foreign", istilah="Net Foreign (Net Buy/Net Sell)", kunci=["net foreign", "net buy", "net sell"],
         definisi="Selisih nilai beli dan jual investor asing pada suatu periode. Net buy = asing lebih banyak membeli (positif), net sell = lebih banyak menjual (negatif).",
         ke="/indeks"),
    dict(id="bandar", istilah="Bandar", kunci=["bandar", "bandarmologi"],
         definisi="Sebutan pasar untuk pemain besar (institusi/broker tertentu) yang pola transaksinya diduga menggerakkan harga suatu saham secara terkoordinasi.",
         catatan="Istilah pasar informal, bukan istilah resmi bursa — PAPAN memakainya untuk membaca pola broker summary, bukan sebagai tuduhan pihak tertentu.",
         ke="/broker-summary"),
    dict(id="ritel", istilah="Ritel", kunci=["ritel"],
         definisi="Investor perorangan dengan modal relatif kecil, dibedakan dari institusi dalam pembacaan arus broker summary."),
    dict(id="scalper", istilah="Scalper", kunci=["scalper"],
         definisi="Broker/pelaku yang berdagang dengan horizon sangat pendek (harian, kadang intraday), sering muncul di kedua sisi beli dan jual pada volume besar."),
    dict(id="institusi", istilah="Institusi", kunci=["institusi"],
         definisi="Pelaku pasar berbadan (sekuritas, manajer investasi, dana pensiun, dll.) dengan modal besar — dibedakan dari ritel dalam pembacaan arus broker summary."),
    dict(id="big-acc-dist", istilah="Big Acc / Big Dist", kunci=["big acc", "big dist"],
         definisi="Label ringkasan rentang tanggal dari Stockbit untuk pola broker bersih dominan: Big Acc (akumulasi besar) atau Big Dist (distribusi besar) pada rentang mingguan/bulanan tertentu.",
         catatan="Istilah bawaan Stockbit yang dikutip PAPAN saat menranskripsi broker summary rentang, bukan istilah yang dihitung sendiri oleh PAPAN.",
         ke="/broker-summary"),

    # ── Teknikal ───────────────────────────────────────────────────────
    dict(id="support", istilah="Support", kunci=["support"],
         definisi="Level harga yang secara historis cenderung menahan penurunan — dipakai PAPAN sebagai acuan level bawah (S1/S2/S3) di setiap kartu emiten."),
    dict(id="resistance", istilah="Resistance (Resisten)", kunci=["resisten", "resistance"],
         definisi="Level harga yang secara historis cenderung menahan kenaikan — dipakai PAPAN sebagai acuan level atas (R1/R2/R3) di setiap kartu emiten."),
    dict(id="pivot", istilah="Pivot", kunci=["pivot"],
         definisi="Titik acuan harga harian (P) yang menjadi basis penghitungan level support (S1-S3) dan resistance (R1-R3) — dihitung dari data harga, bukan ditebak.",
         catatan="`pivot_ragu` di data edisi menandai level pivot yang perhitungannya kurang mantap (mis. data harga tak lengkap)."),
    dict(id="r1-r2-r3", istilah="R1/R2/R3 dan S1/S2/S3", kunci=["R1", "R2", "R3"], cs=True,
         definisi="Tiga lapis level resistance (R1 terdekat sampai R3 terjauh) dan support (S1 terdekat sampai S3 terjauh) di atas/bawah pivot — dipakai sebagai peta target dan invalidasi bertingkat."),
    dict(id="ema", istilah="EMA (Exponential Moving Average)", kunci=["EMA50", "EMA"], cs=True,
         definisi="Rata-rata bergerak eksponensial — rerata harga yang memberi bobot lebih besar pada data terbaru. PAPAN memakai EMA50 (rerata 50 hari) sebagai acuan tren menengah."),
    dict(id="macd", istilah="MACD", kunci=["MACD"], cs=True,
         definisi="Indikator momentum dari selisih dua EMA. PAPAN menandai arah MACD (naik/turun) sebagai dorongan skor tetap di Radar, dan persilangannya (golden/death cross) sebagai kode 'X' pada kolom MACD.",
         ke="/radar"),
    dict(id="persilangan-macd", istilah="Persilangan MACD (Crossing)", kunci=["crossing", "persilangan"],
         definisi="Momen garis MACD memotong garis sinyalnya — ditandai kode 'X' di Radar dan kelas arus 'Crossing' pada edisi Arus Pasar, biasanya dibaca sebagai titik potensi perubahan arah momentum.",
         ke="/radar"),
    dict(id="oscillator", istilah="Oscillator (RSI+BB)", kunci=["oscillator"],
         definisi="Indikator yang berayun dalam rentang tetap (mis. RSI, Bollinger Band) untuk menandai kondisi jenuh beli/jenuh jual. Di Radar, kolom 'RSI+BB' menandai saham yang sedang menyentuh batas oscillator-nya.",
         catatan="Rumus RSI/Bollinger sendiri berasal dari metodologi WD Watch List (Meta-noia), bukan dihitung ulang oleh PAPAN.",
         ke="/radar"),
    dict(id="v-ratio", istilah="V Ratio", kunci=["V Ratio", "vr"], cs=True,
         definisi="Rasio volume hari ini terhadap rerata volume — V Ratio ≥1,5 dibaca sebagai volume ramai dan memberi dorongan skor tetap +4 di Radar.",
         ke="/radar"),
    dict(id="breakout", istilah="Breakout", kunci=["breakout"],
         definisi="Harga menembus level resistance/batas rentang konsolidasi disertai volume — salah satu dari tiga zona resmi Radar (breakout/rebound/uptrend).",
         ke="/radar"),
    dict(id="rebound", istilah="Rebound", kunci=["rebound"],
         definisi="Pemantulan harga naik setelah penurunan, biasanya belum tentu membalik tren — salah satu dari tiga zona resmi Radar (breakout/rebound/uptrend)."),
    dict(id="pullback", istilah="Pullback", kunci=["pullback"],
         definisi="Koreksi sementara dalam tren naik yang lebih besar — dibedakan dari pembalikan tren penuh karena harga masih diharapkan melanjutkan arah semula."),
    dict(id="uptrend", istilah="Uptrend", kunci=["uptrend"],
         definisi="Tren harga naik yang berkelanjutan — salah satu dari tiga zona resmi Radar (breakout/rebound/uptrend)."),
    dict(id="downtrend", istilah="Downtrend", kunci=["downtrend"],
         definisi="Tren harga turun yang berkelanjutan, kebalikan uptrend."),
    dict(id="sideways", istilah="Sideways (Konsolidasi)", kunci=["sideways", "konsolidasi"],
         definisi="Harga bergerak dalam rentang sempit tanpa arah tren yang jelas — pola 'SW' di kolom MACD Radar menandai pola sideways pada grafik."),
    dict(id="momentum", istilah="Momentum", kunci=["momentum"],
         definisi="Kekuatan dan kecepatan pergerakan harga ke satu arah — momentum kuat sering dibarengi volume besar dan dipakai untuk menilai apakah sebuah pergerakan layak dikejar atau rawan blow-off."),
    dict(id="divergensi", istilah="Divergensi", kunci=["divergensi"],
         definisi="Ketidaksesuaian arah antara pergerakan harga dan indikator (mis. harga naik tapi arus flow melemah) — sering dibaca sebagai peringatan dini pembalikan."),
    dict(id="koreksi", istilah="Koreksi", kunci=["koreksi"],
         definisi="Penurunan harga jangka pendek di dalam tren yang lebih besar, dibedakan dari pembalikan tren (downtrend) yang lebih permanen."),
    dict(id="tren", istilah="Tren (Trend)", kunci=["tren", "trend"],
         definisi="Arah pergerakan harga secara umum dalam periode tertentu — naik (uptrend), turun (downtrend), atau mendatar (sideways)."),
    dict(id="sinyal", istilah="Sinyal", kunci=["sinyal"],
         definisi="Kondisi teknikal/arus dana tertentu yang dipakai sebagai dasar pembacaan arah — di Radar, tiap sinyal (mis. Greens+Whites, Streak≥3) dikalibrasi dari arsip sendiri, bukan aturan baku dari luar.",
         ke="/radar"),
    dict(id="candle", istilah="Candle (Candlestick)", kunci=["candle", "candlestick"],
         definisi="Grafik lilin — representasi visual harga buka, tinggi, rendah, tutup dalam satu periode. Warna dan bentuk body candle beruntun jadi salah satu sinyal Radar (kolom Colors/Bodies).",
         ke="/chart"),
    dict(id="streak", istilah="Streak (Beruntun)", kunci=["streak", "hari.?ke", "beruntun"],
         definisi="Jumlah hari berturut-turut suatu kondisi bertahan (mis. warna candle naik beruntun, atau saham bertahan di daftar Radar) — makin panjang streak, makin kuat sinyalnya dianggap."),
    dict(id="colors-bodies", istilah="Colors & Bodies (Greens/Whites/Reds/Blacks)", kunci=["greens", "whites", "reds", "blacks"],
         definisi="Kode warna candle beruntun (Colors: Greens/Reds) dan warna body candle beruntun (Bodies: Whites/Blacks) dari metodologi WD Watch List — kombinasi Greens+Whites atau Reds+Blacks jadi salah satu sinyal terkalibrasi Radar.",
         ke="/radar"),
    dict(id="zona-radar", istilah="Zona (Radar)", kunci=["\\bzona\\b"],
         definisi="Klasifikasi posisi teknikal saham di Radar: breakout, rebound, atau uptrend — dicatat pada kemunculan pertama dan terakhir sebuah saham di daftar untuk melihat apakah zonanya naik kelas selama bertahan.",
         ke="/radar"),
    dict(id="swing-low", istilah="Swing Low/High", kunci=["swing low", "swing high"],
         definisi="Titik terendah/tertinggi lokal pada grafik harga sebelum arah berbalik — dipakai sebagai acuan level uji ulang saat support/resistance utama patah."),
    dict(id="gap", istilah="Gap", kunci=["\\bgap\\b"],
         definisi="Selisih harga tanpa transaksi di antaranya (harga buka jauh dari harga tutup sebelumnya) — sering menandai perubahan sentimen mendadak."),
    dict(id="sponsor", istilah="Sponsor", kunci=["sponsor"],
         definisi="Pihak (broker/institusi) yang secara konsisten menopang pergerakan harga suatu saham lewat pembelian berkelanjutan — 'kehabisan sponsor' berarti penopang utama berhenti membeli."),
    dict(id="target-invalidasi", istilah="Target & Invalidasi", kunci=["invalidation", "batal di bawah"],
         definisi="Sepasang level dalam tiap kartu emiten PAPAN: target = arah harga yang diharapkan bila skenario benar, invalidasi (invalidation) = level harga yang membatalkan skenario itu bila ditembus.",
         catatan="Level target/invalidasi PAPAN bersifat teknikal-otomatis dari pivot & EMA, bukan rekomendasi transaksi."),
    dict(id="skenario", istilah="Skenario (Bull/Retest/Invalid)", kunci=["skenario"],
         definisi="Tiga jalur kemungkinan yang dipetakan PAPAN untuk tiap emiten — bull (konfirmasi naik), retest (uji ulang level), dan invalid (skenario batal) — masing-masing dengan syarat konfirmasi, rute harga, dan risikonya sendiri."),
    dict(id="konfirmasi", istilah="Konfirmasi", kunci=["konfirmasi"],
         definisi="Syarat harga (biasanya level close tertentu disertai volume) yang harus terpenuhi sebelum sebuah skenario dianggap valid dan layak diikuti."),
    dict(id="vonis", istilah="Vonis", kunci=["vonis"],
         definisi="Istilah PAPAN untuk kesimpulan/verdict naratif atas pergerakan sebuah emiten pada halaman Bedah Arus Saham — merangkum apa yang terjadi dan apa artinya, bukan sekadar label arah."),

    # ── Likuiditas ─────────────────────────────────────────────────────
    dict(id="volume", istilah="Volume", kunci=["\\bvolume\\b"],
         definisi="Jumlah lembar saham yang berpindah tangan dalam suatu periode — ukuran aktivitas transaksi, dibedakan dari frekuensi (jumlah transaksinya)."),
    dict(id="frekuensi", istilah="Frekuensi", kunci=["frekuensi"],
         definisi="Jumlah transaksi (order match) yang terjadi pada suatu saham dalam periode tertentu — dibedakan dari volume (jumlah lembar yang berpindah tangan)."),
    dict(id="nilai-transaksi", istilah="Nilai Transaksi", kunci=["nilai transaksi"],
         definisi="Total rupiah yang berpindah tangan dari seluruh transaksi suatu saham dalam periode tertentu (harga dikali volume, dijumlahkan per transaksi)."),
    dict(id="lot", istilah="Lot", kunci=["\\blot\\b"],
         definisi="Satuan standar perdagangan saham di BEI, 1 lot = 100 lembar saham."),
    dict(id="likuiditas", istilah="Likuiditas", kunci=["likuiditas"],
         definisi="Kemudahan suatu saham diperjualbelikan tanpa menggerakkan harga secara signifikan — biasanya diukur dari volume dan frekuensi transaksi hariannya. Likuiditas tipis berarti saham rawan bergerak liar dengan volume kecil sekalipun."),
    dict(id="spread", istilah="Spread", kunci=["spread"],
         definisi="Selisih antara harga beli (bid) tertinggi dan harga jual (offer) terendah pada order book — spread lebar biasanya menandai likuiditas tipis.",
         catatan="Muncul tipis di korpus kita (jarang dibahas eksplisit); definisi mengikuti pengertian bursa yang baku."),

    # ── Mekanisme bursa ────────────────────────────────────────────────
    dict(id="fraksi-harga", istilah="Fraksi Harga (Tick Size)", kunci=["fraksi harga", "tick size", "\\bfraksi\\b"],
         definisi="Kelipatan harga minimum yang berlaku di BEI, berjenjang menurut rentang harga: Rp1 (<Rp200), Rp2 (Rp200-500), Rp5 (Rp500-2.000), Rp10 (Rp2.000-5.000), Rp25 (>Rp5.000). Batas atas tiap jenjang inklusif.",
         ke="/kalkulator"),
    dict(id="ara", istilah="ARA (Auto Rejection Atas)", kunci=["ARA"], cs=True,
         definisi="Batas kenaikan harga maksimum dalam satu hari bursa sebelum order otomatis ditolak sistem. Besarnya berjenjang: 35% (harga acuan ≤Rp200), 25% (Rp200-5.000), 20% (>Rp5.000).",
         ke="/kalkulator"),
    dict(id="arb", istilah="ARB (Auto Rejection Bawah)", kunci=["ARB"], cs=True,
         definisi="Batas penurunan harga maksimum dalam satu hari bursa. Sejak 4 September 2023 besarnya SIMETRIS dengan ARA (35%/25%/20% menurut rentang harga acuan) — sebelumnya sempat 15% seragam pada tahap normalisasi awal.",
         ke="/kalkulator"),
    dict(id="pasar-nego", istilah="Pasar Nego", kunci=["pasar nego"],
         definisi="Segmen perdagangan BEI di luar pasar reguler, transaksi dinegosiasikan langsung antar-pihak (bukan lewat order matching berkelanjutan) — volumenya dipakai sebagai pembanding arus di luar pasar reguler."),

    # ── Fundamental ────────────────────────────────────────────────────
    dict(id="per", istilah="PER (Price Earning Ratio)", kunci=["PER"], cs=True,
         definisi="Rasio harga saham terhadap laba bersih per saham (EPS) — makin tinggi PER, makin mahal valuasi saham relatif terhadap labanya saat ini."),
    dict(id="pbv", istilah="PBV (Price to Book Value)", kunci=["PBV"], cs=True,
         definisi="Rasio harga saham terhadap nilai buku per saham — dipakai untuk menilai apakah saham diperdagangkan di atas atau di bawah nilai aset bersihnya."),
    dict(id="roe", istilah="ROE (Return on Equity)", kunci=["ROE"], cs=True,
         definisi="Rasio laba bersih terhadap ekuitas — mengukur seberapa efisien perusahaan menghasilkan laba dari modal sendiri pemegang saham."),
    dict(id="eps", istilah="EPS (Earning Per Share)", kunci=["EPS"], cs=False,
         definisi="Laba bersih dibagi jumlah saham beredar — komponen dasar penghitungan PER.",
         catatan="Di korpus kita, EPS muncul dalam konteks kelengkapan data (ruas `eps` kosong di ~71% emiten sumber Yahoo), bukan pembahasan naratif tentang nilainya."),
    dict(id="kapitalisasi-pasar", istilah="Kapitalisasi Pasar", kunci=["kapitalisasi"],
         definisi="Nilai total seluruh saham beredar suatu emiten (harga saham dikali jumlah saham beredar) — dipakai untuk mengurutkan emiten menurut ukurannya.",
         ke="/stocks"),
    dict(id="laba-bersih", istilah="Laba Bersih", kunci=["laba bersih"],
         definisi="Laba yang tersisa setelah seluruh beban, pajak, dan biaya dikurangkan dari pendapatan — baris terakhir laporan laba rugi komprehensif."),
    dict(id="arus-kas", istilah="Arus Kas (CFO/CFI/CFF)", kunci=["arus kas"],
         definisi="Catatan pergerakan kas perusahaan, terbagi tiga: operasi (CFO), investasi (CFI), pendanaan (CFF). Arus kas operasi jadi salah satu ruas yang paling sering kosong di sumber data sekunder.",
         catatan="`operating_cf` tercatat 80% kosong di sumber Yahoo yang dipakai PAPAN sekarang — salah satu alasan laporan resmi IDX (XBRL) dijajaki sebagai pelengkap."),
    dict(id="laporan-keuangan-xbrl", istilah="Laporan Keuangan XBRL", kunci=["XBRL", "laporan keuangan"], cs=False,
         definisi="Laporan keuangan resmi emiten dalam format XLSX ber-tag XBRL (eXtensible Business Reporting Language) yang diterbitkan IDX per emiten per kuartal — sumbernya langsung dari emiten, dwibahasa, dan mencakup sektor IDX-IC resmi serta informasi pemegang saham pengendali.",
         catatan="Diuji 16 Agustus 2026: 778 emiten TW2 2026, 777 di antaranya punya berkas .xlsx.",
         ke="/stock-detail"),
    dict(id="idx-ic", istilah="Sektor IDX-IC", kunci=["IDX-IC", "IDX IC"], cs=False,
         definisi="Klasifikasi sektor/subsektor/industri/subindustri resmi Bursa Efek Indonesia (IDX Industrial Classification) — berbeda dari klasifikasi sektor yang dipakai agregator pihak ketiga seperti Yahoo Finance.",
         ke="/sector"),

    # ── Istilah khas PAPAN ─────────────────────────────────────────────
    dict(id="broker-summary", istilah="Broker Summary", kunci=["broker summary"],
         definisi="Rekap transaksi broker per emiten (sisi beli & jual, per broker, per hari) — istilah yang benar untuk data ini di PAPAN.",
         catatan="\"Orderbook\" pernah dipakai keliru untuk data ini di beberapa nama teknis lama (#144) — istilah yang benar tetap broker summary; orderbook sebetulnya berarti antrean bid/offer real-time, bukan rekap harian broker.",
         ke="/broker-summary"),
    dict(id="edisi", istilah="Edisi", kunci=["\\bedisi\\b"],
         definisi="Satu unit terbitan Arus Pasar untuk satu tanggal/periode — tidak pernah digabung dengan edisi lain, dinavigasi lewat arsip per tanggal."),
    dict(id="edisi-harian-mingguan-bulanan", istilah="Edisi Harian/Mingguan/Bulanan", kunci=["harian", "mingguan", "bulanan"],
         definisi="Tiga jenjang periode terbitan Arus Pasar: harian (satu hari bursa), mingguan (rekap sepekan), dan bulanan (rekap sebulan) — masing-masing dirakit dari data harian yang sama.",
         ke="/bulletin"),
    dict(id="bedah-arus-saham", istilah="Bedah Arus Saham", kunci=["bedah"],
         definisi="Terbitan PAPAN yang membedah satu emiten secara mendalam — gabungan narasi flow broker beberapa hari, interpretasi PCD, dan skenario teknikal — berbeda dari edisi Arus Pasar reguler yang memuat banyak emiten sekaligus."),
    dict(id="radar-watchlist", istilah="Radar Watchlist (WDWL)", kunci=["radar", "watchlist", "wdwl"],
         definisi="Halaman PAPAN yang menyajikan arsip WD Watch List & WD Penny List (Saptono Widhi, grup Meta-noia) — daftar pantau berbasis aturan, per edisi tanggal, dengan skor probabilitas yang dihitung PAPAN dari arsipnya sendiri.",
         catatan="WDWL = WD Watch List, sumber metodologi cara baca (warna, oscillator) berasal dari publikasi resmi Meta-noia di Harian Kontan — bukan diciptakan PAPAN.",
         ke="/radar"),
    dict(id="seasonality", istilah="Seasonality", kunci=["seasonality"],
         definisi="Pola musiman pergerakan IHSG (dan per emiten) — misalnya kecenderungan bulan atau hari tertentu dalam sepekan — dihitung dari data historis, bukan prediksi tunggal untuk periode mendatang.",
         ke="/seasonality"),
    dict(id="skor-radar", istilah="Skor (Radar)", kunci=["skor", "kalibrasi", "prior netral"],
         definisi="Skor 0-100 tiap saham di Radar, dimulai dari titik netral 50 lalu digeser oleh tiap sinyal terkalibrasi (hit-rate historisnya sendiri dari arsip) plus dua dorongan tetap: arah MACD (±4) dan V Ratio tinggi (+4).",
         catatan="Model TERBUKA — tiap komponen skor beserta detail hit-rate arsipnya ditampilkan apa adanya, bukan angka hitam-kotak.",
         ke="/radar"),
    dict(id="hit-rate", istilah="Hit-rate & Forward Return", kunci=["hit.?rate", "forward return"],
         definisi="Hit-rate = persentase kejadian suatu sinyal diikuti pergerakan searah ramalannya pada edisi berikutnya di arsip. Forward return = rerata perubahan harga (close ke close edisi berikutnya) pada kejadian-kejadian itu — keduanya dasar kalibrasi skor Radar.",
         ke="/radar"),
    dict(id="shrink-prior", istilah="Shrink ke Prior Netral", kunci=["shrink"],
         definisi="Teknik statistik menarik hit-rate mentah ke arah 50% netral bila jumlah sampelnya masih sedikit — mencegah sinyal yang baru terjadi 2-3 kali di arsip langsung dianggap sangat andal.",
         ke="/radar"),
    dict(id="pcd", istilah="PCD (Price of Construction Distribution)", kunci=["PCD"], cs=True,
         definisi="Aproksimasi PAPAN atas distribusi volume-tertimbang harga dari data OHLCV (bukan data 'done' per transaksi sesungguhnya) — dipakai untuk memperkirakan di harga berapa mayoritas modal pemegang saham 'nyangkut' (zona modal), dengan pembobotan meluruh (half-life 60 hari bursa).",
         catatan="Metode aproksimasi, bukan data transaksi riil — label metodenya wajib tercetak di output produk (lihat `arus-pasar/pcd.py`)."),
    dict(id="modal-nyangkut", istilah="Modal Nyangkut / Zona Modal", kunci=["modal nyangkut", "zona modal", "atas air"],
         definisi="Perkiraan rentang harga tempat mayoritas volume historis dibeli (dari perhitungan PCD) — pemegang di zona itu 'di atas air' kalau harga sekarang lebih tinggi (untung/impas) atau 'nyangkut' kalau lebih rendah (rugi), berpotensi jadi sumber pasokan jual saat harga mendekati level itu lagi."),
    dict(id="risiko-tier", istilah="Level Risiko (TINGGI/EKSTREM)", kunci=["risiko"],
         definisi="Penanda tingkat risiko yang disematkan PAPAN pada tiap setup/skenario emiten — TINGGI atau EKSTREM menandai skenario dengan volatilitas atau ketidakpastian di atas rata-rata.",
         catatan="Kriteria pembeda TINGGI vs EKSTREM ada di skrip build.py yang tidak termasuk sumber yang ditambang untuk glosarium ini — definisi sengaja ditulis umum, jangan dianggap ambang pasti."),
    dict(id="arah-bull-bear-side", istilah="Arah (Bull/Bear/Side)", kunci=["\\bbull\\b", "\\bbear\\b", "bullish", "bearish"],
         definisi="Klasifikasi arah tesis suatu emiten di PAPAN: bull (bullish, condong naik), bear (bearish, condong turun), atau side (sideways, condong mendatar)."),
    dict(id="net-value", istilah="Peran Broker (Ritel/Scalper)", kunci=["peran_broker", "peran broker"],
         definisi="Klasifikasi PAPAN atas kode broker berdasarkan pola perannya di suatu edisi — mis. ritel atau scalper — dicatat per edisi untuk membantu membaca arah arus dana tanpa perlu menghafal puluhan kode broker."),
    dict(id="ihsg", istilah="IHSG", kunci=["IHSG"], cs=True,
         definisi="Indeks Harga Saham Gabungan — mengukur pergerakan harga seluruh saham yang tercatat di BEI, indikator utama arah pasar saham Indonesia.",
         ke="/indeks"),
    dict(id="ytd", istilah="YTD (Year to Date)", kunci=["YTD"], cs=True,
         definisi="Year to Date — akumulasi suatu angka (mis. net sell asing) sejak awal tahun kalender berjalan sampai tanggal acuan."),
    dict(id="rebalancing-msci", istilah="Rebalancing Indeks (MSCI)", kunci=["rebalancing", "MSCI"], cs=False,
         definisi="Penyesuaian berkala komposisi/bobot indeks global (mis. MSCI) yang memicu jual-beli mekanis pada saham-saham terkait — dampaknya bersifat teknis-mekanis, bukan selalu mencerminkan perubahan fundamental."),
    dict(id="level-psikologis", istilah="Level Psikologis", kunci=["psikologis"],
         definisi="Angka bulat yang secara historis sering jadi acuan perhatian pasar (mis. IHSG 6.500, USD/IDR 18.000) meski tak punya dasar teknikal formal — dipakai sebagai konteks tambahan, bukan level support/resistance yang dihitung."),
]

# ── Ekstraksi teks korpus ───────────────────────────────────────────────


def _strings_from_json(obj, out: list[str]) -> None:
    if isinstance(obj, str):
        if obj.strip():
            out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _strings_from_json(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _strings_from_json(v, out)


def muat_korpus() -> tuple[str, list[str]]:
    """-> (teks_gabungan_untuk_frekuensi, daftar_string_json_untuk_contoh)."""
    semua_teks: list[str] = []
    kutipan_json: list[str] = []

    for pola in JSON_GLOBS:
        for fp in glob.glob(os.path.join(ROOT, pola)):
            try:
                data = json.load(open(fp, encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            akumulator: list[str] = []
            _strings_from_json(data, akumulator)
            semua_teks.extend(akumulator)
            kutipan_json.extend(akumulator)

    for f in MD_FILES:
        fp = os.path.join(ROOT, f)
        if os.path.exists(fp):
            semua_teks.append(open(fp, encoding="utf-8").read())

    for f in TS_FILES:
        fp = os.path.join(ROOT, f)
        if os.path.exists(fp):
            semua_teks.append(open(fp, encoding="utf-8").read())

    return "\n".join(semua_teks), kutipan_json


_PEMISAH_KALIMAT = re.compile(r"(?<=[.;])\s+|\n")


def _potongan_kalimat(teks: str) -> list[str]:
    """Pecah satu string jadi potongan pendek (kalimat/klausa) untuk kandidat kutipan."""
    return [p.strip() for p in _PEMISAH_KALIMAT.split(teks) if p.strip()]


def buat_regex(kunci: str, cs: bool) -> re.Pattern:
    flags = 0 if cs else re.IGNORECASE
    if re.fullmatch(r"[A-Za-z0-9]+", kunci):
        pola = r"\b" + re.escape(kunci) + r"\b"
    elif kunci.startswith("\\b") or ".?" in kunci or "|" in kunci:
        pola = kunci  # sudah berupa regex siap pakai
    else:
        pola = re.escape(kunci)
    return re.compile(pola, flags)


def hitung_dan_kutip(kandidat: dict, teks_gabungan: str, kutipan_json: list[str]) -> tuple[int, str]:
    cs = kandidat.get("cs", False)
    pola_list = [buat_regex(k, cs) for k in kandidat["kunci"]]

    frekuensi = sum(len(p.findall(teks_gabungan)) for p in pola_list)

    contoh = ""
    for sumber in kutipan_json:
        for potongan in _potongan_kalimat(sumber):
            if len(potongan) > 140:
                continue
            if any(p.search(potongan) for p in pola_list):
                contoh = potongan
                break
        if contoh:
            break

    return frekuensi, contoh


def main() -> None:
    teks_gabungan, kutipan_json = muat_korpus()

    entri_final = []
    nol_frekuensi = []
    for kandidat in KANDIDAT:
        frekuensi, contoh = hitung_dan_kutip(kandidat, teks_gabungan, kutipan_json)
        if frekuensi == 0:
            nol_frekuensi.append(kandidat["id"])
            continue
        entri = {
            "id": kandidat["id"],
            "istilah": kandidat["istilah"],
            "kunci": kandidat["kunci"],
            "definisi": kandidat["definisi"],
        }
        if kandidat.get("catatan"):
            entri["catatan"] = kandidat["catatan"]
        if contoh:
            entri["contoh"] = contoh
        if kandidat.get("ke"):
            entri["ke"] = kandidat["ke"]
        entri["frekuensi"] = frekuensi
        entri_final.append(entri)

    entri_final.sort(key=lambda e: (-e["frekuensi"], e["istilah"]))

    wib = timezone(timedelta(hours=7))
    hasil = {
        "dibuat": datetime.now(wib).isoformat(),
        "sumber": SUMBER,
        "istilah": entri_final,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(hasil, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Ditulis {OUT_PATH}: {len(entri_final)} istilah.")
    if nol_frekuensi:
        print(f"Dibuang (frekuensi nol, {len(nol_frekuensi)}): {', '.join(nol_frekuensi)}")
    print("\n10 istilah paling sering:")
    for e in entri_final[:10]:
        print(f"  {e['frekuensi']:4d}  {e['istilah']}")


if __name__ == "__main__":
    main()
