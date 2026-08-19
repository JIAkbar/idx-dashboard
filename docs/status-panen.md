# Status Panen — satu tabel untuk seluruh sumber data PAPAN

> **Aturan wajib (Johan, 18 Agustus 2026):** tiap kali ditanya "sudah panen?"
> atau melapor soal data, jawabannya **tabel ini**, bukan kalimat lepas.
> Kolomnya tetap: sumber · halaman pemakai · asal data · isi terakhir ·
> otomatis atau manual · pemicunya.
>
> Kata pemicu untuk panen manual lewat Claude Code: **"Panen Lagi"**.

Diperbarui: **18 Agustus 2026**. Angka "isi terakhir" dibaca dari DALAM berkas,
bukan dari waktu berkasnya ditulis — berkas bisa ditulis ulang tanpa membawa
data baru, dan membaca mtime membuat data basi terlihat segar.

## Tabel utama

| Sumber | Halaman PAPAN | Asal data | Isi terakhir | Berkas | Otomatis? | Pemicu |
|---|---|---|---|---|---|---|
| **OHLC harian** | Grafik Emiten, Tanya PAPAN | Yahoo Finance | **18 Agu 2026** | 964 | ❌ manual | `panen_ohlc.py` — **"Panen Lagi"** |
| **Aliran asing** | Stock Detail, Kartu Analisa *(UI sedang dikerjakan)* | IDX `GetStockSummary` | **2 Jan 2020 → 18 Agu 2026** (median 1.593 hari bursa) | 989 | ❌ manual | `panen_asing.py` — **"Panen Lagi"** |
| **Statistik harian** | Kalender Bursa, Beranda | IDX PDF harian | **18 Agu 2026** | 143 | ⚠️ Actions **merah 13, 14, 17, 18 Agu** — IDX 403 ke IP runner (hijau 10–12 Agu, jadi blokirnya kumat-kumatan) | `update.yml` |
| **Statistik mingguan** | Statistik Berkala | IDX PDF mingguan | 14 Agu 2026 | 33 | ⚙️ Actions (ikut `update.yml`) | `update.yml` |
| **Statistik bulanan** | Statistik Berkala *(chip nonaktif — skema beda, belum dipetakan)* | IDX PDF bulanan `MS<YYMM>-E` | Sep 2025 – Jul 2026 | 11 | ❌ manual | **"Panen Lagi"** |
| **Kabar** | Beranda, Kabar Pasar | IPOT · IDX berita · IDX pengumuman · Kontan | **18 Agu 2026 12:55 UTC** (run `32139468436`, panen terakhir yang sungguh jalan) | — | ⚠️ **berhenti total 18 Agu 12:55 → 19 Agu**: berkas workflow ditolak GitHub (`runner.temp` di `env` tingkat workflow), 6 run 0 detik tanpa job. Sudah dibetulkan di pohon kerja, **belum di-push** — status "semua sumber dicoba" belum pernah terbukti dari satu run pun | `panen-kabar.yml` |
| **Stockbit Snips** | Kabar Pasar (tab STOCKBIT SNIPS) | `snips.stockbit.com` (Squarespace `?format=json`) | 14 Agu 2026 | 238 | ⚠️ ikut mati bersama `panen-kabar.yml` — langkahnya ditambahkan 18 Agu tapi **belum pernah dijalankan sekalipun** | `panen-kabar.yml` |
| **Broker summary** | Broker Summary | Setoran kontributor (screenshot) | **18 Agu 2026** | 753 | 👤 kontributor + kurasi admin | halaman `/admin` |
| **Fundamental** | Stock Detail, Bedah Emiten | yfinance + turunan lokal + `ListedShares` IDX | **18 Agu 2026** | 965 | ⚙️ Actions akhir bulan | `update-fundamental.yml` |
| **Daftar emiten + jumlah saham** | (dipakai `fetch_fundamental.py`, bukan halaman) | IDX `GetStockSummary` (`ListedShares`) | **18 Agu 2026** | 963 emiten | ❌ manual | `sinkron_emiten.py` — **"Panen Lagi"** |
| **Keuangan XBRL IDX** | Stock Detail | IDX `GetFinancialReport` | **2019–2025** (7 thn buku) | 949 | ❌ manual | `panen_keuangan_idx.py` — **"Panen Lagi"** |
| **Keuangan yfinance** | Stock Detail | yfinance | 17 Agu 2026 | 646 | ⚙️ ikut `update-fundamental.yml` | — |
| **Seasonality bulanan** | Seasonality | Yahoo (penutupan bulanan) | 17 Agu 2026 | — | ❌ manual | `panen_seasonality.py` — **"Panen Lagi"** |
| **Peta investor (KSEI)** | Peta Investor | KSEI | *(tak diperbarui rutin)* | — | ❌ manual | `fetch_investor_map.py` |

## Yang perlu diketahui, bukan sekadar dilihat

**Jalur awan vs jalur rumahan — sekarang diuji, bukan ditebak.** Sejak 18 Agu
2026 `panen-kabar.yml` **mencoba semua sumber** dan melaporkan hasilnya per
sumber ke ringkasan run; yang terbukti tembus dari IP datacenter dicatat di
`data-idx/json/kabar-sumber-awan.json`. Sebelumnya sebagian sumber ditahan di
rumah atas dugaan "IDX/Kontan 403 dari datacenter" — dugaan yang dibuat sebelum
`scripts/idx_net.py` (curl_cffi) ada dan tak pernah diuji ulang sesudahnya.
Bukti kenapa ini perlu: run `32139468436` **hijau** sambil mencatat
`IDX berita: 0 item` dan `IDX pengumuman: 0 item` (keduanya 403 lewat
`requests`) — satu sumber hidup cukup membuat panen terlihat sehat.

**Tapi sampai 19 Agu 2026 ini masih rancangan, bukan hasil terukur.** Commit
yang membawanya (`dcde09cd`) sekaligus membuat berkas workflow-nya ditolak
GitHub, jadi versi "semua sumber" belum pernah jalan satu kali pun dan
`kabar-sumber-awan.json` masih kosong. Jangan mengutip bagian ini sebagai
bukti sumber mana yang tembus dari awan sampai ada run hijau yang mengisinya.

**Kegagalan senyap kabar sudah punya alarm.** `scripts/cek_kabar.py` membaca
**isi** `kabar.json` + `snips.json` (stempel waktu item terbaru **per sumber**,
bukan mtime dan bukan ruas `dipanen`), digabung dengan hasil panen per sumber.
Job merah kalau sumber yang PERNAH tembus dari awan berhenti tembus, atau
datanya basi lewat ambang tanpa ada yang mengisinya. Ambangnya dihitung dalam
**jam kabar** (hari bursa 07:00–19:00 WIB, kalender dari `ds_*.json`) supaya
akhir pekan dan libur tak melahirkan alarm palsu.

**403 IDX hampir selalu bentuk permintaan, bukan alamat IP.** Pemanen IDX kini
memakai `curl_cffi` dengan impersonasi TLS; `requests` ditolak walau headernya
lengkap. Uji yang membedakan: buka URL yang sama di peramban — kalau peramban
200, yang salah sidik jari permintaan.

**Batas sumber yang sudah dipastikan, jangan dicoba ulang:**
- XBRL IDX berhenti di tahun buku **2019**; 2018 ke belakang menjawab `ResultCount 0`.
- Intraday Yahoo: 5m/15m/30m ±1 bulan, 1h ±2 tahun, **4h tak ada** (dirakit dari 1h).
- Broker summary **per emiten** tak tersedia di endpoint publik mana pun —
  `GetBrokerSummary` mengabaikan `stockCode` dan selalu menjawab level pasar.

**Aliran asing: 6,6 tahun, bukan sehari.** Selesai 18 Agu 2026 — 989 emiten,
median 1.593 hari bursa, nol tanggal gagal dari 1.729 hari kerja yang dicoba.
Batas sumbernya **2 Januari 2020**: 30 Desember 2019 hari bursa normal dan tetap
menjawab **HTTP 200 dengan `data` kosong**, bukan 403. Bedanya menentukan — 403
berarti bentuk permintaan salah dan bisa diakali; 200-kosong berarti IDX memang
tak menyimpannya, jadi jangan dijadwalkan ulang.

**Satuan aliran asing LEMBAR, bukan rupiah — dan itu diukur, bukan diasumsikan.**
Se-pasar 18 Agu: ForeignBuy 5,03e9 terhadap Volume 2,88e10 dan Value 1,37e13.
Sebagai rupiah itu 0,04% nilai transaksi pasar (mustahil); sebagai lembar 17%
volume (wajar). Nol emiten punya ForeignBuy melebihi Volume-nya. Rupiah hanya
bisa **ditaksir** lewat lembar × (value ÷ volume) dan wajib berlabel taksiran.
Satuannya ditulis di dalam tiap berkas (ruas `satuan`) supaya pembaca berikutnya
tak perlu menebak.

**Menambah ruas dari `GetStockSummary` kelak GRATIS.** Mentahnya diarsipkan
ter-gzip (1.729 berkas, 140 MB); `--dari-arsip` membangun ulang seluruh
2020–2026 dalam 29 detik tanpa satu pun permintaan jaringan. 26 dari 32 ruas
belum dipakai dan sudah tersimpan.

## Yang terlihat hijau padahal tidak (18 Agu 2026)

Dua workflow **sukses** sambil gagal. Ini kelas kegagalan paling mahal di
proyek ini, dan tabel di atas ikut menipu selama beberapa hari.

- **`panen-kabar.yml`** — run 32139468436 hijau, commit terkirim, padahal
  log memuat `IDX berita: 0 item` dan `IDX pengumuman: 0 item` (keduanya 403).
  Satu sumber hidup (IPOT, 28 item) sudah cukup membuat panen terlihat sehat.
- **`update.yml`** — gagal sejak ≥14 Agu karena Playwright `wait_for_selector`
  timeout, dan tabel ini tetap menulis "⚙️ Actions". Skripnya sudah dibuang
  Playwright-nya (`be02bb01`) tapi belum di-push; langkah `playwright install`
  yang tersisa di workflow juga sudah dibuang hari ini.

Pelajarannya untuk kolom "Otomatis?": **status di kolom itu wajib berasal dari
run terakhir yang benar-benar diperiksa, bukan dari niat workflow-nya.**
"⚙️ Actions" tanpa memeriksa run terakhir adalah klaim, bukan fakta.
