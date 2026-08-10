# Rencana Refactor React — IDXMI + Arus Pasar

> Disusun 2026-08-10. Status: **persiapan** — belum ada kode refactor yang ditulis.
> Keputusan user: login **admin tunggal**; otomasi analisa **AI transkripsi → draf → user setujui**.

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
| Analisa vision | Supabase Edge Function → Claude API (vision) | Baca chart + orderbook dari upload → JSON terstruktur. Model: `claude-sonnet-5` cukup untuk transkripsi; naikkan hanya kalau akurasi kurang |
| Skor | Port `arus-pasar/build.py` → modul TS | Deterministik, mudah diuji; SATU sumber kebenaran (Python dipensiun setelah paritas terbukti) |
| Export PDF | CSS print (`@page A4`) + `window.print()` | Template A4 sudah print-ready; nol server, nol biaya. Headless render server-side hanya kalau butuh otomasi penuh |
| Hosting | Tetap GitHub Pages (SPA statis) | Backend seluruhnya di Supabase; tidak perlu pindah hosting |

## 3. Alur otomasi yang disepakati

```
Admin login → upload PDF/screenshot (chart TV + orderbook Stockbit)
  → Edge Function: pecah halaman → Claude vision → JSON draf
     (broker rows, pivot, OHLC hari, slider) + confidence per angka
  → UI DRAF: tabel side-by-side gambar asli vs angka terbaca,
     nilai confidence rendah disorot → admin koreksi → SETUJUI
  → mesin skor (TS) hitung Technical/Flow/RR/Liq/IHSG
  → admin tulis/edit narasi (draf awal dari AI, opsional)
  → pratinjau halaman → export PDF (print CSS) → arsip edisi ke DB
```

Aturan integritas §8 tetap berlaku: tidak ada angka hasil baca mesin masuk terbitan
tanpa persetujuan admin; komponen hilang → penanda gap + penalti skor.

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
| 3 | Form edisi manual (input angka tanpa AI dulu) | Bisa rakit edisi baru end-to-end tanpa Claude Code |
| 4 | Upload + Edge Function vision + UI draf-koreksi | Upload screenshot ARCI → draf angka → koreksi → terbit |
| 5 | Migrasi 11 view dashboard lama, per view | Tiap view: verifikasi 3 viewport (aturan §175) |

Fase 4 paling berisiko (biaya API + akurasi vision) — sengaja SETELAH 0–3 supaya
aplikasi sudah berguna walau fase 4 molor.

## 7. Biaya & risiko

- **Claude API vision**: ~1.500–2.500 token/gambar input; 3 emiten × 2 gambar/hari ≈ murah,
  tapi butuh API key berbayar terpisah dari langganan Claude. Estimasi < $2/bulan pemakaian harian.
- **Supabase free tier**: cukup besar untuk admin tunggal; risiko pause 7 hari idle → mitigasi cron ping.
- **Akurasi vision**: angka mirip (8 vs 6, koma) — mitigasi confidence + UI koreksi (§3).
- **Paritas skor**: penyimpangan TS vs Python = kredibilitas — mitigasi test fase 1.

## 8. Belum diputuskan (tidak memblokir fase 0–3)

- Nama repo/URL produk (`idx-dashboard` tetap? subdomain Arus Pasar?)
- Draf narasi otomatis (AI tulis paragraf) — nice-to-have fase 4+, bukan inti
- Migrasi data historis 1.054 JSON ke Postgres
