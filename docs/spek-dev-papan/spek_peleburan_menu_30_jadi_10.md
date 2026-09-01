# Spek — Peleburan 30 menu jadi 10

**Dari:** Fable (pengawas, sesi AI Skill) · **Untuk:** sesi PAPAN · **31 Agu 2026**
**Asal perintah (Johan, verbatim):** *"terkait peleburan ini buatkan spec jangan sampai
[lupa], catat dan kirim ke sesi papan trading"* — atas rancangan "Peleburan: 30 menu jadi
10" yang kau terbitkan sendiri.

Rancangannya bagus dan tidak kuubah: dikelompokkan menurut **pertanyaan yang dijawab**,
bukan menurut sumber datanya. Itu keputusan yang benar — orang membuka menu karena punya
pertanyaan, bukan karena tahu tabel mana yang dibacanya.

Yang kutambahkan cuma yang membuatnya bisa dikerjakan tanpa ada halaman yang hilang
diam-diam.

---

## 0. Inventaris terverifikasi — angkanya HARUS menjumlah

Kuhitung dari repo, bukan dari gambar:

    app/src/lib/dasbor/menu.ts     36 entri  =  6 grup + 30 halaman berpath
    app/src/App.tsx                36 rute

Tiga puluh halaman itu, dipetakan ke sepuluh menu barumu:

| menu baru | n | rute lama yang dilebur |
|---|---|---|
| Beranda | — | `/` (papan RTI + Diary, sudah jadi) |
| Sinyal | 4 | `/screener` `/jago-papan` `/harian-papan` `/kartu` |
| Emiten | 3 | `/stock-detail` `/grafik` `/berkas-emiten` |
| Aliran Dana | 7 | `/broker-summary` `/broker-summary-v2` `/whales-papan` `/trader-papan` `/neo-papan` `/aliran-asing` `/peta-investor` |
| Pasar | 5 | `/indeks` `/sector` `/stocks` `/broker` `/statistik` |
| Pantau | 3 | `/watchlist` `/radar` `/kalkulator` |
| Musiman | 2 | `/seasonality` `/ipo` |
| Terbitan | 1 | `/bulletin` |
| Kabar | 1 | `/kabar` |
| Metodologi | 2 | `/metodologi` `/feedback` |
| **belum berumah** | **2** | `/chart` · `/kuli-papan` |

    28 dilebur + 2 belum berumah = 30 ✓

**Catatan kecil di tabelmu:** kolom "dari" menjumlah 29 karena Beranda ditulis "1",
padahal sumbernya (`/`) bukan salah satu dari 30 halaman berpath itu. Perbaiki jadi "—"
atau sebut sumbernya, supaya pembaca yang menjumlah tidak berhenti percaya pada tabelnya.

---

## 1. Aturan yang tidak boleh dilanggar

1. **Nol halaman hilang.** Peleburan mengubah PINTU, bukan isi. Tiap dari 30 halaman
   tetap terjangkau sesudahnya — sebagai tab, atau sebagai rute yang masih hidup.
2. **Rute lama tetap bekerja.** Johan dan siapa pun punya markah dan tautan ke
   `/broker-summary-v2`, `/berkas-emiten`, dst. Rute lama diarahkan ke tab barunya,
   bukan dihapus.
3. **Tab ada di URL.** `/aliran-dana?tab=whales` harus bisa disalin dan dibuka orang
   lain, dan tombol Kembali peramban harus kembali ke tab sebelumnya, bukan keluar
   halaman. Tanpa ini, tujuh halaman jadi satu halaman yang tak bisa ditautkan.
4. **Hak akses tidak berubah diam-diam.** Lihat risiko (a) di bawah — ini yang paling
   berbahaya dari seluruh pekerjaan ini.

---

## 2. Risiko konkret, dan yang membuatnya nyata

### (a) `PETA_MENU_KUNCI` berkunci pada ID MENU — dan ID menu yang berubah

`app/src/lib/aksesHalaman.ts:135` memetakan **id menu → kunci akses**
(`world: 'dasbor'`, `chart: 'chart'`, `'stock-detail': 'detail'`, …). Tiga puluh id
menyusut jadi sepuluh berarti dua puluh kunci kehilangan pemiliknya.

Akibat yang mungkin, dan dua-duanya senyap:

- halaman bertier terbuka untuk semua orang karena kuncinya tak lagi terpetakan;
- halaman gratis tertutup karena mewarisi kunci menu induk yang lebih ketat.

**Wajib:** sebelum menyunting menu, tulis dulu tabel `id lama → id baru → kunci akses
lama → kunci akses baru` untuk ke-30 halaman, dan pastikan **tidak ada baris yang kunci
barunya berbeda dari kunci lamanya** kecuali memang diputuskan Johan. Sertakan tabel itu
di laporan.

### (b) Rute yatim

Rute yang tetap ada di `App.tsx` tapi hilang dari menu = halaman hidup yang tak bisa
ditemukan siapa pun. Itu bukan penghematan, itu kehilangan tanpa jejak.

### (c) Tab yang tidak bisa ditautkan

Sudah di aturan 3. Sebutkan di laporan bagaimana keadaan tab disimpan.

### (d) Dua halaman "belum berumah" — keputusan Johan, bukan agen

Usulmu: `/chart` jadi tab di Pasar (alasannya jujur — nol data PAPAN, isinya 20+ indeks
bursa yang datanya tak kita punya), dan `/kuli-papan` masuk Pantau bersama Kalkulator.

Dua-duanya masuk akal. Tapi keduanya **menghapus menu yang sekarang ada**, jadi
tanyakan dengan pola yang sudah terbukti berhasil hari ini: satu kalimat pilihan + satu
kalimat saran + satu baris biaya. Jangan menyimpulkan dari "kerjakan peleburannya"
bahwa dua penghapusan ini ikut disetujui.

---

## 3. Kriteria terima — perintah yang bisa Johan jalankan sendiri

```bash
# 1. Menu tinggal sepuluh (di luar entri grup)
grep -c "path: '/" app/src/lib/dasbor/menu.ts        # → 10

# 2. Nol rute hilang: jumlah rute TIDAK berkurang
grep -c 'path="/' app/src/App.tsx                    # → tetap 36 (atau lebih, kalau ada redirect)

# 3. Tiap rute lama masih menjawab (redirect atau tab)
#    daftar 30 path di bagian 0 dibuka satu per satu, nol 404

# 4. Kunci akses utuh
#    tabel (a) dilampirkan; nol baris yang kunci barunya != kunci lama tanpa keputusan Johan
```

Plus tiga angka, seperti sapuan sebelumnya: **halaman ditemukan · dilebur · sengaja
tidak dilebur (beralasan per halaman)**.

---

## 4. Urutan yang kusarankan

1. Tabel pemetaan lengkap (bagian 0 + kunci akses bagian 2a) — **sebelum satu baris pun
   disunting**. Ini yang membuat "nol halaman hilang" bisa dibuktikan, bukan dijanjikan.
2. Tanyakan dua keputusan (bagian 2d) ke Johan; kerjakan sisanya sambil menunggu.
3. Lebur satu grup dulu — **Musiman** (2 halaman, risiko terkecil) — sampai tab-di-URL,
   redirect, dan kunci akses terbukti bekerja. Baru lanjut ke Aliran Dana (7, terbesar).
4. Verifikasi tampilan di dua ukuran layar yang dipakai Johan, dan jalankan
   `scripts/ukur_ruang_kosong.js` pada tiap halaman gabungan — halaman bertab punya
   kecenderungan meninggalkan ruang kosong di tab yang isinya paling sedikit.

---

## 5. Yang TIDAK berubah karena peleburan ini

Peleburan menu **tidak** menyelesaikan perkara Screener vs Harian Papan yang masih
menunggu keputusan Johan (satu skor atau dua). Keduanya masuk menu **Sinyal** di
rancangan ini, dan itu justru membuat pertanyaannya lebih mendesak: dua tab
bersebelahan yang memberi vonis berbeda untuk emiten yang sama, tanpa penjelasan, akan
terbaca sebagai cacat oleh siapa pun yang membukanya.

Kalau peleburan menu jalan lebih dulu, **beri penanda di kedua tab itu** bahwa skornya
memang dua indikator berbeda — sampai Johan memutuskan.

---

## KOREKSI KRITERIA TERIMA — 1 Sep 2026 (kesalahan penulis spek, bukan pelaksana)

Kriteria `grep -c "path: '/" menu.ts → 10` di bagian 3 **SALAH**, dan salahnya milik
penulis spek ini (pengawas). Ia mengandaikan peleburan MENGHAPUS entri path — padahal
rancangan yang benar (dan yang dieksekusi, `f59c96cd9`) mempertahankan seluruh 30 entri
dan menambahkan ruas `induk`: halaman ber-`induk` hilang dari rail dan jadi TAB di
halaman induknya, rutenya tetap hidup. Implementasi itu justru MEMENUHI aturan "nol
halaman hilang" lebih baik daripada yang kriteria lamanya bayangkan.

Akibat nyata kesalahan ini: pengawas dua kali melaporkan "peleburan belum mulai" kepada
Johan atas pekerjaan yang sudah selesai sejak pagi. Kriteria yang mengukur tetangga
klaimnya (jumlah entri path, bukan jumlah pintu) — kelas §CORE-208.

**Kriteria terima yang benar:**

```bash
total=$(grep -c "path: '/" app/src/lib/dasbor/menu.ts)     # 30 — tak berubah, memang benar begitu
tab=$(grep -c "induk: '/" app/src/lib/dasbor/menu.ts)      # 21
echo "pintu tingkat-atas: $((total - tab))"                # 9  (Johan: "pangkas umumnya 10 maksimal")
```

Terverifikasi 1 Sep atas `f59c96cd9`: 30 − 21 = **9 pintu** (induk: broker-summary-v2×6
tab · indeks×5 · watchlist×3 · screener×3 · stock-detail×2 · seasonality×1 ·
metodologi×1). Penanda dua skor di tab Screener & Harian juga sudah masuk
(`57c8f6b47`). Verifikasi visual tetap lewat RENDER.
