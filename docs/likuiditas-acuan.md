# Ambang likuiditas — acuan resmi & angka pasar kita sendiri

Dicatat 22 Agustus 2026 atas permintaan Johan: *"betul itu penting juga likuid
tidak nya saham itu karena nilai transaksi, bisa web search untuk referensi itu,
penting juga kedepannya ada filter likuidtas"*.

## 1. Bagaimana IDX sendiri mengukur likuiditas

**Indeks IDX80 / LQ45 / IDX30** (Panduan & Metodologi Indeks, PDF resmi IDX,
dibaca langsung 22 Agu 2026) memakai **peringkat relatif**, bukan ambang rupiah
tetap. Saham semesta wajib:

1. Konstituen IHSG yang **tercatat > 6 bulan**;
2. Masuk **150 saham teratas berdasarkan nilai transaksi di pasar reguler
   selama 12 bulan terakhir**;
3. **Tidak tersuspensi** dan ditransaksikan dalam 6 bulan terakhir;
4. Memenuhi batas minimum kapitalisasi pasar free float;
5. **Rasio free float ≥ 10%**.

Dari semesta itu dipilih 80 → 45 → 30 dengan mempertimbangkan **likuiditas**
(nilai transaksi, frekuensi transaksi, kapitalisasi free float) dan
**fundamental** (kinerja keuangan, kepatuhan).

**Papan Pemantauan Khusus** memakai ambang ABSOLUT untuk sisi sebaliknya —
"likuiditas rendah": nilai transaksi rata-rata harian **< Rp5 juta** DAN volume
rata-rata harian < 10.000 saham selama 3 bulan di pasar reguler. Catatan: BEI
mengusulkan **menghapus** kriteria likuiditas ini dari PPK (revisi 2026, target
Q3-2026) — jadi angka Rp5 juta tak layak dijadikan jangkar jangka panjang.

## 2. Sebaran likuiditas pasar kita sendiri

Diukur 22 Agu 2026 dari `data-idx/json/ohlc/` — **median nilai transaksi 20 hari
bursa terakhir** per emiten (close × volume), 923 emiten yang punya ≥ 20 lilin:

| Ambang | Lolos | Porsi |
|---|---|---|
| ≥ Rp5 juta (PPK lama) | 820 | 88,8% |
| ≥ Rp100 juta | 605 | 65,5% |
| **≥ Rp500 juta** (ambang PAPAN sekarang) | 391 | 42,4% |
| ≥ Rp1 miliar | 313 | 33,9% |
| ≥ Rp5 miliar | 176 | 19,1% |

Titik acuan lain: median pasar **Rp272 juta/hari**; peringkat ke-150 (setara
semesta IDX80) ada di **Rp7,3 miliar/hari**; peringkat ke-45 di **Rp42,7
miliar/hari**.

## 3. Apa artinya untuk PAPAN

- Ambang **Rp500 juta/hari** yang dipakai `kartu_analisa.py` (populasi statistik)
  dan `prob.py` (`NILAI_MIN`, pool observasi) **jatuh di sekitar median atas
  pasar** — ia menyaring separuh papan yang paling tidur. Untuk tujuan
  *statistik* itu masuk akal dan sekarang punya dasar tertulis; ia jauh lebih
  ketat daripada PPK (Rp5 juta) dan jauh lebih longgar daripada semesta IDX80
  (Rp7,3 miliar).
- Untuk **filter di layar** (Screener/Kartu/Watchlist), tirulah IDX: jangan satu
  ambang keras, tapi **beberapa tingkat yang bisa dipilih pembaca** —
  mis. `≥ Rp1 mrd` · `≥ Rp5 mrd` · `semesta IDX80 (150 teratas)` — plus penanda
  kualitas seperti yang sudah dipasang di Kartu Analisa ("likuiditas tipis").
  Peringkat relatif ikut bergerak bersama pasar; ambang rupiah tetap akan basi
  seperti Rp5 juta milik PPK.
- Ukurannya sebaiknya **median**, bukan rata-rata: satu hari crossing raksasa
  (mis. DSSA Rp1,42 T di pasar negosiasi, 19 Agu) menaikkan rata-rata sebulan
  tanpa membuat sahamnya benar-benar mudah dijual keesokan harinya. Untuk alasan
  yang sama, nilai transaksi dihitung dari **pasar reguler**, sesuai definisi
  IDX — dan itu memang yang tersimpan di `ohlc/` kita (lihat CLAUDE.md soal
  `Volume` vs `NonRegularVolume`).

Sumber:
- Panduan dan Metodologi Indeks IDX80, LQ45 dan IDX30 (idx.co.id, PDF resmi)
- Peraturan/penjelasan Papan Pemantauan Khusus + berita revisi kriteria 2026
