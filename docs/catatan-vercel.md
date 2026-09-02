# Catatan `vercel.json` — kenapa isinya seperti itu

`vercel.json` **divalidasi terhadap skema ketat**. Properti yang tak dikenal
membuat SELURUH deployment ditolak:

```
Invalid request: should NOT have additional property '_catatan_crons'.
```

JSON juga tak punya sintaks komentar. Jadi **tak ada tempat untuk menulis
alasan di dalam berkas itu** — rumahnya di sini. Jangan menambahkan ruas
apa pun ke `vercel.json` yang bukan bagian skema Vercel, termasuk yang
berawalan garis bawah dan terlihat tak berbahaya.

---

## Riwayat kegagalan deploy 28 Agu – 2 Sep 2026

Dua sebab berurutan, dan yang kedua **lahir dari perbaikan sebab pertama**.

### Sebab 1 — cron 12 jam ditolak paket Hobby (28 Agu – 1 Sep)

`"schedule": "0 */12 * * *"` masuk 28 Agu bersama proxy harga live. Akun
Hobby hanya mengizinkan cron **sekali sehari**, jadi tiap deployment ditolak
saat validasi. Akibatnya **nol deployment dengan status apa pun** selama
empat hari — bukan build yang gagal, tapi build yang tak pernah dijalankan.

Yang membuatnya luput: penolakan terjadi di sisi Vercel dan tak meninggalkan
jejak di tempat yang biasa dilihat. GitHub Actions tetap hijau (ia tak
menyentuh Vercel), situs tetap terbuka menyajikan bundle lama, dan daftar
Deployments tak menampilkan baris merah karena memang tak ada baris.

Diperbaiki jadi `"0 0 * * *"` (harian). **Jangan kembalikan ke `*/12` tanpa
menaikkan paket** — ia akan mematikan seluruh deployment lagi, dan gejalanya
sama senyapnya.

### Sebab 2 — ruas `_catatan_crons` (1 – 2 Sep)

Perbaikan cron di atas dikirim bersama ruas `_catatan_crons` berisi
penjelasan sebab 1. Niatnya mencegah orang mengembalikan `*/12`; akibatnya
**skema Vercel menolak seluruh deployment** — 13 deployment Error berturut,
semuanya tanpa durasi karena gagal sebelum build dimulai.

Jadi sebab 1 memang terpecahkan (deployment mulai DIBUAT lagi), tapi
tertutup oleh sebab baru yang gejalanya nyaris identik.

**Pelajaran yang lebih besar dari kedua sebab itu**: "nol deployment" dan
"deployment Error tanpa durasi" tampak sama dari luar, dan dua-duanya
berarti kegagalan SEBELUM build. Yang membedakan cuma satu hal — ada
tidaknya baris di daftar Deployments — dan itu hanya terlihat kalau
saringan daftarnya diperiksa lebih dulu. Kesimpulan "nol deployment dibuat"
pada 1 Sep lahir dari daftar yang tersaring, dan bertahan sehari penuh.

---

## Ukuran deployment

`app/scripts/copy-static-data.mjs` menyalin data repo ke `dist/`.
`broker_tahunan` **dikecualikan** sejak 2 Sep 2026 dan disajikan GitHub
Pages — alasan dan angkanya ada di komentar skrip itu serta
`app/src/lib/dasbor/baseData.ts`.

| | Berkas | Ukuran |
|---|---|---|
| Deployment hijau terakhir (25 Agu) | 17.184 | — |
| Sebelum pengecualian (2 Sep) | 24.446 | 2,97 GB |
| Sesudah pengecualian | **16.515** | **0,82 GB** |
