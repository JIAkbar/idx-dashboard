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
| **Aliran asing** | *(belum dipakai)* | IDX `GetStockSummary` | **18 Agu 2026** | 963 | ❌ manual | `panen_asing.py` — **"Panen Lagi"** |
| **Statistik harian** | Kalender Bursa, Beranda | IDX PDF harian | **18 Agu 2026** | 143 | ⚙️ Actions 13:00 UTC Sen–Jum | `update.yml` |
| **Statistik mingguan** | Statistik Berkala | IDX PDF mingguan | 14 Agu 2026 | 33 | ⚙️ Actions (ikut `update.yml`) | `update.yml` |
| **Statistik bulanan** | Statistik Berkala | IDX PDF bulanan `MS<YYMM>-E` | *(panen pertama)* | 11 | ❌ manual | **"Panen Lagi"** |
| **Kabar** | Beranda, Kabar Pasar | IPOT · IDX berita · IDX pengumuman · Kontan | **18 Agu 2026** | — | ⚙️ Actions tiap 2 jam | `panen-kabar.yml` |
| **Broker summary** | Broker Summary | Setoran kontributor (screenshot) | **18 Agu 2026** | 753 | 👤 kontributor + kurasi admin | halaman `/admin` |
| **Fundamental** | Stock Detail | yfinance + turunan lokal | 18 Agu 2026 | 967 | ⚙️ Actions akhir bulan | `update-fundamental.yml` |
| **Keuangan XBRL IDX** | Stock Detail | IDX `GetFinancialReport` | **2019–2025** (7 thn buku) | 949 | ❌ manual | `panen_keuangan_idx.py` — **"Panen Lagi"** |
| **Keuangan yfinance** | Stock Detail | yfinance | 17 Agu 2026 | 646 | ⚙️ ikut `update-fundamental.yml` | — |
| **Seasonality bulanan** | Seasonality | Yahoo (penutupan bulanan) | 17 Agu 2026 | — | ❌ manual | `panen_seasonality.py` — **"Panen Lagi"** |
| **Peta investor (KSEI)** | Peta Investor | KSEI | *(tak diperbarui rutin)* | — | ❌ manual | `fetch_investor_map.py` |

## Yang perlu diketahui, bukan sekadar dilihat

**Jalur awan vs jalur rumahan.** GitHub Actions berjalan dari IP datacenter, dan
IDX memblokir sebagian panggilan dari sana. Kabar sudah dipindahkan ke sumber
yang tembus (IPOT); Kontan dicabut dari jalur awan karena 403 per-IP. Panen yang
menyentuh IDX secara langsung lebih andal dijalankan dari mesin rumahan.

**403 IDX hampir selalu bentuk permintaan, bukan alamat IP.** Pemanen IDX kini
memakai `curl_cffi` dengan impersonasi TLS; `requests` ditolak walau headernya
lengkap. Uji yang membedakan: buka URL yang sama di peramban — kalau peramban
200, yang salah sidik jari permintaan.

**Batas sumber yang sudah dipastikan, jangan dicoba ulang:**
- XBRL IDX berhenti di tahun buku **2019**; 2018 ke belakang menjawab `ResultCount 0`.
- Intraday Yahoo: 5m/15m/30m ±1 bulan, 1h ±2 tahun, **4h tak ada** (dirakit dari 1h).
- Broker summary **per emiten** tak tersedia di endpoint publik mana pun —
  `GetBrokerSummary` mengabaikan `stockCode` dan selalu menjawab level pasar.

**Aliran asing belum punya pemakai.** Datanya sudah ada 963 emiten, tapi belum
satu halaman pun membacanya. Itu keadaan yang sama dengan statistik mingguan
sebelum hari ini: dipanen berbulan-bulan, tak pernah sampai ke layar.
