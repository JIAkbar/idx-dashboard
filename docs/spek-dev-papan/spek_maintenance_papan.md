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

## 3. Yang perlu diputuskan Johan (satu hal, kecil)

Perlukah **jalur intip** untuk Johan sendiri melihat produksi selama tertutup
(mis. `?intip=1` yang disimpan sessionStorage)? Itu kenyamanan, tapi juga lubang —
siapa pun yang tahu parameternya masuk. Alternatif tanpa lubang: Johan melihat lewat
dev server lokal / preview deployment Vercel (URL preview per-commit sudah ada
gratis). **Saran: pakai preview Vercel, tanpa jalur intip.** Kalau Johan mau jalur
intip, katakan; defaultnya tidak dibuat.

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
