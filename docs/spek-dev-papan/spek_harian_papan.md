Dari sesi AI Skill (Fable), 25 Agu 2026 — SPEK **HARIAN PAPAN** (halaman baru, BUKAN bagian Screener). Asal perintah Johan: *"artinya buat spec Stock Gainer, Net Buy Foreign dan Net Sell Foreign, untuk SSS Score coba benchmark dari data tabel itu dan data kita dapat angka itu darimana"* · *"3 gambar barusan jadikan spec tersendiri jgn masuk di screener melainkan Harian Papan mgkn ya, jadi ada 3 tab isinya itu tadi"*. Bahan: 3 tangkapan layar tabel harian pihak lain (Stock Gainer, Net Sell Foreign, Net Buy Foreign — Selasa 18 Agu 2026). Semua angkanya SUDAH diverifikasi ke data kita (lihat §Bukti). Sumber kebenaran data: `docs/referensi_idx-statistik.md`.

# Halaman: `/harian-papan` — "Harian Papan"

Rumah: grup **DEV** (ketetapan Johan 25 Agu — bersama Kuli Papan, Neo Papan, Jago Papan, BT Papan; naik ke PASAR kalau sudah matang). Halaman ringkasan harian satu bursa, satu tanggal, tiga tab. **Bukan** di Screener (Screener = penyaringan bebas; Harian Papan = papan peringkat harian tetap).

Tiga tab (isi persis 3 tangkapan layar):
1. **Stock Gainer** — diurutkan Value (bawaan) / 1D Chg; semua emiten yang punya bar hari itu.
2. **Net Buy Foreign** — diurutkan NBSF menurun (positif teratas).
3. **Net Sell Foreign** — diurutkan NBSF menaik (negatif terbawah dulu), **tanda ditulis apa adanya (negatif)** — lihat Temuan 1.

Pemilih tanggal (bawaan: hari bursa terakhir yang datanya lengkap), pemilih sektor, dan tombol unduh CSV.

# Kolom (satu definisi dipakai ketiga tab)

| Kolom | Rumus / sumber | Status |
|---|---|---|
| Code, Sector | `daftar_emiten` + `emiten_sektor.json` (IDX-IC) | ✅ ada |
| Price | `close` chartbit | ✅ terverifikasi 10/10 |
| **TDM%** | **= MTD**: `close ÷ close hari bursa terakhir bulan sebelumnya − 1` | ✅ terpecahkan (uji 10 emiten) |
| Volume (lbr) | `volume` chartbit (lembar) | ✅ |
| **RVol(10)** | `volume ÷ rata-rata volume 10 hari bursa SEBELUMNYA` (tidak termasuk hari ini) | ✅ terpecahkan, 12/12 cocok 2 desimal |
| Value | `value` chartbit (rupiah) | ✅ |
| **NBSF (000)** | `(foreignbuy − foreignsell) ÷ 1.000` | ✅ 22/22 cocok <0,01% |
| Free Float % | `profil/<KODE>.json` IDX (`GetCompanyProfilesDetail`) — **belum pernah dipakai halaman mana pun**, ini pemakaian pertamanya | ⚙️ ada, perlu dipetakan |
| MA20 Head (Up/Down) | arah MA20: `ma20(t) > ma20(t−1)` → Up | ⚙️ hitung |
| Close Gap | `close ÷ open − 1` (persentase; layar menandai merah bila negatif) | ⚙️ hitung — **beri catatan**: bukan "gap" dalam arti pola Gap kita (yang itu open vs high kemarin) |
| 1D / 1WTD / 1MTD Chg | close vs close kemarin / close hari bursa terakhir pekan lalu / bulan lalu | ✅ 1D terverifikasi 6/6 |
| EMA5 / MA10 / MA20 (penanda `>` atau `<`) | `close` vs tiap rata-rata; hijau bila di atas | ⚙️ hitung |
| **SSS Score D/W/M** | rumus milik penyedia — **kita bikin padanan sendiri** bernama **Skor Papan** (lihat §Skor Papan). JANGAN memakai nama "SSS Score" | ⚙️ padanan |

# Skor Papan (padanan SSS Score) — hasil benchmark 25 Agu

Dibalik dari 83 label di dua tangkapan layar. Rata-rata indikator per label (data kita, 18 Agu):

| Label layar | n | RSI14 | Stoch14 | CCI20 | close/MA20 | close/MA50 | MA di bawah harga (dari 12) |
|---|---|---|---|---|---|---|---|
| Strong buy | 23 | 73,1 | 89,1 | +210 | 1,217 | 1,376 | 11,8 |
| Buy | 33 | 59,9 | 71,7 | +84 | 1,057 | 1,126 | 8,8 |
| Neutral | 9 | 52,6 | 56,8 | +19 | 1,011 | 1,071 | 5,3 |
| Sell | 14 | 45,8 | 27,2 | −65 | 0,969 | 0,993 | 1,9 |
| Strong sell | 5 | 36,8 | 15,7 | −131 | 0,869 | 0,813 | 2,6 |

Tangga label itu **monoton sempurna** di RSI, Stoch, CCI, dan jumlah MA yang ditembus — artinya SSS Score adalah **skor teknikal gabungan gaya TradingView "Technical Rating"**, bukan data rahasia.

Padanan yang sudah diuji: 12 rata-rata (MA5/10/20/50/100/200 + EMA5/10/20/50/100/200; +1 bila close di atas, −1 bila di bawah) digabung 4 osilator (RSI14 ≥60/≤40, Stoch14 ≥80/≤20, CCI20 ≥100/≤−100, MACD 12-26 >0), rata-rata dua kelompok, ambang label ±0,5 / ±0,1. **Hasil: tepat 45/83 (54%), selisih ≤1 tingkat 80/83 (96%)**; 3 meleset >1 tingkat (MAPA, EMTK, HMSP).

Ketetapan untuk implementasi:
- Nama kolom **"Skor Papan"** (D/W/M), bukan SSS Score. Label: Strong buy / Buy / Neutral / Sell / Strong sell.
- W = hitung indikator pada bar mingguan (agregasi dari harian), M = bar bulanan. Rumus sama.
- Metodologi wajib memuat: daftar 12 MA + 4 osilator, ambang, dan kalimat *"skor teknikal gabungan buatan PAPAN; padanan uji terhadap 83 label penyedia lain: 96% dalam ±1 tingkat. Bukan rekomendasi beli/jual."*
- Penyempurnaan boleh, tapi **jangan mengoptimasi ke label penyedia lain** — itu meniru buta; cukup sebagai pembanding sekali.

# Bukti verifikasi (25 Agu 2026, tanggal uji 18 Agu 2026)

- Price 10/10 persis; 1D Chg 6/6 persis; RVol(10) 12/12 persis; NBSF 22/22 persis (<0,01%); TDM=MTD cocok 10/10.
- Volume beda ≤ 0,0003% pada 3 emiten (INET 5.000 lembar), Value beda 0,5–6% → tangkapan layar mereka **snapshot pra-penutupan**, arsip kita final.
- **Temuan 1 — tanda NBSF layar "Net Sell Foreign" salah**: ANTM di layar Net Sell tertulis −Rp69.012.970 rb, di layar Net Buy tertulis +Rp69.012.970 rb (nilai identik). Data kita: beli asing Rp135,5 M, jual Rp66,5 M → **net BELI**. Jadi tabel Net Sell mereka mencetak minus borongan. **Harian Papan wajib memakai tanda sebenarnya.**
- **Temuan 2 — MTD mereka beda** di CUAN (26,32 vs 27,27), INET (24,79 vs 28,07), TCPI (−39,41 vs −30,61): mereka memakai harga awal bulan tanpa penyesuaian aksi korporasi; chartbit kita sudah disesuaikan. Tulis di Metodologi bahwa PAPAN memakai harga tersesuaikan.
- **Temuan 3 — emiten beku ikut ditampilkan**: MDIA tercatat +13,82% (1D) di layar, padahal data kita menunjukkan volume 0 tiga hari beruntun (13, 14, 18 Agu) — harga tidak bergerak nyata. Harian Papan **wajib menandai emiten tidak diperdagangkan** (penanda `beku` yang sudah ada di kartu, commit 25 Agu) dan mengeluarkannya dari peringkat gainer.

# Cakupan & sumber

962 emiten punya bar 18 Agu di arsip kita — daftar penuh, bukan 22–40 baris seperti layar. Semua kolom dari `ohlcv_stockbit/` (chartbit) + `emiten_sektor.json` + `profil/` (free float). Tidak ada Yahoo, tidak ada jahitan.

# Uji & dokumentasi

- Uji angka: ulangi verifikasi 18 Agu (Price/1D/RVol/NBSF/TDM) sebagai uji regresi otomatis — nilai acuan ada di spek ini.
- Dua viewport (1920×1080, 412×915) + tema terang/gelap; tabel lebar → gulir mendatar di wadah sendiri, jangan memaksa halaman melebar.
- `docs/jejak-permintaan.md` per tugas; peta halaman → sumber di referensi + HTML dibangun ulang; Metodologi memuat rumus Skor Papan.
