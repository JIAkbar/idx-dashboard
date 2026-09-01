# Spek — PAPAN ditutup sementara (mode renovasi)

**Dari:** Fable (pengawas, sesi AI Skill) · **Untuk:** sesi PAPAN · **1 Sep 2026**
**Asal perintah (Johan, verbatim):** *"karena masih tahap renovasi jadi lebih baik papan
di tutup dulu untuk sementara, berikan icon papan terbaru dan under maintenance"*

Perintah ini SEKALIGUS persetujuan push untuk gerbang maintenance — menutup situs
produksi memang butuh deploy. Persetujuan itu untuk gerbang ini saja, bukan untuk
commit peleburan/fitur lain yang menumpang di push yang sama. **Push gerbangnya
sendirian**; kerja renovasi menyusul di push berikutnya saat Johan bilang buka.

---

## 1. Bentuk: saklar, bukan pembongkaran

Satu env var di Vercel (mis. `VITE_PAPAN_TUTUP=1`), dibaca sekali di akar aplikasi
(`App.tsx` / entry): kalau menyala, render halaman maintenance untuk SEMUA rute —
SPA, jadi satu gerbang di akar menutup seluruh 30+ rute sekaligus, termasuk yang
diakses lewat tautan langsung/markah.

- **Buka kembali = matikan env var + redeploy.** Nol perubahan kode untuk membuka.
- **Lokal tidak terpengaruh** — dev server jalan normal (var tidak diset lokal),
  renovasi tetap bisa dikerjakan dan diverifikasi sambil produksi tertutup.
- JANGAN menutup lewat menghapus rute/kode — itu pembongkaran yang harus dibangun
  ulang, bukan saklar.

## 2. Halaman maintenance

- **Ikon PAPAN terbaru** — logo baru dirancang sesi Papan, dipakai di halaman DAN
  sebagai favicon baru (favicon lama ikut diganti; ini bagian dari "icon papan
  terbaru" yang Johan minta).
- Isi: nama PAPAN, satu kalimat *"sedang renovasi — segera kembali"*, tanpa tanggal
  janji spesifik (kalau meleset, teks basi tayang publik; kelas cacat yang sama
  dengan yang dua hari ini dibereskan).
- Terang + gelap (halaman publik satu-satunya selama renovasi — justru paling
  kelihatan kalau temanya patah).
- **Nol fetch data** dari halaman maintenance — jangan bocorkan endpoint
  `data-idx/json/*` di halaman yang sengaja publik saat semuanya tertutup.
- Dua ukuran layar yang dipakai Johan (1920×1080, 412×915).

## 3. Jalur intip — DIPUTUSKAN Johan 1 Sep: buat (verbatim: *"preview vercel saja dan jalur intip"*)

Johan memakai preview deployment Vercel DAN jalur intip. Pengerasan wajib:

1. **Kode intip dari env var** (`VITE_INTIP_KODE=<slug acak panjang>`), dipakai
   `?intip=<slug>`. Bukan `?intip=1` — yang tertebak satu percobaan bukan gerbang.
   Env var = bisa dirotasi tanpa sentuh kode; slug tak pernah masuk git.
2. **`sessionStorage`, bukan `localStorage`** — hidup per-tab, mati saat tab tutup.
3. **Slug tak ditulis di mana pun yang tayang** — bukan README, bukan teks halaman,
   bukan log konsol. Johan memegangnya karena ia yang set env var di Vercel.
4. **Batas jujur:** env `VITE_*` ter-bake ke bundle JS — pembaca bundle bisa
   menemukannya. Ini tirai dari pengunjung biasa, bukan kunci dari yang berniat;
   cukup untuk gerbang renovasi (situs kemarin pun publik penuh), dan pola ini
   DILARANG dipakai untuk data yang sungguh rahasia.

### Enam uji yang dijalankan (1 Sep 2026, semuanya lulus)

Ditulis di sini karena penjaga nomor 4 di bawah — env var kosong — adalah jenis
lubang yang tak terlihat dari membaca kode: perbandingan `kode === env` bernilai
BENAR saat keduanya kosong, jadi `?intip=` telanjang akan membuka seluruh situs.
Ia harus dicoba, bukan dinalar.

| # | Keadaan | Harapan | Hasil |
|---|---|---|---|
| 1 | gerbang menyala, tanpa parameter | tertutup | tertutup |
| 2 | `?intip=salah` | tertutup | tertutup |
| 3 | `?intip=<kode benar>` | terbuka, URL dibersihkan | terbuka, URL jadi `/indeks` |
| 4 | pindah rute tanpa parameter sesudah (3) | tetap terbuka | tetap terbuka |
| 5 | env var KOSONG + `?intip=` telanjang | tertutup | tertutup |
| 6 | env var KOSONG + `?intip=undefined` | tertutup | tertutup |

Ditambah satu perilaku yang tak diuji lewat peramban tapi ditulis di kodenya:
penyimpanan yang DILEMPAR peramban (situs yang memblokir storage) membuat jalur
intip gagal **tertutup**, bukan terbuka. Gerbang yang membuka saat penjaganya
rusak bukan gerbang.

## 4. Kriteria terima

```bash
# satu gerbang di akar, satu env var
grep -rn "PAPAN_TUTUP" app/src | wc -l    # kecil (1-2 tempat), di akar, bukan tersebar

# halaman maintenance tak memanggil data
grep -n "fetch\|data-idx" <berkas halaman maintenance>   # nol
```

Manual: buka papan-idx.vercel.app → maintenance tampil di `/`, di `/screener`, dan
di satu rute dalam via tautan langsung; favicon baru; lokal tetap normal; matikan
env var di preview → aplikasi penuh kembali.

---

## ADENDUM 1 Sep 2026 — keputusan Johan BERUBAH: situs tetap TERBUKA + modal renovasi

Johan (verbatim): *"artinya Papan skrg biarkan terbuka tapi di beri modal kalau Papan
belum bisa update dan under maintenance"*.

Gerbang penuh (bagian 1–3 di atas) TIDAK dibatalkan — kodenya sudah ter-push dan jadi
**saklar cadangan** yang tinggal dinyalakan env var kapan pun. Yang tayang sekarang
bentuk lain:

### KEPUTUSAN & TANGAN JOHAN: **tidak ada** — semuanya bisa jalan tanpa dia

Modal sengaja **hardcode menyala** (bukan env var) supaya tak ada satu pun langkah
yang menunggu dasbor Vercel. Mematikannya nanti = satu commit saat renovasi selesai —
yang memang akan terjadi bersama push besar pembukaan.

### Bentuk

1. **Modal saat halaman dibuka**: ikon PAPAN terbaru + judul "Sedang Renovasi" +
   isi jujur dua kalimat: PAPAN tetap bisa dibuka, tapi **data belum diperbarui
   untuk sementara dan angka bisa berubah selama renovasi**. Tanpa tanggal janji.
   Tombol "Mengerti" menutupnya; `sessionStorage` supaya tidak muncul ulang tiap
   pindah halaman, tapi muncul lagi di kunjungan/tab baru.
2. **Pita kecil permanen** (header, teks "Renovasi") sesudah modal ditutup — pengunjung
   yang sudah menutup modal tetap melihat situsnya sedang direnovasi. Kecil, tidak
   menghalangi, dua tema.
3. Ikon PAPAN terbaru juga menggantikan favicon (permintaan awal Johan tetap berlaku).
4. Dua ukuran layar Johan; modal harus bisa ditutup di 412×915 (tombol dalam jangkauan
   jempol, tidak terpotong lipatan 810px).

### Yang TIDAK berubah

- Gerbang `VITE_PAPAN_TUTUP` tetap di kode sebagai cadangan; jalur intip dorman
  (situs terbuka, belum diperlukan).
- Nol janji tanggal di teks mana pun.
- Push modal = disetujui oleh instruksi Johan ini (perubahan tampilan produksi yang
  ia minta sendiri).

### Kriteria terima

Render produksi (bukan grep bundle): modal tampil di kunjungan baru `/` dan di rute
dalam; tertutup → pita tetap tampil; muat ulang di tab sama → modal tak muncul lagi;
favicon baru; dua tema; 412×915 tombol terjangkau.
