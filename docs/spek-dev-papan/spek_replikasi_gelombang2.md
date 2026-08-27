# SPEK — Replikasi tradersaham gelombang 2: Watchlist-indeks · 3 kalkulator · IPO — 27 Agu 2026

> Asal perintah Johan (verbatim, 27 Agu 2026): *"P7 dan P9 di replikasi total"*. Saringan tetap tier audit (`audit_tradersaham.md` — perintah Johan 26 Agu: tidak semua tab dipasang, yang informasinya kuat). Semua fitur di sini TIER 1 (data sudah di cakram). Audit gap 27 Agu (`wf_522d15ac`) = dasar status "belum".

## E. Watchlist sebagai indeks (`Watchlist.tsx` + lib baru `watchlistIndeks.ts`)

1. Tab tampilan baru di halaman Watchlist: **Tabel** (yang sekarang) · **Kinerja**.
2. **Kinerja**: anggota watchlist dijadikan satu indeks harian — dua bobot: **Setara** (rata-rata return harian anggota) dan **Kap. pasar** (bobot `market_cap` dari `screener.json`; emiten tanpa kap → bobot setara + disebut). Rentang: `PemilihRentang` kanonis (b3/y1 dst dari `rentang.ts`).
3. Metrik kartu: Total return · vs IHSG (selisih return) · Volatilitas tersetahunkan (σ harian × √252) · **Max drawdown** · **Win rate harian** (% hari return indeks > return IHSG) + n hari. Semua dari `ohlc/<KODE>.json` anggota + `ohlc/IHSG.json`.
4. Chart rebased 100: garis tiap anggota (tipis) + indeks (tebal) + IHSG (putus-putus) — pola chart `broker-summary-v2/VsIhsg.tsx` (pakai util chart yang sama, jangan pustaka baru).
5. Kolom tabel baru (tab Tabel): **Asing 1D** (net lembar bar terakhir `asing/<KODE>.json`) · **RVol10** (ambil dari `screener.json`, jangan hitung ulang) · **Top Broker** (3 chip beli + 3 chip jual net terbesar hari terakhir dari `broker_harian/<KODE>.json`, kode berwarna kelompok identitas). Fetch per anggota hanya saat kolom tampil; watchlist biasanya < 30 emiten.
6. Batas jujur di layar: indeks dihitung dari harga penutupan penyesuaian; bukan produk resmi; win rate deskriptif (BadgeRapor TIDAK dipasang karena tak ada klaim prediktif).

## F. Tiga kalkulator baru (`KalkulatorJia.tsx` + `views/dasbor/kalkulator/*`)

Tab baru: `piramida` · `blender` · `bunga`. Semua murni aritmetika — definisi rumus DICETAK di layar; pembulatan harga WAJIB `keFraksi()` (`lib/fraksiHarga.ts`); pola Simpan/Riwayat meniru `KuliPapan.tsx` (`bacaRiwayat`/`simpanRiwayat` localStorage).

1. **Piramida (Pyramid Entry)** — masukan: modal, risiko per transaksi %, harga masuk, stop loss. Keluaran: nilai risiko, lembar & lot dasar (`floor(risiko ÷ (masuk − SL) ÷ 100)`), lalu **rencana lapis** saat harga naik: 4 lapis berporsi **50% / 25% / 15% / 10%** dari total lot, tiap lapis pada kenaikan berjenjang (langkah % bisa diatur, bawaan 2%, harga lapis dibulatkan ke tick), dengan **harga rata-rata kumulatif per tahap**. Porsi lapis adalah konvensi kalkulator ini dan ditulis begitu di layar.
2. **Blender Posisi (Average Price)** — masukan: sampai 8 posisi (harga, lot) + fee beli % + fee jual % (bawaan 0,15/0,25). Keluaran: WAP, total modal, **break-even termasuk fee** (dibulatkan NAIK ke tick), preset cut-loss −2/−5/−8% dari WAP (dibulatkan ke tick, tampil harga & rugi rupiah), dan simulasi "tambah posisi baru" → WAP baru.
3. **Bunga-Berbunga (Compounding & DCA)** — masukan: modal awal, setoran bulanan, imbal tahunan %, inflasi tahunan %, horizon tahun. Keluaran: tabel tahunan (saldo nominal, saldo riil terdeflasi) + grafik garis dua seri; rumus riil `(1+r)/(1+i)−1` dicetak.

## G. Halaman baru `/ipo` — IPO & rapor penjamin emisi

1. **Prehitung** `app/scripts/bangun-ipo.mjs` (pola `bangun-screener.mjs`): baca `data-idx/json/profil_stockbit/*.json` ruas `history` (`date`, `price`, `shares`, `underwriters` — string berformat, parse angka pola `rasioTambahanKeystats.ts`) + `ohlc/<KODE>.json` → `data-idx/json/ipo.json`:
   - per emiten: kode, tanggal listing, harga IPO, dana (harga×lembar), close+return pada **1D** (bar pertama ≥ tanggal), **1W** (5 bar), **1M** (21 bar), **Kini** (bar terakhir);
   - **normalisasi nama underwriter**: uppercase, buang `PT`/`Tbk`/tanda baca/spasi ganda; JANGAN menebak sinonim di luar itu — nama yang tetap beda dibiarkan beda (jujur);
   - agregat per underwriter: n IPO, win rate per horizon (**win = return > 0**, definisi dicetak di layar), median return.
   - Emiten tanpa `history`/harga (≤2 berkas) dilewati dan DIHITUNG di ruas `dilewati`.
2. **View `IpoAnalysis.tsx`** rute `/ipo`, menu kelompok Analisa, label **IPO Papan**: kartu ringkas (n IPO per tahun, success rate 1D/1W/1M/Kini), tabel IPO (filter tahun, kolom return per horizon, underwriter chips), tab **Penjamin Emisi** (rapor per underwriter). `KonteksData` tanggal dari isi `ipo.json`.
3. **Registrasi WAJIB dua tempat** (aturan CLAUDE.md): `PETA_MENU_KUNCI` (`aksesHalaman.ts`) + baris `akses_halaman` Supabase (tingkat `publik` — perilaku berjalan) — baris DB dikerjakan pengawas (main loop), BUKAN agen.
4. Batas jujur di layar: harga IPO & penjamin dari profil publik (atribusi "Stockbit" boleh); return dari harga penyesuaian; "Kini" = bar terakhir arsip.

## Kriteria terima (semua paket)

6 butir baku `pengantar_pembagian_kerja.md` + khusus: (E) metrik indeks satu watchlist 3 emiten dihitung ulang manual python — total return & win rate cocok; (F) blender: WAP & break-even dicek tangan 2 posisi; piramida: jumlah lot lapis = total; (G) satu underwriter dihitung ulang manual dari `ipo.json` (n, win rate); return BBCA sejak IPO masuk akal vs harga kini. Leak pass semua layar. tsc + vitest hijau.
