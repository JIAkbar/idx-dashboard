# Spek riset #221 — lanjutan #217 (aturan DIKUNCI sebelum angka dilihat)

Ditulis 23 Sep 2026 sebelum satu pun hasil dijalankan. Aturan, varian, dan
kriteria di bawah tidak boleh diubah sesudah angka terlihat. Kalau ada yang
tak bisa dijalankan persis, catat di laporan hasil, jangan diganti diam-diam.

Keputusan Johan 23 Sep 2026 (*"hapus saja kita fokus formula kita"*): kriteria
lulus dihitung pada **biaya 0**. Biaya 0,4% boleh dicetak sebagai catatan,
bukan syarat.

## Mesin
- Impor apa adanya dari `scripts/riset/bt_papan.py` (`muat_emiten`, `muat_ihsg`,
  `simulasi_trade`, `ringkas_trades`, `universe_partanggal`, `deteksi_rbs`,
  `ParamRBS`) dan `scripts/riset/bt_broker.py` (`muat_broker`, `fitur_kode`,
  `tandai_sinyal`, `_simulasi_acak`, `_pf`). Sinyal OBV = definisi
  `bt_indikator.sinyal('obv', df)` (OBV menembus maksimum 20 bar sebelumnya).
- Universe: rank likuiditas trailing 60 bar <= 150 per tanggal (sama #217).
- Masuk open H+1. Satu posisi per emiten pada satu waktu.
- JANGAN mengubah bt_papan.py / bt_broker.py / bt_indikator.py.
- Keluaran HANYA ke `data-idx/json/bt_riset/` (folder baru) — BUKAN `bt/`
  dan BUKAN `bt/index.json` (dibaca halaman Berkas Emiten).

## Arah 1 — broker sebagai PENYARING
Sinyal dasar: (a) OBV harian, (b) RBS (retest, definisi run_rbs/`rbs-tpsl`
konfirmasi yang dipakai bt_papan). Penyaring broker pada tanggal sinyal:
- F0: tanpa penyaring (pembanding wajib — penyaring hanya berguna kalau
  mengalahkan sinyal dasarnya sendiri)
- F1: buang sinyal bila rasio_nonritel_N berada di desil TERBAWAH lintas
  emiten universe tanggal itu (distribusi non-ritel)
- F2: pertahankan hanya bila net_nonritel_N > 0
N = 5 dan 10. Keluar: h5, h20, tp_sl (1,5x ATR14%, horizon 20).
Varian = 2 dasar x (F0 + F1xN2 + F2xN2 = 5) x 3 keluar = 30.

## Arah 2 — horizon panjang
Sinyal: OBV harian, RBS, broker S3 (#217: non-ritel desil teratas N=10 dan
close > EMA20). Keluar waktu: h20, h40, h60 (tutup pada close bar ke-N).
Varian = 3 x 3 = 9.

## Uji dan kriteria (sama untuk kedua arah)
- Walk-forward per tahun: varian dipilih dengan PF dalam sampel tahun
  2018..t-1 (tertinggi, n >= 100), lalu diuji di tahun t, t = 2022..2026.
- Pembanding acak: emiten acak dari universe pada TANGGAL yang sama dengan
  sinyal, keluar sama, 20 ulangan -> p50 dan p95 PF.
- Pembanding IHSG: return IHSG pada jendela yang sama (rata-rata per trade).
- **LULUS** bila PF luar sampel > 1,3 DAN > p95 acak di >= 3 dari 5 tahun uji.
  Arah 1 tambahan: varian terpilih ber-penyaring (F1/F2) harus mengalahkan F0
  dasar yang sama di tahun uji yang sama, minimal 3 dari 5 tahun.
- Catat juga: n trade, win rate, ekspektansi, median, drawdown maksimum kurva
  ekuitas sederhana (rata-rata return per trade diurutkan tanggal keluar).

## Keluaran
- `scripts/riset/bt_lanjutan.py` dengan `--uji` (uji bawaan sintetis tanpa
  data nyata) dan `--resmi`.
- `data-idx/json/bt_riset/riset221-<arah>-<varian>.json` + `index.json`.
- `docs/spek-dev-papan/riset_221_hasil.md`: tabel walk-forward per arah per
  tahun (PF uji, p95 acak, lulus/tidak), tabel dalam sampel semua varian,
  vonis akhir per arah, durasi jalan. Angka apa adanya, tanpa tafsir melebihi
  yang tertulis.
- `data-idx/json/bt_riset/ringkas.json` untuk halaman Rapor Uji:
  `{"diperbarui": "...", "arah": [{"nama": "Broker sebagai penyaring OBV/RBS", "lulus": false, "tahun_lulus": 1, "tahun_uji": 5, "kalimat": "<satu kalimat biasa berisi angka, tanpa nama varian mentah>"}, {"nama": "Tahan 20-60 hari", ...}], "riset_sebelumnya": {"nama": "Arus broker sebagai sinyal (#217)", "lulus": false, "tahun_lulus": 0, "tahun_uji": 5, "kalimat": "..."}}`.
