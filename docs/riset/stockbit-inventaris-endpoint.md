# Inventaris endpoint Stockbit yang terjangkau token akun — 22 Agu 2026

Johan: *"apa saja data yang tersedia di stockbit selain tadi data regular,
keystat dari token itu?"* — ditanya SESUDAH backfill reguler berjalan; seharusnya
inventaris ini dibuat sebelum meluncurkan panen apa pun. Tercatat supaya
keputusan lingkup berikutnya dibuat dari daftar lengkap, bukan satu per satu.

Semua lewat `https://exodus.stockbit.com`, header `Authorization: Bearer <access>`
(token diputar `scripts/stockbit_token.py`). Status = hasil uji nyata hari ini.

## Terbukti hidup dan terbaca

| Endpoint | Isi | Kedalaman / catatan | Dipakai? |
|---|---|---|---|
| `GET /marketdetectors/{kode}?from&to&transaction_type&market_board&investor_type&limit` | Broker summary per emiten: per broker lot/nilai/avg dua sisi + `bandar_detector` | Sejak 2017 (2015 kosong); rentang server tak aditif >2 th & cap 100 broker → simpan per hari. Enum: NET/GROSS · REGULER/NEGO/TUNAI/ALL · ALL/FOREIGN/DOMESTIC | **Ya** — reguler selesai BUMI; asing+nego berjalan |
| `GET /chartbit/{kode}/price/daily?from=TERBARU&to=TERLAMA&limit=0` | OHLCV harian + value, frequency, foreignbuy/sell, dividend, shareoutstanding | Sejak **2004**; volume/value/freq = IDX persis; harga tersesuaikan split seperti Yahoo | Ditunda (keputusan Johan: sesudah pondasi broker + halaman) |
| `GET /keystats/{kode}` | 12 grup ±94 rasio fundamental (valuasi, per saham, solvabilitas termasuk rasio bank, profitabilitas, growth, dividen, Piotroski, neraca, arus kas, imbal hasil) + `most_recent_quarter` + nilai per kuartal | Snapshot terkini; `?period=quarterly` diterima | Belum — belum diuji silang ke XBRL kita |
| `GET /emitten/{kode}/profile` | **Pemegang saham** (nama, %, lembar, lencana `pengendali`), **anak usaha** (%, bidang), **eksekutif** (komisaris/direksi + tanggal), alamat, sejarah | Snapshot terkini | Belum — ini lapis "kepemilikan" yang dijual tradersaham |
| `GET /emitten/{kode}/info?with_sub_industry=true` | Harga/volume/nilai hari ini, previous, keanggotaan **indeks** (LQ45, IDX30, JII…), sektor/sub-sektor/industri, notasi khusus, UMA, bid/offer teratas, day-trade & margin info | Snapshot | Belum — keanggotaan indeks & notasi berguna untuk screener |
| `GET /seasonality/{kode}?year=N` | Tabel musiman: perubahan harga per bulan per tahun (N tahun ke belakang), up/down, rata-rata, probabilitas | `year` = jumlah tahun; `year≤3` menjawab kosong untuk BUMI (?) | Belum — kita sudah punya `panen_seasonality.py` sendiri |
| `GET /chartbit/initial/{kode}` | Nama, bursa, zona waktu | — | — |
| `GET /search?keyword=&type=company` | Pencarian emiten/orang/sektor | — | — |

## Ada, tapi parameternya belum terpecahkan

| Endpoint | Bukti | Yang diperlukan |
|---|---|---|
| `GET /order-trade/broker/top?sort=TB_SORT_BY_TOTAL_VA…&period=TB_PERIOD_LAST_1_DAY&market…` | Terlihat di DevTools Johan (401 saat sesi habis) — **Top Broker** level pasar, ada juga tab Top Stock | Salin parameter lengkapnya dari tab Network saat halaman Top Broker terbuka |
| `GET /findata-view/company/financial?symbol=&report_type=` | 200 tapi `data_tables` kosong — **laporan keuangan** per periode | Nilai `report_type`/`period_type`/`data_type` yang benar (salin dari Network saat tab Financials dibuka) |
| `GET /chartbit/chart/corpaction?symbol=&from=&to=` | 400 `ErrInvalidParameter` — aksi korporasi untuk grafik | Format tanggal/urutan yang benar |
| `GET /chartbit/{kode}/price/intraday` | 400 | Format `from/to` (mungkin epoch) |
| `GET /orderbook/{orderbookid}` | Butuh id numerik (ada di `/emitten/{kode}/info` → `id`=104 untuk BUMI); **di balik paywall Pro** (`/paywall/eligibility/check?features=PAYWALL_FEATURE_ORDERBOOK`) | Uji dengan id numerik; kalau paywall, lewati |
| `/fundachart/{kode}` | 405 (bukan GET) | Metode/param dari Network |

## Tidak ada (404 "Unrecognized Command")

`/insider/{kode}`, `/emitten/{kode}/shareholders`, `/emitten/{kode}/corporate-action`,
`/calendar/corporate-action`, `/emitten/{kode}/financial`, `/order-trade/stock/top`
(nama tebakan — yang asli pasti lain), `/company/*`, `/financials/*`.

## Lingkup panen harian kalau SEMUA lapis terbukti diambil (per emiten)

| Lapis | Permintaan/hari | Catatan |
|---|---|---|
| Broker reguler · asing · nego | 3 | sudah ada di `panen_broker_harian.py --varian` |
| OHLCV chartbit | 1 (atau 0 — cukup `from=hari ini` saja; riwayat sekali) | ditunda |
| keystats, profile, info | 3, tapi cukup **mingguan/bulanan** (snapshot, jarang berubah) | — |

960 emiten × 4 harian ≈ 64 menit pada 1 permintaan/detik — masih muat di
jendela 18:30, tapi ini keputusan lingkup Johan, bukan bawaan.
