# Stockbit `chartbit` sebagai sumber OHLCV — diukur 22 Agu 2026

Johan: *"untuk data OHLCV apakah tidak bisa dari API Stockbit?"* — bisa, dan
terukur lebih baik daripada Yahoo yang kita pakai sekarang.

## Endpoint (dibaca dari bundle JS stockbit.com, modul `39097`)

    GET https://exodus.stockbit.com/chartbit/{KODE}/price/daily
        ?from=<TERBARU>&to=<TERLAMA>&limit=0        # Authorization: Bearer <access>
    GET .../chartbit/{KODE}/price/intraday           # parameter belum ketemu (400)
    GET .../chartbit/chart/corpaction?symbol=&from=&to=
    GET .../chartbit/initial/{KODE}                  # nama, bursa, zona waktu

**Jebakan yang memakan empat percobaan**: `from` adalah tanggal **terbaru**
dan `to` yang **terlama**. Dengan urutan wajar server menjawab 200 dan
`chartbit: []` — tanpa galat. `limit=0` = tanpa batas.

Ruas per baris: `date · unixdate · open · high · low · close · volume ·
value · frequency · foreignbuy · foreignsell · foreignflow · dividend ·
shareoutstanding · soxclose · freq_analyzer · lot`.

## Yang terukur

| Uji | Hasil |
|---|---|
| Kedalaman | BBCA 5.483 bar sejak **2 Jan 2004**; BUMI 5.744 bar sejak 2003. Satu permintaan untuk seluruh riwayat |
| 21 Agu 2026 vs IDX `GetStockSummary` (BUMI, DSSA, BBCA, GOTO) | volume, value, frequency, close **semuanya 1,0000** — volume = pasar REGULER saja (GOTO: 9,19 jt reguler, 8,03 M non-reguler tak ikut) |
| 23 Mei 2025 — hari Yahoo cacat 752 emiten | chartbit 1,0000 pada BBCA/BBRI/TLKM/ASII/BMRI/ANTM; Yahoo 0,42–0,79 |
| BUMI 1.596 hari bursa 2020–2026 vs IDX | chartbit beda >0,5% **5 hari** (semua 2020–Jan 2022, selisih 1–30%); Yahoo **71 hari** |
| Konvensi harga | **Disesuaikan aksi korporasi, sama seperti Yahoo**: CLEO 2 Mar 2020 close 207 (IDX mentah 414), RAJA 41 (206), MLPT 158 (3.950). Kontinuitas grafik terjaga, tanpa lapisan penyesuaian sendiri |
| BUMI close vs IDX mentah (tanpa aksi korporasi) | 0 beda pada sampel tiap 40 hari |

## Artinya untuk pondasi (pilihan C, melengkapi A/B di `ohlc-yahoo-vs-idx.md`)

Chartbit memberi yang selama ini harus diambil dari dua sumber sekaligus:
harga tersesuaikan (kelebihan Yahoo) **dan** volume/nilai/frekuensi persis
bursa (kelebihan IDX) — plus `foreignbuy/foreignsell` harian yang sekarang
kita panen terpisah lewat `asing/`, dan `shareoutstanding` harian.

Risikonya tetap yang sama dengan broker summary: API internal, token 24 jam
(diputar `stockbit_token.py`), tanpa jaminan bentuk tetap. Karena itu:

- mentah tiap panggilan diarsipkan (`_arsip-mentah/`), jadi perubahan
  bentuk ketahuan dan tak memakan data lama;
- IDX payload tetap jadi **penguji** harian (cek silang volume sudah jalan di
  `panen_broker_harian.py`); Yahoo tetap tersedia sebagai cadangan.

Belum diuji: `price/intraday` (400 — parameternya lain), `chart/corpaction`
(belum dipanggil dengan parameter benar), dan kedalaman pra-2004.
