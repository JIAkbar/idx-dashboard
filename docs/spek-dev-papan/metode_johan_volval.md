# Metode Johan — volume terhadap value di bar 5 menit

**Dicatat:** 1 September 2026 · **Sumber:** Johan langsung, di sesi PAPAN
**Kelas:** definisi indikator dari pemilik proyek — bukan turunan, bukan tafsir

---

## 1. Kutipan verbatim

Ditanya indikator apa yang ia pakai memilih sepuluh saham (CUAN, DSSA, BUMI,
ARCI, MBMA, TPIA, BREN, CDIA, VKTR, BNBR) untuk artifact "Sepuluh Saham, Tiga
Horizon" yang terbit 31 Agustus 2026, Johan menjawab:

> *"jadi metode yang saya gunakan lihat timeframe 5 menit kemudian, volval,
> volume terhadap value, jika volume tinggi dan value naik makan ada potensi
> naik"*

Ditulis ke berkas ini pada hari yang sama ia mengucapkannya. Alasannya
langsung: percakapan panjang menenggelamkan definisi, dan definisi indikator
dari pemilik proyek adalah hal yang paling mahal kalau hilang — ia tak bisa
direkonstruksi dari kode, karena kodenya belum ada.

## 2. Yang sudah pasti dari kalimat itu

| Unsur | Nilainya |
|---|---|
| Kerangka waktu | **5 menit** — bukan harian |
| Ruas yang dibaca | **volume** dan **value**, berpasangan (`volval`) |
| Arah sinyal | volume **tinggi** + value **naik** → potensi **naik** |

## 3. Satu percabangan yang BELUM dipastikan Johan

`value = volume × harga`. Jadi kalau volume naik dua kali di harga yang sama,
value ikut naik dua kali **tanpa satu pun pembeli membayar lebih mahal**.
Karena itu "volume tinggi DAN value naik" punya dua pembacaan yang berbeda
hasilnya:

- **(A) mentah** — volume di atas rata-ratanya sendiri, DAN value bar ini di
  atas value bar sebelumnya. Lemah secara logika: sebagian besar kenaikan
  value hanyalah kenaikan volume yang disebut dua kali.
- **(B) harga rata-rata** — `value ÷ volume` (harga rata-rata yang benar-benar
  dibayar per bar) sedang **naik** sementara volumenya besar. Ini yang membawa
  informasi: pembeli mengangkat harga, bukan sekadar ramai.

**Dugaan kerja: (B)**, karena itu yang terlihat mata di layar — batang volume
tinggi sementara harga rata-ratanya bergeser naik. **Belum dikonfirmasi Johan.**
Keduanya akan diukur berdampingan dan hasilnya dilaporkan apa adanya; kalau (A)
ternyata sama baiknya, itu temuan, bukan alasan menyederhanakan.

## 4. Datanya SUDAH ADA — bukan sumber baru

Ini perlu ditegaskan karena sempat disimpulkan sebaliknya di sesi lain
("arsip kita HARIAN, replikasi persis butuh panen intraday, itu sumber data
BARU"). Diperiksa 1 Sep 2026 dan **tidak benar**:

`_arsip-mentah/intraday/<KODE>/<YYYY-MM>.json.gz` — **875 emiten**, bar
**1 menit**, ruas terpisah `volume`, `value`, `frequency`, `lot`,
`foreign_buy`, `foreign_sell`, plus OHLC. Bar 5 menit tinggal dijumlahkan dari
lima bar 1 menit; `value ÷ volume` langsung memberi harga rata-rata per bar.

Kesepuluh saham pilihan Johan terukur **±19.900 bar masing-masing, 62 hari
bursa, 2026-05-29 .. 2026-08-28**.

**Kesenjangan yang nyata:** arsipnya berhenti **28 Agustus**, sementara
31 Agustus dan 1 September sudah lewat. Pemanennya manual (`docs/status-panen.md`
menyebutnya "WAJIB rutin tiap sore ≥16:30") dan server hanya menyimpan ±90
hari — **hari yang tak dipanen hilang permanen**. Jadi kesenjangan ini
mendesak, bukan sekadar merapikan.

## 5. Kenapa profil harian saja tak cukup

Pengukuran 1 Sep atas 842 emiten menemukan sepuluh pilihan Johan menonjol di
likuiditas (persentil median **97,4%** nilai, **97,6%** frekuensi) dan
keanggotaan grup konglomerat (**7 dari 10**, sementara pasar 8,8%).

Itu **jejak** metodenya, bukan metodenya. Likuiditas tinggi adalah **prasyarat**
supaya bar 5 menit punya cukup transaksi untuk dibaca — di saham tipis, barnya
bolong dan volval jadi derau. Grup konglomerat ikut karena di situlah lonjakan
volume terjadi.

Menyimpulkan "sistem sudah menangkap metode Johan" karena proksi hariannya
serumpun (`ukuran_order` = value ÷ freq, RVol) akan **salah**: proksi itu
mengukur rata-rata sepanjang hari, sementara metodenya mencari **momen** di
dalam hari. Rata-rata harian justru meratakan persis apa yang dicarinya.
Proksi harian tetap layak diuji sebagai pembanding — tapi sebagai pembanding,
bukan sebagai pengganti.

## 6. Yang belum diputuskan

- Pembacaan (A) atau (B) — menunggu Johan, sementara itu diukur keduanya.
- Ambang "volume tinggi": berapa kali rata-rata, dan rata-rata berapa bar.
- Jendela "value naik": dibandingkan 1 bar sebelumnya, atau tren beberapa bar.
- Jam berapa sinyalnya sah — pembukaan selalu bervolume raksasa dan akan
  memenuhi syarat "volume tinggi" tiap hari tanpa arti apa pun.
- Horizon hasilnya: naik dalam berapa menit/jam/hari.

Ambang tidak ditebak lalu disetel sampai kasus favorit muncul — itu pola yang
sudah dilarang di proyek ini (`kandidat_deepdive.py`, BUMI & DSSA peringkat
64/69). Yang benar: sapu rentang ambang, laporkan seluruh permukaannya, dan
biarkan Johan memilih dengan angka di depannya.
