# Spek — Metrik Selisih-Pasar (pra-registrasi)

**Dari:** Fable (pengawas, sesi AI Skill) · **Untuk:** sesi PAPAN · **1 Sep 2026**
**Asal:** usulan Johan (verbatim): *"kita bisa berkaca pada pergerakan IHSG juga, jika
IHSG hari ini turun maka bnyk saham turun tapi saham pilihan malah naik dan sebaliknya,
dan data-data itu sudah lengkap sebelum 5 september"* — atas bantahannya terhadap klaim
"harus menunggu 5 Sep".

**Berkas ini adalah PRA-REGISTRASI.** Definisi di bawah dikunci pada 1 September 2026,
SEBELUM satu pun nilai maju dihitung. Mengubah definisi sesudah melihat hasil = memilih
metrik yang menyanjung, dan itu membatalkan seluruh gunanya. Kalau definisinya ternyata
perlu diubah, ubah — tapi nilai yang sudah terbit atas definisi lama tidak ditulis ulang,
dan perubahannya dicatat di sini bertanggal.

---

## 1. Definisi

Untuk tiap sinyal (emiten E, tanggal sinyal T), pada hari bursa ke-k sesudah T:

    selisih_k(E,T) = return_harian(E, hari_k) − baseline(hari_k)

- `return_harian(E, k)` = tutup(k) / tutup(k−1) − 1, dari `data-idx/json/ohlc/`.
- **`baseline(k)` UTAMA = median return harian seluruh emiten BERVOLUME hari itu**
  (equal-weight; pola yang sama dengan pengukuran 31 Agu: 831 emiten bervolume).
  BUKAN IHSG — IHSG cap-weighted, didominasi bank besar; saham pilihan kecil bisa
  "kalah dari IHSG" padahal menang melawan pasar yang sesungguhnya.
- **Kolom kedua = versus IHSG** (`ihsg_harian.json` / `ohlc/IHSG`), karena Johan
  bertanya dalam istilah itu. Ditampilkan, tidak dipakai sebagai baseline keputusan.
- Agregat kohort per hari: **median** selisih_k seluruh sinyal kohort (median, bukan
  rata-rata — satu saham meledak tidak boleh mewakili kohortnya).
- Kumulatif: jumlah selisih harian per sinyal, lalu median antar sinyal.

## 2. Dua kelas, dua label — jangan dicampur

| kelas | data | label wajib di halaman |
|---|---|---|
| **REKONSTRUKSI** | mundur atas seluruh arsip (aturan hari ini diterapkan ke masa lalu) | "sinyal direkonstruksi, bukan catatan harian" |
| **TERKUNCI** | maju atas kohort yang daftarnya sudah tertulis di `data-idx/json/rekomendasi/` sebelum harinya | "kohort dikunci sebelum hari yang diukur" |

Kelas REKONSTRUKSI menjawab pertanyaan Johan yang mundur: **pecah menurut rezim —
hari IHSG naik vs hari IHSG turun** — lalu jawab: *saat pasar turun, apakah saham
pilihan aturan ini tetap di atas median pasar?* Itu sekaligus menambal caveat
"satu rezim" yang tercatat di semua halaman angka.

Kelas TERKUNCI dilaporkan **tiap hari** mulai 1 Sep: kohort 31 Agu (pemutus lama,
berlabel begitu) dan kohort 1 Sep+ (pemutus baru). Dua kohort, dua baris — jangan
dijumlah jadi satu.

## 3. Penjaga sirkularitas (§CORE-208) — WAJIB

**Hari pertama yang boleh dihitung untuk sebuah kohort = hari bursa PERTAMA SESUDAH
tanggal kuncinya.** Kohort 31 Agu: mulai 1 Sep, BUKAN 31 Agu — gerak harga 31 Agu ikut
menentukan siapa yang masuk daftar hari itu, jadi menghitungnya berarti mengukur hal
yang sama dua kali. Kesalahan persis ini sudah dibayar 31 Agu (jarak 2,39 poin yang
sebenarnya 1,18).

## 4. Kedudukan terhadap TP/SL

Metrik ini **berdampingan** dengan win rate TP/SL, tidak menggantikannya:

- **TP/SL** = metrik PRODUK — janji di layar PAPAN berbentuk TP/SL, dinilai saat
  jendela tutup (kohort 31 Agu: 5 Sep). Menilainya lebih awal tetap dilarang.
- **Selisih-pasar** = metrik SKILL — apakah pemilihannya mengalahkan pasar, terlepas
  dari arah pasar; bisa dilaporkan harian tanpa memotong jendela apa pun.

Dua pertanyaan berbeda; dua angka; keduanya tampil dengan labelnya.

## 5. Kriteria terima

```bash
# definisi terkunci sebelum nilai maju pertama terbit
git log --format="%ad %s" --date=short -- docs/spek-dev-papan/spek_metrik_selisih_pasar.md
# tanggal commit spek <= tanggal nilai maju pertama di halaman

# baseline yang dipakai kode = median bervolume, bukan IHSG
grep -n "median\|IHSG" <berkas penghitung>   # IHSG hanya di kolom pembanding
```

Plus di halaman: tiap angka membawa kelas (REKONSTRUKSI/TERKUNCI), kohort, hari-ke,
dan n sinyal — penyebut selalu tercetak.
