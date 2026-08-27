Dari sesi AI Skill (Fable), 25 Agu 2026 — ADENDUM spek Preset Screener (pesan 09:0x). Johan: *"tolong analisa screener baru ini"* (konsep Whale Detector 3 rumus) → *"ok bisa buat 3 preset itu kah?"* · *"sepertinya ini preset baru jgn di timpa dengan yang tadi"*.

**PENTING — ini TAMBAHAN, bukan pengganti (penegasan Johan):** spek utama (Scalping, Swing, Riwayat & Win Rate, Rekap Sore, Tugas A–D) tetap berlaku utuh dan JANGAN diubah/ditimpa. Tiga preset Whale di bawah adalah preset baru yang ditambahkan di samping Scalping & Swing di berkas config yang sama; ruas baru Tugas A adendum ini juga penambahan, bukan revisi ruas yang sudah diminta. Tiga preset WHALE di bawah menambah tab preset di `/screener` (total tab: Scalping · Swing · Whale-Tiket · Whale-AkDis · Whale-Asing · Manual · Riwayat & Win Rate — kalau terlalu ramai, ketiga Whale boleh satu tab "Whale" dengan sub-pilihan). Konfigurasi tetap di `presetScreener.ts`, ambang = "v1 usulan", keputusan akhir Johan.

## Koreksi konsep (wajib tercermin di UI/Metodologi)
1. Filter "lot × harga per transaksi" TIDAK bisa persis — tidak ada data done-trade/tick. Pengganti sah: rata-rata nilai per transaksi (harian & per broker) + blok NEGO.
2. "Total volume beli ÷ jual" di tingkat pasar SELALU = 1 (tiap transaksi dua sisi) — jangan pernah ditampilkan; ukuran yang benar = ketidakseimbangan per broker / konsentrasi top-N / accdist NET (ambang terbukti ±6/±12,5/±20).
3. Net foreign flow pakai `foreignbuy − foreignsell` chartbit (rupiah resmi), bukan taksiran lembar × harga.

## Ruas baru di kartu harian (perluasan Tugas A spek utama)
- `tiket_avg` = value ÷ frequency (Rp/transaksi) dan `tiket_avg_med60` = median 60 hari; `tiket_lonjakan` = tiket_avg ÷ med60.
- Per broker (dari GROSS reguler hari itu): `tiket_broker_maks` = maks(bval ÷ freq) antar broker beli, `broker_tiket_maks_kode`, `bval_maks`.
- `nego_blok_rp` = Σ bval varian NEGO hari itu (0 kalau kosong) + broker nego terbesar.
- `asing_net_5h`, `asing_net_20h` (jumlah bergerak fb−fs), `asing_streak` (hari beruntun searah).
- Konsentrasi: `top3_pct` NET (sudah ada rumusnya di Kamus ruas), `number_broker_buysell`.

## Preset WHALE-1 · Tiket Besar (pengganti "transaction size filter")
- `tiket_lonjakan ≥ 2` (rata-rata tiket hari itu ≥ 2× median 60 harinya) ATAU `tiket_broker_maks ≥ Rp250 jt/transaksi` ATAU `bval_maks ≥ Rp5 M` ATAU `nego_blok_rp ≥ Rp5 M`.
- Saring kebisingan: `peringkat_value ≤ 200` dan close ≥ Rp50.
- Kartu hasil menyebut SIAPA: kode broker tiket terbesar + angka Rp-nya + apakah lewat NEGO.

## Preset WHALE-2 · Akumulasi / Distribusi (pengganti "buy/sell imbalance")
- Mode Akumulasi: `label_accdist ∈ {Big Acc}` (NET percent ≥ 20) · `top3_pct ≥ 60` (terkonsentrasi) · `number_broker_buysell ≤ 0` opsional (sedikit pembeli besar melawan banyak penjual = ciri akumulasi senyap).
- Mode Distribusi (toggle): cermin — `Big Dist`, top3 jual terkonsentrasi.
- Konfirmasi 5 hari: akumulasi bandar 5 hari (Σ net broker top1) searah.
- UI wajib menulis: "rasio volume beli/jual pasar selalu 1 — yang diukur di sini ketidakseimbangan per broker (aturan PAPAN, ambang accdist terkalibrasi dari data Stockbit)".

## Preset WHALE-3 · Asing (net foreign flow)
- `asing_net_5h > 0` DAN `asing_streak ≥ 3` (konsisten masuk) DAN `porsi_asing ≥ 20%` (asing memang pemain berarti di emiten itu); mode keluar = cermin negatif.
- Konfirmasi lambat (opsional, badge): Δ bulanan KSEI `asing_total` naik ≥ 0,5 pp pada posisi terakhir.
- Skor = besaran asing_net_20h relatif ke market cap (soxclose chartbit).

## Riwayat & Win Rate
Ketiga preset Whale ikut mekanisme `rekomendasi/<tgl>.json` + win rate yang sama (Tugas C spek utama) — jadi klaim "whale masuk = naik" teruji rapornya, menang dan kalah sama-sama tampil.

## Uji
- 1 tanggal penuh: daftar hasil tiap preset dicek manual terhadap berkas mentah (khusus WHALE-1 cek broker & angka Rp; WHALE-2 cek accdist/top3 ke bandar_detector; WHALE-3 cek fb−fs chartbit).
- 2 viewport + tema, seperti spek utama; dokumentasi referensi + jejak sama.
