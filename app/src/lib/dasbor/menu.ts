/**
 * Satu sumber daftar menu dasbor publik, dipakai Sidebar (rail desktop) &
 * LaciMobile (laci kiri telepon, #76). Port dari index_live.html
 * baris 683-716 (sidebar) — urutan ini juga dipakai sebagai urutan laci di
 * telepon (di kode asli baris 5187-5191 urutannya sedikit beda dari sidebar;
 * itu bug duplikasi dua daftar terpisah yang disatukan di sini).
 *
 * Arah visual "Lantai Bursa": tiap menu punya KODE tiga huruf bergaya ticker
 * bursa (IND/STK/BRK/…) dan ikon SVG yang digambar sendiri. Emoji dibuang —
 * bentuknya berbeda-beda tiap sistem operasi, tidak bisa diberi warna
 * mengikuti tema, dan membuat antarmuka terbaca sebagai templat.
 */
/** Kelompok tempat sebuah menu bernaung. Rail desktop menampilkan KELOMPOK,
 *  bukan menu — 16 ikon berderet sudah menghabiskan tinggi rail di laptop dan
 *  ikon ke-18 akan meluber tanpa gulir dan tanpa galat (#175). */
export type GrupId = 'pasar' | 'emiten' | 'aliran' | 'analisa' | 'baca'

export interface MenuItem {
  id: string
  path: string
  label: string
  /** Kode tiga huruf gaya ticker, tampil di flyout rail & kartu Beranda. */
  kode: string
  /** Isi atribut `d` satu <path> SVG pada viewBox 24×24. */
  ikon: string
  /** Badge kecil di sebelah label, mis. "Alpha" pada Broker Summary. */
  badge?: string
  /** Satu kalimat: DATA apa yang ada di dalam, bukan ajakan. Dipakai kartu
   *  halaman Beranda — ditaruh di sini, bukan di komponen kartunya, supaya
   *  menu baru tak bisa lahir tanpa penjelasan apa isinya. */
  ringkas?: string
  /** Kelompok pemiliknya. Ditulis di data, bukan dihitung di komponen: rail
   *  dan laci telepon wajib membaca pengelompokan yang sama persis. */
  grup: GrupId
}

export interface MenuGrup {
  id: GrupId
  /** Kode tiga huruf gaya ticker, tampil di rail desktop. */
  kode: string
  label: string
  /** Isi atribut `d` satu <path> SVG pada viewBox 24×24. */
  ikon: string
}

/** Urutan kelompok di rail = urutan di bawah ini.
 *  Catatan kode: kelompok "Baca" memakai BAC, bukan BCA — di dasbor bursa
 *  "BCA" terbaca sebagai Bank Central Asia, bukan sebagai kata kerja. */
export const MENU_GRUP: MenuGrup[] = [
  {
    id: 'pasar', kode: 'PSR', label: 'Pasar',
    ikon: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6',
  },
  {
    id: 'emiten', kode: 'EMT', label: 'Emiten',
    ikon: 'M4 4h7l9 9-7 7-9-9zM8.5 8.5h.01',
  },
  {
    id: 'aliran', kode: 'ALR', label: 'Aliran Dana',
    ikon: 'M4 8h13l-3.5-3.5M20 16H7l3.5 3.5',
  },
  {
    id: 'analisa', kode: 'ANL', label: 'Analisa',
    ikon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM15.6 8.4l-2.3 5.2-5.2 2.3 2.3-5.2z',
  },
  {
    id: 'baca', kode: 'BAC', label: 'Baca',
    ikon: 'M12 6a3 3 0 00-3-3H4v14h5a3 3 0 013 3 3 3 0 013-3h5V3h-5a3 3 0 00-3 3zM12 6v14',
  },
]

export const MENU_ITEMS: MenuItem[] = [
  // ── Pasar ──────────────────────────────────────────────────────────────
  {
    // Halaman utama '/' kini Beranda (kartu-kartu + kabar); Indeks Dunia
    // pindah ke rutenya sendiri. Kunci akses 'dasbor' tetap menempel pada
    // halaman ini, bukan pada Beranda — Beranda terbuka untuk siapa pun.
    id: 'world', path: '/indeks', label: 'Indeks Dunia', kode: 'IND', grup: 'pasar',
    ringkas: 'Indeks utama dunia dan IHSG dalam satu layar — penutupan, perubahan, dan kalender bursa.',
    ikon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9s1.3-6.6 3.8-9z',
  },
  {
    id: 'sector', path: '/sector', label: 'Sektor & Indeks', kode: 'SEK', grup: 'pasar',
    ringkas: 'Sebelas sektor IDX dan indeks tematik, diurut kinerja.',
    ikon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  },
  {
    id: 'stocks', path: '/stocks', label: 'Top Stocks', kode: 'STK', grup: 'pasar',
    ringkas: 'Papan peringkat harian: penggerak indeks, volume terbesar, dan kapitalisasi pasar.',
    ikon: 'M4 19h16M4 15l4-5 4 3 5-7 3 4',
  },
  {
    // Statistik Berkala — rekap SATU PEKAN bursa dari terbitan resmi IDX.
    // Ditaruh di kelompok Pasar karena isinya seluruh pasar (bukan satu
    // emiten, bukan aliran dana): nilai transaksi, IHSG, indeks dunia,
    // peringkat saham & broker sepekan. Kode 'STA' — 'STK' sudah dipakai Top
    // Stocks dan 'SEK' Sektor & Indeks.
    id: 'statistik', path: '/statistik', label: 'Statistik Berkala', kode: 'STA', grup: 'pasar',
    ringkas: 'Rekap satu pekan bursa dari terbitan resmi IDX — tiap angka berpasangan dengan pekan sebelumnya.',
    ikon: 'M4 20h16M7 20V10M12 20V4M17 20v-7M4 7h6M4 13h3',
  },
  {
    id: 'broker', path: '/broker', label: 'Top Broker', kode: 'BRK', grup: 'pasar',
    ringkas: 'Broker paling aktif per hari — nilai, lot, dan arah bersihnya.',
    ikon: 'M4 20V9m5.4 11V4m5.2 16v-8m5.4 8V7',
  },

  // ── Emiten ─────────────────────────────────────────────────────────────
  {
    id: 'stock-detail', path: '/stock-detail', label: 'Stock Detail', kode: 'DTL', grup: 'emiten',
    ringkas: 'Satu emiten dibedah: harga, laporan keuangan, valuasi, dan arus asing.',
    ikon: 'M10 4a6 6 0 100 12 6 6 0 000-12zM14.5 14.5L20 20M8 10h4M10 8v4',
  },
  {
    // Chart PAPAN (tahap 3, 17 Agu 2026) — beda dari 'chart' (widget
    // TradingView di bawah): lilin+volume dari OHLC lokal PAPAN sendiri,
    // kanvas milik sendiri supaya overlay khas PAPAN (pita musiman,
    // akumulasi broker, penanda Radar) bisa dipasang di tahap berikutnya.
    // Kode 'CHT' sudah dipakai TradingView, jadi 'GRF'.
    id: 'grafik', path: '/grafik', label: 'Grafik Emiten', kode: 'GRF', grup: 'emiten',
    ringkas: 'Lilin dan volume satu emiten dari data OHLC PAPAN sendiri — bisa di-zoom dan digeser.',
    ikon: 'M4 3v18M2 8h4v6H2zM11 2v20M9 6h4v10H9zM18 5v16M16 9h4v8h-4z',
  },
  {
    id: 'chart', path: '/chart', label: 'Chart', kode: 'CHT', grup: 'emiten',
    ringkas: 'Grafik lilin IHSG dengan rentang 10 tahun dan penanda level kunci.',
    ikon: 'M7 5v14M5 8h4v8H5zM15 3v18M13 7h4v9h-4z',
  },

  // ── Aliran Dana ────────────────────────────────────────────────────────
  {
    id: 'peta-investor', path: '/peta-investor', label: 'Peta Investor', kode: 'MAP', grup: 'aliran',
    ringkas: 'Kepemilikan saham dari data KSEI — asing vs domestik, ritel vs institusi, dan grup konglomerat.',
    ikon: 'M12 5a2 2 0 100 4 2 2 0 000-4zM5 15a2 2 0 100 4 2 2 0 000-4zM19 15a2 2 0 100 4 2 2 0 000-4zM11 8.5L6.3 14.6M13 8.5l4.7 6.1M7 17h10',
  },
  {
    id: 'broker-summary', path: '/broker-summary', label: 'Broker Summary', kode: 'BSM', grup: 'aliran',
    ringkas: 'Rekap transaksi broker per emiten, ditranskripsi dari setoran kontributor.',
    ikon: 'M4 7h16M4 7l2-3h12l2 3M4 7v11a2 2 0 002 2h12a2 2 0 002-2V7M9 12h6',
  },
  {
    // Aliran Asing (22 Agu 2026, Johan: "aliran asing ini bisa di adaptasi
    // di page apa ya enaknya? daripada ada di stock detail yang jarang
    // dibuka?") — daftar SELURUH emiten diurut net asing, dari
    // screener.json; PanelAliranAsing per-emiten (dulu cuma di Stock Detail)
    // dirender di bawah begitu satu baris dipilih. Kode 'ASG' — 'AGT' dsb.
    // belum dipakai grup ini.
    id: 'aliran-asing', path: '/aliran-asing', label: 'Aliran Asing', kode: 'ASG', grup: 'aliran',
    ringkas: 'Emiten diurut net asing, dengan arus harian per emiten begitu dipilih.',
    ikon: 'M4 12h6M7 9l-3 3 3 3M20 12h-6M17 9l3 3-3 3',
  },

  // ── Analisa ────────────────────────────────────────────────────────────
  {
    id: 'seasonality', path: '/seasonality', label: 'Seasonality', kode: 'SSN', grup: 'analisa',
    ringkas: 'Pola musiman: bulan, hari dalam pekan, dan rentang tahun yang bisa dipilih.',
    ikon: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 9.5h16M8 3v4M16 3v4M8 13h2M12 13h2M8 16.5h2M12 16.5h2',
  },
  {
    id: 'radar', path: '/radar', label: 'Radar Watchlist', kode: 'RDR', grup: 'analisa',
    ringkas: 'Daftar pantau berbasis aturan — emiten yang memenuhi syarat, bukan tebakan.',
    ikon: 'M12 3a9 9 0 109 9M12 7a5 5 0 105 5M12 12l5.5-5.5M12 12h.01',
  },
  {
    // Watchlist dinamis (backlog C8, 19 Agu 2026) — BEDA dari 'radar' (Radar
    // Watchlist, arsip WDWL berbasis aturan): ini daftar pantau milik
    // pembaca sendiri, disimpan di peranti (localStorage), bergerak
    // mengikuti OHLCV harian + harga milik utk untung-rugi. Ikon dipakai
    // ulang dari IKON_MATA ("mata" = memantau, sudah dipakai makna sama di
    // toggle tampil/sembunyi Grafik Emiten) — bukan ikon baru.
    id: 'watchlist', path: '/watchlist', label: 'Watchlist', kode: 'WCH', grup: 'analisa',
    ringkas: 'Daftar pantau milik Anda sendiri — harga bergerak tiap hari, isi harga beli untuk melihat untung-rugi.',
    ikon: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 12m-2.6 0a2.6 2.6 0 1 0 5.2 0 2.6 2.6 0 1 0-5.2 0',
  },
  {
    id: 'kalkulator', path: '/kalkulator', label: 'Kalkulator', kode: 'KAL', grup: 'analisa',
    ringkas: 'Hitung average down, target ARA, risk-reward, dividen, dan titik pulih.',
    ikon: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01',
  },
  {
    // Kartu Analisa Emiten (18 Agu 2026) — kartu per emiten dari berkas
    // turunan scripts/riset/kartu_analisa.py: struktur harga, level S/R
    // dengan n sentuhan, ekspektasi waktu first-passage, musiman, fundamental.
    // Kode 'KTA' — 'KAL' Kalkulator, 'RDR' Radar sudah dipakai.
    id: 'kartu', path: '/kartu', label: 'Kartu Analisa', kode: 'KTA', grup: 'analisa',
    ringkas: 'Kartu per emiten: struktur harga, level dengan n sentuhan, ekspektasi waktu, musiman, dan fundamental — tiap angka membawa asal-usulnya.',
    ikon: 'M4 4h16v16H4zM4 9h16M9 9v11M14 13h3M14 16h3',
  },

  {
    // Screener lembar-kerja (B31, 21 Agu 2026) — 921 emiten dalam satu tabel
    // 18 kolom, dibaca dari berkas turunan `data-idx/json/screener.json`
    // supaya halaman tak perlu mengunduh 921 berkas OHLC.
    // Kode 'SCR' — 'SEK' Sektor & 'SRN' Saran sudah dipakai.
    id: 'screener', path: '/screener', label: 'Screener', kode: 'SCR', grup: 'analisa',
    ringkas: 'Sembilan ratus emiten dalam satu tabel: skor teknikal harian/pekanan/bulanan, momentum, volume relatif, aliran asing, dan posisi terhadap rata-rata bergerak.',
    ikon: 'M4 5h16M4 5l6 7v6l4 2v-8l6-7M4 5v0',
  },

  // ── Baca ───────────────────────────────────────────────────────────────
  {
    id: 'kabar', path: '/kabar', label: 'Kabar Pasar', kode: 'NWS', grup: 'baca',
    ringkas: 'Berita & pengumuman resmi IDX, IPOT News, dan Kontan dalam satu aliran — PAPAN menautkan, tidak menyalin.',
    ikon: 'M4 5a1 1 0 011-1h11l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1zM15 4v4h4M8 11h8M8 14h8M8 17h5',
  },
  {
    id: 'bulletin', path: '/bulletin', label: 'Bulletin Arus Pasar', kode: 'BLT', grup: 'baca',
    ringkas: 'Arsip edisi Arus Pasar — tinjauan teknikal dan arus dana, lengkap dengan PDF-nya.',
    ikon: 'M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM16 4v4h3M8 10h7M8 13h7M8 16h4',
  },
  {
    id: 'feedback', path: '/feedback', label: 'Kritik & Saran', kode: 'SRN', grup: 'baca',
    ringkas: 'Sampaikan koreksi data atau usulan fitur langsung ke redaksi.',
    ikon: 'M21 12a8 8 0 01-8 8H4l2.4-2.9A8 8 0 1121 12zM9 11h6M9 14h4',
  },
  {
    // Backlog C6 — glosarium (75 istilah ditambang dari korpus PAPAN sendiri)
    // + metodologi sumber data. Ikon buku terbuka, beda bentuk dari IKON_CATATAN
    // (notepad, dipakai tab Changelog) supaya tak tertukar di flyout yang sama.
    id: 'metodologi', path: '/metodologi', label: 'Metodologi & Glosarium', kode: 'MTD', grup: 'baca',
    ringkas: '75 istilah PAPAN dengan definisi dan frekuensi pemakaian, plus penjelasan sumber data & batasnya.',
    ikon: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  },
]

/** Kelompok beserta isinya — satu sumber untuk rail desktop (flyout) DAN laci
 *  telepon (daftar bertajuk). Diturunkan dari dua daftar di atas, bukan
 *  ditulis ulang, supaya menu baru cukup diberi ruas `grup`. */
export const MENU_KELOMPOK: (MenuGrup & { items: MenuItem[] })[] = MENU_GRUP.map((g) => ({
  ...g,
  items: MENU_ITEMS.filter((m) => m.grup === g.id),
}))
