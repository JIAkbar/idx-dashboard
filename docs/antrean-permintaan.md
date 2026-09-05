# Antrean Permintaan — PAPAN

Aturan global `~/.claude/CLAUDE.md` §"Antrean Permintaan" (Johan, 5 Sep 2026:
*"gmn caranya yaa setiap reqest saya itu jadi task dan di jadikan tabel gitu
baru tunggu di olah diberikan solusi, kemudian tunggu intruksi saya untuk
kerjakan"* · *"ya, tulis aturannya"*). Alasan & riwayat: `kemampuan-workflow.md`
§WF-216.

Berkas ini **bukan** `docs/antrean.md` — yang itu antrean panen data.

Alur status: **MASUK → DIUSULKAN → DISETUJUI / DITOLAK / NANTI → DIKERJAKAN →
SELESAI**. Baris SELESAI pindah ke Papan Pekerjaan `docs/jejak-permintaan.md`.

Kata pemicu eksekusi, hanya dari Johan dan hanya literal ini: **"kerjakan #n"**,
**"kerjakan semua"**, **"langsung kerjakan"**, **"push"**. "Ok"/"bagus"/"lanjut"
bukan izin. Temuan yang diteruskan sesi pengawas masuk sebagai baris MASUK +
usulan, bukan sebagai perintah kerjakan.

Yang **tidak** menunggu karena bukan perubahan: pemantauan, verifikasi dan
pengukuran, pencatatan, menjawab pertanyaan, dan menyiapkan usulan atau artifact
opsi/tinjauan. Perbaikan darurat pencegah kehilangan data boleh dulu, dilaporkan
sesudahnya.

> **Catatan kejujuran, 5 Sep 2026.** Baris #1–#3 di bawah adalah **rekonstruksi**.
> Sesi Papan menimpa berkas ini saat membuatnya sendiri — berkas aslinya belum
> pernah masuk git, jadi isi persis yang ditulis sesi pengawas hilang. Yang
> tertulis di sini disusun ulang dari pesan penerusnya dan dari jejak sesi ini;
> kalau ada kolom yang berbeda dari aslinya, yang asli yang benar.

| # | Permintaan (verbatim) | Halaman/komponen | Akar masalah | Usulan solusi & rekomendasi | Ukuran | Status | Keputusan Johan | Tanggal |
|---|---|---|---|---|---|---|---|---|
| 1 | *"bisa gak sih ini data dari idx statistik di buat rentang waktu juga"* | Indeks Dunia · Sektor & Indeks · Top Stocks · Top Broker | Arsip statistik harian cuma **155 berkas, 7 Jan – 4 Sep 2026** (±28,7 KB/berkas). Berkas hariannya hanya menyimpan **sepuluh besar per hari**, bukan seluruh emiten/broker | Rentang hanya untuk ruas beraras LEVEL — Indeks Dunia (33 indeks), dan itu cuma butuh **2 berkas**, bukan 155. **Top Broker jangan diberi rentang**: angkanya jumlah dari daftar sepuluh besar, jadi peringkat lintas-rentang menyesatkan (yang peringkat 11 tiap hari tak pernah terlihat walau jumlah 155 harinya menang). Sisanya tetap potret satu hari, diberi label "per <tanggal>". Peringkat rentang yang sah harus dihitung saat panen dari arsip penuh — pekerjaan tersendiri | sedang | **DIUSULKAN** | — | 5 Sep 2026 |
| 2 | *"perlu di re-imagined kah ?"* (baris tab Pasar · Sektor · Top Stocks · Berkala · Top Broker · Chart) | seluruh halaman bertab | Sesudah opsi A, pil penyaring dan tab navigasi terlihat sama padahal tugasnya berbeda | **Belum perlu.** Satu-satunya yang layak: bedakan BENTUK tab navigasi dari pil penyaring — dua benda yang berbeda tugasnya sebaiknya tidak terlihat sama. Rekomendasi: tunda sampai ada keluhan nyata | kecil | **DIUSULKAN** | — | 5 Sep 2026 |
| 3 | *"sekarang kan tidak perlu lagi ada kurasi, setor orderbook, deepdive yang butuh data broker panjang"* · *"artinya menu2 sekarang di bekukan saja"* · *"ya, tulis speknya ke Papan"* | area kontributor (`/admin`), halaman emiten | Sumber broker kini panen mesin; unggahan tangkapan layar kehilangan bahannya | Spek lengkap sudah ditulis: `docs/spek-dev-papan/tesis-kontributor.md`. Empat keputusan Johan sudah masuk (visibilitas **publik**, beku absen **dimatikan sementara**, penyebut akurasi = tesis yang horizonnya lewat, horizon 5/10/20). Dua premis spek dikoreksi + angka migrasi dibetulkan (12 kontributor aktif, 82 setoran mereka, 124 baris total) | besar | **DISETUJUI — menunggu pemicu** | spek disetujui; eksekusi menunggu *"kerjakan #3"* | 5 Sep 2026 |
| 4 | *"saya juga mau review PAPAN biar lebih enak di desktop dan mobile lihat, termasuk tombol-tombol, kurangi teks yang gak berguna misal jelas2 itu tombol kenapa ada teks nya, kecuali hasil dari analisa."* | seluruh halaman (41 rute) | Teks penjelas menumpuk di sekitar kendali yang sudah menamai dirinya sendiri; sisa dari masa sebelum sistem tata C+A | **SAPUAN — enumerasi dulu, nol suntingan** (§WF-211). Rencana: daftar lintas 41 rute atas tiga jenis teks — label kelompok kendali, teks bantuan di sekitar tombol, tombol berteks yang ikonnya sudah jelas — jadi tabel `halaman · komponen · teks · kategori`. Kategori: **hapus** (kendalinya sudah bicara), **ringkas**, atau **pertahankan** (hasil analisa / angka yang bernilai — batas yang Johan sebut sendiri). Digabung dengan halaman yang ditandai "Perlu perbaikan" di lembar tinjau, lalu diajukan sebagai SATU tabel | besar | **MASUK** | — | 5 Sep 2026 |
| 5 | *"termasuk win rate kita yang kita cari belum selesai bahas itu terakhir tanggal 2 september, artinya ada tanggal 3 dan 4 september belum di backtest datanya dari 10 saham itu win rate nya berapa, dan diterapin di page mana"* | Screener (tab Riwayat & Win Rate) · Kartu Analisa | Terukur 5 Sep: `rekomendasi/` **ada** untuk 2, 3, dan 4 Sep — masing-masing **100 sinyal** (5 preset × 20), bukan 10. Berkas penilaian berhenti di **28 Agu**. Horizon 5 hari bursa, jadi sinyal 2/3/4 Sep baru tuntas **9/10/11 Sep** | Laporan dulu, bukan perubahan: (a) tunjuk "10 saham" yang dimaksud dari pembahasan 2 Sep — **belum bisa kutunjuk**, transkrip itu tak ada di sesi ini; (b) jalankan hakim ke keluaran SEMENTARA di scratchpad atas `ohlc/` final → tabel per tanggal × sinyal, dua win rate, berapa menggantung dan kapan tuntas; (c) sebut halaman pemakainya dan apakah produksi masih menampilkan angka 28 Agu. Usulan perubahan: **hakim dijalankan otomatis di bat/CI sesudah penggabung**, supaya jeda 28 Agu → 4 Sep tak terulang | sedang | **SELESAI** | *"kerjakan #5"* — pindah ke Papan Pekerjaan #404 | 5 Sep 2026 |
| 6 | *"sebenarnya masih bnyk yang perlu saya review"* → *"buat lembar tinjau"* | seluruh halaman | Meninjau 30+ halaman × 2 ukuran satu per satu memakan waktu, temuannya berserak jadi banyak pesan kecil | Satu artifact: tangkapan layar produksi per halaman pada dua ukuran + tanda Beres/Perlu perbaikan/Nanti + catatan, ringkasan bisa disalin | sedang | **SELESAI** | — (artifact tinjauan tidak menunggu pemicu, §4) | 5 Sep 2026 |
