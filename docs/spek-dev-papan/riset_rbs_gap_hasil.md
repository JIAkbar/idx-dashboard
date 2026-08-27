# Riset pola RBS & Gap — hasil backtest untuk review Johan (25 Agu 2026)

Asal: Johan — *"saya ada ide pola di chart yaitu RBS = Resistance become Support … dan Pola Gap … buatkan dan analisakan … jadikan pola di chart, setelah itu saya review analisis mu"*.
Metode: backtest di **100 emiten ternilai-transaksi terbesar** (rata-rata value 60 hari), bar chartbit **2018-01-01 → 2026-08-21** (harga sudah disesuaikan pemecahan saham). Skrip: `riset_rbs_gap.py` (scratchpad sesi AI Skill).

## Definisi algoritmik v1 (yang diuji)

**GAP NAIK**: `open(t) ≥ high(t−1) + max(2 tick, 1% × high(t−1))` — ambang tick supaya saham murah tidak banjir gap palsu (1 tick di Rp50 = 2%). Gap turun cermin. "Terisi" = `low` suatu hari kembali ≤ high(t−1).
**RBS**: pivot high (tertinggi 5 bar kiri-kanan) → level resistance = klaster pivot ±1,5% dengan ≥2 sentuhan dalam 120 hari, belum pernah ditutup di atasnya → **breakout** = close > level+1% → **retest** = ≤40 hari kemudian low masuk pita level ±1,5% → **bertahan** = close hari sentuh ≥ level → **konfirmasi** = ≤3 hari close ≥ level+2%.

## Angka hasil

| Uji | Hasil |
|---|---|
| Gap naik, kejadian | 3.897 (≥2%: 2.028); gap turun 3.839 |
| Gap **terisi** ≤5 hari / ≤20 hari | **80% / 88%** |
| Beli di open hari gap → close hari itu | median **−0,71%**, hanya 29% hijau |
| H+5 setelah gap naik | median 0,00%, menang 48% (volume ≥2×MA20 tidak menolong: tetap 48%) |
| Gap tak terisi 5 hari → H+5→H+25 | median 0,00%, 49% (kandidat "breakaway" pun tak beredge) |
| Gap tak terisi + ≥2% + close≥open | median +0,22%, 50% |
| Gap turun → H+5 | median −0,64%, menang 43% (drift turun berlanjut) |
| RBS: breakout | 617 |
| … yang kembali **retest** | 488 (**79%**) |
| … retest **bertahan** di atas level | 348 (**71%** dari retest) |
| H+5 / H+20 setelah retest bertahan | 0,00% (49%) / −1,08% (43%) |
| RBS + konfirmasi mantul (n=248): H+20 | median −1,70%, 43% |
| **Trade RBS**: beli di konfirmasi, **SL = level−3%**, 20 hari | SL kena 129/248 (52%); **yang lolos SL: median +3,89%, 72% menang** |

## Bacaan jujur

1. **Klaim deskriptif RBS BENAR di bursa kita**: breakout hampir selalu balik dulu (79%) dan resistance memang berubah jadi support (71% bertahan). Levelnya nyata.
2. **Sebagai sinyal beli berdiri sendiri, dua-duanya BELUM beredge** pada parameter v1: median return sesudah sinyal ±0%. Gap malah jebakan kalau dibeli di open (−0,71%, 29% hijau) — 88% gap tertutup dalam 20 hari.
3. **Nilai sebenarnya = alat level & manajemen risiko di chart**, bukan pemicu beli:
   - Gap = zona bergambar dengan probabilitas terisi (88%) → target "gap fill" dan area support/resistance bekas gap.
   - RBS = garis level dengan mesin status + tempat SL yang terukur: SL di level−3% membelah hasil jadi dua kubu — gagal cepat & rugi kecil (52%) vs jalan +3,89% median 72% menang (untung:rugi ≈ 1,3:1).
4. Peluang menajamkan (belum diuji, bahan iterasi setelah review): gabungkan dengan ruas bandar (retest bertahan **+ accdist Big Acc hari itu**), batasi tren (close > MA50), atau ukur per tier likuiditas.

## Usulan "jadikan pola di chart"

**Ketetapan Johan (25 Agu): RBS dan Gap adalah DUA POLA TERPISAH — jangan dicampur.** Masing-masing punya toggle sendiri di panel indikator, overlay sendiri, ruas screener sendiri, section Metodologi sendiri, dan statistik backtest sendiri (backtest di atas memang sudah terpisah). Tidak ada fitur gabungan "RBS+Gap"; kombinasi antar-pola hanya boleh terjadi lewat filter Screener yang dipilih pemakai sendiri.

- **Rumah**: halaman **Grafik Emiten / Chart**, dua overlay terpisah:
  - **Pola GAP** (toggle sendiri): kotak gap berarsir — hilang saat terisi, label % terisi historis; berlaku gap naik & turun.
  - **Pola RBS** (toggle sendiri): garis level dengan status berwarna (resistance → tembus → retest → support sah / gagal) + segitiga di titik konfirmasi.
- **Ruas screener** (numpang kartu harian Tugas A), dua kelompok terpisah: GAP → `gap_up_pct`, `gap_down_pct`, `gap_belum_terisi`; RBS → `rbs_status` (breakout/retest/sah/gagal), `rbs_level`, `rbs_jarak_pct`.
- Parameter (pivot 5, sentuhan 2, toleransi 1,5%, buffer 1%, retest 40 hari, SL 3%) di config yang sama dengan preset — "v1", bisa kamu ubah.
- Label kejujuran di UI: "pola deskriptif teruji (data 2018–2026, 100 emiten likuid); bukan sinyal beli — lihat Metodologi untuk angka backtest".

Menunggu review Johan sebelum jadi spek ke sesi Papan Trading.
