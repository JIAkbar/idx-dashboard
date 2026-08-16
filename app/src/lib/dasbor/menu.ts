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
export interface MenuItem {
  id: string
  path: string
  label: string
  /** Kode tiga huruf gaya ticker, tampil di rail desktop. */
  kode: string
  /** Isi atribut `d` satu <path> SVG pada viewBox 24×24. */
  ikon: string
  /** Badge kecil di sebelah label, mis. "Alpha" pada Broker Summary. */
  badge?: string
  /** Satu kalimat: DATA apa yang ada di dalam, bukan ajakan. Dipakai kartu
   *  halaman Beranda — ditaruh di sini, bukan di komponen kartunya, supaya
   *  menu baru tak bisa lahir tanpa penjelasan apa isinya. */
  ringkas?: string
  /** Item ini membuka kelompok baru di rail — Sidebar menggambar garis jeda
   *  tepat sebelumnya. Ditandai di data, bukan dihitung dari indeks, supaya
   *  urutan menu boleh berubah tanpa memindahkan garisnya secara manual. */
  mulaiKelompok?: boolean
}

export const MENU_ITEMS: MenuItem[] = [
  {
    // Halaman utama '/' kini Beranda (kartu-kartu + kabar); Indeks Dunia
    // pindah ke rutenya sendiri. Kunci akses 'dasbor' tetap menempel pada
    // halaman ini, bukan pada Beranda — Beranda terbuka untuk siapa pun.
    id: 'world', path: '/indeks', label: 'Indeks Dunia', kode: 'IND',
    ringkas: 'Indeks utama dunia dan IHSG dalam satu layar — penutupan, perubahan, dan kalender bursa.',
    ikon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9s1.3-6.6 3.8-9z',
  },
  {
    id: 'stocks', path: '/stocks', label: 'Top Stocks', kode: 'STK',
    ringkas: 'Papan peringkat harian: penggerak indeks, volume terbesar, dan kapitalisasi pasar.',
    ikon: 'M4 19h16M4 15l4-5 4 3 5-7 3 4',
  },
  {
    id: 'broker', path: '/broker', label: 'Top Broker', kode: 'BRK',
    ringkas: 'Broker paling aktif per hari — nilai, lot, dan arah bersihnya.',
    ikon: 'M4 20V9m5.4 11V4m5.2 16v-8m5.4 8V7',
  },
  {
    id: 'sector', path: '/sector', label: 'Sektor & Indeks', kode: 'SEK',
    ringkas: 'Sebelas sektor IDX dan indeks tematik, diurut kinerja.',
    ikon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  },
  {
    id: 'chart', path: '/chart', label: 'Chart', kode: 'CHT',
    ringkas: 'Grafik lilin IHSG dengan rentang 10 tahun dan penanda level kunci.',
    ikon: 'M7 5v14M5 8h4v8H5zM15 3v18M13 7h4v9h-4z',
  },
  {
    id: 'stock-detail', path: '/stock-detail', label: 'Stock Detail', kode: 'DTL',
    ringkas: 'Satu emiten dibedah: harga, laporan keuangan, valuasi, dan arus asing.', mulaiKelompok: true,
    ikon: 'M10 4a6 6 0 100 12 6 6 0 000-12zM14.5 14.5L20 20M8 10h4M10 8v4',
  },
  {
    id: 'peta-investor', path: '/peta-investor', label: 'Peta Investor', kode: 'MAP',
    ringkas: 'Kepemilikan saham dari data KSEI — asing vs domestik, ritel vs institusi, dan grup konglomerat.',
    ikon: 'M12 5a2 2 0 100 4 2 2 0 000-4zM5 15a2 2 0 100 4 2 2 0 000-4zM19 15a2 2 0 100 4 2 2 0 000-4zM11 8.5L6.3 14.6M13 8.5l4.7 6.1M7 17h10',
  },
  {
    id: 'broker-summary', path: '/broker-summary', label: 'Broker Summary', kode: 'BSM',
    ringkas: 'Rekap transaksi broker per emiten, ditranskripsi dari setoran kontributor.',
    ikon: 'M4 7h16M4 7l2-3h12l2 3M4 7v11a2 2 0 002 2h12a2 2 0 002-2V7M9 12h6',
  },
  {
    id: 'kalkulator', path: '/kalkulator', label: 'Kalkulator', kode: 'KAL',
    ringkas: 'Hitung average down, target ARA, risk-reward, dividen, dan titik pulih.',
    ikon: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01',
  },
  {
    id: 'radar', path: '/radar', label: 'Radar Watchlist', kode: 'RDR',
    ringkas: 'Daftar pantau berbasis aturan — emiten yang memenuhi syarat, bukan tebakan.',
    ikon: 'M12 3a9 9 0 109 9M12 7a5 5 0 105 5M12 12l5.5-5.5M12 12h.01',
  },
  {
    id: 'seasonality', path: '/seasonality', label: 'Seasonality', kode: 'SSN',
    ringkas: 'Pola musiman: bulan, hari dalam pekan, dan rentang tahun yang bisa dipilih.',
    ikon: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 9.5h16M8 3v4M16 3v4M8 13h2M12 13h2M8 16.5h2M12 16.5h2',
  },
  {
    id: 'kabar', path: '/kabar', label: 'Kabar Pasar', kode: 'NWS',
    ringkas: 'Berita & pengumuman resmi IDX, IPOT News, dan Kontan dalam satu aliran — PAPAN menautkan, tidak menyalin.',
    mulaiKelompok: true,
    ikon: 'M4 5a1 1 0 011-1h11l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1zM15 4v4h4M8 11h8M8 14h8M8 17h5',
  },
  {
    id: 'bulletin', path: '/bulletin', label: 'Bulletin Arus Pasar', kode: 'BLT',
    ringkas: 'Arsip edisi Arus Pasar — tinjauan teknikal dan arus dana, lengkap dengan PDF-nya.',
    ikon: 'M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM16 4v4h3M8 10h7M8 13h7M8 16h4',
  },
  {
    id: 'forum', path: '/forum', label: 'Forum', kode: 'FRM',
    ringkas: 'Ruang diskusi antar-anggota, per topik.',
    ikon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-4 4v-4H5a1 1 0 01-1-1zM8 9h8M8 12h5',
  },
  {
    id: 'feedback', path: '/feedback', label: 'Kritik & Saran', kode: 'SRN',
    ringkas: 'Sampaikan koreksi data atau usulan fitur langsung ke redaksi.',
    ikon: 'M21 12a8 8 0 01-8 8H4l2.4-2.9A8 8 0 1121 12zM9 11h6M9 14h4',
  },
]
