# Panen harga bulanan seluruh emiten — laporan

Dibuat 15 Agustus 2026. Skrip: [`scripts/panen_seasonality.py`](../scripts/panen_seasonality.py).
Keluaran: `data-idx/json/seasonality/harga_bulanan.json`.

## ⚠️ Datanya BUKAN sejak IPO

Ini temuan terpenting dari panen ini, dan perlu diputuskan sebelum halaman
Seasonality dibangun.

`range=max` di Yahoo berarti "sejauh Yahoo menyimpan", bukan "sejak emiten
tercatat di BEI". Untuk emiten IDX, Yahoo praktis mulai sekitar tahun 2000 —
dan bahkan setelah itu, awal seri tiap emiten berbeda-beda tanpa pola yang
bisa ditebak:

| Emiten | IPO di BEI | Data Yahoo mulai | Yang hilang |
|---|---|---|---|
| ASII | April 1990 | Oktober 2000 | 10 tahun |
| ABDA | Juli 1989 | Oktober 2001 | 12 tahun |
| AALI | Desember 1997 | April 2001 | 3 tahun |
| ANTM | November 1997 | September 2005 | **8 tahun** |
| BBCA | Mei 2000 | Juni 2004 | 4 tahun |

Titik data paling tua di seluruh panen: **Agustus 2000**.

Akibatnya untuk halaman Seasonality:

* Kalimat "sejak IPO" tidak boleh dipakai di antarmuka. Yang benar: **"sejak
  data tersedia"**, dengan tanggal mulai ditampilkan per emiten.
* Krisis 1998 tidak ada di data mana pun. Seasonality yang dihitung dari sini
  tidak pernah melihat rezim itu.
* ANTM kehilangan 8 tahun sementara AALI cuma 3 — membandingkan dua emiten
  berarti membandingkan dua rentang waktu yang berbeda, kecuali rentangnya
  disamakan lebih dulu. Halaman harus menyediakan penyamaan itu, atau
  setidaknya menandai perbedaannya.

Kalau riwayat pra-2000 memang dibutuhkan, sumbernya harus lain (arsip IDX
sendiri), dan itu pekerjaan terpisah dari panen ini.

## Cara kerja panen

| | |
|---|---|
| Sumber | Yahoo Finance chart API, `interval=1mo` |
| Harga | `adjclose` — sudah menyerap right issue & reverse split |
| Bentuk | `{kode: {"YYYY-MM": harga}}` |
| Panen penuh | `python scripts/panen_seasonality.py --penuh` |
| Penyegaran harian | `python scripts/panen_seasonality.py` |

**Harian tidak menarik ulang.** Seasonality bulanan hanya berubah saat bulan
berganti; mode harian cuma mengambil `range=3mo` dan menimpa bulan-bulan
terakhir. Menarik ulang seluruh riwayat 963 emiten setiap pagi berarti ratusan
permintaan berat untuk mengubah satu angka per emiten.

Emiten yang belum pernah dipanen tetap ditarik penuh walau mode harian —
menyegarkan 3 bulan dari seri yang belum ada cuma menghasilkan riwayat tiga
bulan.

## Agar Yahoo tidak menganggap kita mesin pengeruk

Endpoint ini tidak berdokumentasi resmi. Kalau digedor, balasannya 429 lalu
pemblokiran sementara per-IP.

| Pengaman | Alasan |
|---|---|
| Satu permintaan pada satu waktu, tanpa paralel | 963 emiten jadi ~20 menit — harga yang benar untuk data yang berubah sekali sehari |
| Jeda **acak** 0,9–1,6 detik | Jeda yang persis sama tiap kali justru pola paling mudah dikenali sebagai mesin |
| User-Agent browser + `Accept` / `Accept-Language` | UA bawaan urllib ditolak; header setengah jadi juga mencurigakan |
| Backoff 5s → 15s → 45s pada 429/5xx | Menghormati `Retry-After` kalau server menyebutnya |
| **Berhenti setelah 3 penolakan beruntun** | Memaksa terus saat sedang ditolak adalah cara mendapat blokir yang lebih panjang |
| Titik simpan tiap 50 emiten | Mati listrik tak mengulang dari nol; jalan berikutnya melanjutkan |

Hasil uji: 12 emiten pertama lolos tanpa satu pun penolakan, 18 detik.

## Anomali yang sudah ditangani

**Yahoo tidak selalu menghormati `interval=1mo`.** Untuk emiten yang baru
tercatat, ia mengirim candle MINGGUAN — ketahuan 15 Agustus 2026 pada VKTR
(165 titik untuk rentang 39 bulan) dan ALII. Kalau dipakai apa adanya, "imbal
bulanan" sebenarnya imbal mingguan, dan satu bulan kalender terhitung 4–5 kali
di ember seasonality-nya.

Pengelompokan ke bulan karena itu dikerjakan di sisi kita: harga bulan = titik
terakhir di bulan itu. Untuk seri yang memang sudah bulanan, langkah ini tidak
mengubah apa pun.

## Ukuran berkas dan langkah lanjutan

Ekstrapolasi dari 100 emiten pertama: **± 3,7 MB** untuk 963 emiten (perkiraan
awal 8 MB terlalu tinggi — emiten di awal alfabet kebetulan berumur panjang).

Masih terlalu berat untuk diunduh sekali di telepon. Dua pemangkasan yang
sudah disepakati untuk menyusul setelah data lengkap ada:

1. **Pecah per huruf awal** (`harga_A.json`, …) — pengunjung cuma mengunduh
   yang emitennya dicari. Paling efektif.
2. **Simpan imbal bulanan (%) 2 desimal**, bukan harga penuh — halaman toh
   menghitung persentase. Kira-kira memangkas separuh.

Gabungan keduanya membuat unduhan tinggal puluhan KB per pencarian, dengan
seluruh riwayat tetap tersimpan.
