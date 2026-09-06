# Review halaman per halaman — PAPAN

Asal: Johan, 29 Agustus 2026 — *"saya mau review halaman per halaman, tolong
pakai task tracking tools yaaaa"*. TodoWrite tidak tersedia di sesi ini, jadi
papan lacaknya berkas ini: Johan mereview di layarnya sendiri, temuannya
ditulis di sini, dan barisnya dicentang saat temuan itu ditutup.

**Cara pakainya:** Johan buka satu halaman, sebut apa yang salah. Temuan masuk
kolom "Temuan" dengan tanggal, lalu jadi baris Papan Pekerjaan di
`jejak-permintaan.md` kalau butuh perubahan kode. Status berubah jadi ✅ hanya
kalau ada bukti — commit, uji, atau tangkapan layar.

Status: ⬜ belum direview · 🔎 sedang · ⚠️ ada temuan terbuka · ✅ bersih

## Pasar

| Status | Halaman | Rute | Temuan |
|---|---|---|---|
| ⬜ | Beranda | `/` | |
| ⬜ | Indeks Dunia | `/indeks` | |
| ⬜ | Sektor & Indeks | `/sector` | |
| ⬜ | Top Stocks | `/stocks` | |
| ⬜ | Statistik Berkala | `/statistik` | |
| ⬜ | Top Broker | `/broker` | |

## Emiten

| Status | Halaman | Rute | Temuan |
|---|---|---|---|
| ⬜ | Stock Detail | `/stock-detail` | |
| ⬜ | Grafik Emiten | `/grafik` | |
| ⬜ | Chart | `/chart` | |
| ⬜ | Berkas Emiten | `/berkas-emiten` | ~~Blok A–D hidup; E, F, G masih kerangka~~ — **dicabut 6 Sep 2026.** Diukur di komponen halaman: **ketujuh blok A sampai G hidup dan merender**, masing-masing punya judul sendiri di layar (bendera risiko · rezim pasar · broker penampung & pelepas · aliran asing · likuiditas · probabilitas & rekam jejak · teknikal & fundamental); nol teks kerangka/TODO. **PERTANYAAN TERBUKA untuk Johan (belum dijawab, jangan ditebak):** catatan pembuka komponennya menyebut *"rancangan penuh delapan blok"* — blok **kedelapan** itu apa? Isinya tak ada di repo mana pun (frasa "delapan blok" cuma muncul sekali, di komponen itu sendiri; nol hasil di seluruh `docs/`), rancangannya hidup di artifact "Berkas Emiten" di luar repo. Tetap ⬜: belum direview Johan |
| ⬜ | Kartu Analisa | `/kartu` | ~~Turunan basi 27 Agu~~ — **dicabut 6 Sep 2026, tidak benar.** Indeks kartu ber-stempel `diperbarui` **2026-09-05 13:01**; **832 dari 963** kartu bertanggal **2026-09-04** (hari bursa terakhir) dan **131 sisanya emiten beku semua** (`beku`>0, diperiksa 131 dari 131) — jadi yang dulu terbaca "basi" itu pembekuan, bukan panen yang berhenti. Tetap ⬜: belum direview Johan |

## Aliran Dana

| Status | Halaman | Rute | Temuan |
|---|---|---|---|
| ⬜ | Peta Investor | `/peta-investor` | |
| ⬜ | Broker Summary | `/broker-summary` | |
| ⬜ | Broker Summary v2 | `/broker-summary-v2` | |
| ⬜ | Aliran Asing | `/aliran-asing` | |
| ⬜ | Whales Papan | `/whales-papan` | ~~Arsip broker berhenti 27 Agu (rantai token mati)~~ — **dicabut 6 Sep 2026, rantainya sudah pulih.** Arsip broker per emiten yang dibaca halaman ini (`broker_tahunan/<KODE>/2026.json`) terisi sampai **2026-09-04** — hari bursa terakhir — di **831 dari 881** emiten; 50 sisanya tertinggal dan berekor sama persis dengan daftar emiten beku. Temuan baru belum ada; barisnya tetap ⬜ karena Johan belum mereviewnya |
| ⬜ | Kuli Papan | `/kuli-papan` | ~~idem~~ — **dicabut 6 Sep 2026.** Kedua sumbernya segar: `bidoffer.json` bertanggal **2026-09-04**, dan `broker_harian/<KODE>.json` terisi sampai 2026-09-04 di **962 dari 963** emiten (stempel `diperbarui` 2026-09-05). Satu-satunya yang tertinggal **GOTOM**, macet di 2026-08-27 (sebabnya BELUM diukur — jangan ditebak; yang terukur cuma bahwa stempel `diperbarui` berkasnya juga berhenti 2026-08-27 sementara 962 lainnya 2026-09-05) — terbuka, belum ditutup. Tetap ⬜: belum direview Johan |
| ⬜ | Neo Papan | `/neo-papan` | ~~idem~~ — **dicabut 6 Sep 2026.** Tab Inventory/Compare/Stalker membaca `broker_harian/` + `broker_tahunan/`, dua-duanya segar sampai 2026-09-04 (angkanya di dua baris di atas). Tetap ⬜: belum direview Johan |

## Analisa

| Status | Halaman | Rute | Temuan |
|---|---|---|---|
| ⬜ | Seasonality | `/seasonality` | Turunan 15 Agu — 13 hari |
| ⬜ | Radar Watchlist | `/radar` | |
| ⬜ | Watchlist | `/watchlist` | |
| ⬜ | Kalkulator | `/kalkulator` | |
| ⬜ | Screener | `/screener` | |
| ⬜ | IPO Papan | `/ipo` | |
| ⬜ | Trader Papan | `/trader-papan` | |
| 🔎 | Harian Papan | `/harian-papan` | 29 Agu: 28 Agu masuk lewat tambalan bursa; NBSF & Close Gap kosong hari itu (disebut di layar). Sudah diperbaiki: penanda tertinggal, kolom Form, satuan NBSF |
| ⬜ | Jago Papan | `/jago-papan` | |

## Baca

| Status | Halaman | Rute | Temuan |
|---|---|---|---|
| ⬜ | Kabar Pasar | `/kabar` | 29 Agu: Snips tertinggal karena jam panen; sudah dipanen ulang |
| ⬜ | Bulletin Arus Pasar | `/bulletin` | |
| ⬜ | Metodologi & Glosarium | `/metodologi` | |
| ⬜ | Kritik & Saran | `/feedback` | |
