# MASTER DISPATCH — Dev PAPAN (dari sesi AI Skill / Fable, 26 Agu 2026)

**Pengawas proyek: Fable (sesi AI Skill).** Sesi Papan Trading = pelaksana. Semua spek di folder ini (`docs/spek-dev-papan/`) adalah sumber kebenaran desain; sumber kebenaran DATA tetap `docs/referensi_idx-statistik.md`. Disusun terpusat, dieksekusi oleh sesi Papan.

> Asal perintah Johan (26 Agu, sebelum tidur, verbatim): *"pastikan setelah spec sudah lengkap semua dari yang kemarin sampai hari ini di pelajari dan di analisa… kirim ke sesi Papan karena disana sudah saya set ke Fable, dan beberapa audit itu sudah ada di website PAPAN sehingga harus di revisi sesuai spec lengkapmu ini… fable sebagai pengawas proyeknya… semua spec desain komponen dll disesuaikan dengan PAPAN."*

## ⚠️ Aturan tetap (tidak boleh dilanggar)
- **Model sesi Papan: Fable** (orkestrator/pembaca spek/reviewer). **Eksekusi ber-spec WAJIB didelegasikan ke Agent `model: "sonnet"` eksplisit** — jangan biarkan agent inherit Fable (insiden PAPAN 14 Agu: 16 subagent × 3jt token). Sebut model tiap panggilan Agent di laporan.
- **Serial di main loop (jangan agent paralel)**: berkas lintas-paket (`presetScreener.ts`, registry rute/menu, `kartu_analisa.py`), dan APA PUN yang menyentuh panen/token Stockbit (runner, `.env.local`, `token_segar()`).
- Jangan push git. Jangan sentuh `docs/backlog-edisi.md`. Data hari berjalan JANGAN ditulis ke `_arsip-mentah`. Berkas NET tidak dibaca halaman.
- **Substrat dikunci**: pakai/kembangkan komponen chart/kanvas/tabel/dropdown/modal PAPAN yang SUDAH ADA. DILARANG menambah library chart/UI baru (lightweight-charts, TradingView embed, dll) tanpa keputusan Johan tertulis. (Insiden Whales Papan.)
- **Kriteria Terima 6 butir** (`pengantar_pembagian_kerja.md` §Kriteria Terima) berlaku untuk SETIAP halaman: (1) substrat dikunci; (2) verifikasi visual di browser (screenshot 2 viewport 1920+412 + tema terang/gelap, dibandingkan artifact/mockup); (3) interaktivitas diklik nyata via chrome-devtools; (4) angka dicocokkan ke arsip (nilai acuan regresi di tiap spek wajib diuji); (5) default state di-assert; (6) laporan wajib bawa bukti per butir. "Selesai" tanpa lulus semua butir = TIDAK selesai.
- Tiap tugas: `docs/jejak-permintaan.md` (Papan Pekerjaan 10 kolom) + peta halaman→sumber di referensi + HTML dibangun ulang.

## ⚠️ REVISI halaman yang SUDAH ADA di PAPAN (bukan cuma bikin baru)
Johan: "beberapa audit sudah ada di website PAPAN sehingga harus di revisi sesuai spec lengkap ini." Yang sudah ada (Stock Profiler dkk) **diselaraskan** ke spek ini, bukan dibiarkan versi lama:
- Chart Teknikal → arsitektur 2-lapis canvas + crosshair bebas/readout-snap (`audit_chart_custom.md`).
- Halaman/komponen yang meniru tradersaham/whales sebelum audit lengkap ini → cek ulang vs `audit_tradersaham.md` (tier adopsi) & `audit_whales_id.md` (batas jujur: JANGAN janjikan footprint intraday per broker / heatmap orderbook / replay — data tidak kita punya).
- Semua fitur analisa → pasang **BadgeRapor + kolom form win-rate** (`adendum_rapor_badge.md`), gerbang Diamond.

## Urutan pengerjaan (dependency-aware)
1. **BT Papan** (lab backtest) — DULUAN; BadgeRapor & semua klaim win-rate membacanya. (`spek_rbs_gap_intraday.md` bagian BT Papan)
2. **Adendum Rapor & BadgeRapor** (kontrak angka lintas-spek) — kerangka dulu, lalu ditempel ke tiap halaman. (`adendum_rapor_badge.md`)
3. **Chart custom 2-lapis** (dipakai banyak halaman). (`audit_chart_custom.md`)
4. Sisanya paralel per halaman (1 agent sonnet/halaman): Harian Papan · Jago Papan · Neo/Kuli/Edu · preset Whale · RBS/Gap · Visitor Stats.

## Indeks spek (baca urut kebutuhan)
| Berkas | Isi | Status di PAPAN |
|---|---|---|
| `pengantar_pembagian_kerja.md` | Model, pembagian kerja, **Kriteria Terima 6 butir** | kerangka wajib |
| `adendum_rapor_badge.md` | Rapor & Badge Win Rate (kontrak angka), gerbang Diamond, Deep Dive Snapshot Analisa | retrofit semua halaman |
| `spek_rbs_gap_intraday.md` | pola RBS (sendiri) · pola Gap (sendiri) · panen intraday rutin · **BT Papan** | baru |
| `spek_harian_papan.md` | Harian Papan 3 tab (Gainer/NetBuy/NetSell asing) + Skor Papan | baru (Dev) |
| `spek_jago_papan.md` | Jago Papan 4 tab momentum | baru (Dev) |
| `spek_edu_papan.md` | Edu Papan 7 bab + Fase Bandar & Klaster Bandar (tab Neo) + mode TMM (kalkulator Kuli) | baru (Dev) |
| `adendum_preset_whale.md` | 3 preset Whale (TAMBAHAN, jangan timpa preset lama) | tambah ke Screener |
| `referensi_prototipe_dev.md` | Kuli Papan + Neo Papan (dari 2 PDF ide) | ada prototipe |
| `analisa_bidoffer_bandar.md` | analisa PDF BidOffer Bandar (dasar TMM/Fase/Klaster) | referensi |
| `spek_preset_winrate_rekap.md` | preset screener + win rate + rekap sore | baru |
| `riset_rbs_gap_hasil.md` | laporan backtest RBS/Gap (bukti angka) | referensi |
| **`audit_tradersaham.md`** | audit 13 halaman tradersaham + **3 tier adopsi (disaring win-rate)** | revisi + adopsi Tier 1 |
| **`audit_whales_id.md`** | audit whales.id + batas jujur data | revisi + batas |
| **`audit_chart_custom.md`** | chart custom = 2-lapis Canvas 2D, crosshair bebas | revisi chart |
| **`audit_gedanggoreng.md`** | Visitor Tracking spec + analisa kebocoran akun | baru (visitor) + keamanan |

## Ringkas adopsi dari 3 audit (yang WAJIB dikerjakan, sudah disaring win-rate)
**tradersaham TIER 1 (adopsi, data kita sudah ada):** posisi 6-bulan per broker (floor price, P&L%, hari-akumulasi, TRAPPED count) · kurva inventori broker + overlay harga (kita 10 tahun) · konsensus + konsistensi n/5 hari · NEGO Opposite Pattern (nego-buy→reg-sell) · klasifikasi perilaku broker (directionality net÷gross) · IPO success-rate + rapor underwriter · watchlist-as-index + DAY WIN RATE · kolom RVol/Vol-ratio · gating data jujur · 3 kalkulator (Pyramid Entry, Average Price blender cut-loss tick-rounded, Compounding) → Kuli Papan.
**tradersaham TIER 2 (uji BT Papan dulu):** GEM Score & TA+Flow Confluence 0-100 (komposit — komponen diuji satu-satu) · Smart Money "nampung retail" (butuh keputusan kategori broker).
**tradersaham TIER 3 (jangan/tunda):** embed TradingView, Peta Investor/UBO, "estimasi asing dari closing" (kita punya angka resmi).
**whales.id:** JANGAN janjikan footprint intraday per broker / heatmap orderbook / replay (data tidak dimiliki). Boleh tiru versi HARIAN: bubble broker outlier z-score, garis avg-price broker, popup 4 kuadran GROSS/NET, sidebar insight ber-chip yang melompatkan chart.
**gedanggoreng:** Visitor Stats (hash-anonim, no PII, fail-closed) · JANGAN tiru proxy-akun Stockbit publik (contoh negatif keamanan).
**chart:** 2-lapis canvas sendiri, DPR-aware, magnet-off garis/magnet-on data, panes tersinkron, header Mirae.

## Keputusan yang MENUNGGU Johan (jangan diputuskan agen sendiri)
1. **Definisi kategori broker PAPAN** (Smart Money/Whale/Retail) — usul: dari perilaku terukur (share IHSG, directionality, konsistensi), bukan daftar tetap. Fitur Smart Money & Konsensus menunggu ini.
2. Gerbang Diamond: sistem badge pengguna PAPAN sudah ada atau belum? Kalau belum, jangan mengarang auth — flag ke Johan.
3. Panen sumber baru (opsional Tier 3): holder>1% bulanan, SID, keterbukaan informasi.


---

## ➕ ADENDUM 26 Agu (audit chart mendalam — Fable, ultracode)
Johan minta audit ulang Custom Chart tradersaham sedetail-detailnya + spek adopsi untuk chart PAPAN. Hasil: **`audit_chart_custom_LENGKAP.md`** (435 baris, terverifikasi ke kode `app/src`) = **spek chart yang BERLAKU**, menggantikan rekomendasi lama.

**Koreksi kritis**: audit lama `audit_chart_custom.md` menyuruh "bangun Canvas 2D dua-lapis dari nol" — KELIRU. Verifikasi kode membuktikan PAPAN SUDAH memakai **lightweight-charts@5.2.1** + drawing + indicators (registry 366 rumus) di `app/src/views/dasbor/GrafikEmiten.tsx`. Aturan substrat = kembangkan itu, JANGAN engine baru. lightweight-charts sudah berlapis internal; crosshair bebas = mode `Normal` bawaan, header = `subscribeCrosshairMove`, panes sinkron = multi-pane satu chart instance.

**Temuan grounded lain (terverifikasi kode)**: VPA sudah ada (`cariLonjakanVolume` di `grafikEmiten.ts`) — sambungkan, jangan bangun ulang; skor teknikal ada (`skorTeknikal.ts`) — cek sudah jadi panel chart atau baru Screener; DPR: contoh BENAR `bandingEmiten.ts:575` (clamp+round), contoh SALAH `WhalesPapan.tsx:78` (raw, perbaiki); 366 rumus indikator di registry — cross-check nama sebelum bikin baru.

**Sikap jujur yang dipertahankan**: (a) diskrepansi "18 vs 16 indikator" belum direkonsiliasi — jangan tulis angka pasti tanpa audit-live susulan; (b) pola candle selain Marubozu BELUM dikonfirmasi ada di tradersaham — tandai "ekstensi PAPAN", jangan klaim "replikasi"; (c) TA+Flow Confluence 0–100 = **Tier 2, DIKUNCI di belakang BT Papan + BadgeRapor** (tak boleh tampil tanpa bukti win-rate); (d) SKIP tegas: TradingView embed, footprint intraday per broker, orderbook heatmap, replay tick, CVD/delta sejati, area breakdown per rentang harga (data tak dimiliki).

**Urutan kerja chart** (dari §8.3 LENGKAP): (1) verifikasi & sambungkan yang sudah ada (Pivot ke GrafikEmiten, skorTeknikal, DPR, cross-check 366 registry) → (2) turunan OHLCV murah (CPR, R:R, jarak level, preset, bar-terakhir/Bersihkan, wiring VPA) → (3) butuh broker summary (avg-broker-line, bubble outlier harian) → (4) candlestick (Marubozu dulu) → (5) Tier 2 confluence (BT Papan dulu) → (6) BadgeRapor di semua sebelum dianggap selesai.

**Keputusan viewport masih menunggu Johan**: aturan global 3 titik vs Kriteria Terima PAPAN 2 viewport — LENGKAP mengikuti 2 viewport (aturan PAPAN berlaku) sampai Johan putuskan; jangan diam-diam pilih 3.
