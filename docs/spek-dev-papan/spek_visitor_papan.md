# SPEK VISITOR TRACKING PAPAN — 26 Agu 2026 (Fable, pengawas)

> Asal perintah Johan (26 Agu, verbatim): *"di PAPAN di beri visitor nih harusnya untuk mengukur dan tracking pengguna papan non login buat spec nya juga"*.
> **Catatan: spek ini SUDAH ditulis 26 Agu di dalam `audit_gedanggoreng.md`, tapi terkubur di tengah berkas audit sehingga tak ditemukan.** Diangkat jadi berkas sendiri supaya bisa dicari. Isinya sama, ditambah keputusan yang masih menunggu Johan.

# ==== SPEK VISITOR TRACKING untuk PAPAN (permintaan Johan: "ukur & tracking pengguna papan non-login") ====
Cara gedanggoreng (terverifikasi, sederhana & tepat):
- **POST `/api/visitors`** dipanggil sekali saat load halaman (fire-on-mount) → server mencatat kunjungan (sesi/IP/hari).
- **GET `/api/visitors`** → `{success, current, today, monthly, total}` — 4 angka ditampilkan di kartu "VISITOR STATS · Live" (Current=sesi aktif sekarang, Today, Monthly, Total kumulatif).
- Refresh berkala (polling) untuk "Live current".

**Rekomendasi implementasi PAPAN** (tanpa login, hormati privasi):
- Endpoint ringan `POST /api/visitors` (catat) + `GET /api/visitors` (4 angka). Simpan **hanya hitungan** — jangan simpan IP mentah/PII; pakai hash harian (`sha256(ip+ua+tanggal+salt)`) untuk unik-harian, buang setelah agregasi. "Current" = jumlah sesi aktif via heartbeat/websocket (TTL ~60 dtk) atau ping tiap 30 dtk.
- Tampilkan kartu Visitor Stats (Current/Today/Monthly/Total) di sidebar/footer — kecil, non-blok.
- **Kejujuran metrik**: current = perkiraan (heartbeat), tulis di tooltip. Jangan mengarang angka.
- PAPAN pakai stack sendiri (Vercel) — endpoint di route handler + KV/DB kecil (Vercel KV/Postgres). Bukan Netlify.

---

## Pelajaran keamanan yang mengikat spek ini

**Pelajaran WAJIB untuk PAPAN** (karena PAPAN juga proxy Stockbit + akan tambah visitor tracking):
- **JANGAN pernah menyajikan endpoint yang menumpang token Stockbit pribadi ke pengunjung anonim tanpa gerbang.** Kalau PAPAN publik, panen jalan di server (cron/worker) dan yang disajikan ke pengunjung = **data hasil panen yang sudah tersimpan (statis/DB)**, bukan pemanggilan langsung ke Stockbit atas nama akun pemilik.
- Token Stockbit hanya di server (env), tidak pernah ke klien; endpoint publik tidak boleh memicu refresh/aksi akun.
- Kalau ada mode terkunci (mis. fitur Diamond / admin), auth harus AKTIF secara default (fail-closed), bukan fitur yang kebetulan dimatikan.
- Jangan ekspos kuota API pihak ketiga ke publik.
- Rate-limit + hash-anonim untuk visitor; jangan simpan PII.

---

## Keputusan yang menunggu Johan

Sesi Papan menawarkan **Vercel Web Analytics** (aktifkan di dasbor, nol kode). Perbandingan jujur:

| | Vercel Web Analytics | Endpoint sendiri (spek di atas) |
|---|---|---|
| Ongkos kerja | nol kode, aktifkan saja | route handler + KV/DB kecil |
| Angka "Live current" | ❌ tidak ada (Vercel agregat harian) | ✅ ada (heartbeat TTL) |
| Kartu di dalam halaman PAPAN | ❌ hanya di dasbor Vercel | ✅ tampil di sidebar/footer seperti gedanggoreng |
| Privasi | ditangani Vercel | kita kendalikan penuh (hash harian, nol PII) |
| Biaya | kuota paket Vercel | ~nol |

**Rekomendasiku: dua-duanya, bukan salah satu.** Aktifkan Vercel Web Analytics sekarang (gratis informasi, nol kerja) untuk tren pengunjung; bangun endpoint sendiri hanya kalau Johan memang mau **kartu "Live" di dalam halaman** seperti gedanggoreng. Kalau kartu Live tidak penting, endpoint sendiri tidak perlu dibangun sama sekali.

**Pertanyaan yang perlu dijawab Johan sebelum dibangun**: apakah angka pengunjung ini untuk konsumsi Johan sendiri (cukup dasbor Vercel), atau ingin **dipamerkan ke pengunjung** di halaman (butuh kartu + endpoint sendiri)?
