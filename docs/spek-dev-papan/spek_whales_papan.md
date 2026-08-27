# SPEK HALAMAN **WHALES PAPAN** — 26 Agu 2026 (Fable, pengawas proyek)

> Asal perintah Johan: *"untuk whales papan apakah spec nya sudah seperti whales.id? ada selection nya, pakai candle stick?"* → *"setuju, buatkan spek Whales Papan lalu kirim ke Papan. buat replikasi 100% jika bisa kalau data 4H dan 1H masih bisa lah yaa"*.
> **Ini spek pertama halaman Whales Papan.** Sebelumnya halaman ini dibangun tanpa spek — hanya berbekal riset (`docs/riset/whales-bongkar.md` + `docs/spek-dev-papan/audit_whales_id.md`). Itu akar insiden lama ("candle jadi butiran debu, kotak seleksi tak interaktif"). Spek ini menutup celah itu.
> Semua klaim data & kode di bawah **diverifikasi** ke `app/src`, `docs/referensi_idx-statistik.md`, dan `docs/riset/stockbit-inventaris-endpoint.md`.

---

> **⚠️ KOREKSI 26 Agu 2026 (setelah panen perdana):** satu baris §0 di bawah sudah dikoreksi — aliran asing intraday ternyata TIDAK tersedia (ruasnya ada tapi selalu kosong, terukur). Ini menggugurkan salah satu klaim keunggulan spek versi pertama. Sisanya tetap berlaku.

## 0. Jawaban tegas: bisakah replikasi 100%?

**Tidak bisa 100%, dan alasannya bukan kemalasan — melainkan data yang secara fisik tidak kita miliki.** Tapi bagian yang kamu tanyakan (1H & 4H) **BISA**, dan di satu sisi kita bahkan **lebih unggul** dari whales.id. Rincian jujur:

| Fitur whales.id | Bisa di PAPAN? | Alasan (terverifikasi) |
|---|---|---|
| **Candle 1H & 4H** | ✅ **BISA** | endpoint `chartbit/{kode}/price/intraday` memberi **bar 1 menit** → agregasi ke 5m/15m/30m/1H/2H/4H. Batas: server simpan **±90 hari** saja (−180 hari = HTTP 400) |
| **Candle harian** | ✅ BISA, **10 tahun** (2017–2026) | `ohlcv_stockbit/` — jauh melebihi riwayat whales.id |
| **Volume / value / frekuensi per 1H-4H** | ✅ BISA | ruas ada di bar 1 menit |
| **Aliran asing per 1H-4H** | ❌ **TIDAK BISA — KOREKSI 26 Agu 2026** | Ruas `foreign_buy`/`foreign_sell` ADA di balasan endpoint tapi **server tak pernah mengisinya**: diukur pada seluruh arsip (874/874 emiten) oleh sesi Papan, dan diverifikasi ulang mandiri oleh pengawas atas 133.937 bar dari 15 emiten (termasuk BBCA/BUMI/ASII/TLKM/ANTM, seluruh rentang, hari yang sudah tutup) → **Σforeign_buy = Σforeign_sell = 0, nol bar berisi**. Klaim awal spek ini ("BISA — whales.id tidak punya") **GUGUR**; W5 pita asing intraday DIBATALKAN. Aliran asing tetap tersedia **harian** (`ohlcv_stockbit`). |
| **Seleksi area (seret persegi)** | ✅ BISA, sudah ada | tinggal dipindah ke arsitektur baru |
| **Pecahan broker di dalam area seleksi** | ⚠️ **HANYA di TF harian** | broker summary kita **HARIAN** (`marketdetectors`, baru terisi setelah pasar tutup). Tidak ada broker per jam — **di TF 1H/4H pecahan broker MUSTAHIL** |
| **Footprint per level harga (HAKA/HAKI per sel)** | ❌ TIDAK | butuh tick per transaksi + sisi beli/jual. Bar 1 menit tidak punya sisi |
| **Heatmap orderbook latar** | ❌ TIDAK | orderbook tidak dipanen (paywall Pro) |
| **Replay tick** | ❌ TIDAK | sumbernya sama dengan dua di atas |
| **CVD / volume delta sejati** | ❌ TIDAK | butuh sisi beli/jual per transaksi |
| **Riwayat broker 10 tahun, 108 broker, 962 emiten** | ✅ **KITA UNGGUL** | whales.id klaim 35+ broker, riwayat pendek |

**Kesimpulan yang harus ditulis apa adanya di halaman**: Whales Papan bukan tiruan footprint whales.id. Ia adalah **papan bandarmologi dua-mode** — mode harian dengan pecahan broker penuh (keunggulan kita), dan mode intraday 1H/4H untuk harga+volume+frekuensi (aliran asing intraday TIDAK tersedia — lihat koreksi §0). Jangan pernah menjanjikan footprint/orderbook/replay.

---

## 1. Bentuk halaman: DUA MODE, satu halaman

Pemilih timeframe di toolbar: **Harian (bawaan) · 4H · 1H**. Mode menentukan sumber data DAN isi panel seleksi.

### Mode A — HARIAN (bawaan, unggulan kita)
- Candle harian dari `ohlcv_stockbit/<KODE>.json`, riwayat penuh (rentang mengikuti chip periode yang sudah ada).
- **Seleksi area → pecahan broker penuh** (inti halaman ini): siapa menampung, siapa melepas, di rentang harga × tanggal itu.
- Overlay broker: garis rata-rata, bubble outlier, profil harga.

### Mode B — INTRADAY 4H / 1H (jawaban permintaanmu)
- Candle hasil agregasi bar 1 menit → 4H atau 1H. **Cakupan ±90 hari terakhir** (batas server), kecuali kita mulai memanen rutin (§5).
- **Seleksi area → profil harga-volume + frekuensi** di rentang itu (aliran asing TIDAK ada di intraday — §0) (BUKAN pecahan broker — mustahil, lihat §0). Panel wajib menjelaskan kenapa, jangan dibiarkan kosong tanpa keterangan.
- Bila emiten/rentang tak punya data intraday: kunci mode dengan pesan jelas ("intraday tersedia ±90 hari terakhir; di luar itu pakai mode Harian") — pola gating jujur, sama seperti tradersaham.

**Aturan ganti mode**: seleksi aktif dibuang saat mode/emiten berganti (perilaku ini SUDAH benar di kode sekarang, `WhalesPapan.tsx:81` — pertahankan).

---

## 2. Arsitektur: HYBRID (sesuai keputusan Johan 26 Agu)

**Ganti kanvas 2D mentah → `lightweight-charts` + primitive.** Alasan penggantian: komentar kode sekarang (`WhalesPapan.tsx:22-27`) menolak lightweight-charts karena "butuh seret-pilih dua dimensi, bukan deret lilin". **Alasan itu gugur** setelah Plugin API dipakai — primitive bisa menggambar kotak seleksi, bubble, dan garis apa pun **di dalam render-loop chart yang sama**, jadi kita dapat candle asli TANPA kehilangan seret-pilih. Jalur ini sudah **terbukti** di `lib/dasbor/garisAvgBroker.ts` (P1, dibangun 26 Agu).

- **Lapis 1**: `createChart` + `CandlestickSeries` + `HistogramSeries` (volume). Wajib `crosshair: { mode: CrosshairMode.Normal, vertLine/horzLine labelVisible }` seperti `GrafikEmiten.tsx:991-995`.
- **Lapis 2 (primitive)**: seluruh isi khas Whales Papan (§3). Semua menggambar di `target.useBitmapCoordinateSpace(...)` dengan `horizontalPixelRatio`/`verticalPixelRatio` → tajam di DPR berapa pun, tanpa mengurus canvas sendiri.
- **JANGAN** canvas terpisah bertumpuk di atas chart: harus disinkron manual tiap zoom/pan/resize dan itu sumber overlay "geser/gemetar".

---

## 3. Primitive yang dibangun (isi khas Whales Papan)

| ID | Primitive | Isi | Data | Prioritas |
|---|---|---|---|---|
| **W1** | **Seleksi area** | kotak seret (2 dimensi: rentang harga × waktu), garis batas + isian transparan, pegangan sudut untuk mengubah ukuran, tombol hapus | interaksi murni | **wajib, pertama** |
| **W2** | **Garis rata-rata broker** | garis putus-putus + pill `XC AVG BUY 179 (54%)` | `broker_harian/` (`average`) | **sudah jadi** (`garisAvgBroker.ts`) — pindahkan/pakai ulang |
| **W3** | **Bubble broker outlier** | lingkaran berlabel kode broker di posisi (tanggal × harga rata-rata broker hari itu), radius ∝ \|net\|, warna beli/jual, **ambang z-score bisa disetel** (whales.id: slider 1–4z, bawaan 2,5z) | broker harian | tinggi |
| **W4** | **Profil harga (volume-at-price)** | bar horizontal di sisi kanan plot. **Mode Harian**: lot per level dari broker harian (seperti sekarang). **Mode Intraday**: volume-at-price sesungguhnya dari bar 1 menit (volume tiap menit dibagi ke rentang harganya) — **tandai "hampiran"**, bukan TPO resmi | broker harian / intraday 1m | tinggi |
| ~~**W5**~~ | ~~Pita aliran asing~~ | **DIBATALKAN 26 Agu 2026** — ruas `foreign_buy/sell` bar 1 menit terukur SELALU kosong (874/874 emiten; verifikasi ulang pengawas 133.937 bar, Σ=0). Jangan dibangun. | — | ❌ batal |
| **W6** | **Penanda hasil seleksi** | setelah seleksi dikunci, gambar ringkas di kanvas (mis. label total lot & broker teratas di pojok kotak) supaya tak perlu bolak-balik ke panel | turunan | rendah |

**W1 detail interaksi (ini yang dulu "tak interaktif")**:
- `pointerdown` di dalam plot → mulai seret; `pointermove` → perbarui kotak (lewat `requestUpdate()` primitive, jangan `setState` per gerakan); `pointerup` → kunci seleksi.
- Seret < 4 px dianggap klik, bukan seleksi (penjaga ini SUDAH ada di kode sekarang `:271-275` — **pertahankan**).
- Konversi piksel ↔ nilai memakai API chart: `timeScale().coordinateToTime()` dan `series.coordinateToPrice()` — **jangan** hitung sendiri dari skala manual (itu sumber ketidakcocokan dengan candle).
- Setelah terkunci: kotak tetap menempel pada harga & waktu (bukan piksel), jadi **ikut bergeser saat zoom/pan**. Ini uji terima utamanya.
- Sentuh (telepon): seret satu jari di kanvas = seleksi; sediakan tombol batal yang cukup besar. Pastikan tak bentrok dengan gulir halaman.

---

## 4. Panel hasil seleksi

**Mode Harian** (pertahankan yang sudah ada, rapikan):
- Ringkas: rentang harga, rentang tanggal, jumlah hari bursa, total lot & nilai.
- Tabel broker: **Penampung** (net beli) dan **Pelepas** (net jual), tiap baris: kode, lot, nilai, harga rata-rata, porsi %. Urut nilai. Tombol tampilkan-semua bila lebih dari N baris.
- Turunan yang layak: berapa % dari total volume periode itu, dan **apakah harga sekarang di atas/di bawah rata-rata tiap broker** (siapa untung, siapa nyangkut) — ini yang membuat halaman berguna, bukan sekadar daftar.

**Mode Intraday**:
- Ringkas: rentang harga & waktu, total volume, nilai, frekuensi.
- **Profil volume per level harga** di dalam area.
- **Net asing** di dalam area (kecuali hari berjalan).
- Kotak keterangan tetap: *"Pecahan per broker tidak tersedia di timeframe intraday — data broker IDX hanya terbit harian setelah pasar tutup."* Jangan biarkan pemakai menebak.

---

## 5. Data & panen

- **Mode Harian**: `ohlcv_stockbit/` + `broker_harian/` — sudah ada, tidak perlu panen baru.
- **Mode Intraday**: `chartbit/{kode}/price/intraday`, `from`=epoch **terbaru**, `to`=epoch **terlama** (terbalik, seperti daily). Bar 1 menit 08:58–16:14.
- ⚠️ **Server hanya menyimpan ±90 hari.** Kalau Johan mau riwayat intraday lebih panjang, **panen rutin harus dimulai sekarang** — tiap hari yang lewat tanpa dipanen hilang permanen. Ini keputusan Johan, bukan asumsi implementor. (Spek panen ada di `spek_rbs_gap_intraday.md`.)
- ⚠️ **Jangan pernah menulis data hari berjalan ke `_arsip-mentah`** — berkas parsial akan dilewati runner malam ("sudah ada") dan tinggal parsial selamanya. Snapshot intraday hari berjalan harus di jalur terpisah atau selalu ditimpa setelah tutup.

---

## 6. Migrasi dari kode sekarang (`WhalesPapan.tsx`, 462 baris)

**Dipertahankan** (sudah benar, jangan dibongkar):
- Logika seleksi & bentuk data `SeleksiArea`, `keSeleksi()`, penjaga seret-kecil, buang-seleksi-saat-ganti-emiten.
- Panel hasil seleksi + `rupiahRingkas`/`lotRingkas`.
- DPR clamp `:102` (sudah pola benar).
- `warnaBrokerCanvas` (warna per broker konsisten dengan halaman lain).

**Diganti**:
- Penggambaran kanvas mentah (kisi, sumbu, **titik harian**, profil, kotak) → lightweight-charts + primitive W1–W6.
- **Titik harian dihapus** — diganti candle asli. (Inilah "butiran debu": lingkaran ber-radius 1,4–4,5 px di harga rata-rata. Bukan bug, tapi memang bukan yang Johan mau.)
- Sumbu & kisi manual → milik chart.

**Ditambah**: pemilih TF Harian/4H/1H, ambang z-score bubble, gating intraday. (~~pita aliran asing~~ — dibatalkan, §0.)

---

## 7. Batas jujur yang WAJIB tampil di halaman

Satu kotak "Metodologi & batas" yang bisa dibuka, isinya apa adanya:
1. Broker hanya harian → di 1H/4H tidak ada pecahan broker.
2. Intraday hanya ±90 hari terakhir (kecuali sudah dipanen rutin sejak tanggal X).
3. Aliran asing hari berjalan tidak ditampilkan karena sumbernya basi.
4. Profil volume intraday adalah **hampiran** dari bar 1 menit, bukan footprint per transaksi.
5. Tidak ada orderbook, tidak ada replay, tidak ada CVD — datanya tidak dimiliki.
6. Halaman ini **deskriptif**, bukan rekomendasi beli/jual (label sama dengan pola RBS/Gap).

---

## 8. Kriteria Terima (Kriteria Terima 6 butir + khusus halaman ini)

Selain 6 butir baku (`pengantar_pembagian_kerja.md`), yang khusus:
1. **Candle benar-benar candle** — badan & sumbu terlihat jelas di 1920 dan 412, bukan titik. Screenshot dua viewport × tema terang/gelap, dibandingkan berdampingan dengan mockup.
2. **Seleksi diuji klik nyata**: seret → kotak muncul; **zoom & pan → kotak tetap menempel pada harga/tanggal yang sama** (uji ini yang paling penting, kegagalan di sinilah yang dulu terasa "tak interaktif"); hapus → panel kosong; ganti emiten → seleksi hilang.
3. **Angka dicocokkan arsip**: satu emiten × satu rentang seleksi, total lot/nilai per broker dihitung ulang manual dari `broker_harian/<KODE>.json` → harus sama persis. Lampirkan angkanya.
4. **Mode intraday**: verifikasi jumlah bar 4H per hari bursa masuk akal (sesi 08:58–16:14 → 2 bar 4H), dan candle 1H/4H hasil agregasi cocok dengan high/low harian hari itu.
5. **Bawaan di-assert**: buka halaman → TF = Harian, tanpa seleksi, chip periode bawaan.
6. **Trace performa** saat seret-seleksi + pan/zoom: rata-rata ≥55 fps, nol frame >50 ms.

---

## 9. Urutan kerja

1. Rangka hybrid: candle harian + volume di lightweight-charts, crosshair `Normal`. **Buktikan candle tampil benar dulu** sebelum apa pun.
2. **W1 seleksi area** sebagai primitive + sambungkan ke panel hasil yang sudah ada (logikanya dipakai ulang, jangan ditulis ulang). Uji zoom/pan menempel.
3. W2 (pakai ulang `garisAvgBroker.ts`) + W4 profil harian.
4. W3 bubble outlier + ambang z-score.
5. Mode intraday 4H/1H + gating. (~~W5 pita asing~~ dibatalkan — §0.)
6. Kotak metodologi (§7) + BadgeRapor bila ada klaim prediktif.

**Catatan pengawas**: jangan kerjakan langkah 5 sebelum 1–2 lulus uji terima. Insiden lama terjadi karena banyak hal dikerjakan sekaligus tanpa satu pun diverifikasi visual.


---

> **⚠️ KOREKSI LINTAS-SPEK 26 Agu 2026 — kedalaman arsip OHLCV.**
> Beberapa spek di folder ini menulis OHLCV harian "2017–2026" (≈10 tahun). **Itu SALAH — understated.** Terukur langsung dari `ohlcv_stockbit/`:
> IHSG **1997-07-01** · ASII **2000-10-17** · BUMI **2003-01-01** · BBCA & TLKM **2004-01-02** · SIDO 2013-12-18 (tanggal IPO-nya) — semua sampai 2026-08-21.
> Jadi OHLCV = **20–30 tahun** untuk emiten lama, bukan 10. Angka "2017" itu tercampur dari **lantai BROKER** (yang benar pun **2016-01-04**, terbukti lewat uji 2015 yang nihil).
> **Yang benar: OHLCV ≈ 1997/2000-an→2026 (per emiten, sejak IPO) · BROKER 2016→2026 · INTRADAY 1m ±90 hari (panen rutin sejak 26 Agu 2026).**
> Dampak: Seasonality boleh memakai 20+ tahun (bukan 10), backtest BT Papan punya sampel jauh lebih panjang, dan klaim "menang telak atas riwayat pesaing" justru lebih kuat dari yang tertulis.
