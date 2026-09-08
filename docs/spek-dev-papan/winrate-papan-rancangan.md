# Rancangan Sistem Winrate PAPAN (lampiran spek #91)

**Asal:** Johan 8 Sep 2026 *"kirim model paling pintar dan canggih untuk bangun sistem winrate papan berdasarkan data termasuk volval"* — ditulis agen Opus atas perintah pengawas, dibantah pemeriksa Opus (setia pada mesin; koreksi pemeriksa yang belum diterapkan di teks di bawah: (1) H+60 punya ≤4 pengamatan, bukan mustahil; pembatas H+120/200 adalah jalan ke depan sejak sinyal terawal, bukan panjang arsip intraday — memperpanjang jendela ke belakang berarti mengubah `["d"][-120:]` di `volval.py:kalender_dan_harga()`; (2) §7: bukan "seluruh" sel H+10 kelas D, tiga sel kelas C; (3) biaya datar 0,4% salah bentuk untuk saham fraksi kasar — masukkan ke keputusan Johan bersama 0,3 vs 0,4). Nol kode dieksekusi ke repo.

---

# Sistem Winrate PAPAN — rancangan berbasis data yang sudah ada

**8 Sep 2026** · usulan, nol kode dieksekusi ke repo
**Dasar empiris:** `volval_emiten_demo.json` (dijalankan hari ini) + pembacaan lima mesin di repo.
## 1. Masalah yang membuat sistem ini perlu ada

Lima sumber sudah jalan sendiri-sendiri, dan menjawab pertanyaan yang **berbeda bentuknya**:

| Sumber | Berkas | Satuan sinyal | Penyebut hari ini |
|---|---|---|---|
| Aturan kartu | `rencana_saham.py` | per emiten, tiap hari sinyal | menang/kalah/**gantung**, dua winRate |
| RBS & Gap | `bt_papan.py` | per pola, lintas emiten, top-N likuiditas | trade tuntas, biaya **0,3%** |
| Set Inti | `bt_indikator.py` | per indikator × kerangka waktu | menumpang mesin `bt_papan` |
| Volval | `volval.py` | **top-20 pasar per hari** | median pasar, tanpa biaya |
| Saringan teknikal | `app/src/lib/skor/skor.ts` | skor 0–100 komposit | **tak punya penyebut** |

Dibuktikan hari ini: kriteria Volval adalah peringkat **lintas emiten**, jadi dipakai
per emiten ia nyaris tak pernah menyala — BNBR 1 hari sinyal dari 64, ARCI 0. Sistem
winrate per emiten tak bisa sekadar "membaca ulang" mesin yang ada; ia butuh definisi
sinyal per emiten yang **eksplisit**, bukan diwarisi diam-diam.
## 2. Bentuk keluaran: satu berkas, tiga sumbu

`data-idx/json/winrate.json`, dibangun tiap panen, dibaca halaman apa adanya:

```
winrate[kode][sumber][horizon] = { n, nEfektif, menang, kalah, gantung,
  winRateTuntas, winRateSemua, winRateVsPasar, medianNet, rataNet,
  medianSelisih, biayaPct, kelasBukti, tanggalSinyal[] }
```

**emiten × sumber × horizon** — sumbu `sumber` **tidak pernah dijumlahkan**. Bukan
kehati-hatian berlebih: `dorongan` unggul di H+1 sementara `gelombang` unggul di H+5
(docstring `volval.py`), jadi satu angka gabungan membuang informasi yang paling berguna.
## 3. Penyebut — satu definisi untuk lima sumber

Diambil dari yang paling jujur yang sudah ada (`rencana_saham.py` keputusan #4):

- **`menang`/`kalah`/`gantung` selalu bertiga.** Target & batas tersentuh di hari yang
  sama = **kalah** (data harian tak menyimpan urutannya).
- **`winRateTuntas` dan `winRateSemua` selalu berdampingan.** Yang pertama sendirian
  membuat aturan yang sering menggantung terlihat lebih baik daripada yang selalu tuntas.
- **`winRateVsPasar`** memakai `baseline()` `volval.py` — median emiten **bervolume**,
  bukan seluruh emiten.
- **Hari sinyal tak ikut dinilai**; jendela mulai hari bursa berikutnya.
- **`nEfektif`** = sinyal tersisa setelah jendela tumpang-tindih dibuang (greedy, seperti
  `blok_tak_tumpang()` di demo). **Ini yang ditampilkan besar di layar, bukan `n`.**
  Bukti hari ini: ARCI p50 H+20 memberi "win 100%, n=11" — `nEfektif`-nya **1**. Tanpa
  kolom ini halaman menerbitkan satu lemparan koin sebagai sebelas kemenangan.
## 4. Biaya — diseragamkan lebih dulu

`bt_papan.py` 0,3% pulang-pergi vs `rencana_saham.py` 0,4%. Selama berbeda, angka antar
sumber **tidak setara** dan tak boleh sebaris di satu tabel. → keputusan Johan (§10).
## 5. Menggabungkan sinyal tanpa menjahit angka

**Dilarang:** rata-rata tertimbang lintas sistem, atau satu "skor PAPAN" tunggal — bobotnya
tak punya asal-usul dan tak bisa diuji.

**Boleh,** karena aturannya eksplisit dan penyebutnya tetap terhitung:

- **`serempak`** — emiten yang hari itu memberi sinyal di ≥2 sumber. Ini **sumber ke-6**
  dengan barisnya sendiri, bukan pengubah angka lima sumber lain. Kalau `nEfektif`-nya
  terlalu kecil untuk dibaca, itu hasilnya — bukan alasan melonggarkan definisi.
- **`bertentangan`** — dilaporkan, tidak disembunyikan. Contoh nyata hari ini: `gelombang`
  menaruh BNBR di persentil 7,6% dan ARCI 4,5% (paruh bawah pasar), padahal keduanya ada
  di sepuluh pilihan Johan.
## 6. Ambang: disapu, tidak disetel

Aturan `metode_johan_volval.md` §6 diberlakukan ke semua sumber: tiap ambang disapu
sepenuh rentangnya dan **seluruh permukaannya diterbitkan**; halaman menampilkan permukaan
itu, bukan satu sel. Larangan yang sudah ada (`kandidat_deepdive.py`, BUMI & DSSA peringkat
64/69) berlaku penuh — memilih ambang sesudah melihat hasil emiten favorit = angka kosong.
## 7. Kelas bukti — melekat di tiap sel, bukan catatan kaki

| Kelas | Syarat | Boleh dipakai untuk |
|---|---|---|
| **A** | nEfektif ≥ 30, ≥2 rezim pasar | keputusan dagang |
| **B** | nEfektif ≥ 10 | pembanding antar emiten |
| **C** | nEfektif ≥ 3 | penjelajahan |
| **D** | nEfektif < 3 | ditampilkan "belum cukup", angkanya diredam |

Diukur ke data hari ini: **seluruh** sel Volval per emiten di H+10 dan H+20 jatuh di kelas
**D**. Halaman harus sanggup menampilkan D dengan jujur — itulah sebagian besar isinya di awal.
## 8. Data yang belum ada

| Kebutuhan | Keadaan | Akibat kalau tak ditambah |
|---|---|---|
| Intraday > 70 hari | 2026-05-29..09-07; server simpan ±90 hari; panen **manual** | Volval & 1H/4H terkunci kelas C/D; H+60/120/200 mustahil |
| Rezim pasar kedua | tiga bulan, satu rezim | tak ada sel kelas A dari jalur intraday |
| Biaya seragam | 0,3% vs 0,4% | angka antar sumber tak setara |
| Kategori broker PAPAN | menggantung sejak 26 Agu | jalur bandarmologi belum bisa masuk |

**Mendesak:** hari yang tak dipanen **hilang permanen**. Panen intraday otomatis tiap sore
lebih menentukan nasib sistem ini daripada rumus apa pun di dalamnya.
## 9. Kriteria terima

1. `--uji` hijau untuk lima sumber, termasuk penjaga "fitur tak menyentuh hari yang dinilai".
2. Winrate satu emiten yang dihitung ulang lewat mesinnya sendiri **sama persis** dengan
   yang tertulis di `winrate.json` — nol jahitan, nol beda pembulatan.
3. Tiap sel membawa `nEfektif`, `biayaPct`, `kelasBukti`. Sel tanpa ketiganya = gagal.
4. Nol angka gabungan lintas sumber di berkas maupun layar, kecuali baris `serempak`.
5. Berjalan penuh < 10 menit (pass pasar Volval terukur **27 detik** untuk 875 emiten hari
   ini — anggaran ini realistis, bukan tebakan).
6. Sel kelas D tampil sebagai "belum cukup bukti", bukan sebagai persentase besar.
## 10. Asumsi saya vs keputusan Johan

**Asumsi saya, boleh dibantah:** penyebut menang/kalah/gantung `rencana_saham.py` pantas
jadi standar lima sumber; `nEfektif` lebih penting daripada `n` di layar; ambang kelas
bukti 30/10/3 adalah titik awal, bukan hasil pengukuran.

**Harus diputuskan Johan:**
1. Biaya tunggal seluruh repo — 0,3% atau 0,4%.
2. Definisi "hari sinyal" per emiten untuk Volval: peringkat pasar (mesin, n≈0), ambang
   persentil, atau skor emiten terhadap **riwayat dirinya sendiri**. Tiga pertanyaan berbeda.
3. Volval pembacaan (A) mentah atau (B) harga rata-rata — terbuka sejak 1 Sep.
4. `gelombang` menaruh BNBR/ARCI di paruh bawah pasar sementara Johan memilih keduanya.
   Mana yang diperbaiki — skornya, atau pemahaman kami atas pilihannya?
5. Prioritas panen intraday otomatis. Tanpa ini butir 8 tak pernah selesai.
