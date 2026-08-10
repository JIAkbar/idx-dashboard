# Rencana Refactor React — IDXMI + Arus Pasar

> Disusun 2026-08-10, direvisi 2026-08-10 (arsitektur hibrida).
> Status: **persiapan** — belum ada kode refactor yang ditulis.
> Keputusan user: login **admin tunggal**; mesin analisa utama **Claude Code** (web = kotak masuk
> + arsip + rak terbitan); API vision menjadi **opsional**, bukan jalur utama.

## 1. Kenapa refactor

- `index_live.html` = 6.043 baris satu file, 11 menu, routing `sw()` manual — sudah melewati batas nyaman vanilla.
- Tiga kemampuan baru tidak mungkin di situs statis murni: **login**, **upload PDF → analisa otomatis**, **export PDF dari aplikasi**.

## 2. Stack tujuan

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | React + Vite + TypeScript | Stack terbukti di proyek SAKTI (`kemampuan-stack.md`); pola siap pakai |
| Auth | Supabase Auth, satu akun admin | MCP Supabase sudah terhubung; email+password cukup, tanpa manajemen user |
| Database | Supabase Postgres | Edisi, emiten, baris flow, skor — menggantikan JSON file |
| Storage | Supabase Storage | PDF/screenshot upload admin |
| Mesin analisa | **Sesi Claude Code** (manual / `/schedule`) | Transkripsi vision + narasi + rakit PDF; konteks metodologi utuh, masuk langganan. Cadangan opsional (fase 6): Edge Function → Claude API `claude-sonnet-5`, ~$1–11/bulan tergantung 3–20 emiten/hari |
| Skor | Port `arus-pasar/build.py` → modul TS | Deterministik, mudah diuji; SATU sumber kebenaran (Python dipensiun setelah paritas terbukti) |
| Export PDF | CSS print (`@page A4`) + `window.print()` | Template A4 sudah print-ready; nol server, nol biaya. Headless render server-side hanya kalau butuh otomasi penuh |
| Hosting | Tetap GitHub Pages (SPA statis) | Backend seluruhnya di Supabase; tidak perlu pindah hosting |

## 3. Alur yang disepakati (hibrida: web = wadah, Claude Code = otak)

```
HP admin → upload screenshot ke web (Supabase Storage), kapan saja
   ↓
Sesi Claude Code — manual, atau terjadwal via /schedule:
   tarik file dari Storage → transkripsi (vision sesi, masuk langganan)
   → tampilkan draf angka ke admin → koreksi → SETUJUI
   → mesin skor → narasi analisa (kualitas sesi penuh: METODOLOGI-ANALISA.md,
     kamus broker, riwayat edisi) → rakit PDF
   → unggah PDF + data edisi balik ke web sebagai edisi terbit
```

Alasan memilih ini di atas Edge Function + API vision: kualitas narasi setara edisi manual
(konteks metodologi utuh, model sesi), nol biaya API, satu otak analisa — bukan dua
implementasi yang harus dijaga paritasnya. Trade-off yang diterima: analisa butuh sesi
Claude Code hidup (manual/terjadwal), tidak bisa dipicu dari tombol di web.

Aturan integritas §8 tetap berlaku: tidak ada angka hasil baca mesin masuk terbitan
tanpa persetujuan admin; komponen hilang → penanda gap + penalti skor.

### Standar upload (wajib, supaya transkripsi konsisten)

| Berkas | Standar |
|---|---|
| Orderbook (Stockbit) — **wajib** | Tab ORDERBOOK · Net ON · tanggal terlihat · top-10 beli & jual utuh · slider Broker Action terlihat |
| Chart (TradingView) — opsional | Timeframe 1D · EMA50 + Pivot Points · label pivot/harga kanan terbaca · rentang ≥6 bulan · ekspor PNG |
| Penamaan | `TICKER_YYYY-MM-DD_*` (pola yang sudah dipakai) |

### Mitigasi chart tidak diupload

1. **Utama — hitung sendiri (tanpa browser):** EMA50 dan Pivot Points klasik
   (`P=(H+L+C)/3`, `R1=2P−L`, `S1=2P−H`, dst. dari bar sebelumnya) dihitung dari OHLC
   yfinance; chart digambar mesin render PDF yang sudah ada. Edisi tetap lengkap.
2. **Opsional — remote Chrome → TradingView:** buka TradingView via Claude in Chrome
   (login + template indikator user), tangkap layar. Dipakai hanya bila user ingin chart
   bersumber TradingView persis; fallback, bukan jalur utama.

Orderbook tidak punya mitigasi otomatis — broker summary per-saham tidak tersedia gratis
(METODOLOGI §10); tanpa orderbook → blok FLOW DATA GAP + penalti skor (§8).

## 4. Skema data awal (Supabase)

```
edisi        (id, kode, tanggal, status draf|terbit, ihsg_context jsonb)
emiten_edisi (id, edisi_id, ticker, ohlc jsonb, pivot jsonb, ema50,
              label, arah, flow_kelas, narasi jsonb, skor jsonb,
              slider_pct, sumber_upload_path)
flow_baris   (id, emiten_edisi_id, sisi B|S, kode_broker, nilai_juta,
              lot, avg, confidence, dikoreksi bool)
peran_broker (kode, peran ritel|scalper|institusi, catatan)
```

RLS: semua tabel hanya `authenticated` (admin tunggal). Bucket storage privat.

## 5. Yang dibawa, bukan ditulis ulang

| Aset sekarang | Nasib di React |
|---|---|
| `arus-pasar/template.html` (CSS nota riset) | Port **byte-per-byte** ke komponen (workflow §169) — desain sudah disetujui, jangan didesain ulang diam-diam |
| `arus-pasar/build.py` (skor + format angka id-ID) | Port ke TS + unit test paritas: input sama → skor sama persis |
| `METODOLOGI-ANALISA.md` | Acuan tetap; label, peran broker, aturan §8 jadi konstanta TS |
| 11 menu `index_live.html` | Migrasi per-view, satu view satu commit (pola hemat.md §14) |
| `data/*.json` (1.054 file) | Tetap dilayani statis untuk view lama; view baru pakai Supabase. Migrasi data lama ke DB = nanti, bukan prasyarat |
| GitHub Actions fundamental | Jalan terus tanpa perubahan |

## 6. Urutan fase (tiap fase = bisa dipakai, bukan setengah jadi)

| Fase | Isi | Bukti selesai |
|---|---|---|
| 0 | Scaffold Vite+React+TS + Supabase project + auth admin | Login/logout jalan; route `/admin` terlindungi |
| 1 | Modul skor TS + test paritas vs build.py | 3 emiten edisi ujicoba → angka identik |
| 2 | Port template Arus Pasar → komponen + export print CSS | PDF hasil print ≡ AP-100826-E01 (diff visual) |
| 3 | Form edisi manual + upload ke Storage (kotak masuk) | Rakit edisi end-to-end tanpa Claude Code; upload dari HP tersimpan rapi per tanggal |
| 4 | **Integrasi Claude Code sebagai mesin analisa** — alur tarik-file dari Storage, transkripsi+verifikasi, hitung pivot/EMA sendiri saat chart absen, unggah PDF terbit balik; lalu otomasi via `/schedule` | Satu siklus penuh: upload malam → agen pagi → draf → koreksi → edisi tayang di web |
| 5 | Migrasi 11 view dashboard lama, per view | Tiap view: verifikasi 3 viewport (aturan §175) |
| 6 *(opsional)* | Edge Function + API vision — hanya bila butuh analisa terpicu dari web tanpa sesi Claude Code | Upload di web → draf angka tanpa Claude Code |

Fase 4 versi lama (Edge Function vision) turun jadi fase 6 opsional — digantikan integrasi
Claude Code yang kualitas analisanya setara edisi manual dan tanpa biaya API. Fase 6 baru
dipertimbangkan kalau alur terjadwal terasa kurang (mis. butuh hasil instan dari tombol web).

## 7. Biaya & risiko

- **Kuota usage langganan**: mesin analisa di sesi Claude Code memakai jatah langganan —
  20 emiten/hari ≈ 40 gambar ≈ 90rb token input per siklus; muat, tapi pantau sisa kuota.
- **Claude API vision (fase 6 opsional)**: ~1.500–2.800 token/gambar; ~$1,2/bulan (3 emiten/hari,
  Sonnet 5 intro) s.d. ~$11/bulan (20 emiten/hari). Butuh API key prabayar terpisah dari langganan.
- **Supabase free tier**: cukup besar untuk admin tunggal; risiko pause 7 hari idle → mitigasi cron ping.
- **Akurasi vision**: angka mirip (8 vs 6, koma) — mitigasi confidence + UI koreksi (§3).
- **Paritas skor**: penyimpangan TS vs Python = kredibilitas — mitigasi test fase 1.

## 8. Belum diputuskan (tidak memblokir fase 0–3)

- Nama repo/URL produk (`idx-dashboard` tetap? subdomain Arus Pasar?)
- Draf narasi otomatis (AI tulis paragraf) — nice-to-have fase 4+, bukan inti
- Migrasi data historis 1.054 JSON ke Postgres
