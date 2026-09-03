# Studi — "Algo, Radar & Ops: Formula Reference" (Rizky Cahya, v1.0)

Sumber: `data ide/algo-radar-ops-formula.pdf`, 25 halaman, masuk 1 Sep 2026.
Dipelajari 3 Sep 2026 atas perintah Johan (*"pelajari ini yaa"*). Dokumen ini
menjawab tiga hal: apa isinya, **mana yang bisa dihitung dari data yang kita
punya**, dan mana yang menuntut sumber baru — supaya keputusannya di tangan
Johan, bukan ditebak.

## 1. Apa isinya

Spesifikasi matematis sebuah mesin analitik intraday untuk IDX (long-only).
Dua belas bagian, dari statistik dasar sampai penjatahan posisi:

| § | Isi | Butuh data apa |
|---|---|---|
| 2 | Baseline robust: median & MAD, z-robust `0.6745·(x−med)/MAD`, terkalibrasi bila ≥20 hari, ember waktu-hari (bucket menit WIB) | apa saja yang punya riwayat ≥20 hari |
| 3 | Metrik tape: CVD (volume bertanda sisi agresor), cvdShare, VPIN (ember 1.000 lot), intensitas Hawkes (half-life 30 dtk), OBI (5 level, peluruhan 0,3), OFI Cont–Kukanov–Stoikov, λ Kyle (regresi Δharga vs ΔOFI, r²>0,1), entropi ukuran transaksi, ADV & ATR | **tape per transaksi + sisi agresor (HAKA/HAKI)**, **order book berlapis** |
| 4 | Forensik buku: rekonstruksi add/cancel dari delta volume per level, siklus hidup level (deplete/refill, time-on-book, CAR, CTR, absorption), komposisi antrean (jumlah order per level, CV ukuran order, placement burst), **Wall Authenticity Score** (logistic prior, belum dikalibrasi) | **snapshot order book berlapis beruntun + jumlah order per level** |
| 5 | 11 detektor: CVD divergence, unusual move, fake wall/spoofing, aggressive burst, iceberg, baiting, pinning, unusual activity (radar), sector sweep, book dynamics (regime), split order | campuran; lihat matriks §3 |
| 6 | Skor = strength×100; **tak terkalibrasi → skor dipatok ≤60, confidence LOW, P(win) = null** | kebijakan, bukan data |
| 7 | P(win): Beta-Binomial shrinkage (κ=4), ember z {2,5–3, 3–4, 4+}, meta-model backtest + Brier, pelacak presisi live (≥8 hasil) | hasil sinyal yang sudah tuntas |
| 8 | Rencana: tabel fraksi, snap ke tick, entry ±0,25 ATR, stop 1 ATR, TP 1/2/3 ATR, RR per TP | harga, ATR harian |
| 9 | Ukuran posisi: Kelly ¼, maks risiko 2%/transaksi, partisipasi ≤1% ADV, konstrain pengikat dilaporkan | P(win), ADV |
| 10 | Pelacakan hasil: **stop menang saat seri intrabar**, tp1–3, timeout R=(P−E)/risk | harga sesudah sinyal |
| 11 | Pemindai tape: value/volume/freq 1 menit vs rata-rata 15 menit; lonjakan bila ≥4× dan (≥Rp1 M atau ≥20.000 lot) dan ≥5 transaksi; dominasi HAKA/HAKI dari deltaShare | bar menit **+ sisi agresor** untuk deltaShare |
| 12 | Kandidat Radar: crossListScore (jumlah top-list yang memuat simbol), rankVelocity, newEntry (15 mnt, re-entry ≥60 mnt), churn (top-frequency tanpa top-value) | top-list pasar |

Konstanta semuanya default dan dinyatakan bisa diubah (Lampiran A).

## 2. Data yang kita punya — diperiksa dari berkas, bukan dari ingatan

| Gudang | Butir | Ada sisi agresor? | Ada kedalaman buku? |
|---|---|---|---|
| Intraday 1 menit (`_arsip-mentah/intraday/<KODE>/<YYYY-MM>.json.gz`, jendela 90 hari) | open/high/low/close, **volume, value, frequency**, **foreign_buy/foreign_sell** per menit | **Tidak** — hanya net asing per menit | Tidak |
| Bid-offer (`bidoffer.json`, 833 emiten) | bid, bid_lot, offer, offer_lot, close, prev — *"antrean penutupan level harga terbaik saja"* | — | **Satu level, sekali sehari** |
| Broker harian (`broker_harian/`, 6 varian) | beli/jual lot & nilai per broker per hari | Bukan agresor — sisi beli/jual broker | Tidak |
| Statistik harian (`ds_*.json`) | OHLC, volume, nilai, frekuensi, **top_saham value/volume/frequency**, gainers/losers, sektor | — | — |
| OHLCV harian (`ohlc/`, `ohlcv_stockbit/`) | riwayat panjang, 17 ruas | — | — |
| Radar WDWL (`lib/radar/`) | skor 0–100 dari kombinasi sinyal, dikalibrasi dari arsip sendiri (hit-rate forward return antar edisi), rollup mingguan/bulanan | — | — |
| Penilai jejak (`scripts/riset/nilai_jejak.py`, `rencana_saham.py`, `arus-pasar/prob.py`) | TP/SL dengan **seri = kalah**, hari sinyal tak dinilai, dua win rate, Brier | — | — |

Yang tak kita punya dan tak bisa diturunkan: **sisi agresor per transaksi** dan
**order book berlapis dengan jumlah order, disnapshot beruntun**.

## 3. Matriks kelayakan — bagian per bagian

Legenda: ✅ bisa persis dari data kita · 🟡 bisa sebagai **proksi** (harus diuji dulu, ditandai di layar) · ❌ butuh sumber baru.

| Bagian | Status | Cara / kenapa |
|---|---|---|
| §2 baseline robust, z-robust, kalibrasi ≥20 hari | ✅ | Semua fitur harian kita ≥20 hari; ember waktu-hari dari bar menit. Ini fondasi yang paling murah dan paling luas dampaknya |
| §2.5 ember waktu-hari | ✅ | menit WIB dari `datetime` bar |
| §3.1–3.2 CVD, cvdShare | 🟡 | Proksi (a) **net asing per menit** (`foreign_buy−foreign_sell`) — bertanda, tapi asing saja; (b) tick-rule per bar (close vs close sebelumnya) — lemah; (c) harian: net broker per hari dari 6 varian. Ketiganya BUKAN CVD; wajib diuji terhadap hasil sebelum dipakai sebagai sinyal |
| §3.3 VPIN | 🟡 | Bulk Volume Classification (Easley dkk.) memang dirancang untuk **bar**: bagi volume bar memakai z perubahan harga. Bisa dari bar menit kita |
| §3.4 Hawkes | 🟡 | Kita punya **frequency per menit** — burstiness jumlah transaksi per menit adalah proksi wajar untuk intensitas |
| §3.5 OBI | ❌ | Perlu ≥2 level; kita 1 level, sekali sehari |
| §3.6 OFI, §3.7 λ Kyle | ❌ / 🟡 | OFI perlu kutipan beruntun. λ bisa diproksi: regresi Δharga per menit terhadap volume bertanda BVC ("berapa rupiah per lot bersih") |
| §3.8 entropi ukuran transaksi | 🟡 | Kita punya **value/frequency per menit = tiket rata-rata per menit**. Entropi sebaran tiket rata-rata per menit (ember log2) — proksi untuk "pemotong algoritmik" |
| §3.9 ADV & ATR | ✅ | median volume & range harian |
| §4 forensik buku (add/cancel, lifecycle, WAS, komposisi antrean) | ❌ | Seluruhnya butuh snapshot buku berlapis + jumlah order per level, beberapa detik sekali |
| §5.2 CVD divergence | 🟡 | Hanya seproksi §3.1. Catatan penting dari penulis: versi awal yang ikut agresor **win rate 15%, ekspektansi −0,41R atas 467 sinyal** — dibalik jadi lawan agresor (absorpsi). Arah tak boleh diasumsikan; uji di data kita |
| §5.3 Unusual move | ✅ | z-robust return harian & range harian — bisa dibangun HARI INI dari `ohlc/`. Terkalibrasi sejak hari pertama karena baseline dari riwayat |
| §5.4 Fake wall, §5.6 Iceberg, §5.7 Baiting, §5.8 Pinning, §5.11 Book dynamics, §5.12 Split order | ❌ | Semua bergantung §4 |
| §5.5 Aggressive burst | 🟡 | λ Hawkes dan VPIN proksi (§3.3–3.4) |
| §5.9 Unusual activity (radar) | ✅ harian | `top_saham` value/volume/frequency di `ds_*.json` → crossListScore, churn (masuk top-frequency tanpa top-value), newEntry pada kadens **harian**, bukan 15 menit |
| §5.10 Sector sweep | ✅ harian | Peta sektor + ΔP% harian per emiten: ≥3 anggota searah dengan \|ΔP%\|≥2 |
| §6 pematokan skor tak terkalibrasi (≤60, P=null) | ✅ | Kebijakan — selaras aturan proyek "penanda kualitas, bukan disembunyikan". Bisa dipasang ke Radar WDWL & Rencana Saham sekarang |
| §7 P(win) Beta-Binomial κ=4, ember z, Brier, presisi live ≥8 | ✅ | Kita punya hasil tuntas di `nilai_jejak`/`rencana_saham` dan Brier di `prob.py`; yang belum ada: **shrinkage** dan **ember kekuatan sinyal**. Ini peningkatan konkret atas angka win rate kita yang kini mentah |
| §8 tabel fraksi | ✅ | **Identik** dengan `lib/fraksiHarga.ts` (1/2/5/10/25) — sudah diverifikasi ke bursa di proyek ini |
| §8 rencana ATR (entry ±0,25 ATR, stop 1 ATR, TP 1–3 ATR) | ✅ | Varian rencana kedua di samping `rencana_saham` (zona entry = rentang hari sinyal). Bisa di-backtest langsung dengan `nilai_jejak.py` |
| §9 Kelly ¼, maks 2%, partisipasi 1% ADV | ✅ | Formula; butuh P(win) dari §7. ADV dari volume harian |
| §10 stop menang saat seri | ✅ | **Sama dengan aturan kita** (`nilai_jejak` #2: TP & SL sehari = kalah). Timeout R=(P−E)/risk bisa ditambah untuk yang "menggantung" |
| §11 pemindai lonjakan menit | 🟡 | value/volume/freq per menit **persis ada**; spikeRatio, avgTicket bisa dihitung; deltaShare butuh sisi agresor → proksi asing/BVC. Tapi kita memanen intraday **sesudah 18.00** — jadi pemindai **akhir hari** (riwayat 90 hari), bukan live |
| §12 metrik kandidat radar | ✅ harian | rankVelocity dari peringkat top-list antar hari; newEntry/re-entry pada kadens harian |

Hitungan kasar: **12 bagian ✅ (sebagian pada kadens harian), 8 🟡 proksi, 9 ❌** dari 29 butir yang dipetakan.

## 4. Yang bisa dipakai sekarang, urut manfaat ÷ kerja

1. **§2 + §5.3 Unusual move** di atas `ohlc/` — z-robust return & range harian, terkalibrasi dari riwayat. Satu skrip riset, nol sumber baru. Pembanding langsung untuk skor Momentum/Harian.
2. **§6 + §7** ke sistem win rate kita — shrinkage Beta-Binomial (κ=4), ember kekuatan sinyal, skor tak terkalibrasi dipatok ≤60 dan P(win) kosong. Menjawab keberatan lama bahwa win rate dari sampel kecil terlalu percaya diri.
3. **§8 rencana ATR** sebagai varian kedua, di-backtest dengan `nilai_jejak.py` di samping zona-entry hari sinyal. Kita punya alatnya; yang ditambah cuma pembuat rencananya.
4. **§5.9, §5.10, §12** di Radar pada kadens harian — crossListScore, churn, sector sweep dari `ds_*.json` yang sudah dipanen setiap hari.
5. **§11 pemindai lonjakan menit (akhir hari)** dari arsip intraday 90 hari — spikeRatio & avgTicket persis, deltaShare proksi asing. Ini yang paling dekat dengan cara Johan membaca pasar (*"lihat timeframe 5 menit, volval"*), dan kita sudah punya `volval.py` yang mengukur hal serupa.
6. **§9 Kelly** — hanya sesudah nomor 2 memberi P(win) yang terkalibrasi.

Semua proksi (🟡) wajib lewat uji yang sama seperti `volval_backtest.py`: 59
tanggal, H+1 dan H+5, dengan baseline bervolume — dan ditandai di layar sebagai
proksi.

## 5. Yang butuh sumber baru — keputusan Johan

Seluruh §4 dan enam detektor di §5 hanya hidup dengan **order book berlapis
(≥5 level, lot + jumlah order per level) yang disnapshot tiap beberapa detik
selama jam bursa**, plus **tape dengan sisi agresor**. Yang kita tahu hari ini:

- `bidoffer.json` kita hanya level terbaik saat tutup. Aplikasi Stockbit
  menampilkan order book 10 level dengan lot dan frekuensi (jumlah order) —
  endpointnya belum diinventaris di `docs/referensi_idx-statistik.md`.
- Menyimpan snapshot tiap 5 detik × ~900 emiten × 6 jam ≈ 3,9 juta snapshot
  per hari. Itu bukan penambahan berkas, itu sistem baru: pemanen live selama
  jam bursa, penyimpanan terpisah dari git, dan laju permintaan yang — hari
  ini saja — sudah kita lihat dibatasi diam-diam oleh sumber (jejak #359).
- Alternatif yang lebih sempit: snapshot buku hanya untuk **watchlist**
  (≤50 emiten) tiap 10–15 detik. Masih sistem live, tapi 100× lebih ringan.

Sebelum satu baris pun ditulis untuk ini, inventaris endpointnya dulu (semua
ruas yang tersedia), taksiran beban, lalu keputusan — sesuai aturan kejujuran
inventaris.

## 6. Catatan kritis atas speknya sendiri

- **Tiga komponen dinyatakan tak terkalibrasi oleh penulisnya sendiri**: WAS,
  fake wall, iceberg, baiting, pinning, book dynamics, split order — bobotnya
  "structured prior, belum difit ke hasil". Dibaca sebagai urutan, bukan
  probabilitas. Ini jujur dan selaras dengan cara kita memberi tanda kualitas.
- **Koreksi arah 2026-08-27** (§5.2): detektor yang ikut agresor menghasilkan
  win rate ~15% atas 467 sinyal live — bukan derau, tapi **pembalikan bersih**.
  Pelajaran yang sama dengan `volval_backtest` kita: arah sinyal harus diuji,
  bukan diasumsikan dari intuisi "beli agresif = bullish".
- **Aturan seri = stop** (§10) identik dengan `nilai_jejak` #2. Dua sistem yang
  dibangun terpisah sampai pada keputusan konservatif yang sama — itu memperkuat
  keduanya.
- **Tabel fraksi** (§8.1) sama persis dengan `fraksiHarga.ts`; penulis sendiri
  meminta verifikasi ulang ke rulebook bursa — kita sudah.
- **Net-foreign list day-level & delayed** (§12) — persis yang kita alami:
  aliran asing kita harian, dan sudah diputuskan bukan deret waktu realtime.
- Yang tak disebut spek: **biaya transaksi**. Semua R dan Kelly di dalamnya
  sebelum biaya. `rencana_saham` kita sudah memotong 0,4% (`ekspektansiBiaya`);
  kalau formula §7–§9 diadopsi, biaya harus masuk ke R sebelum P(win) dihitung.

## 7. Yang belum diputuskan (menunggu Johan)

1. Adopsi paket **§2 + §5.3 + §6 + §7** ke Radar & Rencana Saham — kerja
   riset satu skrip + satu perubahan skor, nol sumber baru. Kusarankan ya.
2. Rencana **ATR** (§8) sebagai varian kedua yang di-backtest — kusarankan ya,
   hasilnya angka pembanding, bukan pengganti.
3. **Order book live** (§4/§5) — sistem baru, beban besar, sumber sedang
   membatasi laju. Kusarankan inventaris endpoint dulu, keputusan sesudah
   angka bebannya ada.
