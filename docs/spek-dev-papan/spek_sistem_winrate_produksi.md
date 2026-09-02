# Spek — Sistem Win Rate jadi fitur produksi

**Dari:** Fable (pengawas, sesi AI Skill) · **Untuk:** sesi PAPAN · **1 Sep 2026**
**Asal perintah (Johan, verbatim):** *"buatkan sistem winrate kemarin yang kamu lakukan
asli bisa kami pakai"* — menyusul rangkaian backtest 31 Agu–1 Sep.

Semua yang dipelajari dua hari terakhir dikodifikasi di sini supaya fitur produksinya
lahir dengan disiplin yang sama yang menemukan cacat-cacatnya. Rumah fiturnya sudah
ada: halaman **Uji Aturan** (Johan sudah menyuruh pasang ke sana).

## KEPUTUSAN & TANGAN JOHAN

**Tidak ada yang menahan mulai.** Satu keputusan menyusul di tengah: nama & posisi
menu fitur ini (usul: tab di Metodologi — "Angkanya dari mana?"). Kerjakan dulu,
tanya sambil jalan.

## 1. Pipa data harian (otomatis, bukan tangan)

1. Panen sore → `rekap_preset.py` menulis `rekomendasi/<tanggal>.json` — **sekali
   tulis, sudah ada, jangan diubah sifatnya.**
2. **Skrip hakim** menilai sinyal yang jendelanya tutup hari itu:
   - **TERISI DULU, BARU TARGET** — cek gerbang masuk (`entry: [bawah, atas]`)
     sebelum cek TP/SL. Bug urutan-cek BUMI/TPIA dilarang hidup di sini.
     (Prasyarat: sapuan sistemik urutan-cek yang sudah diminta — selesaikan dulu.)
   - Hasil ditulis sekali-tulis juga: `penilaian/<tanggal>.json`.
3. **Tabel TERKUNCI harian** (selisih-pasar, spek pra-registrasi): satu baris per
   kohort per hari, ditulis otomatis, baseline = median emiten **bertransaksi**
   (definisi disamakan SEKALI di spek metrik — bukan "bervolume" di satu tempat dan
   "bertransaksi" di tempat lain).
4. Kedua keluaran baru masuk `MANIFEST` gerbang kesegaran.

## 2. Halaman

- **Angka utama: ekspektansi per sinyal** (sesudah biaya transaksi — sebutkan tarif
  yang dipakai). Win rate tampil sebagai pendukung, per sinyal DAN per saham.
- **Tiap angka membawa label kelas bukti**: CATATAN (sinyal harian sekali-tulis) ·
  TERKUNCI (kohort dinilai sesudah tanggal kunci) · REKONSTRUKSI (backtest).
  Tiga kelas tak pernah dijumlah jadi satu angka.
- **Penyebut selalu tercetak dan menjumlah**: menang + kalah + berjalan = total.
- **Era sampel dipisah**: pemutus-abjad (s.d. 31 Agu) vs pemutus-nilai-transaksi
  (sejak diganti) — dua baris, tidak digabung. "20 dari N yang lolos" dengan N.
- **Baris rezim**: median/kuartil pasar & IHSG hari itu di samping angka kohort.
- Jendela dieja di antarmuka: "dinilai dalam 5 hari bursa" pada tiap win rate.
- Nol janji, nol ramalan: frekuensi historis, bukan probabilitas ke depan
  (aturan `berkasRekam.ts` berlaku).

## 3. Yang DILARANG

- Menilai sinyal sebelum jendelanya tutup, atau kohort pada hari kuncinya (§CORE-208).
- Menghitung ulang / menimpa berkas sekali-tulis.
- Menggabung era sampel atau kelas bukti.
- Menampilkan angka rekonstruksi tanpa labelnya.

## 4. Kriteria terima

```bash
# hakim memeriksa gerbang masuk sebelum target
grep -n "entry" <skrip hakim>        # cek terisi mendahului cek tp/sl
# keluaran baru diawasi gerbang kesegaran
grep -c "penilaian\|terkunci" scripts/cek_kesegaran.py   # > 0
```

Render halaman: tiap angka punya label kelas + penyebut; dua era terpisah; baris
rezim ada; angka utama ekspektansi-sesudah-biaya. Uji ulang angka contoh dengan
tangan (satu preset, satu tanggal) dan cocok.

## 5. Urutan

1. Sapuan urutan-cek (prasyarat pembekuan & hakim) → 2. skrip hakim + berkas
   penilaian → 3. tabel TERKUNCI harian otomatis → 4. halaman → 5. daftarkan ke
   gerbang kesegaran → 6. hitung final 24–28 dibekukan lewat hakim yang sudah bersih.
