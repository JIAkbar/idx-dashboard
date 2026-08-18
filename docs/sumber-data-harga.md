# Sumber data harga — IDX vs Yahoo

Diverifikasi langsung 15 Agustus 2026 (bukan ditebak dari dokumentasi).
Kesimpulannya: **bukan salah satu menang, tapi saling menambal**. Memilih satu
saja akan kehilangan hal yang tak bisa didapat dari yang lain.

## Yang hanya ada di IDX

| Ruas | Yahoo |
|---|---|
| **Frequency** (jumlah transaksi) | tidak ada |
| **ForeignBuy / ForeignSell** | tidak ada |
| Bid, Offer + volumenya (antrean penutupan) | tidak ada |
| ListedShares, TradebleShares | tidak ada |
| NonRegular Volume/Value/Frequency (pasar nego) | tidak ada |
| Remarks (kode papan & notasi khusus) | tidak ada |

Ditambah: **satu permintaan memberi 963 emiten sekaligus**, resmi, dan tanpa
proxy pihak ketiga. Bandingkan dengan Yahoo yang butuh 962 permintaan
terpisah untuk hal yang sama.

## Yang hanya ada di Yahoo

| Hal | IDX |
|---|---|
| **OpenPrice** yang terisi penuh | bolong parah — lihat tabel di bawah |
| Riwayat sebelum 2020 | arsip mulai awal 2020 |
| Riwayat sejak 1990-an untuk indeks | tidak ada |

## Kelengkapan OpenPrice di IDX

Dihitung HANYA dari emiten yang benar-benar bertransaksi hari itu:

| Tanggal | Emiten aktif | Punya Open | High/Low/Frek |
|---|---|---|---|
| Jan 2020 | 568 | 8% | 100% |
| Jan 2022 | 696 | 6% | 100% |
| Agu 2024 | 839 | 5% | 100% |
| Apr 2025 | 849 | 61% | 100% |
| Agu 2026 | 832 | 74% | 100% |

Nol di ruas Open BUKAN berarti emiten tak diperdagangkan: pada 14 November
2024, dari 900 emiten ber-Open nol, **785 punya volume**. Ruasnya memang tak
diisi. Dipakai apa adanya, candle-nya akan menggambar harga buka di nol.

## Aturan pakai

| Kebutuhan | Sumber |
|---|---|
| Data harian ke depan — semua ruas, asing, frekuensi | **IDX**, satu permintaan/hari |
| Riwayat High/Low/Close/Volume sejak 2020 | **IDX**, per tanggal |
| Harga BUKA riwayat | **Yahoo** |
| Riwayat sebelum 2020 | **Yahoo** |
| Riwayat indeks 1990-an | **Yahoo** |

Aturan turunan: kalau sebuah candle memakai Open dari Yahoo tapi High/Low
dari IDX, itu HARUS disebut di antarmuka. Mencampur dua sumber tanpa
memberitahu adalah cara paling halus kehilangan kepercayaan.

## Catatan teknis

* Endpoint IDX menolak permintaan tanpa sesi halaman. Panggil dari dalam
  idx.co.id (Playwright, atau browser MCP seperti saat verifikasi ini).
* Playwright ada di `C:/Python314/python.exe`, BUKAN di `python` yang menunjuk
  venv lain.
* `GetBrokerSummary` menerima parameter `code` tapi MENGABAIKANNYA — tetap
  mengembalikan 88 broker se-pasar. Broker per emiten tidak tersedia.
* Yahoo: jangan pernah `range=max` dengan `interval=1d` — resolusinya
  diturunkan diam-diam jadi bulanan. Selalu `period1`/`period2`.

## Apa yang bisa dibangun dari ruas ini

Dicatat supaya tak ada yang menyimpulkan "datanya kurang" padahal cuma belum
dilihat. Semua di bawah ini **sudah punya bahannya**, tinggal dihitung.

### Analisis volume

| Yang dibangun | Ruas |
|---|---|
| Volume vs rata-ratanya (lonjakan tak wajar) | Volume |
| **Nilai per transaksi** = Value ÷ Frequency | Value, Frequency |
| **Ukuran order rata-rata** = Volume ÷ Frequency | Volume, Frequency |
| Volume di pasar reguler vs negosiasi | Volume, NonRegularVolume |
| Turnover = Volume ÷ TradebleShares | Volume, TradebleShares |

Ruas **Frequency** yang membuat ini jauh lebih tajam daripada analisis volume
biasa: volume besar dengan frekuensi kecil berarti sedikit pihak bertransaksi
besar — beda watak dari volume besar yang tersebar di ribuan transaksi. Itu
selisih yang tak bisa dilihat kalau sumbernya cuma Yahoo.

### Aliran dana asing

| Yang dibangun | Ruas |
|---|---|
| Net asing harian = ForeignBuy − ForeignSell | ForeignBuy, ForeignSell |
| Akumulasi asing n-hari | keduanya, dijumlah |
| Porsi asing = (Buy+Sell) ÷ Volume | ketiganya |

### Divergensi & konvergensi

Butuh indikator momentum yang dihitung dari harga — RSI, MACD, atau
stochastic — lalu dibandingkan arahnya dengan harga:

* **Divergensi bearish**: harga membuat puncak lebih tinggi, indikatornya
  tidak.
* **Divergensi bullish**: harga membuat dasar lebih rendah, indikatornya
  tidak.

Semua bahannya ada dari OHLC. Yang membuat versi PAPAN bisa lebih dari
sekadar mengulang aplikasi lain: divergensi harga-vs-momentum bisa
**disandingkan dengan divergensi harga-vs-net asing** atau
**harga-vs-frekuensi** — harga naik sementara asing terus keluar adalah
cerita yang berbeda dari harga naik dengan asing masuk, dan itu tak terlihat
di mana pun yang cuma memakai OHLCV.

Catatan kejujuran: divergensi adalah pengamatan, bukan ramalan. Kalau
ditampilkan, sebutkan berapa sering pola serupa berlanjut secara historis —
pola yang sama dengan yang sudah dipakai halaman Seasonality.

---

## Aliran asing per emiten — SUDAH DIPANEN (18 Agu 2026)

`ForeignBuy`/`ForeignSell` di atas tak lagi cuma "ada di sumber": sekarang
tersimpan per emiten di **`data-idx/json/asing/<KODE>.json`**, dipanen oleh
`scripts/panen_asing.py`. Divergensi harga-vs-net-asing yang disebut di bagian
sebelumnya kini punya datanya.

**Bentuknya** (per emiten, meniru `ohlc/<KODE>.json` — membuka satu emiten
tak boleh berarti mengunduh seluruh pasar):

```json
{"kode":"AADI",
 "satuan":{"beli":"lembar","jual":"lembar","volume":"lembar",
           "value":"rupiah","frekuensi":"kali"},
 "ruas":["tanggal","beli","jual","volume","value","frekuensi"],
 "mulai":"2024-12-05","akhir":"2026-08-18","n":398,
 "d":[["2024-12-05",0,3000,459400,3055010000,1891], ...]}
```

**Satuan — sudah diukur, jangan ditebak.** `beli`/`jual`/`volume` LEMBAR,
`value` RUPIAH, `frekuensi` kali. Bukti: se-pasar 18 Agu 2026 menjumlah
ForeignBuy 5,03e9 sementara Volume 2,88e10 dan Value 1,37e13 — sebagai rupiah
itu cuma 0,04% nilai transaksi pasar (mustahil), sebagai lembar 17% volume
(wajar); dan tak satu pun emiten hari itu punya ForeignBuy > Volume.

**IDX tidak melaporkan aliran asing dalam RUPIAH.** Rupiahnya hanya bisa
ditaksir (lembar × `value`/`volume`) — taksiran, bukan data, jadi sengaja tak
disimpan. Kalau nanti ditampilkan sebagai rupiah, sebut itu taksiran.

**`net` tidak disimpan** — turunan murni `beli - jual`, dan menyimpannya
menambah ~15% berat unduhan tanpa menambah satu pun informasi. Hitung di
pembacanya.

### Batas riwayat: 2020-01-02 — jangan coba lebih tua

Diuji satu panggilan per tanggal, 18 Agu 2026. HTTP **200** semua, yang
membedakan hanya isinya:

| Tanggal | Baris | | Tanggal | Baris |
|---|---|---|---|---|
| 2020-01-02 | 671 | | 2019-12-30 | **0** |
| 2020-01-03 | 671 | | 2019-12-27 | **0** |
| 2020-01-06 | 671 | | 2019-12-02 | **0** |
| | | | 2019-09-02 | **0** |
| | | | 2018-01-02 / 2015-01-05 / 2010-01-04 | **0** |

30 Des 2019 hari bursa (bukan libur), dan balasannya bukan galat — 200 dengan
`data: []`. Itu batas sumbernya, bukan gejala jaringan. **Jangan menjadwalkan
percobaan ulang untuk tanggal sebelum 2020-01-02.** Pelajaran yang sama sudah
dibayar sekali hari ini: panen XBRL 2016-2019 habis satu siklus penuh sebelum
ketahuan IDX memang tak menyajikannya.

Catatan baca: **0 baris juga yang dibalas hari libur/akhir pekan** (17 Agu
2026, HUT RI, balas 0). Jadi "0 baris" TIDAK sama dengan gagal — pemanen
melewatinya, tidak menghitungnya sebagai galat, dan tidak mengulangnya.

### Angka panen pertama

989 emiten · 2020-01-02 s/d 2026-08-18 · median **1.593** baris/emiten
(min 12, max 1.593) · 1.593 hari bursa, 136 tanggal balas 0 baris (libur) ·
**0 tanggal gagal** dari 1.729 hari kerja · keluaran 57,8 MB (±57 KB/emiten).

Cek tangan lolos di tiga tahun berbeda — berkas vs endpoint langsung, sama
persis: BBCA 2026-08-14, ANTM 2023-04-17, TLKM 2020-06-02.

### Mengulang / menambah ruas tanpa biaya jaringan

Mentahnya diarsipkan ter-gzip di `_arsip-mentah/asing/<tahun>/<YYYYMMDD>.json.gz`
(1.729 berkas, 140 MB — vs ~1 GB kalau tak dikompresi) dan dibaca **sebelum**
menembak jaringan. Menambah ruas dari 32 ruas `GetStockSummary` yang belum
dipakai cukup:

    py -3.14 scripts/panen_asing.py --dari-arsip     # 29 detik, 0 permintaan

Arsip itu sekaligus penanda kemajuan — putus di tengah lalu dijalankan ulang
akan melewati tanggal yang sudah terarsip. Tak ada berkas kemajuan terpisah
yang bisa tak sinkron dengan arsipnya.
