Dari sesi AI Skill (Fable), 26 Agu 2026 — **AUDIT gedanggoreng.netlify.app** (web #3) + **spek Visitor Tracking PAPAN** + **analisa kebocoran akun**. Metode: chrome-devtools (tak butuh login — perintah Johan), semua halaman + semua endpoint API dibongkar read-only (hanya GET yang halaman itu sendiri panggil; tidak ada aksi merusak/takeover).

# Identitas
- **gedanggoreng.netlify.app** — "Gedang Goreng · Platform Analisa & Screening". Next.js (turbopack) di Netlify. Proyek kecil satu-pemilik, proxy ke akun **Stockbit** pemilik + **RapidAPI**. Beda produk dari tradersaham (lebih sederhana), kemungkinan pembuat/lingkaran yang sama.
- 5 menu: **Calculator** (Analyze Stock: emiten + date range → Calculate Price Target / Analyze Story) · **Morning Briefing** · **Screener** · **Trading Plan** · **Tracer** (+ Manual Book). Sidebar: jam WIB, status Stream/Job/Token, Visitor Stats, Fullscreen, Light Mode, Password Settings.

# Fitur per halaman
- **Morning Briefing**: sentimen global (Wall St, indeks, komoditas, USD/IDR), Rotasi Sektor BEI (IMPROVING/LEADING/LAGGING), "Update Latest News" (RapidAPI). Bagus tapi = Market Overview tradersaham versi ringkas.
- **Screener**: multi-model — After Market (18:00-08:00), Intraday (09:30/11:00/13:30), BSJP (run after 14:00), API Screener, Template Screener, ATM Harian, Alert DSI. Preset: Breakout, Multibagger, Insider, Daily Movers, Daily Top Stocks. "Run Screener" on-demand. Rapid API token usage bar (0/1000, reset tgl 5).
- **Trading Plan**: generate plan hari ini (1D/1W/1M) per rentang tanggal.
- **Tracer** (INI yang penting — konsep rapor): "Lacak keberhasilan target price + pantau live Telegram DSI alert". Endpoint `/api/screener/accuracy` mengembalikan **`tp1HitRate, tp2HitRate, targetRealistisHitRate, targetMaxHitRate, avgDurationTp1/Tp2/TargetRealistis/TargetMax, activeCount, totalTracked`** + records. **Ini persis adendum BadgeRapor kita** — bukti pihak lain pun mengukur hit-rate target; perkuat Rapor & Badge sebagai fitur wajib PAPAN. Watchlist Tracer punya BROKER INDEX Smartmoney/Whale/Retail/Mix + kolom Top Broker Akum 31D/1D + Dist 1D.
- **Calculator**: Analyze Story (RapidAPI, narasi) + Calculate Price Target.

# Rute API (dari bundle JS)
`/api/analyze-story · /api/auth/{check,set,verify}-password · /api/job-retry · /api/rapidapi/usage · /api/screener/{accuracy,dsi/push,dsi/re-enrich-pending,run,save,stockbit-list,stockbit-movers,watchlist} · /api/stock · /api/token-status · /api/trading-plan/generate · /api/visitors`

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

# ==== ANALISA "KEBOCORAN AKUN" (permintaan Johan) ====
**Temuan (semua read-only, tidak dieksploitasi):**
1. **Password protection MATI**: `GET /api/auth/check-password` → `{enabled:false, hasPassword:false}`. Situs seharusnya bisa dikunci password, tapi saat ini TERBUKA penuh. Semua endkpoin API bisa dipanggil siapa pun tanpa auth.
2. **Arsitektur = proxy publik ke akun Stockbit pribadi pemilik**: seluruh data screener/story/trading-plan mengalir lewat token Stockbit pemilik (`/api/token-status` → saat ini `isExpired:true` = "Please Reconnect to Stockbit"). Saat token valid, **pengunjung anonim mana pun memakai sesi Stockbit berbayar pemilik** — menghabiskan kuota & berpotensi menyentuh data akun. Ini inti "kebocoran akun": kredensial pribadi menyalakan situs publik tanpa gerbang.
3. **`/api/auth/set-password` menerima POST sementara `hasPassword:false`** → risiko *account-takeover panel*: penyerang bisa men-set password miliknya sendiri lebih dulu dan mengunci pemilik. (TIDAK diuji — hanya diflag.)
4. **Kuota RapidAPI terekspos publik** (`/api/rapidapi/usage` → 1000/1000) — siapa pun bisa memantau & menguras.
5. `/api/token-status` HANYA mengembalikan boolean (exists/isValid/isExpiringSoon/isExpired) — nilai token TIDAK bocor lewat endpoint ini (baik). Bundle JS juga BERSIH dari kredensial hardcoded (dicek regex token/secret/bearer → nol hit).
6. Header server `Netlify`, tak ada `x-powered-by` bocor (baik).

**Pelajaran WAJIB untuk PAPAN** (karena PAPAN juga proxy Stockbit + akan tambah visitor tracking):
- **JANGAN pernah menyajikan endpoint yang menumpang token Stockbit pribadi ke pengunjung anonim tanpa gerbang.** Kalau PAPAN publik, panen jalan di server (cron/worker) dan yang disajikan ke pengunjung = **data hasil panen yang sudah tersimpan (statis/DB)**, bukan pemanggilan langsung ke Stockbit atas nama akun pemilik.
- Token Stockbit hanya di server (env), tidak pernah ke klien; endpoint publik tidak boleh memicu refresh/aksi akun.
- Kalau ada mode terkunci (mis. fitur Diamond / admin), auth harus AKTIF secara default (fail-closed), bukan fitur yang kebetulan dimatikan.
- Jangan ekspos kuota API pihak ketiga ke publik.
- Rate-limit + hash-anonim untuk visitor; jangan simpan PII.

# Verdict adopsi
- **Visitor Stats**: ADOPSI (spek di atas) — kecil, berguna, aman kalau ikuti rambu.
- **Tracer hit-rate**: sudah tercakup adendum BadgeRapor kita (lebih kuat) — gedanggoreng mengonfirmasi arah.
- Morning Briefing / Screener / Trading Plan: kalah dari tradersaham & spek kita; tidak perlu tiru.
- Arsitektur proxy-akun: JANGAN tiru — jadikan contoh negatif di Metodologi keamanan PAPAN.
