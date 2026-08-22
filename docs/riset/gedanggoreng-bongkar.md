# gedanggoreng.netlify.app — audit SOP (23 Agu 2026)

Johan: *"perlu di audit setiap menu dan fungsinya"*. Situs analisa/screening
buatan perorangan. Diaudit tanpa login (tak ada auth wajib; password opsional,
dan `/api/auth/check-password` menjawab `hasPassword:false` — jadi terbuka).

## ⚠️ TEMUAN KEAMANAN (bukan untuk ditiru)

`GET /api/token-status` **membocorkan token Stockbit (JWT) milik pemilik situs
ke publik** — payload memuat `use: "Harisam"`, `ema: harismajid@outlook.com`,
`uid: 412887`. Siapa pun yang membuka endpoint itu memegang sesi Stockbit orang
tersebut sampai `exp`. Kita **tidak memakainya** (kredensial orang lain), dan
pelajaran untuk PAPAN: token Stockbit kita hidup di berkas lokal ber-gitignore,
**tak pernah** disajikan lewat endpoint mana pun — pola gedanggoreng ini persis
yang harus dihindari. (Kalau Johan kenal pemiliknya, layak dikabari.)

## 1 · Infrastruktur

| Lapis | Temuan |
|---|---|
| Hosting | **Netlify** (`Cache-Status: "Netlify Durable"/"Netlify Edge"`), Next.js (App Router; RSC `?_rsc=`) |
| Front-end | Next.js + React, chunk `_next/static`, cdnjs |
| Backend | Route handler Next.js sendiri: `/api/*` di domain yang sama |
| Data pasar | **Token Stockbit** (running stream + broker) + **RapidAPI** (kuota "22/1000, reset tgl 5") untuk sentimen makro & sebagian screener |
| AI | **Gemini 3 Flash Preview (Thinking HIGH)** untuk "Analyze Story" (terbaca di job-logs) |
| Notifikasi | **Telegram** (DSI alert) |

## 2 · Menu & turunannya (SOP "sampai habis")

Sidebar tetap: jam server, status **Stockbit Stream** (Ready), **Background
Job** (Idle/Checking), **Token Status** (Expires On …), fullscreen, tema,
**Password Settings**, statistik pengunjung (live/today/monthly/total).

- **Calculator** (`/`) — form ANALYZE STOCK: input EMITEN + rentang tanggal →
  **Calculate Price Target** dan **Analyze Story** (AI, disabled sampai ada
  target). Ini padanan "Kartu Analisa / Deep Dive" versi mereka.
- **Morning Briefing** (`/briefing`) — "Global Market Sentiment & Daily
  Economic Pulse": sentimen pasar global + analisis komoditas, tombol Refresh
  (sumber RapidAPI).
- **Screener** (`/screener`) — mode: After Market (18:00–08:00), Intraday
  (09:30/11:00/13:30), BSJP (>14:00), API Screener, Template Screener, ATM
  Harian, Alert DSI. Preset sinyal: **Breakout · Multibagger · Insider ·
  Daily Movers · Daily Top Stocks**. Kuota RapidAPI ditampilkan. Run Screener
  → daftar emiten.
- **Trading Plan** (`/trading-plan`) — **Generate Trading Plan Hari Ini**,
  cari emiten/sumber screener, rentang 1D/1W/1M + kalender. Kosong hari ini.
- **Tracer** (`/accuracy`) — "lacak keberhasilan target price + live Telegram
  DSI". Sub: Watchlist · ATM Harian · BSJP Screener · Alert DSI · API
  Screener · Template Screener. Watchlist: tambah kode, NET/GROSS, **BROKER
  INDEX: Smartmoney / Whale / Retail / Mix**, IHSG 30 hari, kolom Top Broker
  Akum 31D / Akum 1D / Dist 1D (broker, lot, avg, val), filter per tipe alert.
- **Manual Book** — dialog bantuan.

## 3 · Endpoint nyata (tab Network)

`/api/trading-plan?startDate&endDate` · `/api/trading-plan/generate` ·
`/api/token-status` (BOCOR, lihat atas) · `/api/job-logs?limit=` (riwayat job
AI: analyze-story pakai Gemini) · `/api/job-retry` · `/api/visitors` ·
`/api/auth/{check,verify,set}-password`. Screener & briefing menembak RapidAPI
dari server.

## 4 · Sumber data hulu

Sama dengan kita + tambahan: **Stockbit** (broker summary & stream — token
pribadi, persis yang kita pakai), **RapidAPI** (makro/sentimen, berbayar kuota),
**Gemini** (narasi AI), **Telegram** (distribusi alert). Broker index
Smartmoney/Whale/Retail = klasifikasi buatan sendiri, sama konsepnya dengan
kelompok broker kita.

## 5 · Peta ke PAPAN

| Fitur mereka | Padanan kita | Status |
|---|---|---|
| Calculator price target | Kalkulator + Kartu Analisa | ada |
| Screener (breakout/multibagger/movers) | Screener + kandidat Deep Dive | ada, preset beda |
| Trading Plan harian | Deep Dive / Analisa PAPAN v1 | ada, konsep sama |
| Tracer akurasi target | tinjauan H+5 (`tinjau_deepdive.py`) | **ada** — kita lebih terukur |
| Broker index Smart/Whale/Retail | kelompok broker (mockup Broker Summary) | ada |
| Watchlist broker akum/dist | broker harian per emiten | ada |
| Morning Briefing makro (RapidAPI) | Kabar + belum ada sentimen makro global | **belum** |
| Analyze Story (Gemini) | Tanya PAPAN (dimatikan sementara) | ditunda |

## Kesimpulan

gedanggoreng = perkakas satu orang di atas token Stockbit pribadi + RapidAPI +
Gemini + Telegram. **Tak ada fitur data yang kita tak punya jalannya** kecuali
sentimen makro global (RapidAPI berbayar) dan narasi AI. Yang menarik ditiru
sebagai ide, bukan data: **Tracer** (papan akurasi target price yang hidup) —
tapi kita sudah punya mesinnya (`tinjau_deepdive.py`), tinggal tampilan.

Pelajaran terkuat justru negatif: **jangan pernah menyajikan token lewat
endpoint** — kesalahan yang gedanggoreng buat dan kita sudah hindari sejak awal.
