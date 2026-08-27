Dari sesi AI Skill (Fable), 25 Agu 2026 — ADENDUM LINTAS-SPEK **"RAPOR & BADGE WIN RATE"**. Mengikat SEMUA paket spek (Whale, RBS/Gap/intraday/BT Papan, Harian Papan, Jago Papan, Edu Papan) DAN halaman existing PAPAN. Asal perintah Johan (verbatim): *"setiap menu analisis itu punya ukuran win rate / probabilitas atau sejenis nya supaya fitur-fitur yang sudah kita bangun tidak hanya oh bagus tapi memang menghasilkan sesuatu yang kita butuhkan"* · *"boleh buat rapor dan badge win rate, dan kedepannya akses untuk lihat rapor dan badge win rate bagi pengguna Papan yang memiliki badge Diamond saja, dan tidak hanya spec yang sudah ada tapi halaman-halaman skrg yang ada di PAPAN contoh seperti Deep Dive itu juga perlu dibuatkan … 18 agustus di simpan kemudian di cek di 24 agustus berapa win rate nya"*.

# Dua ukuran, jangan dicampur

1. **Rapor emiten (kolom form)** — deret hasil harian saham itu sendiri: `▲▲▲▲▼ 4-1`. Definisi bawaan **close > open hari itu** (persis contoh Johan "sejak harga open"); toggle alternatif close-vs-close kemarin. Jendela bawaan 5 hari bursa terakhir. Murni OHLCV chartbit. Dipasang sebagai kolom opsional di SEMUA tabel emiten (Harian, Jago, Screener hasil, Neo).
2. **Rapor fitur (BadgeRapor)** — win rate mengikuti sinyal/analisa fitur. Dua sumber:
   - **Mundur**: berkas beku hasil BT Papan (`bt/`).
   - **Maju**: snapshot beku `rekomendasi/` — dinilai berjalannya waktu.

# Komponen `BadgeRapor` (satu komponen, dipakai semua halaman)

Isi wajib: `win % · horizon · n · rentang data`. Klik = buka rincian di BT Papan / riwayat snapshot.

Aturan kejujuran (tidak boleh dilanggar implementasi):
- Warna dari angka: hijau ≥55% · abu 45–55% ("belum terbukti unggul") · merah <45%. `n` selalu tampil; `n<100` diberi cap "sampel kecil".
- Dua angka bila keduanya ada: `backtest 51% · live 48% (30 hari)`. Live jauh di bawah backtest = peringatan dini fitur basi (tanda ⚠ otomatis bila selisih >10 poin).
- Badge hanya MEMBACA berkas beku (`bt/*.json` ber-hash, `rekomendasi/*.json` append-only). Tidak ada jalur edit dari UI. Tidak boleh disetel tangan.
- Badge bukan cuma kabar baik: fitur yang backtest-nya jelek tetap memakai badge merah/peringatan (contoh Gap beli-di-open −0,71%).

# Gerbang akses: Diamond saja

- Seluruh keluaran rapor fitur (BadgeRapor, kolom form, halaman riwayat snapshot, tab Riwayat & Win Rate) **hanya tampil untuk pengguna ber-badge Diamond**.
- Non-Diamond: elemen disembunyikan penuh ATAU diganti placeholder terkunci ("🔒 Rapor — Diamond") — pilih satu, konsisten se-app; rekomendasi: placeholder terkunci supaya fiturnya diketahui ada.
- **Catatan jujur untuk implementor**: kalau PAPAN belum punya sistem badge pengguna (Diamond dst), JANGAN mengarang sistem auth baru diam-diam — lapor dulu ke Johan bentuk sistem badge yang diinginkan (lokal? akun?). Gerbang ini menunggu keputusan itu; sementara belum ada, pakai flag konfigurasi `raporDiamondOnly` (default true) + toggle developer.

# Retrofit halaman EXISTING (bukan cuma spek baru)

## Deep Dive — kontrol waktu (contoh eksplisit Johan)

Masalah: analisa Deep Dive dilihat tanggal 18 Agu, tidak ada cara mengecek 24 Agu "apakah analisa itu benar".

Mekanisme **Snapshot Analisa**:
1. Tombol "📌 Simpan analisa" di Deep Dive → menulis berkas beku `rekomendasi/deepdive/<KODE>_<YYYY-MM-DD>.json`: tanggal simpan, emiten, nilai-nilai kunci yang tampil saat itu (skor, fase, accdist, level RBS bila ada), dan **tesis pengguna** (pilih: Naik / Turun / Netral + catatan bebas opsional).
2. Halaman **Riwayat Snapshot** (bagian Deep Dive atau BT Papan): tabel semua snapshot + kolom otomatis `H+1 … H+N` (return dari close tanggal simpan; entry alternatif open H+1 mengikuti konvensi BT Papan), status per hari ▲/▼, dan verdict `WIN/LOSS` vs tesis (Naik = win bila return horizon > 0; horizon bawaan H+5, bisa dipilih).
3. Contoh Johan terpetakan persis: simpan 18 Agu → dicek 24 Agu → 4 hari naik 1 hari turun = form `▲▲▲▲▼`, verdict tergantung tesis+horizon.
4. Snapshot **append-only**: tidak bisa diedit/dihapus dari UI setelah dibuat (kejujuran rapor); salah simpan = tandai `dibatalkan` (tetap tercatat).
5. Agregat: win rate seluruh snapshot Deep Dive per pengguna = "rapor maju" halaman Deep Dive sendiri, tampil sebagai BadgeRapor di kepala halaman.

## Halaman existing lain (pemetaan wajib)

| Halaman | Bentuk rapor |
|---|---|
| Deep Dive | Snapshot Analisa (di atas) + BadgeRapor agregat |
| Screener (preset) | BadgeRapor per preset dari BT Papan + tombol "uji preset ini di BT Papan" |
| Broker Summary v2 | kolom form emiten + (opsional, tahap 2) rapor sinyal accdist: "Big Acc terdeteksi → H+5 naik x% kasus" |
| Kalkulator / Kuli Papan | `TP tercapai: x% dalam N hari` — dari riwayat kalkulasi tersimpan (perlu mulai menyimpan input kalkulasi sebagai snapshot juga) |
| Neo Papan (semua tab) | kolom form emiten; tab Fase Bandar: BadgeRapor "fase akumulasi → 20 hari naik x% kasus" |
| Chart/pola (RBS, Gap) | badge angka backtest di dekat pola (sudah di spek RBS/Gap) |

Halaman DATA murni (arsip, referensi, tabel mentah) TIDAK diberi badge — badge hanya untuk fitur yang mengklaim/menyiratkan analisa.

# Kontrak angka, bukan kontrak visual

Ketetapan Johan soal improvisasi UI/UX: adendum ini mengikat **angka, n, horizon, sumber beku, aturan warna, gerbang Diamond, dan append-only**. Bentuk visual (letak badge, gaya kolom form, ikon) BEBAS diimprovisasi sesi Papan Trading — asal semua elemen kontrak tampil dan tidak ada angka yang bisa disetel tangan.

# Data & implementasi

- Sumber: OHLCV chartbit (form, return H+N), berkas beku BT Papan, snapshot `rekomendasi/`. **Tidak butuh panen baru.**
- Satu berkas indeks `bt/index.json` (fitur → hasil backtest terkini + hash) sebagai satu-satunya pintu baca BadgeRapor mundur.
- Snapshot dinilai memakai data FINAL tutup pasar (jangan data hari berjalan — konsisten aturan arsip).
- Uji: 1 kasus regresi per definisi (form close>open vs close-vs-close; verdict WIN/LOSS; H+N dari close simpan). Dua viewport + tema terang/gelap. `docs/jejak-permintaan.md` per tugas; Metodologi memuat definisi form, verdict, dan gerbang Diamond.
