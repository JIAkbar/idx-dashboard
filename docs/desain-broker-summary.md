# Referensi desain — halaman Broker Summary (catatan, belum dikerjakan)

Johan 22 Agu 2026: *"harus buat page baru dengan style yang mirip dengan
stockbit tapi versi kita dan sebelum koding nanti saya berikan referensi lain
supaya bisa lebih unggul dan sempurna"* · *"ini desain nya tadi soal broker
summary, catat dulu"*.

Tiga tangkapan layar dikirim 22 Agu malam — dari **tradersaham.com → Stock
Profiler** (Premium; bongkarnya di `docs/riset/tradersaham-bongkar.md`). Ini pencatatan apa adanya — **keputusan desain belum
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

## Mockup interaktif (22 Agu 2026 malam)

Artifact: https://claude.ai/code/artifact/62ee304d-17f6-4582-a6f1-f141f136cc5f —
data nyata BUMI 3–21 Agu 2026 (14 hari GROSS), sumbernya
`docs/desain/broker-summary-mockup.template.html` (placeholder `__DATA__`
diisi dari `broker_tahunan/BUMI/2026.json`). Yang sudah dicoba di situ dan
disetujui Johan lewat arahan langsung:

- kendali ala Stockbit: ‹ tanggal › + kalender dengan preset (Latest, Prev Day,
  Last 7D, This Month, Prev Month, Last 1M/3M/6M, YTD, Last 1Y — yang datanya
  baru sebagian bergaris putus, yang tak ada tercoret), dropdown Investor /
  Market / Net-Gross, sakelar Nilai/Lot;
- blok ringkasan Stockbit: Top 1/3/5 (volume, %, Rp(B), Acc/Dist), Broker
  buyer/seller/#, Net Volume, Net Value, Average (Rp). **Definisi terukur dari
  layar BBCA 21 Agu**: % = net lot ÷ Net Volume (Σ net pembeli); Average =
  Net Value ÷ (Net Volume × 100). Label Acc/Dist pakai ambang sementara
  <5 Neutral · <12,5 Small · <20 Normal · ≥20 Big — belum diverifikasi;
- gutter batang gulir tabel **1 px** (permintaan Johan);
- kode broker **berwarna per kelompok** (Asing · BUMN · Smart Money · Ritel ·
  Afiliasi grup/bandar · Lainnya) dengan legenda — bukan hijau/merah per sisi;
- panel "Asal data" **dibuang** dari tampilan (permintaan Johan) — kejujuran
  datanya pindah ke dokumen, bukan ke layar.

## Rumus blok ringkasan Stockbit — TERUKUR (BUMI 21 Agu 2026, All Investor · Regular · Net)

Diadu ke lima tangkapan layar Stockbit yang dikirim Johan 22 Agu malam, memakai
data GROSS harian kita untuk tanggal yang sama:

| Ruas | Rumus | Kita | Stockbit |
|---|---|---|---|
| Net Volume | Σ net lot semua broker yang net-nya positif | 9.623.643 | 9.616.243 (−0,08%) |
| Net Value | Σ net nilai broker net-positif | 188,5 M | 188,5 M |
| Average (Rp) | Net Value ÷ (Net Volume × 100) | 196 | 196 |
| **Top N** | Σ N pembeli net teratas **+** Σ N penjual net teratas (negatif) | −1.786.740 / −2.231.722 / −2.067.539 | **sama persis** |
| % | Top N ÷ Net Volume | −18,6 / −23,2 / −21,5 | sama |
| **Rp(B)** | Top N lot × 100 × Average — **bukan** nilai net sebenarnya | −35,0 / −43,7 / −40,5 | sama |
| Average (baris) | belum ketemu; rata-rata Top 1–5 meleset 1,2% (−2.109.940 vs −2.136.400) | ≈ | ditandai ≈ di layar |
| Broker buyer/seller | hitung broker net >0 / <0 | 34/44 | 33/47 (beda cara menghitung net nol) |

Label Acc/Dist dikalibrasi ke 13 label yang terlihat (Neutral 0,2 · 1,1 · 0,3 ·
−1,9 · −4,7 · −5,6; Small 7,6 · −8,1 · −8,8 · −10,0; Normal −17,9 · −18,6;
Big −21,5 · −22,2 · −23,2 · 20,3): **|%| < 6 Neutral · < 15 Small · < 20
Normal · ≥ 20 Big**. Batas persisnya 6–7,6 dan 10–17,9 belum terjepit.

GROSS dua sisi ikut cocok: XL beli 7,07 jt lot / 138,7 M (Stockbit 7,1 jt /
138,7 M), jual 156,2 M sama. Layar Foreign / Domestic / Nego membuktikan
parameter `investor_type` dan `market_board` memberi pecahan yang konsisten
(Foreign net volume 385.273 lot, 5 pembeli / 18 penjual) — belum dipanen.
