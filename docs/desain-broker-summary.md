# Referensi desain — halaman Broker Summary (catatan, belum dikerjakan)

Johan 22 Agu 2026: *"harus buat page baru dengan style yang mirip dengan
stockbit tapi versi kita dan sebelum koding nanti saya berikan referensi lain
supaya bisa lebih unggul dan sempurna"* · *"ini desain nya tadi soal broker
summary, catat dulu"*.

Tiga tangkapan layar dikirim 22 Agu malam (tema gelap, aplikasi pihak ketiga,
bukan Stockbit). Ini pencatatan apa adanya — **keputusan desain belum
diambil**, dan Johan masih akan mengirim referensi lain. Jangan mulai koding
dari berkas ini saja.

## Layar 1 — panel Broker Summary (tabel dua sisi)

- Judul "Broker Summary", sakelar **Net | Gross** di kanan atas.
- Dua kolom berdampingan: **Buy** (`Val · Lot · Avg`) dan **Sell** (`Val ·
  Lot · Avg`), masing-masing diurutkan nilai terbesar ke kecil, bisa digulir.
- Kode broker berwarna per sisi (beli biru, jual merah). Angka dipadatkan:
  `72.2B`, `80.7K`, `9181`.
- Titik biru kecil di sebelah kode tertentu (LG di sisi beli, XL di sisi
  jual) — penanda jenis/favorit; artinya belum jelas.
- Sisi jual ada batang gulir sendiri.

Padanan data kita: **sudah ada** — `data-idx/json/broker_harian/<KODE>.json`
(GROSS per broker: `beli_lot · beli_nilai · beli_avg · jual_lot · jual_nilai ·
jual_avg`). NET = beli − jual, dihitung di klien.

## Layar 2 — Market Flow + Broker Flow (kartu ringkas)

**Market Flow** — "Last 32 days · until 21 Aug 2026", sakelar **Net | Gross**
dan **Val | Vol**, tombol perbesar. Empat baris, tiap baris grafik batang mini
harian (hijau beli, merah jual, sumbu `D-22 … D0`) dan total di kanan:

| Baris | Total contoh |
|---|---|
| Foreign | 629.9B |
| Regular | 3.9T |
| Nego | 26.8B |
| UW/5% | 891.7B |

**Broker Flow** — tombol *Manage* dan *Details*. Empat kategori broker,
masing-masing grafik batang mini, jumlah broker, dan net:

| Kategori | Jumlah | Net |
|---|---|---|
| Smart Money | 21b | +33.5B |
| Whale | 6b | +25.2B |
| Smart Retail | 6b | −53.5B |
| Retail | 7b | −33.3B |

Padanan data kita: Foreign/Regular/Nego **bisa** — `investor_type=FOREIGN`,
`market_board=NEGO` terbukti hidup (22 Agu), tinggal dipanen sebagai
permintaan tambahan per emiten. **Belum ada**: klasifikasi broker (Smart
Money / Whale / Smart Retail / Retail) — butuh tabel kategori broker yang
kita tetapkan sendiri (*Manage* di layar ini menyiratkan pengguna bisa
mengubahnya); dan arti **UW/5%** belum pasti (dugaan: underwriter /
pemegang ≥5%), jangan ditebak saat koding.

## Layar 3 — grafik kumulatif per broker vs harga

- Chip **BUYERS** (AK · DR · LG · BB) dan **SELLERS** (CC · XL · RX · YP),
  tombol *+ Add Broker*; sakelar garis/lilin, **Val | Vol**, layar penuh.
- Panel utama: garis **kumulatif net per broker** (sumbu kiri, −100B … 120B,
  satu warna per broker dengan label kode di ujung kanan) ditumpuk dengan
  **garis harga putih** (sumbu kanan 8.800 … 10.200, harga terakhir ditandai
  kotak "9800.00").
- Panel bawah: batang harian hijau/merah (net harian) dengan sumbu kecil
  ±0.05 — satuannya belum jelas (mungkin net ÷ kapitalisasi atau rasio
  turnover); pastikan sebelum meniru.
- Sumbu x ±1 bulan (21 Jul – 20 Agu).
- Kartu bawah: **"6 Month Floor Price ⓘ — by Broker · 📅 2026-08-21"**,
  tombol *Category*, *Statistics*, sakelar **Reg | All**, legenda "● 20 ● 30".

Padanan data kita: kumulatif per broker = jumlah harian dari
`broker_harian/` — **butuh riwayat harian** sepanjang rentang yang
ditampilkan (1 bulan mudah; "6 Month Floor Price" berarti backfill ≥ 6 bulan
per emiten, lihat pilihan backfill di `antrean.md` P5). Harga dari OHLC kita.
"Floor price by broker" kemungkinan harga rata-rata beli terendah tiap broker
dalam 6 bulan — turunan dari `beli_avg` harian, tapi **definisinya diukur
dulu** sebelum diklaim sama.

## Yang jelas dari ketiganya (untuk dibahas, bukan diputuskan)

1. Semua layar bertumpu pada satu bentuk data: **per broker per hari, dua
   sisi, nilai + lot + harga rata-rata** — persis yang sudah dipanen 3d.
2. Tiga dimensi sakelar berulang di semua layar: Net/Gross, Val/Vol,
   Reg/All. Kalau ditiru, itu satu komponen kanonis (aturan #170), bukan
   tiga tombol per panel.
3. Yang membedakan "versi kita": riwayat disimpan sendiri (tak dibatasi 2
   tahun/100 broker seperti API), broker yang sama bisa dilacak lintas
   emiten, dan arus broker bisa dijahit ke pivot/EMA Analisa PAPAN v1.
