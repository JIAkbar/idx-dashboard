Bertindaklah sebagai Analis Pasar Keuangan Senior dan Pakar Ekuitas (Saham) dengan pengalaman lebih dari 10 tahun di bursa saham global dan domestik.

Tujuan: Memberikan analisis pasar, evaluasi saham, wawasan ekonomi makro, dan proyeksi tren yang objektif, akurat, serta berbasis data.

Panduan Analisis:

Pendekatan Holistik: Selalu pertimbangkan tiga pilar utama dalam setiap analisis:

Fundamental: Laporan keuangan, valuasi (PER, PBV, EPS), model bisnis, dan keunggulan kompetitif.

Teknikal: Tren harga, volume transaksi, momentum, serta level kunci (Support, Resistance, Moving Average).

Sentimen & Makroekonomi: Dampak suku bunga, inflasi, kebijakan bank sentral, geopolitik, dan berita sektoral terkini.

Struktur Penyajian: Sajikan informasi secara sistematis agar mudah dipahami. Gunakan heading, poin-poin (bullet points), dan buatkan tabel ringkasan metrik keuangan jika Anda menganalisis saham spesifik.

Objektivitas & Rasionalitas: Hindari bias emosional atau spekulasi tak berdasar. Selalu paparkan dua sisi koin: potensi pertumbuhan (katalis positif) dan potensi penurunan (risiko/katalis negatif).

Gaya Bahasa: Profesional, lugas, ringkas, namun tetap dapat dipahami oleh investor ritel yang serius.

Manajemen Risiko: Selalu ingatkan tentang pentingnya manajemen risiko dan diversifikasi portofolio.

Disclaimer Keuangan: Sertakan disclaimer singkat di akhir setiap analisis bahwa informasi ini bersifat edukatif/informasional dan bukan merupakan rekomendasi atau saran investasi mutlak (Not Financial Advice).

Format Output Standar:

Ringkasan Eksekutif (Kesimpulan singkat)

Tinjauan Makro/Sektoral (Kondisi pasar secara umum)

Analisis Spesifik (Fundamental & Teknikal aset yang ditanyakan)

Katalis & Risiko (Pro dan Kontra)

Kesimpulan Analis (Pandangan akhir yang merangkum data)

Jika Anda mengerti dan siap menerima peran ini, balas dengan: "Saya siap bertindak sebagai Analis Pasar Keuangan Anda. Saham, sektor, atau kondisi makroekonomi apa yang ingin kita bedah hari ini?"
<!-- ai-kemampuan-pointer -->
## Basis Pengetahuan
Baca dulu (efisiensi + navigasi): `C:\1-Johan\10. Pengembangan\AI Skill\03 - AI Kemampuan (Basis Pengetahuan)\hemat.md` lalu `kemampuan-index.md`.
<!-- /ai-kemampuan-pointer -->

---

## PAPAN — aturan kerja teknis

Catatan hidup ada di `docs/rencana-berjalan.md` (progres, antrean, keputusan
yang sudah diambil). **Baca itu dulu sebelum menyentuh apa pun** — di sana ada
tabel keputusan yang mencegah perdebatan ulang.

### Sumber data — jangan tertukar perannya
| Sumber | Untuk apa | Jebakannya |
|---|---|---|
| **IDX** `GetStockSummary` | Hari berjalan **dan riwayat per tanggal sejak awal 2020**. 32 ruas: volume, frekuensi, asing | `OpenPrice` praktis kosong sebelum 2025 (5-8%), hari ini pun 74%. Nol di ruas itu ≠ tak diperdagangkan |
| **Yahoo Finance** | Riwayat sebelum 2020 + **harga BUKA riwayat** | `range=max` diam-diam menurunkan resolusi jadi BULANAN walau `interval=1d`. **WAJIB** `period1`/`period2` — sudah dua kali menjebak |

Data broker per emiten tidak ada di `GetStockSummary`. `ForeignBuy`/
`ForeignSell` itu aliran asing, bukan identitas broker.

**Sudah diuji 16 Agu 2026 dari IP rumahan** (`docs/sumber-fundamental-idx.md`):
seluruh endpoint IDX menjawab 200 di sini, padahal dasbor lain kena `IDX API
403` lewat Netlify — blokirnya per-IP, bukan per-endpoint. `GetBrokerSummary`
bekerja tapi **mengabaikan `stockCode`**, jadi hasilnya selalu level pasar.
Broker **per emiten** tetap belum ketemu di endpoint publik mana pun.

Sekalian ketemu yang lebih besar: **laporan keuangan resmi XLSX ber-XBRL per
emiten per kuartal** lewat `GetFinancialReport` — 777 dari 778 emiten TW2 2026,
berisi sektor IDX-IC resmi dan pemegang saham pengendali. Runbook lengkapnya di
`docs/sumber-fundamental-idx.md`, rencana pakainya di
`docs/workflow-fundamental.md`.

### Yang berulang kali jadi sumber bug
- **Grid pembungkus halaman wajib `minmax(0, 1fr)`**, bukan `auto`. Kolom `auto` melebar mengikuti anak terlebar; `.dasbor-main` memotong (bukan menggulung), jadi kelebihannya tak terjangkau di ponsel.
- **`display:flex` jangan dipasang ke `<td>`** — sel berhenti berperilaku sebagai sel tabel, tingginya menyusut, garis bawahnya jadi tak sejajar. Bungkus isinya.
- **Tanggal setoran wajib lewat `lib/tanggalBursa.ts`** — jangan tulis ulang `new Date()`. Fungsi itu pernah disalin di 4 berkas dan keempatnya salah bersamaan.
- **Mengganti NILAI status/enum wajib disertai sapuan pembacanya.** Migrasi #142 mengganti `'ditolak'` → `'dihapus'` tanpa memeriksa siapa yang membaca nilai itu; enam objek SQL tertinggal menyaring nilai yang tak pernah ada lagi dan semuanya gagal senyap (kuota termakan, emiten terkunci, akurasi selalu 100%). Sapuannya: `select proname from pg_proc where prosrc like '%nilai%'` + `pg_policies` (`qual` DAN `with_check`) + grep kode termasuk berkas uji.
- **Harga yang ditampilkan wajib lewat `keFraksi()`** (`lib/fraksiHarga.ts`). Kecuali rata-rata biaya hasil hitungan, yang memang tak wajib jatuh di tick.
- **Kunci dedup jangan cuma tautan.** Pengumuman resmi IDX tanpa lampiran semuanya menunjuk ke satu URL generik (halaman keterbukaan informasi), jadi dedup ber-tautan meringkas belasan pengumuman berbeda jadi SATU baris — tanpa galat, cuma daftar yang menyusut diam-diam dan dari layar terbaca sebagai "beritanya tidak ada". Pakai tautan + judul + waktu (`gabungKabar()` di `lib/dasbor/kabar.ts`, sudah ada tesnya).
- **Pemanen berhenti kalau halaman KEMBAR PERSIS, bukan kalau "tak ada item baru".** Endpoint IPOT mengabaikan parameter `halaman` (halaman 0/1/5/50 membalas 200 `news_id` yang sama), dan panen ulang yang wajar juga menghasilkan nol item baru — syarat itu tak bisa membedakan "arsipnya habis" dari "sumbernya jalan di tempat". Tanpa pemeriksaan sidik halaman, skripnya menembak 1.000 permintaan selama 20 menit untuk nol hasil.

### Cara kerja & rilis — WAJIB

**Kerjakan semua di localhost. Jangan push tanpa diminta.** Aturan ini berlaku sejak
16 Agu 2026 dan mengikat seluruh sesi berikutnya: commit boleh, `git push` hanya setelah
Johan menyatakan "live"/"push". Verifikasi tetap di `localhost:5173` lewat devtools.

**Tiap kali tak ada tugas lagi, tutup sesi dengan memperbarui empat tempat** — bukan
salah satu saja:

| Tempat | Isi |
|---|---|
| `CLAUDE.md` (berkas ini) | Aturan teknis baru yang mengikat sesi berikutnya |
| `docs/rencana-berjalan.md` | Progres, antrean, keputusan yang sudah diambil |
| `memory/MEMORY.md` + berkas memori | Fakta lintas sesi yang tak terbaca dari kode |
| `AI Skill/03 - AI Kemampuan/kemampuan-*.md` | Pelajaran yang berguna di **proyek lain**, didaftarkan di `kemampuan-index.md` |

Yang masuk kemampuan lintas proyek: pola teknis yang terbukti, jebakan yang gagal senyap,
metodologi kerja. Yang TIDAK: hal khas proyek ini (itu masuk `docs/`).

### Nada tulisan
Pesan ke kontributor berbentuk **apresiasi**, bukan pemberitahuan penolakan.
Setoran yang disetujui tapi tak dimuat di edisi harus terbaca sebagai terima
kasih — pengakuan di depan, keterangan teknis di belakang.

### Verifikasi
Dua viewport (laptop 1536×960×1.25, telepon 412×915×2.625) sebelum melapor
selesai. Halaman admin ada di balik login: **jangan pernah mengisi kolom
sandi** — minta Johan login sendiri di jendela devtools.
