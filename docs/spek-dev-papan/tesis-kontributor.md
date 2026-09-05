# Spek: Area kontributor beralih dari unggah tangkapan layar ke tesis teruji

Disusun Fable (AI Skill, pengawas), 5 Sep 2026 14:15, atas perintah Johan: *"ya, tulis speknya ke Papan"*. Eksekusi: sesi Papan Trading. Dikerjakan **sesudah** push opsi A + penghapusan chip + penyelarasan CI 6 varian tayang.

## KEPUTUSAN & TANGAN JOHAN

Sudah diputuskan Johan hari ini (kutipan verbatim):

- *"sekarang kan tidak perlu lagi ada kurasi, setor orderbook, deepdive yang butuh data broker panjang"* — sumber broker kini panen mesin 6 varian GROSS harian; unggahan tangkapan layar broker/orderbook **berhenti total**.
- *"artinya tidak ada lagi upload broker summary yaa, cukup buat tesis ?"* → ya. Objek setoran baru = **tesis** yang dinilai mesin.
- *"artinya menu2 sekarang di bekukan saja"* → beku yang kehilangan bahan (Unggah versi tangkapan layar, Kurasi, setor orderbook, Deep Dive manual); Radar, Terbitan, Akun, Akses, Aktivitas, Changelog, Jenjang tetap.
- Lokasi: tombol "Setor tesis" di halaman emiten; antrean dan daftar di area admin.

## DIJAWAB JOHAN, 5 Sep 2026 sore (sesi Papan)

Empat pertanyaan diajukan sekaligus; keempatnya dijawab. **Dua jawaban berbeda
dari default spek** — itu keputusan Johan, bukan penyimpangan pelaksana.

| # | Pertanyaan | Jawaban Johan | Beda dari spek? |
|---|---|---|---|
| 1 | Visibilitas tesis | **Publik** — hasil penilaian jadi berkas statis; halaman publik boleh membaca isi tesis | **Ya**, spek mengusulkan "hanya anggota" |
| 2 | Beku otomatis selama transisi | **Dimatikan sementara**, dinyalakan lagi begitu formulir tesis tayang | **Ya**, dan premis spek keliru — lihat di bawah |
| 3 | Penyebut akurasi jenjang | **Tesis yang horizonnya sudah lewat** (menang + kalah + tak masuk); yang masih berjalan tidak menghukum | **Ya**, spek memakai `menangDariSemua` apa adanya |
| 4 | Horizon | **5 · 10 · 20 hari bursa** | Tidak |

**Koreksi atas keputusan #2 — `beku_otomatis` bukan kunci jenjang.** Spek
menulis "jenjang sekarang dikunci (`beku_otomatis = true`)". Ruas itu artinya
lain: ia menyalakan **pembekuan karena absen** (label di tab Akun: "matikan
untuk kontributor yang sedang cuti"), dan ambangnya per jenjang lewat
`jenjang.hari_beku`. Menyalakannya tidak mengunci tier sama sekali.

Diukur 5 Sep 2026, sebelum diubah: menyala di **12 dari 12** akun kontributor,
dan **10 di antaranya sudah melewati ambangnya** — 9 akun tier 0 (ambang 5 hari
kerja, diam terlama 14 hari) dan satu akun tier 1 (8 vs 7). Satu akun tier 2
tinggal satu hari kerja lagi. Setoran terakhir di seluruh sistem 24 Agustus.
Kalau jalur setor lama dibekukan sementara jalur tesis belum ada, seluruh basis
kontributor dibekukan karena diam yang **kita** sebabkan.

Dijalankan hari itu juga atas jawaban Johan: `beku_otomatis` dimatikan untuk
12 akun kontributor (superadmin tidak disentuh; `aktif` dan `tier` tidak
disentuh — 12 tetap aktif, jenjang tak berubah). **Wajib dinyalakan lagi**
begitu formulir tesis tayang; kalau hitungan absennya kelak berpindah ke
"tesis terakhir", itu perubahan fungsi basis data tersendiri.

**Koreksi atas penyebut akurasi (#3).** `menangDariSemua` di `nilai_jejak.py`
adalah `menang ÷ len(hasil)`, dan `hasil` memuat yang masih **menggantung**.
Dipakai sebagai syarat naik jenjang, ia menghukum keaktifan: penyetor rajin
selalu menggendong tesis yang belum jatuh tempo. Contoh 100 tesis, 20 berjalan,
menang 60 dari 80 tuntas → dari-tuntas 75%, dari-semua 60%; ambang 70% jadi
mustahil bukan karena ia salah, tapi karena ia rajin. Yang dipakai sekarang:
penyebut = tesis yang horizonnya sudah lewat. `tak_masuk` **tetap** di penyebut
— itu inti metriknya, dan tanpanya asal-tembak jadi gratis.

**Angka migrasi, diukur bukan dikira** (5 Sep 2026):

| | Jumlah |
|---|---|
| Akun kontributor aktif (di luar superadmin) | **12** |
| Di antaranya pernah menyetor | 11 |
| Setoran milik kontributor | **82** |
| Setoran milik superadmin | 42 |
| Total baris `setoran` | **124** — 122 disetujui, 1 revisi, 1 dihapus |
| Sebaran jenjang | 10 akun tier 0, 1 tier 1, 1 tier 2 |
| Setoran terakhir | 24 Agustus 2026 |

Angka "42 setoran disetujui" di naskah awal spek adalah setoran **superadmin**,
bukan setoran kontributor.



## 1. Objek tesis

Tabel Supabase baru `tesis` (jangan menimpa `setoran`; riwayat lama tetap utuh):

| Ruas | Isi | Aturan |
|---|---|---|
| `id`, `penyetor` | FK `profil.id`, `on delete cascade` seperti `setoran.penyetor` | — |
| `kode` | emiten | wajib ada di `ohlcv_stockbit/` |
| `arah` | `naik` / `turun` | hakim menilai `turun` sebagai cermin (target di bawah, stop di atas) |
| `tanggal_sinyal` | hari bursa terakhir yang barnya sudah final saat setor (aturan `bar_berisi`: ≥16:45 WIB dan volume>0; sebelum itu = hari bursa sebelumnya) | ditetapkan server, bukan klien |
| `harga_masuk` | bawaan = penutupan `tanggal_sinyal`; boleh diubah jadi area beli (bawah–atas) | area harus memuat atau berdekatan dengan penutupan; kalau harga tak pernah masuk area = **tak masuk** (keputusan hakim #3) |
| `target`, `stop` | harga | `naik`: target > masuk > stop; `turun` sebaliknya |
| `horizon_hari` | 5 / 10 / 20 hari bursa | hari sinyal tidak dihitung (keputusan hakim #1) |
| `alasan` | ≤280 karakter | wajib |
| `lampiran` | tangkapan layar opsional | bucket yang sudah ada |
| `status` | `menunggu` → `menang` / `kalah` / `tak_masuk` / `menggantung` | ditulis hakim; `ambigu` (TP&SL sehari) = `kalah` + tanda `ambigu` |
| `dinilai_pada`, `harga_akhir`, `hari_terpakai` | jejak penilaian | sekali tulis |

**Sekali tulis.** Tesis tidak bisa disunting. Boleh **dibatalkan** hanya sebelum hari bursa berikutnya dibuka (09:00 WIB) dan tidak dihitung apa pun. Kuota/hari memakai `kuota_harian` + `kuota_manual` yang sudah ada.

## 2. Hakim

Pakai `scripts/riset/nilai_jejak.py` apa adanya — empat keputusannya (hari sinyal tak dinilai; TP&SL sehari = kalah + `ambigu`; tak masuk dilaporkan terpisah dan jadi penyebut; dua win rate `menangDariTuntas` + `menangDariSemua`) berlaku tanpa perubahan. Tambahan minimum:

- Sumber sinyal kedua: `tesis` (bukan hanya `rekomendasi/<tgl>.json`). Hakim menerima `arah` dan `horizon_hari` per sinyal; `turun` = cermin.
- Keluaran `data-idx/json/penilaian_tesis/<tgl>.json` sekali tulis (keputusan Johan #1: **publik**, berkas statis di Vercel; halaman membaca hasilnya dari situ, status di tabel `tesis` boleh disinkronkan lewat Edge Function idempoten kalau tampilan admin membutuhkannya).
- Dipanggil dari `JALANKAN_BUKA_LAPTOP.bat` **sesudah** panen OHLCV + penggabung (hakim butuh `ohlc/` final), dan dari CI dengan urutan sama. Tesis dinilai hanya untuk tanggal yang barnya sudah final — data hari berjalan tidak pernah dipakai.
- `swauji()` ditambah kasus `turun`, `tak_masuk` dengan area beli, dan jalur `main()` yang benar-benar dipakai (pelajaran IHSG ×100: uji harus menjalankan jalur produksi).

## 3. Jenjang

`app/src/lib/jenjang.ts` tetap; makna dua ruas berganti:

- `min_disetujui` → **jumlah tesis tuntas** (`menang` + `kalah` + `tak_masuk`; `menggantung` tidak dihitung). Angka 10/30/75/150/300 tetap.
- `min_akurasi` → win rate dengan penyebut **tesis yang horizonnya sudah lewat** (menang + kalah + tak_masuk; yang masih berjalan tidak dihitung — keputusan Johan #3, koreksi Papan atas `menangDariSemua`). Ambang 70/75/80/85/90 tetap. `akurasi_sejak` (reset, pendidikan bukan hukuman) tetap berlaku.
- Kuota/hari per jenjang tetap; `kuota_manual` superadmin tetap menang.
- Teks `pengetahuan.ts` id `hitung-akurasi` ditulis ulang sesuai rumus baru; `jenjang.test.ts` + `jarakJenjang.ts` diuji dengan ruas baru.
- Migrasi sesuai keputusan #2.

## 4. Antarmuka

- **Halaman emiten** (Bedah Emiten / stock-detail): tombol "Setor tesis" → modal: kode + penutupan terisi, arah, area beli, target, stop, horizon (3 pil), alasan, lampiran. Sisa kuota hari ini terlihat sebelum kirim.
- **Admin `/admin`** (`AdminLayout.tsx:218`): tab Unggah → **Tesis**: daftar tesis saya (status, hari tersisa, hasil), kuota; Kotak Masuk → antrean tesis per tanggal jatuh tempo (superadmin lihat semua).
- **Beku** (rute tetap, hanya superadmin, label "Arsip · beku", baca saja): `UnggahHarian`, `KurasiSetoran`, `PanduanScreenshot`, `BedahUnggah`. Tidak ada baris `setoran` yang dihapus. Tombol dan tautan ke unggahan tangkapan layar hilang dari tampilan kontributor (grep di bawah).
- **Jenjang** (`PanelJenjang`, `TanggaJenjang`, `ModalNaikJenjang`, `BadgeRapor`): label "setoran" → "tesis tuntas".
- **Terbitan / Rekap Sore** (tahap 2, spek Rekap Sore #34 sudah ada): edisi harian boleh menyematkan tesis pilihan superadmin; papan "PAPAN vs kontributor" memakai dua win rate yang sama.
- Deep Dive otomatis dari broker 10 tahun = spek terpisah, bukan bagian ini.

## 5. Tahapan dan kriteria terima

Tahap 1 (paket ini): tabel + RLS (kontributor hanya baca/tulis tesis sendiri; superadmin semua) · formulir · hakim + jalur bat/CI · status + jenjang baru · pembekuan tab · migrasi.

Kriteria terima, semuanya bisa dijalankan Johan:

1. `python scripts/riset/nilai_jejak.py --uji` lulus dengan kasus `turun`, `tak_masuk`, dan jalur produksi.
2. `npm test` hijau: `jenjang.test.ts`, `jarakJenjang`, uji sekali-tulis tesis (sunting ditolak, batal ditolak setelah 09:00 hari bursa berikutnya).
3. `grep -rn "screenshot\|tangkapan layar\|PanduanScreenshot" app/src --include=*.tsx` hanya tersisa di berkas beku dan superadmin.
4. Satu tesis uji milik Johan disetor → dinilai hakim pada panen berikutnya → status berubah → jenjang menghitungnya. Buktinya baris `penilaian_tesis/<tgl>.json` + tangkapan layar tab Tesis.
5. Tampilan diverifikasi dua ukuran layar Johan (1920 dan 412) di halaman emiten (modal), `/admin` tab Tesis, dan panel Jenjang.
6. Data hari berjalan tidak pernah dinilai (uji: setor jam 14:00 → `tanggal_sinyal` = hari bursa sebelumnya).

Papan Pekerjaan per langkah; referensi proyek: peta halaman → sumber (tesis = Supabase, penilaian = bat/CI dari `ohlc/`), kamus ruas tabel `tesis`.
