Dari sesi AI Skill (Fable), 25 Agu 2026 — SPEK **JAGO PAPAN** (halaman baru, terpisah dari Screener dan Harian Papan). Asal: Johan *"masih ada lagi page Jago papan, setelah ini saya kirim"* + 4 tangkapan layar "Jago Saham" (Strong Uptrend 21 Agu sesi 2; Breakout, Early Breakout, Foreign Flow Uptrend — 20 Agu sesi 2). Semua angka sudah diverifikasi ke data kita (§Bukti). Sumber kebenaran: `docs/referensi_idx-statistik.md`.

# Halaman `/jago-papan` — "Jago Papan"

Rumah: grup **DEV** (ketetapan Johan 25 Agu — semua halaman baru ini masuk Dev dulu; naik ke ANALISA setelah matang). Beda peran dari tetangganya:
- **Screener** = penyaringan bebas (pemakai menyusun aturan).
- **Harian Papan** = papan peringkat harian tetap (gainer / net buy / net sell asing).
- **Jago Papan** = **kumpulan screener siap-pakai bertema momentum**, tiap tema satu tab, isinya daftar emiten + kolom pendukung + kalimat penjelas aturan di kepala tab (seperti gaya slide Jago Saham).

Empat tab (v1, urut sesuai tangkapan layar):

| Tab | Aturan v1 (dari deskripsi layar, dibuat eksplisit) | Urut bawaan |
|---|---|---|
| **Strong Uptrend** | `close > MA20` · `value > Rp2 miliar` · `market cap > Rp1 triliun` | Value |
| **Breakout** | `close > MA20` · `close menembus MA20 hari ini` (kemarin `close ≤ MA20`) · `volume > volume MA20` · 1D return positif | Volume |
| **Early Breakout** | `volume > 2 × volume MA20` · `close > MA20` · `close > MA5` · 1D return positif · `Near 52W High` ditampilkan | Volume |
| **Foreign Flow Uptrend** | `net foreign hari ini > 0` · `net foreign > MA10 net foreign` · `foreign flow kumulatif > MA20 foreign flow` · `streak ≥ 2` hari net beli | Foreign Flow |

Kolom (semua sudah terbukti bisa dihitung dari arsip kita — lihat §Bukti): Symbol · Price · 1 Day Price Returns % · Price MA5 · Price MA20 · Market Cap (`soxclose`) · Value · Volume · Volume MA20 · Near 52W High · Net Foreign Buy/Sell · Net FB/FS MA10 · Net Foreign Streak · Foreign Flow (kumulatif) · Foreign Flow MA20. Tiap tab menampilkan **kalimat aturan** + tanggal + tombol CSV, dan tabel bisa diurut per kolom.

# Bukti verifikasi (25 Agu 2026)

**Strong Uptrend 21 Agu — 5 emiten diuji (PACK, PIPA, JARR, CSMI, VICI): 8 kolom × 5 baris = 40 angka, SEMUA cocok persis** — close, 1D return, MA5, MA20, Market Cap (`soxclose` chartbit), Value, Volume, Volume MA20. Contoh PACK: close 386 · +9,66% · MA5 336 · MA20 270 · mcap Rp13.162,51 B · value Rp290,0 M · volume 767.834.600 · vMA20 204.387.375 — identik semua.

**Early Breakout — kolom "Near 52 Week High" terpecahkan** = `close ÷ tertinggi CLOSE 52 minggu` (bukan tertinggi HIGH, bukan posisi dalam rentang high–low). Uji 8 emiten: INET 0,46 (kita 0,46) · MEJA 0,72 (0,75) · NICL 0,24 (0,25) · TRIN 0,18 (0,20) — memakai high intrahari hasilnya 0,44/0,69/0,24/0,18, memakai posisi rentang 0,33/0,63/0,04/0,14. Definisi close-vs-close paling dekat; **pakai itu, dan tulis rumusnya di Metodologi**.

**Foreign Flow Uptrend — tabelnya BUKAN dari tanggal yang tertulis.** Slide berlabel "20 Agustus 2026" tapi angkanya tidak cocok dengan 20 Agu, 19 Agu, maupun 18 Agu di arsip kita:

| Emiten | Layar NB | Kita 18 Agu | 19 Agu | 20 Agu |
|---|---|---|---|---|
| ANTM | 95,90 B | 69,01 | −52,50 | 138,77 |
| INCO | 1,78 B | 2,89 | 4,45 | 28,17 |
| INDF | 10,17 B | 4,86 | **10,47** | 0,05 |
| PSAB | 3,55 B | 25,17 | 10,80 | 94,12 |

Yang mendekati justru **19 Agu untuk INDF saja**; sisanya tidak cocok di tanggal mana pun. Foreign Flow kumulatif juga selalu meleset 0,5–45% (ANTM 6.662 vs 6.837; PSAB 222 vs 216). Dugaan: mereka memakai **snapshot pra-penutupan** ("Sesi 2" = saat sesi 2 berjalan) atau sumber aliran asing berbeda (lembar × harga, bukan rupiah resmi chartbit). **Ketetapan untuk PAPAN: pakai `foreignbuy − foreignsell` chartbit (rupiah resmi), tulis jam potong data di layar, jangan menyamakan angka dengan mereka.**

Catatan tambahan: label slide "Sesi 2" berarti data mereka diambil saat pasar masih berjalan — konsisten dengan temuan uji intraday kita 24 Agu (chartbit memberi bar berjalan, ruas asing basi). PAPAN memakai data final tutup pasar; kalau kelak dibuat versi intraday, ruas asing tidak boleh ikut sampai tutup.

# Ruas baru yang perlu dihitung (perluasan kartu harian)

`near52w` (close ÷ max close 250 hari) · `net_asing_ma10` · `net_asing_streak` (hari beruntun net beli) · `foreign_flow_kum` (kumulatif `fb−fs` sejak awal deret — chartbit sudah punya kolom `foreignflow`, **pakai kolom itu, jangan hitung ulang**) · `foreign_flow_ma20` · `mcap` (`soxclose`) · `vol_ma20` · `tembus_ma20_hari_ini`.

# Kejujuran & batas

- Semua tab **bukan rekomendasi beli** — label sama seperti pola RBS/Gap; sertakan tautan ke BT Papan supaya pemakai bisa melihat rapor backtest tiap tema (Strong Uptrend / Breakout / Early Breakout / Foreign Flow bisa langsung jadi strategi uji di BT Papan).
- Emiten beku (volume 0 / tidak diperdagangkan) dikeluarkan dari semua tab.
- Ambang (Rp2 M value, Rp1 T mcap, 2× volume MA20, streak ≥2) = "v1", di config yang sama dengan preset Screener supaya bisa kamu ubah.
- Aturan tiap tab ditulis apa adanya di kepala tab + Metodologi, termasuk perbedaan definisi Near 52W High dan sumber aliran asing.

# Uji & dokumentasi

- Uji regresi: nilai acuan Strong Uptrend 21 Agu (5 emiten × 8 kolom) dan Near 52W High 8 emiten ada di spek ini.
- Dua viewport + tema terang/gelap; tabel lebar bergulir mendatar di wadah sendiri.
- `docs/jejak-permintaan.md` per tugas; peta halaman → sumber di referensi + HTML dibangun ulang.
