Dari sesi AI Skill (Fable), 25 Agu 2026 — PENGANTAR & PEMBAGIAN KERJA untuk 6 paket spek Dev PAPAN. Dikirim bersama semua paket. Asal keputusan Johan: *"spec tersebut harus di kerjakan agent atau di kerjakan opus sendiri?"* + diskusi model 25 Agu (*"jika di setup model ke fable pekerjaan akan di luar ekspektasi … iya gak sih?"* → ketetapan di bawah).

# Model sesi & pembagian kerja (WAJIB dipatuhi)

1. **Model sesi Papan Trading disarankan Fable** (`/model claude-fable-5`) — Fable tier Mythos, di atas Opus; dipakai untuk peran yang butuh otak tertinggi: membaca & menafsirkan spek, keputusan desain terbuka, diagnosa bug yang gejalanya menyesatkan, dan REVIEW hasil delegasi. Tidak ada batasan kemampuan Fable yang relevan untuk kerja PAPAN (safety measures Fable soal dual-use, bukan coding).
2. **Eksekusi ber-spec DIDELEGASIKAN ke Agent `model: "sonnet"` eksplisit** — semua spek ini sengaja ditulis tajam (rumus, kolom, ambang, nilai acuan regresi) supaya sonnet cukup. Rumus: model tertinggi berpikir & memutuskan → sonnet mengerjakan yang sudah diputuskan → model tertinggi mereview.
3. **JANGAN biarkan Agent tanpa override model** — inherit dari sesi Fable = semua subagent jalan di model termahal (insiden PAPAN 14 Agu: ±16 subagent × ±3 jt token). Setiap panggilan Agent sebut modelnya; sebut pilihan model di laporan supaya bisa diaudit.
4. **Yang TIDAK boleh didelegasikan ke agent paralel**: berkas yang disentuh banyak paket sekaligus (`presetScreener.ts`, `kartu_analisa.py`, registry rute/menu) — kerjakan serial di main loop; dan APA PUN yang menyentuh panen/token Stockbit (runner, `.env.local`, `token_segar()`) — main loop saja, jangan agent.
5. Aturan tetap: jangan push git; jangan sentuh `docs/backlog-edisi.md`; data hari berjalan jangan ditulis ke `_arsip-mentah`; uji 2 viewport (1920×1080 + 412×915) + tema terang/gelap; `docs/jejak-permintaan.md` per tugas; peta halaman → sumber di `docs/referensi_idx-statistik.md` + HTML dibangun ulang.

# Isi 6 paket

| # | Berkas | Isi | Rumah |
|---|---|---|---|
| 1 | `adendum_preset_whale.md` | 3 preset Whale (TAMBAHAN, jangan menimpa preset sebelumnya) | Screener |
| 2 | `spek_rbs_gap_intraday.md` | pola RBS (sendiri) · pola Gap (sendiri) · panen intraday rutin · **BT Papan** | Chart + `/bt-papan` (DEV) |
| 3 | `spek_harian_papan.md` | 3 tab: Stock Gainer · Net Buy Foreign · Net Sell Foreign + Skor Papan | `/harian-papan` (DEV) |
| 4 | `spek_jago_papan.md` | 4 tab: Strong Uptrend · Breakout · Early Breakout · Foreign Flow Uptrend | `/jago-papan` (DEV) |
| 5 | `spek_edu_papan.md` + `analisa_bidoffer_bandar.md` | Edu Papan 7 bab + Fase Bandar & Klaster Bandar (tab baru Neo Papan) + mode TMM (kalkulator ke-3 Kuli Papan) | `/edu-papan` (DEV) + Neo + Kuli |
| 6 | `adendum_rapor_badge.md` | Rapor & Badge Win Rate — LINTAS-SPEK, mengikat paket 1–5 DAN halaman existing (Deep Dive Snapshot Analisa dkk); gerbang Diamond | semua halaman analisa |

Menu Dev final: Kuli Papan · Neo Papan · Harian Papan · Jago Papan · BT Papan · Edu Papan.

Urutan pengerjaan yang disarankan: BT Papan duluan (paket 2 bagian akhir) karena paket 6 (BadgeRapor) membaca berkas beku hasil BT Papan; sisanya bebas paralel per halaman (satu agent sonnet per halaman aman — berkas tidak saling tindih kecuali daftar di butir 4).

# Kriteria Terima (WAJIB — pelajaran insiden Whales Papan)

Latar: halaman Whales Papan pernah "selesai + sudah direview Opus" tapi hasilnya salah total — candle rusak (jadi butiran), kotak seleksi tidak interaktif, angka tidak cocok OHLCV, memakai lightweight-charts padahal sudah ada kanvas chart sendiri, default rentang waktu 4 jam hilang. Akar: review membaca kode, tidak pernah membuka halaman; spek tidak melarang library baru; tidak ada angka acuan wajib. Aturan di bawah menutup itu. **"Selesai" tanpa lulus semua butir = TIDAK selesai**, bukti tiap butir dicatat di jejak.

1. **Substrat dikunci**: WAJIB memakai komponen chart/kanvas existing PAPAN (yang dipakai Grafik Emiten sekarang). DILARANG menambah library chart/UI baru (lightweight-charts dkk) tanpa keputusan Johan tertulis. Berlaku juga untuk komponen tabel, dropdown, modal — pakai yang sudah ada.
2. **Verifikasi VISUAL di browser, bukan baca kode**: reviewer (main loop Fable/Opus) wajib buka halaman via chrome-devtools, screenshot 2 viewport + tema terang/gelap, dan BANDINGKAN dengan artifact/mockup acuan berdampingan. Candle harus berbentuk candle.
3. **Interaktivitas diKLIK, bukan diasumsikan**: setiap elemen interaktif di spek (seleksi, toggle, dropdown, tab, tombol snapshot) diuji klik nyata via chrome-devtools dan hasil kliknya diverifikasi berubah. Elemen yang cuma tampil tapi mati = gagal.
4. **Angka dicocokkan ke arsip**: minimal 1 emiten × 1 tanggal per halaman dicek angkanya persis ke berkas arsip (`ohlcv_stockbit/`, broker, KSEI) sebelum lapor. Nilai acuan regresi yang sudah ada di tiap spek (mis. Strong Uptrend 40 angka, NBSF 22/22) dipakai sebagai uji wajib, bukan hiasan.
5. **Default state dites eksplisit**: setiap "bawaan" di spek (tanggal terakhir, horizon H+5, urut kolom, timeframe) di-assert saat halaman pertama dibuka — bukan dianggap benar karena kodenya kelihatan benar.
6. Laporan agent eksekusi wajib memuat: model yang dipakai, butir 1–5 mana yang sudah lulus + buktinya (screenshot/angka). Reviewer menolak laporan tanpa bukti.
