# Jejak permintaan — apa yang diminta, sebelum & sesudah

Dibuat atas permintaan Johan 16 Agustus 2026: *"perlu ada ceklist backlog dalam
bentuk tabel yang mana ada perintah saya dan sebelum dan sesudah perubahan."*

**Kenapa berkas ini ada.** `ceklist-backlog.md` menjawab "apa yang sudah/belum
selesai", `rencana-berjalan.md` menjawab "apa keputusannya". Yang tak terjawab
keduanya: **apa persisnya yang diminta, dan apa yang berubah karenanya.**
Tanpa itu, sebuah baris backlog bisa berumur berhari-hari tanpa ada yang tahu
maksud aslinya — persis yang terjadi pada #130 (lihat bagian paling bawah).

Aturan pengisian:

- **Permintaan** ditulis sedekat mungkin dengan kata Johan sendiri. Kalau
  diringkas, meringkasnya tak boleh mengubah maksud.
- **Sebelum** harus keadaan yang bisa diperiksa, bukan "belum bagus".
- **Sesudah** harus hasil yang bisa dibuktikan — angka, berkas, atau perintah.
- Baris ditambahkan **saat pekerjaannya selesai**, bukan saat direncanakan.

---

## Sesi 16 Agustus 2026 (siang–malam) — Beranda, Kabar Pasar, Tanya PAPAN

### Admin & kurasi

| # | Permintaan Johan | Sebelum | Sesudah | Commit |
|---|---|---|---|---|
| 1 | "orderbook di ubah ke Broker Summary / perlu ada tombol edit / kalau chart tidak kita perlukan hapus saja kolom nya" | Kolom & input Chart masih ada; setoran tak bisa diubah; istilah "orderbook" di layar | Kolom Chart dibuang, tombol Ubah + mode sunting, gerbang panduan screenshot muncul sebelum modal unggah pertama | `17b39c15` |
| 2 | "jenjang pemula sudah ada tapi jenjang tier nya misal perunggu+icon nya sampai diamond" | Kartu jenjang cuma menyebut tier saat ini | Tangga Perunggu→Diamond dengan lencana | `39f5da7b` |
| 3 | "icon ini berbeda sih / pakai ini saja" | Saya menggambar lambang baru (tunas/perisai/mahkota) tanpa cek proyek sudah punya | Semua pakai `IkonJenjang` yang memang sudah ada; lambang gambaran saya dibuang seluruhnya | `e70ed00d` |
| 4 | "searchable dan pagination ya per 10, sorting juga berdasarkan tinggi jenjang" | Tabel akun tanpa cari/urut/paginasi | Cari email+alias, 7 pilihan urutan (awal: jenjang tertinggi), 10 baris per halaman | `39f5da7b` |
| 5 | "kenapa kok waktu buka page ini ada delay yang berasa? apakah tidak ada di kemampuan terkait lazy load?" | Semua thumbnail diunduh sekaligus — **terukur 302 ms JS vs 5.042 ms jaringan**, gambar 420–520 KB ditampilkan di kotak 40 px | Dimuat saat terlihat saja (IntersectionObserver) | `ab7bd948` |
| 6 | "buatkan keterangan di superadmin untuk saya aturan nya gmn, kalau di tolak, di revisi, di hapus data hilang atau masih ada" | Aturan kurasi cuma ada di kepala | Panel lipat berisi tabel 4 status × 6 akibat, diturunkan dari kode & fungsi SQL yang **sedang berjalan** | `7d5daf78` |
| 7 | "kan kita pernah bahas soal di hapus itu terkait data di supabase tidak bisa sinkron?" | `hapusScreenshot()` menghapus **berkas dulu** lalu menelan galat hapus baris → baris yatim | Urutan dibalik (baris dulu) + hasilnya diperiksa, karena **RLS yang menolak DELETE tidak melempar galat** | `13489191` |
| 8 | "ok hapus saja" (baris yatim INDY) | 1 baris menunjuk berkas yang sudah lenyap | Dihapus; **0 baris yatim, 0 berkas yatim, 24 setoran** | — (SQL) |

### Halaman baru: Beranda & Kabar Pasar

| # | Permintaan Johan | Sebelum | Sesudah | Commit |
|---|---|---|---|---|
| 9 | "page ini sudah tidak lagi halaman utama... news dulu, kemudian kartu-kartu yang inspiratif... identitas sebenarnya itu 'DATA dan INFORMASI'" | Halaman utama = dasbor angka | Beranda baru: identitas, papan IHSG, ringkasan pasar, terbit terakhir, kabar, kartu menu | `29fdfd34` |
| 10 | "teks Papan besar itu bagus tapi masuk di section yang ada angka IHSG nya" | Judul PAPAN di kartu terpisah | Nama PAPAN jadi kepala papan IHSG, satu kartu | `6a493634` `13dd9b23` |
| 11 | "ubah chart ini ke dalam bentuk candle? data ytd yang di tampilkan supaya mewakili di sistem" | Garis | Lilin untuk YTD & 1 tahun (Chart.js floating bar, tanpa pustaka finansial). **Ketahuan bug**: YTD terbaca −26,82% padahal seharusnya −28,43% — dihitung dari lilin pertama, bukan penutupan tahun lalu | `faef198d` |
| 12 | "kalau ini terlihat terlalu luas dan panjang dibagi 2 atau 3 kolom" | Satu kolom selebar layar | Dua kolom | `fb170c00` |
| 13 | "berita di versi mobile di pangkas karena tujuan kita branding... jika berita lebih bnyk user males scroll menu dibawah" | Semua kabar tampil di telepon | Dipangkas di telepon supaya kartu menu tak terkubur | `f575f810` |
| 14 | "RSS Media dan Pengumuman Resmi dari IDX... buatkan juga rumah section news nya" | **Tak ada berita sama sekali** | Halaman `/kabar` + panen 4 sumber | `e1f1cd3e` |
| 15 | "apakah sudah bisa otomatis ini rss feed nya? kirim agentic untuk memperbaiki" | Panen manual dari mesin rumahan | GitHub Actions tiap 2 jam untuk sumber tanpa batasan IP; IDX & IPOT tetap di rumah (403 dari datacenter) | `e1a5bb05` |
| 16 | "informasi ini di landing saja dijadikan 4 kolom dari IDX, Ipot, Stockbit, dan Kontan" | Satu aliran campur | Empat kolom per sumber di Beranda saja | `067bb7f1` |
| 17 | 4 tautan kanal IPOT | IPOT dipanen dari daftar campur (ada politik Amerika, pemilu Zambia) | Empat kanal topik + waktu terbitnya | `094878c7` |
| 18 | "carikan stockbit snips penting juga, perintahkan agent untuk fetch 1 tahun ini" | — | 238 item setahun lewat `?format=json` Squarespace | `ab89418b` |
| 19 | "sweep teks dipanen atau panen diubah jadi update atau terbaru" | Kata "panen" bocor ke layar pengguna | Diganti "diperbarui" | `387573cd` |
| 20 | "IPOT News itu lebih penting bisa ambil datanya 1-3 bulan belakang kalau bisa ya YTD" | Cuma halaman pertama tiap kanal | 737 item, 13 Jul–16 Agu. **YTD TIDAK tercapai**: endpoint mengabaikan `halaman` (halaman 0/1/5/50 membalas 200 `news_id` yang sama) | `b00a8a23` |
| 21 | "CNBC dan detikFinance >>> cabut saja" | 2 sumber bermasalah ikut dipanen | Dicabut; 20 item lamanya dibuang dari `kabar.json` | `10e1f160` |
| 22 | "lokasi dropdown bener2 gak estetik" → "desain dropdown nya gini ya?" | Dropdown menggantung di tengah header; daftarnya digambar sistem operasi (putih terang di panel gelap) | Disatukan jadi satu kendali dengan kotak cari, pakai komponen `Dropdown` proyek yang bertema | `b9604e59` |
| 23 | "kok kosong gini?" (tab IDX cuma 1 baris) | Dedup ber-tautan meringkas **19 pengumuman jadi 1** — semuanya menunjuk satu URL generik | Kunci dedup jadi tautan+judul+waktu; tiap pengumuman kini menunjuk **PDF-nya sendiri** | `23ab2322` |

### Tanya PAPAN

| # | Permintaan Johan | Sebelum | Sesudah | Commit |
|---|---|---|---|---|
| 24 | "apakah ada sistem AI yang tidak bayar biaya?" → "kalibrasi dulu tanpa AI, baru sambungkan Gemini Flash" | Ambang narasi ditebak (>1%, <0,3%) | **Dikalibrasi dari 2.409 hari bursa**: gerak "kuat" = 1,27% (p85), "nyaris datar" = 0,28% (p30) | `d555b683` |
| 25 | "boleh buatkan tombol mengambang dengan icon P yang seperti AI, dan muncul kolom chat" | — | Tombol + panel percakapan | `d555b683` |
| 26 | "P itu boleh tapi tambah lah ada animasi nya dan teks 'AI' nya" / "animasi diluar ini ngapain sih, jadi overflow" / "berikan logo gradient" / "icon nya di perkecil" | Cincin conic berputar **bocor keluar** saat tombol memanjang | Cahaya bernapas di dalam bayangan (selalu terkurung bentuknya), gradasi 2 warna merek, 46 px di telepon | `038470c8` `581fb7fa` |
| 27 | "prioritaskan semua data kita **kecuali yang sifatnya privasi seperti akun kontributor**, dan serap teks di Papan ke Rule Engine" | Cuma menjawab ringkasan harian | Harga, valuasi, sektor, kinerja setahun, kepemilikan KSEI, grup konglomerat, kalender bursa — **tanpa menyentuh data akun kontributor sama sekali** | `fd1479d6` |
| 28 | "kalau perlu ada agent yang membantu untuk explorer glosarium sehingga tidak bnyk menggunakan gemini flash" | — | **75 istilah** ditambang dari korpus PAPAN sendiri, tiap entri bawa frekuensi + kutipan asli | `6e885a2c` `3d107035` |
| 29 | "kok tidak bisa jawab terus sih" (dari tangkapan layar) | "kondisi pasar sekarang" ditolak karena tak menyebut kata IHSG | Dijawab ringkasan hari itu. **Ketahuan dari uji peramban, bukan dari tes** — tes cuma menanyakan yang sudah kepikiran | `e04c2f02` |
| 30 | "scrollnya harus inline beginian, gutter tipis 2px saja cukup" | Batang gulir tebal bawaan sistem (15 px) | Aturan **bawaan** `.lantai ::-webkit-scrollbar` — 1 px, berlaku ke semua panel baru tanpa perlu disalin | `13489191` |

### Rilis & tata kelola

| # | Permintaan Johan | Sebelum | Sesudah | Commit |
|---|---|---|---|---|
| 31 | "cabut keduanya dari manifest sekarang" (edisi Mingguan & Bulanan) | Dua edisi terbit tanpa diminta; mingguan **21 dari 24 halaman identik karakter-per-karakter** dengan edisi harian | Dicabut dari manifest (PDF tetap tersimpan); rakit ulangnya jadi #166 | `c53606ec` |
| 32 | "sebaran data gini baiknya tanggal di kolom pertama ya? bayangkan misal dalam 3 bulan data sudah lebih dari 60" | Tanggal bukan kolom pertama, tanpa paginasi | Tanggal jadi kolom pertama + paginasi + filter | `c53606ec` |
| 33 | "#160 jalankan sekarang" | 3 objek SQL masih menyaring `'ditolak'` yang tak ada → **akurasi semua kontributor selalu 100%** | Diperbaiki + 7 berkas klien. Superadmin kini **96% (22/23)** | `24dc03c8` |
| 34 | "Track saja CLAUDE.md" | Ber-gitignore → aturannya tak terbawa ke worktree baru | Di-track (dicek dulu tak memuat rahasia) | `24dc03c8` |
| 35 | "waktu nya push live" | 48 commit lokal | Live: `778ec1c2..94958c5a`, 73 berkas, +17.054/−374 | — |
| 36 | "bukannya jumlah commit tadi ditulis 55, padahal sudah 61" | Saya menghitung dari commit teratas saat sesi dimulai → **selalu melebihkan** | Patokannya `origin/main`: `git rev-list --count origin/main..HEAD` | `def1c2f4` |

---

## Permintaan yang belum punya baris "sesudah"

Ini yang **menunggu Johan**, dan sengaja dipisah supaya tak tenggelam.

| # | Permintaan asli | Kapan | Yang menghalangi |
|---|---|---|---|
| 145 | "bar tembus" (bagian dari #107) | 15 Agu 2026 | Istilahnya tak punya rujukan di kode. Bar kapitalisasi yang melewati kotak, atau bar dua arah dari sumbu nol? |
| 146 | "divergensi tiga lapis" (definisi untuk #130) | 15 Agu 2026 | Lapis mana: harga vs volume, volume vs frekuensi, asing vs domestik? Urutannya menentukan seluruh perhitungan |

### Asal-usul #130 — kenapa istilahnya menggantung

Lahir **15 Agustus 2026**, commit `d697f049` *"tiga task baru masuk antrean pada
posisi ongkosnya"*, satu paket dengan #131a, #131b, dan #129. Bunyi barisnya
sejak awal cuma:

> `| 130 | Analisis volume & divergensi tiga lapis | Besar | Yang tak ada di aplikasi lain | terhalang #122/#108 |`

Kolom "kenapa layak" terisi, kolom "apa persisnya" **tidak pernah ada**. Waktu
itu #130 terhalang data (#122 OHLC & #108 harga buka belum dipanen), jadi
definisinya tak mendesak. Sekarang kedua penghalang itu sudah beres — dan yang
tersisa justru pertanyaan yang tak pernah ditanyakan.

**Itulah gunanya berkas ini.** Baris backlog yang cuma menyimpan *judul*
permintaan akan kehilangan maksudnya begitu penghalang teknisnya hilang.

---

## Chart PAPAN sendiri — jawaban singkat: **belum ada**

Ditanyakan Johan 16 Agu 2026: *"tadi saya baca chart Papan sendiri ada?"*

Yang **sudah** ada dan sering disalahsangka sebagai chart PAPAN:

| Yang terlihat | Sebenarnya |
|---|---|
| Chart di halaman `/chart` | **Widget TradingView** (`TradingViewChart.tsx`) — skrip mereka, digambar mereka |
| Grafik IHSG di Beranda | **Chart.js** floating bar yang dibentuk jadi lilin — buatan kita, tapi cuma IHSG, tanpa indikator, tanpa zoom |

Keputusan sudah diambil Johan 16 Agu: **opsi A** — mesin gambar
`lightweight-charts` (Apache-2.0, dipasang lokal, tanpa iframe dan tanpa
panggilan ke server TradingView), sedangkan **seluruh indikator dan overlay
tetap kode kita**.

Tahapnya (dari `rencana-berjalan.md`):

| Tahap | Isi | Status |
|---|---|---|
| 1 | #122 panen OHLC 5 tahun | ✅ 962 emiten, 37,3 MB |
| 2 | #108 harga buka IHSG | ✅ 8.849 hari 1990–2026 |
| 3 | Chart dasar: lilin + volume + zoom, satu emiten | ☐ **belum mulai** |
| 4 | Indikator baku: MA, EMA, RSI, MACD, Bollinger | ☐ |
| 5 | #130 divergensi tiga lapis | ☐ butuh #146 |
| 6 | Overlay khas PAPAN: pita musiman, akumulasi broker, penanda Radar | ☐ |
| 7 | #129 bandarmologi multi-panel | ☐ butuh sumber broker per emiten |

**Pondasinya (tahap 1–2) sudah berdiri**; yang belum dimulai justru chartnya
sendiri. Tahap 3 sudah cukup jadi rilis yang bisa diumumkan. Tahap 6 yang
membuatnya tak punya pembanding — dan itu semua bergantung data yang cuma
PAPAN punya, bukan pada mesin gambarnya.
