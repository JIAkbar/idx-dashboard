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
