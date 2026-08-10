# Metodologi Analisa Harian — Spesifikasi Kerja

Dokumen ini memetakan metodologi terbitan referensi (MTTV) dan menerjemahkannya menjadi
spesifikasi yang bisa kita bangun. Dipakai sebagai acuan tunggal untuk pekerjaan berikutnya:
pipeline data, penulisan analisa, dan tata letak keluaran.

- **Sumber referensi:** `data referensi/CSMTTV10826P.pdf` — 25 halaman, terbitan 10 Agustus 2026,
  kode `MTTV-100826-B01..B04`, penerbit *Creepy Stocks*, dibuat di Canva lalu diekspor sebagai gambar.
- **Cakupan pembacaan:** 11 dari 25 halaman dibaca langsung (sampul, 2 halaman IHSG, 7 halaman emiten
  lintas kasus, halaman peringkat). Struktur terkonfirmasi silang: halaman peringkat memuat 21 ticker,
  cocok dengan 21 halaman emiten.
- **Status:** spesifikasi, belum ada implementasi.

---

## 1. Anatomi terbitan

| Halaman | Jenis | Jumlah |
|---|---|---|
| 1 | Sampul | 1 |
| 2 | IHSG Daily View | 1 |
| 3 | Flow Asing IHSG | 1 |
| 4–24 | Halaman emiten | 21 |
| 25 | Quant Opportunity Ranking | 1 |

Satu emiten = satu halaman penuh. Tidak ada halaman yang memuat dua emiten.

---

## 2. Halaman IHSG Daily View

Lima blok bernomor dengan urutan tetap:

| # | Blok | Isi |
|---|---|---|
| 1 | Daily View | Level penutupan, persentase perubahan, penilaian struktur secara naratif |
| 2 | Level Penting | Support utama, support dekat, resistance utama, target lanjutan, potensi pekan ini |
| 3 | Skenario Utama | Kondisional: "Jika bertahan di atas X … peluang menguji Y" |
| 4 | Catatan Sentimen | Konteks makro/global dan peringatan atas level yang perlu dihormati |
| 5 | Kesimpulan | Ringkasan satu paragraf + baris tegas `Support X • Resistance Y` |

Angka IHSG ditulis dengan empat desimal (`6.409,6540`), mengikuti presisi indeks.
Warna: hijau untuk support dan angka positif, merah untuk resistance dan angka negatif.

---

## 3. Halaman Flow Asing IHSG

Empat blok:

| # | Blok | Isi |
|---|---|---|
| 1 | Ringkasan Foreign Flow | Narasi + tabel: Foreign Buy Regular, Foreign Sell Regular, Net Foreign Buy Regular |
| 2 | Pasar Reguler | Penekanan bahwa yang dihitung adalah pasar reguler, bukan negosiasi. Ditutup blok `Catatan:` |
| 3 | Domestic Flow | Pembacaan sisi domestik. Ditutup blok `Implikasi:` |
| 4 | Kesimpulan Flow | Ditutup blok `Bias:` |

Pembedaan **reguler vs negosiasi** adalah inti halaman ini — net buy di pasar reguler dianggap
sinyal lebih sehat daripada yang didorong transaksi negosiasi.

---

## 4. Halaman emiten — struktur baku

```
┌ Header ─────────────────────────────────────────────────────┐
│ $TICKER   Nama Perusahaan Tbk.          CLOSE n   ±n,nn%     │
├ Chart ──────────────────────────────────────────────────────┤
│ TradingView harian: MA20, MA50, Fibonacci, level horizontal  │
├ Kiri ──────────────┬ Kanan ─────────────────────────────────┤
│ BIG MONEY FLOW     │ LABEL BIAS              TINGKAT RISIKO  │
│ tabel broker       │ FLOW     — klasifikasi | net | (top-10) │
│ top-10 beli & jual │            narasi siapa memimpin        │
│ kolom: B.val B.lot │ TEKNIKAL — posisi vs MA, level ditembus │
│ B.freq B.avg /     │ SUPPORT     a • b • c • d               │
│ S.val S.lot        │ RESISTANCE  a • b • c                   │
│                    │ STRATEGI — kalimat tindakan             │
│                    │ Invalidation: Close <X                  │
│                    │ Target: A / B / C                       │
│                    │ paragraf konsekuensi jika level gagal   │
├ Footer ─────────────────────────────────────────────────────┤
│ MTTV-DDMMYY-Bnn • TANGGAL      Disclaimer • bukan ajakan     │
└─────────────────────────────────────────────────────────────┘
```

### Aturan tiap ruas

| Ruas | Aturan |
|---|---|
| Support | Selalu **4 level**, urut menurun, dipisah ` • ` |
| Resistance | **3 atau 4 level**, urut menaik |
| Target | Selalu **3 angka**, dipisah ` / `, diambil dari deret resistance |
| Invalidation | Selalu ada, berbentuk `Close <X`. Boleh ditambah `; support mayor Y` |
| Strategi | Satu kalimat, diawali kata kerja: *Buy on weakness*, *Tunggu pullback*, *Hindari chase*, *Jangan mengejar* |
| Paragraf penutup | Wajib menyebut konsekuensi kalau level kunci gagal — bukan pengulangan strategi |

---

## 5. Taksonomi label

### Label bias (dua bagian: arah - karakter)

| Label | Ditemukan pada |
|---|---|
| `BULLISH - BREAKOUT EXTENDED` | ISAT (+14,21%) — sudah naik tinggi, rawan retest |
| `BULLISH - BREAKOUT WATCH` | BRPT, BUMI — menunggu konfirmasi tembus |
| `BULLISH - KONSOLIDATIF` | DEWA — bertahan di atas breakout, flow seimbang |
| `BULLISH - VOLATILE BREAKOUT` | DSSA — tembus tapi wick atas besar |
| `BULLISH - EARLY REVERSAL` | BNBR — baru merebut level, pembalikan awal |
| `BEARISH - PROFIT TAKING` | KOTA (−7,45%) — koreksi setelah rally |
| `BEARISH - BREAKDOWN` | BACH (−9,52%) — gagal mempertahankan level |

Arah ditentukan struktur harga, **bukan** oleh persentase hari itu. BUMI naik +4,47% dengan flow
negatif tetap berlabel bullish karena struktur di atas MA20/MA50.

### Tingkat risiko

Halaman emiten memakai: `MENENGAH` → `TINGGI` → `SANGAT TINGGI`.
Halaman peringkat memakai: `MENENGAH` → `TINGGI` → `EKSTREM`.

> **Inkonsistensi referensi.** KOTA dan BACH tertulis `SANGAT TINGGI` di halaman emiten tapi
> `EKSTREM` di halaman peringkat. Untuk terbitan kita, pilih **satu** skala dan pakai di kedua tempat.
> Rekomendasi: `MENENGAH / TINGGI / EKSTREM` (tiga tingkat, sejajar dengan pemetaan skor di §7).

### Klasifikasi flow

| Klasifikasi | Arti |
|---|---|
| `Accumulation` | Net top-10 positif, pembeli non-scalper dominan |
| `Rotation / neutral` | Net top-10 mendekati nol atau sedikit negatif, tanpa dominasi jelas |
| `Distribution` | Net top-10 negatif, penjual besar dominan |
| `Distribution / retail-led` | Net negatif dan pembeli terbesarnya justru ritel |
| `FLOW DATA GAP` | Data tidak tersedia — lihat §8 |

Formatnya: `Klasifikasi | ≈ ±RpN,N miliar (top-10)`.

---

## 6. Kamus peran broker

Referensi tidak memperlakukan semua net buy sama. Tiap kode broker diberi peran, dan peran itu
mengubah tafsir angkanya.

| Peran | Kode yang eksplisit disebut | Tafsir |
|---|---|---|
| Ritel | `XL` | Beli besar dari ritel **melemahkan** kualitas akumulasi |
| Scalping-prone | `YP`, `MG`, `BQ` | Flow-nya cenderung berbalik cepat, jangan dihitung sebagai keyakinan |
| Non-scalper / institusi | `AK`, `ZP`, `CP`, `AO`, `CC`, `BK`, `SQ`, `PO`, `YU`, `LG`, `AZ` | Ini yang dianggap "big money" sesungguhnya |

Contoh penerapan pada KOTA: *"XL Rp8,9B menjadi buyer terbesar tetapi merupakan ritel"* — pembelian
terbesar justru dijadikan alasan label bearish, bukan bullish.

> Kode di luar daftar ini belum diklasifikasikan referensi. **Jangan mengarang perannya.**
> Perlu dilengkapi dari data broker summary yang akan disiapkan, atau dibiarkan netral.

---

## 7. Model skor — Quant Opportunity Ranking

```
Technical 35% • Big Money Flow 30% • Risk/reward 20% • Liquidity 10% • IHSG sensitivity 5%
```

Skor teramati: 42–84. Pemetaan ke tingkat risiko:

| Rentang skor | Risiko |
|---|---|
| 80–100 | MENENGAH |
| 55–79 | TINGGI |
| ≤54 | EKSTREM |

Halaman peringkat memuat:

1. **Kesimpulan Utama** — menyebut nama terbaik dan terburuk secara eksplisit.
2. **Tabel dua kolom** — `# · TICKER · SKOR · RATIONALE · RISK`. Rationale maksimal ±5 kata.
3. **Blok MODEL** — bobot ditulis terbuka + konteks IHSG hari itu.
4. **Blok EKSEKUSI** — aturan main.
5. **Catatan penalti** — menyebut siapa yang kena penalti dan kenapa.

Dua kalimat yang wajib dipertahankan semangatnya:

> *"Tidak ada konfirmasi berarti tidak ada ukuran agresif."*
> *"Ranking bersifat komparatif, bukan sinyal beli otomatis."*

---

## 8. Aturan integritas data

Ini yang membuat referensi kredibel dan **wajib kita tiru**.

Ketika data flow DSSA tidak ada, referensi tidak menebak. Panel kiri diganti blok merah:

```
FLOW DATA GAP
Screenshot Big Money Flow tidak tersedia pada ZIP.
Tidak ada angka broker yang direkayasa.
```

Konsekuensinya berlapis dan konsisten:
- Ruas FLOW berisi `FLOW DATA GAP | Tidak tersedia`
- Analisa dinyatakan hanya memakai struktur teknikal
- **Skor diberi penalti** (DSSA turun ke 61 / TINGGI)
- Halaman peringkat menyebut penaltinya secara terbuka

**Aturan untuk kita:** komponen data yang hilang tidak pernah diisi perkiraan. Tampilkan
ketiadaannya, beri penalti skor, dan sebutkan di ringkasan. Analisa yang mengaku tidak tahu
lebih berharga daripada analisa yang terdengar yakin di atas data kosong.

---

## 9. Gaya bahasa

| Aturan | Contoh dari referensi |
|---|---|
| Kondisional, bukan prediktif | "Jika bertahan di atas X, peluang menguji Y" — bukan "akan naik ke Y" |
| Selalu ada sisi gagal | "Kehilangan 103 mengembalikan harga ke area MA 99-93" |
| Kualifikasi pelaku, bukan cuma angka | "XL Rp8,9B menjadi buyer terbesar tetapi merupakan ritel" |
| Kata kerja tindakan di Strategi | "Jangan mengejar; tunggu pullback 2.100-2.170" |
| Nada tenang, tanpa sensasi | Tidak ada tanda seru, tidak ada "cuan", tidak ada emoji |
| Disclaimer di setiap halaman | "Analisis probabilistik, bukan ajakan transaksi" |

Angka: pemisah ribuan titik, desimal koma (`6.409,6540`, `Rp917,23 miliar`, `+14,21%`).

---

## 10. Peta kelayakan terhadap data kita

| Komponen model | Bobot | Sumber di proyek ini | Status |
|---|---|---|---|
| Technical | 35% | `data/ds_*.json` (OHLC harian) | **Bisa otomatis** — MA20/MA50, level, Fibonacci dihitung sendiri |
| Big Money Flow | 30% | — | **Tidak tersedia gratis.** Lihat catatan di bawah |
| Risk/reward | 20% | Turunan support/resistance | **Bisa otomatis** |
| Liquidity | 10% | Volume/value harian | **Bisa otomatis** |
| IHSG sensitivity | 5% | Korelasi terhadap seri IHSG | **Bisa otomatis** |

### Catatan Big Money Flow

Broker summary **per saham** tidak ada di endpoint gratis IDX (lihat `kemampuan-trading-idx.md` §92).
Endpoint `GetBrokerSummary` hanya memberi total se-pasar per broker, tidak dipisah beli/jual, tidak
bisa difilter per emiten. Sejak 6 Desember 2021 BEI menutup kode broker selama jam perdagangan,
sehingga broksum per-saham hanya tersedia EOD lewat vendor berlisensi.

Panel BIG MONEY FLOW di referensi adalah **tangkapan layar Stockbit**, bukan data terprogram —
halaman DSSA membuktikannya sendiri.

Tiga jalan:
1. Sumber berlisensi (Sectors.app, IDX Data Services) — berbayar, terprogram
2. Masukan manual per hari — seperti referensi, gratis, tidak terskala
3. Proksi **net foreign per saham** dari `GetStockSummary` — gratis dan legal, menutup sebagian
   pertanyaan yang sama meski bukan pengganti setara

Selama komponen ini belum ada, terapkan §8: tampilkan gap, beri penalti, sebutkan.

---

## 11. Rencana kerja

| Tahap | Isi | Bergantung pada |
|---|---|---|
| A | Pipeline data harian hidup kembali | Workflow `Update IDX Dashboard` berhasil |
| B | Mesin skor 70% (Technical, R/R, Liquidity, IHSG sensitivity) | Tahap A |
| C | Chart per emiten | Lihat catatan di bawah |
| D | Big Money Flow | Data yang disiapkan secara terpisah |
| E | Perakitan halaman + tata letak | B, C, D |
| F | Terbitan (halaman web dan/atau ekspor) | E |

### Catatan chart (tahap C)

Chart referensi dibuat manual di TradingView lalu ditangkap layar. Tiga pilihan untuk kita:

1. **Widget TradingView tertanam** — sudah dipakai di `index_live.html`, interaktif, tanpa kerja tambahan
2. **Render sendiri** dari `data/ds_*.json` memakai lightweight-charts atau Chart.js — penuh kendali,
   bisa dijadikan gambar untuk ekspor
3. **Remote Chrome ke TradingView** — memasang indikator dan menangkap layar secara otomatis.
   Paling mirip referensi. Perlu diperiksa lebih dulu: kebijakan penggunaan TradingView untuk
   otomatisasi dan penangkapan layar, serta kestabilannya untuk 21 emiten per hari.

Belum ada yang dipilih. Keputusan diambil saat tahap C dimulai.

### Aturan verifikasi tampilan

Setiap keluaran visual diverifikasi di tiga ukuran layar sekaligus lewat chrome-devtools:
`1920x1080x1`, `1536x960x1.25`, dan `412x915x2.625,mobile,touch` — dengan batas lipatan nyata
810px pada ukuran telepon.

---

## 12. Yang sengaja tidak ditiru

- **Merek dan identitas visual** referensi (logo, nama, palet spesifik) — kita bangun identitas sendiri.
- **Klaim data yang tidak kita punya.** Kalau Big Money Flow belum ada, jangan tampilkan panel
  kosong yang menyerupai — pakai blok gap yang jujur.
- **Inkonsistensi skala risiko** (§5) — kita samakan sejak awal.
