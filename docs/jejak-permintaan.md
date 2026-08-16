# Papan Pekerjaan

> **Papan pekerjaan yang diwajibkan `kemampuan-workflow.md` §174.**
> Sebutannya tetap "Papan Pekerjaan" walau produknya juga bernama PAPAN —
> usulan mengganti nama jadi "Lembar Kerja" ditolak Johan 17 Agu 2026.
>
> **Bukan papan progress.** Papan progress melapor apa yang sudah jalan; papan
> ini mencatat perintahnya, sebelum-sesudahnya, alasannya, dan buktinya —
> sehingga bisa dipakai MENOLAK perubahan sebelum dikerjakan.
>
> **Bentuk baku sepuluh kolom** untuk baris BARU mulai 17 Agu 2026:
>
> `# · Tugas · Asal perintah · Halaman · Komponen (file:baris) · Sebelumnya ·
> Jadi · Alasan · Status & bukti · Changelog`
>
> Baris sesi 16 Agu di bawah ditulis sebelum konvensi ini diadopsi di sini,
> jadi bentuknya masih empat kolom (permintaan · sebelum · sesudah · commit).
> **Sengaja tidak ditulis ulang** — memundurkan pekerjaan yang sudah selesai
> untuk memenuhi format hanya memindahkan waktu dari pekerjaan berikutnya, dan
> isinya toh sudah menjawab pertanyaan yang sama. Yang mengikat mulai sekarang
> adalah baris baru.

---

## Sesi 17 Agustus 2026 — bentuk baku sepuluh kolom (§174)

| # | Tugas | Asal perintah | Halaman | Komponen (`file:baris`) | Sebelumnya | Jadi | Alasan | Status & bukti | Changelog |
|---|---|---|---|---|---|---|---|---|---|
| 37 | Betulkan setelan lapis AI yang salah isi | "jadi TANYA_AI_AKTIF, TANYA_AI_BATAS_IP, dan TANYA_AI_MODEL jadi true ya" | — (Edge Function) | `supabase/functions/tanya-ai/index.ts:26` | `Number("true")` jadi NaN dan `n <= NaN` selalu false — tiap pertanyaan dianggap lewat batas, "Batas NaN pertanyaan" bocor ke layar | `angkaSetelan()` mengabaikan isi tak masuk akal, jatuh ke bawaan | Setelan opsional yang salah isi tak boleh melumpuhkan lapis; sakelar hidup/mati tetap mutlak | Selesai — diuji langsung ke fungsinya | Fixed |
| 38 | Rantai model + matikan penalaran | (lanjutan #37) | — | `supabase/functions/tanya-ai/index.ts:44` | Satu nama model: `gemini-2.0-flash` ditarik Google (404), `gemini-flash-latest` kena 503 | Rantai 4 model + `thinkingBudget: 0`, 700 token | Nama model yang dihafal justru sumber pemadaman; jatah keluaran habis untuk menalar jadi jawaban terpotong | Selesai — `0b67b2a9`, jawaban utuh dari `gemini-flash-latest` | Fixed |
| 39 | Unggahan kontributor selalu ditolak | "ada bug nih terkait logika, akun warda upload tapi data tidak masuk" | `/admin` tab Unggah | policy `unggah_screenshots` + `emiten_sudah_disetor()` | `ada_alasan` menuntut baris setoran ADA, `NOT emiten_sudah_disetor` menuntut TIDAK ada — ditolak oleh barisnya sendiri, selalu | `emiten_sudah_disetor` mengecualikan baris milik sendiri | Maksud aturannya "sudah disetor AKUN LAIN", dan itu sudah tertulis di pesan galatnya sejak awal | Selesai — migrasi `emiten_sudah_disetor_kecualikan_diri`; diuji dua arah (AADI lolos, PADI/ESSA tetap terkunci) | Fixed |
| 40 | Galat unggah bawa keterangan server | (temuan saat #39) | `/admin` tab Unggah | `UnggahHarian.tsx:153`, `supabaseEdisi.ts:99` | Empat kemungkinan disebut, keterangan server dibuang — #162 tak pernah terlacak | Keterangan server ikut + penanda tahap `[baris setoran]`/`[unggah berkas]` | Menerjemahkan galat menolong; MENGHAPUS galat aslinya membutakan yang memperbaikinya | Selesai — `71733906`; tanpa ini #39 tak akan ketemu | Fixed |
| 41 | Rem borongan setoran | "apakah jika nanti dia upload tanggal 10, 11, 12, 13, 14 otomatis dia bisa cepat naik level?" | `/admin` tab Unggah | `tanggal_dalam_jendela()`, `setoran_hari_ini_saya()` | Tak ada batas mundur; Perak memborong 145 hari bursa = 435 setoran, melampaui syarat Diamond | Jendela 5 hari kerja + laju 2x kuota per hari kalender | Kuota berlaku per TANGGAL bukan per hari nyata — selisih itu yang dipakai memborong | Selesai — migrasi `rem_borongan_setoran`; diuji (14 Agu lolos, 7 Agu lolos, 5 Jan ditolak) | Added |
| 42 | Bedah boleh lintas tanggal | "upload per tanggal per emiten itu bisa misal 5 langsung yakan? karena ini single bukan data daily" | `/admin` tab Bedah | `hitung_bedah_emiten_tanggal()`, `bedah_hari_ini_saya()` | `hitung_bedah_hari < 1` lintas emiten — berkas KEDUA selalu ditolak, tanggal kedua ikut terkunci | 2 berkas per emiten per tanggal, lintas tanggal bebas, laju 50/hari | Bedah itu studi satu emiten lintas waktu, bukan potret satu hari bursa | Selesai — migrasi `bedah_boleh_rentang_tanggal` + `bedah_laju_harian_50` | Fixed |
| 43 | Tab Bedah setara tab Unggah | "harusnya sama sih dengan fitur unggah di kasih fungsi hapus dan cara screenshot broker summary" | `/admin` tab Bedah | `BedahUnggah.tsx`, `PanduanScreenshot.tsx` | Tak ada hapus, tak ada panduan, arsip cuma menyimpan tanggal terakhir | Hapus per berkas, panduan dipakai ulang (prop `bedah`), arsip per tanggal, kunci emiten + Tambah Emiten | Dua tab yang sifatnya sama tak boleh beda perlakuan | Selesai — `94133bdc` + `b3520ded`; hapus diuji live (berkas 2 jadi 1) | Added |
| 44 | Reset akurasi kontributor | "saya sebagai superadmin bisa reset akurasi itu penting, karena pendidikan tidak harus selalu punishment" | `/admin` tab Akun | `profil.akurasi_sejak`, `AkunAdmin.tsx`, `jenjang.ts:34` | Akurasi dihitung dari SELURUH riwayat; satu periode buruk menempel selamanya | Titik mulai `akurasi_sejak` — riwayat tak dihapus, jumlah disetujui tak berubah, bisa dibatalkan | Menghapus baris memalsukan sejarah; menggeser jendela hitung tidak | Selesai — `6e27a167`, 266 tes, diuji 2 akun dua arah | Added |
| 45 | Kata tunggal dikenali Tanya PAPAN | "perlu kembangin rule engine yang lebih luas lagi supaya dengan 1 kata saja sudah paham" | Semua halaman (panel) | `pengetahuan.ts:41,70` | `kontributor`, `tier`, `level`, `model ai` semuanya gagal dijawab | Kata tunggal jadi kunci + entri `model-ai` baru | Entrinya sudah ada, yang kurang cara menemukannya | Selesai — `94133bdc`, 265 tes; sisanya jadi #171 | Fixed |
| 46 | Definisi divergensi tiga lapis | "harus bisa tentukan chart itu membentuk pola bearish divergent atau bullish divergen, kolaborasi dengan indikator stochastic, mungkin volume" | — (spesifikasi) | `docs/rencana-berjalan.md` | #146 menggantung sejak 15 Agu; #130 terhalang tanpa definisi | Harga + Stochastic + Volume sebagai PENGESAH, berikut derajat keyakinan | Lapis volume sebagai pengesah itu yang membedakan dari indikator divergensi kebanyakan | Selesai — `ad6f6c79`; #145 dilewati atas keputusan Johan | — |
| 47 | Bedah ASK SPLE | "kalau mau coba-coba bisa tuh di sple-mf... pakai devtools chrome lebih leluasa" | (situs pihak ketiga) | `docs/riset/sple/ask-sple.md` | Kedalaman AI mereka belum diketahui sebabnya | Prompt + 29 ruas konteks terdokumentasi; API terbukti Anthropic dari `stop: end_turn` | Gerbangnya kolom sandi — dibedah dari sisi klien, kolom sandi tak disentuh | Selesai — `06a3efd6`, `f9c13f71`, `898bbf44` | — |
| 48 | Urutan kerja ringan ke mahal | "buatlah ceklist tabel workflow dari yang paling ringan sampai yang paling mahal" | — | `docs/ceklist-backlog.md` | Antrean dikelompokkan per tema, tanpa urutan eksekusi | 21 baris berurut + kolom bergantung/membuka | Urutan ditentukan oleh apa yang DIBUKA, bukan besar-kecilnya | Selesai — `93a7d835` | — |
| 49 | Adopsi §174 + parkir #167/#129 | "gunakan selalu Papan Pekerjaan (bukan papan progress)" · "tetap jadikan backlog sampai saya panggil kmu lagi" | — | `CLAUDE.md`, berkas ini, `ceklist-backlog.md` | Sesi ini tak memakai papan §174; #167/#129 bisa terangkat sendiri | Papan wajib tiap balasan; #167/#129 ditandai diparkir | Yang diparkir hanya boleh diangkat kalau dipanggil — menawarkan berulang mengabaikan keputusan | Selesai — commit ini | — |
| 50 | Tombol buka arsip Bedah tak ketemu | "dimana tombol delete nya ya ?" · "yang gak beres itu tombol nya terutupi bro" | `/admin` tab Bedah | `BedahUnggah.tsx:379`, `AdminShared.css:222` | Tombol buka memakai ikon CENTANG dengan label ber-`opacity:0` sampai disentuh kursor; hapus cuma ada di dalam baris yang terbuka; tabel meluber 87px keluar panel di 412px | Tombol `dd-btn` berlabel tetap "Buka N berkas" + panah berputar; tabel dibungkus `.af-gulir` | Centang terbaca "sudah selesai", bukan "klik untuk membuka" — dan di telepon yang tak punya hover, label itu tak pernah muncul sama sekali | Selesai — diperiksa 1536×960 dan 412×915: label opacity 1, `elementFromPoint` mengembalikan tombol itu sendiri, tabel menggulung di dalam panel | Fixed |
| 51 | Kolom "Tanggal" arsip Bedah menampilkan angka | (temuan saat #50) | `/admin` tab Bedah | `BedahUnggah.tsx:380` | Kepala kolom "Tanggal", selnya `{tanggalList.length}` — menampilkan "1" di tempat yang menjanjikan tanggal | Kepala jadi "Rentang tanggal", sel jadi `3 Agu – 14 Agu (10)` | Kepala kolom yang berbohong sekelas dengan angka yang berbohong — pembaca tak punya cara tahu ia salah baca | Selesai — terbaca `3 Agu – 14 Agu (10)` di layar | Fixed |
| 52 | Tinggi chip rentang disamakan tab | "tinggi tombol ini disamakan dengan tinggi tombol bulan atau harian biar gak kecil kasian kalau manusia punya mata minus" | Seasonality (dua tab), Forum, Detail Saham | `lantai.css:821` | `.bchip-klik` mewarisi padding `1px 6px` milik lencana pasif — tinggi ±17px, jauh di bawah `.tab` 26px | `.bchip-klik` jadi `inline-flex`, tinggi 26px, padding `0 12px`, font 11px | Chip yang bisa diklik itu kendali, bukan lencana; dipasang di `-klik` supaya lencana pasif tetap ringkas | Selesai — terukur 26px di 11 chip, sama persis dengan `.tab` | Changed |
| 53 | Kotak keterangan tak lagi menggantung | "informasi ini lebih baik di rapikan lagi tidak mengambang disitu karena mobile view kan ?" | Seasonality (dua tab) | `lantai.css:2485`, `lantai.css` (akhir) | `.sea-kaki` dibatasi `max-width: 82ch` — di layar lebar menggantung sendirian di kiri; `.panel-h` flex satu baris menggencet judul dan keterangan jadi dua kolom sempit di 412px | `.sea-kaki` selebar panel; `.panel-h` boleh `flex-wrap` di bawah 560px | Batas lebar baca 82ch benar untuk teks panjang, tapi keterangan pendek yang dipatok segitu terbaca sebagai sisa yang lupa dirapikan | Selesai — 1432px di laptop, 396px di telepon tanpa luber horizontal | Changed |
| 54 | Bedah dan Broker Summary tak terbedakan | "desain nya sama antara bedah dan broker summary dimana gak ada badge yang membedakan" | `/admin` tab Kurasi | `KurasiSetoran.tsx:304`, `KurasiSetoran.css:78` | Jenis cuma teks abu-abu 10,5px satu baris dengan nama kontributor | Lencana berwarna di baris ticker: BEDAH biru, BROKER SUMMARY netral, CHART ungu | Dua produk berbeda (Bedah jadi PDF studi satu emiten, Broker Summary jadi edisi harian) tak boleh terlihat identik | Selesai — terbaca di 1536×960 dan 412×915, tinggi kepala kartu seragam 23px | Added |
| 55 | Tombol kartu kurasi naik-turun | "tombol-tombol itu naik turun tangga perlu di rapikan" | `/admin` tab Kurasi | `KurasiSetoran.css:78` | Tinggi blok info mengikuti panjang alasan tiap setoran; tiga kartu bersebelahan menaruh tombol di tiga ketinggian berbeda | `.ks-info { flex: 1 }` — tombol menempel ke dasar kartu | Kartu sudah sama tinggi karena grid `align-items:stretch`; yang belum ikut cuma isinya | Selesai — terukur tiga kartu `aksiAtas` sama persis (698px) | Fixed |
| 56 | Toast "Dimasukkan ke edisi" menyesatkan | "toast yang membingungkan kalau saya backtest artinya setiap yang di setujui itu masuk edisi buletin ya ?" | `/admin` tab Kurasi | `KurasiSetoran.tsx:159`, `:521` | "Dimasukkan ke edisi." terbaca seolah PDF sudah berubah; padahal `dimuat` cuma penanda dan perakitan manual | "Ditandai masuk edisi — berlaku saat edisi dirakit ulang" + satu butir aturan baru yang menyebut `build.py` manual | Kalimat yang menyiratkan penerbitan otomatis pada sistem yang manual adalah janji yang tak ditepati sistemnya sendiri | Selesai — butir aturan terbaca di panel Aturan Kurasi | Changed |
| 57 | Salinan daftar edisi salah polaritas | (temuan saat #56) | `/admin` tab Kurasi | `KurasiSetoran.tsx:197`, `arus-pasar/build.py:837` | Tombol menyalin daftar yang MASUK edisi (`dimuat`), sedangkan `build.py --kecuali=` menerima daftar yang DIKELUARKAN — menempelkannya membuang persis yang harus dimuat, dan kalau semua dimuat `build.py` berhenti "Semua emiten dikeluarkan" | Salinan memuat dua daftar + argumen `--kecuali=` siap tempel yang berisi yang DIKELUARKAN | Perangkap senyap: hasilnya bukan galat, melainkan edisi yang isinya terbalik | Selesai — `tsc` bersih, teks salinan diperiksa | Fixed |
| 58 | Rel navigasi ditunda, jadi backlog | "untuk menu rail untuk sementara dibiarkan gini dulu kan bisa scrolling ya, jadi dipikirkan kemudian jadikan backlog" | semua halaman (rel kiri) | `.dasbor-rail-list` (`lantai.css`) | Dianggap bisa digulung sehingga penambahan ikon aman | Dicatat sebagai #174 dengan angka terukur; tak ada perubahan kode | **Relnya tidak bisa digulung** — `overflow-y: visible`, `scrollHeight` = `clientHeight` = 960. Sisa ruang 96px = 2 ikon; yang ke-18 meluber ke area kaki tanpa gulir dan tanpa galat | Dicatat — `docs/ceklist-backlog.md` §174; keputusan (gulir vs kelompokkan) menunggu Johan | — |
| 58 | Warna baris rentang Seasonality Harian | "berikan warna yang berbeda" (baris "BRMS · 2025-08-20 → 2026-08-14 · 241 hari bursa" satu warna abu-abu rata) | Seasonality tab HARIAN | `SeasonalityHarian.tsx:238`, `lantai.css` (dekat `.sea-hari-kepala`) | Tiga informasi (sumber, rentang tanggal, jumlah hari) dijejalkan satu `<span className="v-note">` satu warna — tak bisa dipindai cepat | Dipecah 3 `<span>`: sumber amber tebal mono, tanggal `--text2` mono, jumlah hari `--green` tebal mono; pemisah `·` dan "hari bursa" tetap `--text3` lewat warisan | Warna berbeda per jenis informasi memungkinkan mata memindai tanpa membaca kalimat penuh | Selesai — `e7d76f68`; warna terukur `getComputedStyle` di tema gelap & terang, keduanya kontras cukup | Fixed |
| 59 | Sudut chip sumber diseragamkan (K10) | "kok masih rounded ini ?" (chip BRMS pil 99px vs tombol IHSG kotak 4px bersebelahan) | Seasonality tab HARIAN + tab BULANAN (kelas sama) | `lantai.css:2399` `.sea-chip` | `border-radius: 99px`, padding `4px 10px` — tak seragam dengan `.bchip.bchip-klik` (4px, tinggi 26px) di sebelahnya | `.sea-chip` jadi `border-radius: 4px`, `height: 26px`, `padding: 0 12px` — sama persis dengan `.bchip-klik` | K10 (`docs/spek-kendali.md`): kendali yang bisa diklik pakai sudut 4px, pil 99px cuma untuk lencana status pasif (`.chip`, tak disentuh) | Selesai — `e7d76f68`; `getComputedStyle` kedua chip identik (`borderRadius:"4px"`, `height:"26px"`) di kedua tema | Fixed |
| 60 | Tooltip crosshair grafik Balapan | "apakah bisa di setiap hari nya di munculkan kenaikan dan penurunan saham nya ? ... ok Opsi A dulu saja, jadi ketika kursor menyentuh akan muncul setiap titik dimana kenaikannya berapa gitu ya ?" | Seasonality tab HARIAN | `SeasonalityHarian.tsx:379` (`Balapan`), `lantai.css` (dekat `.sb-*`) | Grafik balapan tak punya cara melihat angka harian sebenarnya — cuma garis kumulatif | Overlay Pointer Events (mouse+touch) menampilkan tanggal+hari, persen perubahan harga NYATA dari `tutup` mentah (hijau/merah), dan penanda garis hari mana yang disuapi tanggal itu | Opsi A (tooltip) dipilih karena biaya rendernya tetap satu overlay di rentang apa pun — batas "maksimal 1Y" yang dikhawatirkan jadi tak perlu untuk fitur ini | Selesai — `a00fd593`; `tsc`+`vitest` bersih, 3 tanggal diverifikasi lewat `pointermove` sintetis, satu angka (+1,24% @ 10 Feb 2026) dicocokkan manual dari `ihsg_harian.json`; sentuh diuji `pointerdown/move/cancel` di 412×915, `scrollWidth` tetap 412 | Added |

---

## Catatan asal: apa yang diminta, sebelum & sesudah

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
