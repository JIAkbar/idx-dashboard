# Spek — rapikan klaim basi + aturan rasio kosong Blok F

**Dari:** Fable (pengawas, sesi AI Skill) · **Untuk:** sesi PAPAN · **29 Agu 2026**

Sesi PAPAN tidak terjangkau lewat `SendMessage` dari sesi mana pun hari ini, jadi
spek ini dititipkan lewat Johan. Semua klaim di bawah diverifikasi langsung ke
berkas; yang tidak kuverifikasi ditandai.

---

## 1. Cabut TODO basi — bug-nya sudah diperbaiki enam hari lalu

`scripts/backfill_broker_massal.py:59-63` masih menulis bahwa refresh token lintas
thread "belum dikunci". **Sudah dikunci.**

    stockbit_token.py:194   _KUNCI_PUTAR = _threading.Lock()
    stockbit_token.py:202   with _KUNCI_PUTAR:   (+ baca ulang di dalam kunci)

Garis waktunya (diverifikasi sesi SAKTI lewat `git log -S`, jam bukan cuma tanggal):

| Waktu | Kejadian |
|---|---|
| 23 Agu 06:32 | TODO "belum dikunci" ditulis (`85ece56a0`) |
| 23 Agu 21:01 | token mati 401 |
| 23 Agu 23:38:49 | kunci dipasang, 44 -> 128 thread (`c7bceca13`) |

Matinya jatuh 2 jam 37 menit **sebelum** kuncinya ada. Hipotesis tabrakan cocok
dengan jam, dan perbaikannya menyusul malam itu juga.

TODO-nya tertinggal karena perbaikannya ada di **berkas yang berbeda** dari
TODO-nya. Aturan yang lahir dari ini: perbaikan lintas berkas wajib mencabut TODO
di berkas asal.

**Jangan hilangkan satu fakta ini** saat mencabutnya — pindahkan ke tempat yang
benar (`stockbit_token.py:191-193` sudah memuatnya): kuncinya **antar-thread dalam
satu proses saja**. Dua PROSES yang sama-sama memanen tetap saling membunuh, dan
itu ditegakkan sebagai larangan di CLAUDE.md, bukan oleh kode.

**Kriteria terima:** `grep -n "belum dikunci" scripts/` nol hasil.

---

## 2. Cabut penampung "be-nanti" — kini menjanjikan yang SUDAH terbit

`app/src/views/dasbor/BerkasEmiten.tsx:938-942` (baris bergeser dari 812 saat
berkasnya tumbuh — periksa dengan grep, jangan percaya nomor ini) masih
merender kartu "menyusul" untuk blok E, F, G, padahal ketiganya sudah hidup
di atasnya.

Bukan sisa kosmetik. Kartunya menjanjikan **"P(R1/R2/S1)"** — dan 29 Agu 2026
sesi PAPAN menerbitkannya untuk **956 emiten**. Jadi kaki halaman mengiklankan
sebagai "menyusul" sesuatu yang terbit hari itu juga, beberapa jam sebelumnya.
Ini kelas cacat yang sama persis dengan ambang risiko PDF: kode berubah,
teksnya tidak ikut.

Sisa janjinya, **"win rate"**, memang belum berbahan — riwayat rekomendasi
tidak ada di disk. Jadi kartu yang sama sekaligus salah (mengaku belum ada
padahal ada) dan menyesatkan (mengaku akan ada padahal tak berbahan).

`berkasRekam.ts` menanganinya dengan benar — "Bukan ramalan", dan aturan
"3 dari 4 bukan 75%" ditegakkan di kode. Penampung basi ini membatalkan
kejujuran itu di kaki halaman yang sama.

**Kriteria terima:** `grep -rn "be-nanti" app/src` nol hasil — termasuk aturan
CSS-nya di `BerkasEmiten.css:235-247`, yang akan tertinggal jadi gaya yatim
kalau cuma JSX-nya yang dicabut.

---

## 3. Gerbang kesegaran buta pada data yang baru terbit

`scripts/cek_kesegaran.py:236` `MANIFEST` = **18 entri disusun tangan**, tanpa uji
kelengkapan. Jadi "basi 0" hanya berlaku untuk 18 yang kebetulan terdaftar.

Diverifikasi: `keystats` dan `info_stockbit` — dua dataset yang blok F dan G MULAI
baca hari ini — **tidak ada** di manifes. Gerbang menyala hijau untuk pertama
kalinya di hari yang sama tiga blok baru terbit membaca data yang tak diawasinya.

Dua pekerjaan:

1. Tambahkan `keystats` dan `info_stockbit` ke `MANIFEST`.
2. Tambahkan uji yang **gagal** kalau ada dataset yang dibaca halaman tapi tidak
   terdaftar di `MANIFEST`. Sumber daftarnya sudah ada: peta halaman -> sumber di
   `docs/referensi_idx-statistik.md`.

Tanpa nomor 2, tiap dataset baru akan lolos diam-diam lagi, dan hijaunya makin
menyesatkan justru seiring proyek tumbuh.

**Kriteria terima:** `grep -c "keystats\|info_stockbit" scripts/cek_kesegaran.py`
lebih dari nol, dan ujinya merah kalau satu entri manifes dihapus.

---

## 4. Blok F wajib menyebut kedalaman keystats

Diukur dari berkas: `financial_year_parent` hanya memuat **2024, 2025, 2026**.
Arsipnya sendiri baru 2 potret per emiten (23 dan 29 Agu), jadi keystats adalah
**potret nilai-kini**, bukan deret waktu rasio.

- Rasio sebagai potret kini: bersumber penuh, satu sumber, tanpa jahitan. Aman.
- Rasio sebagai tren/riwayat: mentok tiga tahun. Lebih dalam menarik jahitan
  J4/J5 yang **belum diputuskan Johan** (tabel pembanding angkanya belum pernah
  dibuat).

Kalau F menampilkan tren tanpa menyebut batas ini, pembaca akan mengira jendelanya
sepanjang riwayat emiten. Sebutkan jendelanya di antarmuka.

---

## 5. Rasio kosong — SELESAI, dikerjakan sesi PAPAN 29 Agu (bagian ini arsip)

**Status: sudah dikerjakan, dan lebih baik daripada yang kutulis di sini.**
Bagian ini kutinggalkan sebagai riwayat, bukan sebagai perintah. Jangan
dikerjakan ulang.

Yang kuusulkan: kosong tetap kosong dengan alasan, tambal hanya yang benar
ada, tiap angka menyebut sumbernya, tabel pembanding dulu ke Johan.

Yang benar-benar dibangun (`app/src/lib/dasbor/berkasRasio.ts`) melampaui itu
di dua hal yang tidak kuukur:

1. **Izin menambal ditentukan pengukuran kesepakatan dua sumber**, bukan
   penalaran soal "berlaku atau tidak". Dibandingkan pada emiten yang KEDUA
   sumbernya berisi:

       Dividend (TTM)                 n=410   median 1,0000   88% dalam +/-5%  -> tambal
       Current Book Value Per Share   n=954   median 1,0000   83%              -> tambal
       Dividend                       n=406   median 1,0000   78%              -> tambal
       Return on Equity x100          n=957   median 0,979    42%              -> DITOLAK
       Payout Ratio x100              n=287   median 0,962    15%              -> DITOLAK
       Return on Assets x100          n=888   median 1,010     7%              -> DITOLAK

   Tiga yang ditolak bukan soal satuan: dikali 100 pun sebarannya tetap lebar
   karena periodenya beda (TTM vs kuartal, tanggal laporan tak sama).

2. **Label sumber diverifikasi, bukan diasumsikan.** `NAMA_CADANGAN_TURUNAN`
   ada justru untuk kasus ruas cadangan yang ternyata hasil hitungan, bukan
   angka penyedia — dengan alasan yang ditulis di kodenya: label sumber yang
   salah lebih buruk daripada tak menyebut sumber sama sekali. Diperiksa atas
   966 berkas bahwa ketiga ruas tambalan memang angka penyedia, bukan turunan.

Sisanya dibiarkan kosong. Jawaban atas pertanyaan Johan "SB atau Yahoo?":
**Yahoo Finance**, untuk tiga ruas itu saja, dan sudah diverifikasi per ruas.

Arahnya cocok dengan klausul 3c: sumber utama tetap keystats Stockbit, Yahoo
berperan cadangan, dan tambalannya ditandai di antarmuka.

---

## 6. RIGS — keputusan Johan, bukan Papan

`RIGS` = **Rig Tenders Indonesia Tbk.** Panen OHLCV-nya gagal karena satu bar
rusak (`high < low`) pada **2020-05-19**.

Datanya **tidak hilang** — `_arsip-mentah/ohlcv-stockbit/RIGS/` berisi 4 potret.
Yang terjadi adalah kebijakan: `panen_ohlcv_stockbit.py:97` membuang **seluruh
emiten** saat satu bar cacat, jadi `RIGS.json` tidak pernah terbit dan halaman
tidak punya RIGS sama sekali.

RIGS muncul kedua kalinya di `scripts/lengkapi_fundamental.py` — satu-satunya
emiten dari 85 pelapor non-IDR yang sengaja dilewati guard sanity-check. Emiten
yang sama tersandung dua penjaga berbeda; itu pola, bukan kebetulan.

Pilihannya: karantina satu bar (terbitkan sisanya, catat pengecualiannya) atau
buang satu emiten. **Yang tidak boleh: membuang bar diam-diam.** Menunggu Johan.

---

## 7. Dua kosakata untuk satu gagasan — sebelum keduanya menyimpang

Ditemukan saat memverifikasi bagian 5. Proyek kini punya **dua penambal
fundamental yang menandai asal angka dengan cara berbeda**:

| | penambal | caranya | penanda |
|---|---|---|---|
| lama | `scripts/lengkapi_fundamental.py` | MENGHITUNG dari bahan di berkas yang sama + XBRL resmi | ruas `asal_turunan`, dibaca `KolomValuasi.tsx` |
| baru | `app/src/lib/dasbor/berkasRasio.ts` | MENYALIN nilai dari sumber cadangan | `NAMA_CADANGAN` / `NAMA_CADANGAN_TURUNAN`, blok F |

Keduanya benar sendiri-sendiri, dan bedanya nyata: yang pertama turunan
(boleh tanpa keputusan Johan — ia bukti angka, bukan jahitan), yang kedua
jahitan lintas sumber (butuh tabel pembanding, sudah dibuat).

Yang berisiko: dua kosakata untuk gagasan yang sama akan menyimpang begitu
salah satunya disesuaikan, dan pembaca halaman melihat dua gaya penanda asal
di layar yang sama. Ini kelas cacat yang sama dengan ambang risiko PDF dan
`sejak 2020` — kode berubah, teksnya tidak ikut.

Yang diminta: **satu baris di `docs/referensi_idx-statistik.md`** yang mencatat
kedua mekanisme berdampingan beserta bedanya (hitung vs salin). Bukan
menyatukan kodenya — keduanya memang beda perkara. Cukup satu tempat yang
mengingat bahwa keduanya ada.

**Kriteria terima:** `grep -c "asal_turunan" docs/referensi_idx-statistik.md`
lebih dari nol.
