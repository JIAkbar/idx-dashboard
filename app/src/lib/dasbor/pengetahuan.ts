/**
 * Basis pengetahuan tekstual PAPAN — jawaban siap pakai untuk pertanyaan
 * "cara kerja platform" dan "apa artinya" (aturan bursa, kebijakan
 * kontributor, istilah pasar, apa isi tiap halaman). Berbeda dari
 * `tanyaPapan.ts`: itu menjawab dari ANGKA hari berjalan, ini menjawab dari
 * FAKTA tetap yang tak berubah tiap hari.
 *
 * Sengaja dipisah dari `tanyaPapan.ts` supaya kedua mesin bisa berkembang
 * tanpa saling menabrak — penyambungannya (mis. dipanggil sebagai jalur
 * cadangan sebelum "tak paham") dikerjakan di tempat lain.
 *
 * Isi diserap dari (bukan dikarang): `docs/pedoman-harga-bei.md` +
 * `lib/fraksiHarga.ts` (fraksi & ARA/ARB — dicek keduanya cocok, tak ada
 * selisih), `docs/rencana-berjalan.md` bagian "Keputusan yang sudah
 * diambil" (jenjang, kurasi, kredit, istilah broker summary), `menu.ts`
 * (ringkasan tiap halaman), `ambangPasar.json` + `ringkasHarian.ts`
 * (kalibrasi ambang "menguat kuat"), dan `docs/sumber-fundamental-idx.md`
 * (sumber data). Angka yang tak ditemukan di sumbernya SENGAJA tak ditulis
 * — kalimat tanpa angka lebih baik daripada angka yang tak terverifikasi.
 */

export interface Entri {
  id: string
  /** Kata kunci pemicu, huruf kecil, tanpa tanda baca. */
  kunci: string[]
  judul: string
  isi: string
  /** Rute halaman yang relevan, mis. '/kalkulator'. */
  ke?: string
  keLabel?: string
}

export const PENGETAHUAN: Entri[] = [
  // ── Tentang PAPAN sendiri ────────────────────────────────────────────────
  // Ditambahkan setelah pengukuran 16 Agu 2026: dari 20 pertanyaan wajar,
  // sembilan tak terjawab — dan yang paling telak "apa itu PAPAN". Basis
  // pengetahuan yang tahu fraksi harga tapi tak bisa menyebut dirinya sendiri
  // adalah lubang yang cuma kelihatan kalau benar-benar ditanyai.
  {
    id: 'tentang-papan',
    // 'apa itu papan' SENGAJA tidak didaftarkan: ia beririsan penuh dengan
    // kunci 'papan', jadi cuma menggandakan skor entri ini — dan itu membuat
    // "apa itu papan pencatatan" dijawab profil PAPAN alih-alih entri papan
    // pencatatan. Kunci yang beririsan bukan menambah ketepatan, melainkan
    // membajak entri yang lebih spesifik.
    kunci: ['papan', 'situs ini', 'website ini', 'aplikasi ini'],
    judul: 'PAPAN — Pusat Analisa Pasar Nusantara',
    isi:
      'PAPAN menyajikan data dan informasi Bursa Efek Indonesia: angka harian pasar, fundamental per emiten, ' +
      'kepemilikan saham dari KSEI, pola musiman, dan terbitan analisa. Prinsipnya angkanya bisa ditelusuri ke ' +
      'sumbernya, metodenya terbuka, dan yang belum kami punya kami sebut belum punya. PAPAN bukan produk resmi ' +
      'Bursa Efek Indonesia.',
  },
  {
    id: 'biaya-papan',
    kunci: ['gratis', 'bayar', 'biaya', 'berlangganan', 'harga langganan'],
    judul: 'Biaya',
    isi:
      'Halaman data PAPAN terbuka untuk umum tanpa biaya. Sebagian fitur terbuka bertahap mengikuti jenjang ' +
      'kontributor — jenjang naik dari kontribusi setoran, bukan dari pembayaran.',
  },
  {
    id: 'login-masuk',
    kunci: ['login', 'masuk', 'sign in', 'lupa sandi', 'lupa password', 'akun saya'],
    judul: 'Masuk ke akun',
    isi:
      'Tombol masuk ada di pojok kanan atas halaman — dipakai kontributor dan pengurus untuk membuka Area ' +
      'Kontributor. Seluruh halaman data bisa dibaca tanpa masuk. Lupa sandi atau akun terkunci: hubungi ' +
      'pengurus lewat halaman Kritik & Saran, sandi tidak bisa diatur ulang sendiri.',
    ke: '/feedback',
    keLabel: 'Hubungi lewat Kritik & Saran',
  },
  {
    id: 'batas-kemampuan',
    kunci: ['kok belum bisa jawab', 'tidak bisa jawab', 'gak bisa jawab', 'bisa jawab apa',
      'kamu bisa apa', 'kemampuanmu'],
    judul: 'Yang bisa dan belum bisa saya jawab',
    isi:
      'Saya menjawab dari data yang sudah dihitung PAPAN: angka IHSG dan arus asing hari itu, sektor, saham ' +
      'naik/turun, harga dan valuasi per emiten, kepemilikan KSEI, grup konglomerat, kalender bursa, edisi, ' +
      'kabar, serta arti istilah dan cara kerja tiap halaman. Yang belum: prakiraan harga, rekomendasi ' +
      'beli/jual, dan hal di luar pasar saham Indonesia. Kalau pertanyaanmu ditolak padahal masuk daftar di ' +
      'atas, itu kekurangan saya mengenali kalimatnya — coba sebut kata kuncinya lebih langsung.',
  },
  {
    id: 'cara-jadi-kontributor',
    kunci: ['jadi kontributor', 'cara kontributor', 'gabung', 'daftar', 'daftar akun', 'registrasi', 'ikut menyetor'],
    judul: 'Cara menjadi kontributor',
    isi:
      'Akun kontributor dibuat oleh pengurus, bukan lewat pendaftaran mandiri — supaya tiap setoran punya ' +
      'penanggung jawab yang jelas. Kontributor menyetor tangkapan layar broker summary harian sesuai kalender ' +
      'bursa; setoran yang lolos kurasi menambah jenjang dan kuotanya. Ajukan lewat halaman Kritik & Saran.',
    ke: '/feedback',
    keLabel: 'Buka Kritik & Saran',
  },
  {
    id: 'hitung-akurasi',
    kunci: ['hitung akurasi', 'menghitung akurasi', 'akurasi kontributor', 'rumus akurasi', 'akurasi dihitung'],
    judul: 'Cara akurasi kontributor dihitung',
    isi:
      'Akurasi = setoran disetujui dibagi (disetujui + dihapus). Setoran berstatus "perlu revisi" sengaja TIDAK ' +
      'ikut dihitung: revisi adalah permintaan perbaikan, bukan vonis — kalau ikut menghukum, kontributor justru ' +
      'akan menghindarinya. Setoran yang masih menunggu juga belum dihitung.',
  },
  {
    id: 'broker-sebagian-emiten',
    kunci: ['broker sebagian', 'kenapa broker', 'broker tidak lengkap', 'broker semua emiten'],
    judul: 'Kenapa broker summary hanya sebagian emiten',
    isi:
      'Rekap broker per emiten tidak tersedia di endpoint publik IDX mana pun — yang terbuka hanya rekap level ' +
      'pasar untuk 88 broker, tanpa rincian per saham. Karena itu broker summary PAPAN berasal dari setoran ' +
      'kontributor, jadi cakupannya sebatas emiten yang disetor hari itu. Ini keterbatasan sumber, bukan pilihan.',
    ke: '/broker-summary',
    keLabel: 'Buka Broker Summary',
  },
  {
    id: 'bukan-saran-investasi',
    kunci: ['layak dibeli', 'saham bagus', 'rekomendasi saham', 'saran investasi', 'beli apa',
      'harus beli', 'prediksi harga', 'saham naik besok'],
    judul: 'PAPAN tidak memberi rekomendasi beli/jual',
    isi:
      'PAPAN menyajikan data dan metode perhitungannya, bukan saran investasi. Tidak ada halaman di sini yang ' +
      'menyebut sebuah saham layak dibeli atau dijual — yang ada angka, pola, dan aturan yang dipakai ' +
      'menghitungnya, supaya keputusan tetap di tangan pembacanya. Radar Watchlist pun daftar berbasis aturan ' +
      'yang syaratnya terbuka, bukan rekomendasi.',
    ke: '/radar',
    keLabel: 'Buka Radar Watchlist',
  },
  {
    id: 'beda-dengan-lain',
    kunci: ['bedanya papan', 'beda dengan', 'dibanding aplikasi', 'kelebihan papan', 'keunggulan'],
    judul: 'Bedanya dengan aplikasi pasar lain',
    isi:
      'Yang tak umum ada di tempat lain: kepemilikan saham dari KSEI beserta peta jaringan dan grup ' +
      'konglomeratnya, pola musiman yang diuji lawan 2.000 pengacakan, riwayat IHSG sejak 1990 dan OHLCV lima ' +
      'tahun untuk hampir seluruh emiten, harga yang selalu dibulatkan ke fraksi bursa sehingga benar-benar bisa ' +
      'dipesan, serta terbitan analisa berkala. Yang belum ada juga disebut terus terang.',
  },
  {
    id: 'halaman-beranda',
    kunci: ['beranda', 'halaman utama', 'halaman depan'],
    judul: 'Beranda',
    isi:
      'Beranda memuat papan IHSG hari berjalan, ringkasan pasar yang dirakit dari angka (bukan ditulis model ' +
      'bahasa), terbitan terakhir, kabar dari empat sumber, dan kartu menu ke seluruh halaman.',
    ke: '/',
    keLabel: 'Buka Beranda',
  },

  // ── Aturan bursa (docs/pedoman-harga-bei.md + lib/fraksiHarga.ts) ───────
  {
    id: 'fraksi-harga',
    kunci: ['fraksi', 'tick', 'tick size', 'kelipatan harga'],
    judul: 'Fraksi harga (tick size)',
    isi:
      'Kelipatan harga di BEI berjenjang lima tingkat: Rp1 untuk harga sampai Rp200, Rp2 sampai Rp500, ' +
      'Rp5 sampai Rp2.000, Rp10 sampai Rp5.000, dan Rp25 di atasnya. Batas atas tiap jenjang inklusif — ' +
      'harga tepat Rp2.000 masih berfraksi Rp5, baru Rp10 mulai Rp2.001.',
    ke: '/kalkulator',
    keLabel: 'Buka Kalkulator',
  },
  {
    id: 'auto-rejection',
    kunci: ['ara', 'arb', 'auto rejection', 'batas atas harga', 'batas bawah harga'],
    judul: 'Auto rejection (ARA/ARB)',
    isi:
      'Batas auto rejection atas (ARA) dan bawah (ARB) besarnya SAMA sejak 4 September 2023: 35% untuk harga ' +
      'acuan sampai Rp200, 25% untuk Rp200 sampai Rp5.000, dan 20% di atas Rp5.000.',
    ke: '/kalkulator',
    keLabel: 'Kalkulator Pemulihan',
  },
  {
    id: 'papan-pencatatan',
    kunci: ['papan pencatatan', 'papan utama', 'papan pengembangan', 'papan akselerasi'],
    judul: 'Papan pencatatan BEI',
    isi:
      'Emiten BEI tercatat di salah satu dari tiga papan pencatatan — Papan Utama, Papan Pengembangan, dan ' +
      'Papan Akselerasi — masing-masing punya indeks papannya sendiri, bisa dilihat di halaman Sektor & Indeks.',
    ke: '/sector',
    keLabel: 'Sektor & Indeks',
  },

  // ── Kebijakan kontributor (docs/rencana-berjalan.md) ─────────────────────
  {
    id: 'jenjang-kontributor',
    kunci: ['jenjang', 'kuota', 'tier kontributor', 'naik jenjang', 'level kontributor'],
    judul: 'Jenjang kontributor',
    isi:
      'Kontributor PAPAN naik jenjang berdasarkan jumlah setoran disetujui dan akurasi kurasi, dengan kuota ' +
      'setoran harian yang berbeda tiap jenjang. Enam jenjangnya dari terendah: Pemula, Perunggu, Perak, Emas, ' +
      'Platinum, dan Diamond.',
  },
  {
    id: 'pembekuan-kontributor',
    kunci: ['pembekuan', 'akun beku', 'nonaktif otomatis'],
    judul: 'Pembekuan akun kontributor',
    isi:
      'Akun kontributor dibekukan otomatis kalau tak ada setoran apa pun (bukan hanya yang lolos kurasi) dalam ' +
      'jangka waktu tertentu — ambangnya berjenjang, dari 5 hari kerja untuk Pemula sampai 120 hari kerja untuk ' +
      'Diamond, sebagai imbalan atas rekam jejak yang panjang.',
  },
  {
    id: 'kurasi-setoran',
    kunci: ['kurasi', 'setujui setoran', 'revisi setoran', 'aksi kurasi'],
    judul: 'Aksi kurasi setoran',
    isi:
      'Redaksi PAPAN mengurasi tiap setoran dengan tiga aksi: Setujui, Revisi (perbaikan yang tak menghukum ' +
      'akurasi, berkasnya boleh diganti), atau Hapus. Setoran yang dihapus tidak memakan kuota harian dan tidak ' +
      'mengunci emiten itu untuk disetor ulang hari yang sama.',
  },
  {
    id: 'kredit-setoran',
    kunci: ['kredit kontributor', 'dimuat edisi', 'tidak dimuat'],
    judul: 'Kredit kontributor',
    isi:
      'Kredit dan kenaikan jenjang mengikuti setoran yang disetujui, bukan yang akhirnya dimuat di edisi Arus ' +
      'Pasar — dimuat atau tidak adalah keputusan redaksi soal isi edisi, bukan ukuran pekerjaan kontributor.',
    ke: '/bulletin',
    keLabel: 'Bulletin Arus Pasar',
  },
  {
    id: 'istilah-broker-summary',
    kunci: ['broker summary', 'bandarmologi', 'orderbook', 'order book'],
    judul: 'Broker summary (bukan orderbook)',
    isi:
      'Istilah yang benar untuk rekap transaksi broker per emiten adalah "broker summary", bukan "orderbook" — ' +
      'istilah lama itu masih menempel di beberapa nama teknis di balik layar, tapi tak lagi dipakai di teks ' +
      'yang dibaca pengguna.',
    ke: '/broker-summary',
    keLabel: 'Broker Summary',
  },

  // ── Sumber data & istilah pasar ───────────────────────────────────────────
  {
    id: 'sumber-data',
    kunci: ['sumber data', 'dari mana data', 'data dari mana'],
    judul: 'Sumber data PAPAN',
    isi:
      'Data pasar PAPAN berasal dari situs resmi IDX (statistik ringkas harian dan laporan keuangan XBRL per ' +
      'emiten), Yahoo Finance untuk riwayat sebelum 2020, KSEI untuk kepemilikan saham, dan setoran kontributor ' +
      'untuk broker summary.',
  },
  {
    id: 'sumber-data-peran',
    kunci: ['idx atau yahoo', 'kapan pakai yahoo', 'harga buka sejarah'],
    judul: 'IDX vs Yahoo Finance',
    isi:
      'IDX jadi sumber utama untuk hari berjalan dan riwayat sejak awal 2020 (volume, frekuensi, arus asing), ' +
      'sedangkan Yahoo Finance dipakai untuk riwayat sebelum 2020 dan harga pembukaan historis — harga buka ' +
      'dari IDX sendiri sering kosong, terutama sebelum 2025.',
  },
  {
    id: 'istilah-net-foreign',
    kunci: ['net foreign', 'net buy', 'net sell', 'arus asing'],
    judul: 'Net foreign',
    isi:
      'Net foreign adalah selisih nilai beli dan jual investor asing pada suatu periode — positif (net buy) ' +
      'berarti asing lebih banyak membeli, negatif (net sell) berarti lebih banyak menjual.',
    ke: '/indeks',
    keLabel: 'Indeks Dunia',
  },
  {
    id: 'istilah-kapitalisasi-pasar',
    kunci: ['kapitalisasi pasar', 'market cap', 'kapitalisasi'],
    judul: 'Kapitalisasi pasar',
    isi:
      'Kapitalisasi pasar adalah nilai total seluruh saham beredar suatu emiten (harga saham dikali jumlah ' +
      'saham beredar), dipakai untuk mengurutkan emiten berdasarkan ukurannya.',
    ke: '/stocks',
    keLabel: 'Top Stocks',
  },
  {
    id: 'istilah-per-pbv',
    kunci: ['pbv', 'price earning', 'eps', 'valuasi saham'],
    judul: 'PER dan PBV',
    isi:
      'PER (Price Earning Ratio) membandingkan harga saham dengan laba per saham, sedangkan PBV (Price to Book ' +
      'Value) membandingkan harga saham dengan nilai buku per saham — keduanya ukuran valuasi yang ditampilkan ' +
      'di level pasar maupun sektor.',
    ke: '/sector',
    keLabel: 'Sektor & Indeks',
  },
  {
    id: 'istilah-frekuensi-volume',
    kunci: ['frekuensi', 'volume transaksi', 'volume saham'],
    judul: 'Frekuensi dan volume',
    isi:
      'Frekuensi adalah jumlah transaksi (order match) yang terjadi pada suatu saham dalam periode tertentu, ' +
      'sedangkan volume adalah jumlah lembar saham yang berpindah tangan — dua ukuran aktivitas yang berbeda.',
    ke: '/stocks',
    keLabel: 'Top Stocks',
  },
  {
    id: 'istilah-ihsg',
    kunci: ['ihsg', 'indeks harga saham gabungan', 'idx composite'],
    judul: 'IHSG',
    isi:
      'IHSG (Indeks Harga Saham Gabungan) mengukur pergerakan harga seluruh saham yang tercatat di BEI, jadi ' +
      'indikator utama arah pasar saham Indonesia.',
    ke: '/indeks',
    keLabel: 'Indeks Dunia',
  },
  {
    id: 'istilah-hari-bursa',
    kunci: ['hari bursa', 'hari kerja bursa', 'trading day'],
    judul: 'Hari bursa',
    isi:
      'Hari bursa adalah hari BEI buka untuk perdagangan, yaitu Senin sampai Jumat di luar hari libur nasional ' +
      'dan cuti bersama — tanggal setoran kontributor dan perhitungan ambang pasar PAPAN memakai hitungan ini, ' +
      'bukan hari kalender.',
  },
  {
    id: 'istilah-seasonality',
    kunci: ['seasonality', 'musiman', 'pola musiman'],
    judul: 'Seasonality',
    isi:
      'Seasonality adalah pola musiman pergerakan IHSG — misalnya kecenderungan bulan tertentu atau hari ' +
      'tertentu dalam sepekan — dihitung dari data historis, bukan prediksi tunggal untuk periode mendatang.',
  },
  {
    id: 'ambang-menguat-kuat',
    kunci: ['menguat kuat', 'melemah tajam', 'ambang pasar', 'kenapa disebut kuat'],
    judul: 'Kenapa disebut "menguat kuat"',
    isi:
      'Sebutan "menguat kuat" dan "nyaris datar" pada ringkasan harian dihitung dari sejarah gerak harian IHSG ' +
      'sepuluh tahun terakhir (persentil, bukan angka yang ditebak), dan dikalibrasi ulang berkala supaya ' +
      'sebutannya tetap sesuai watak pasar terkini.',
    ke: '/indeks',
    keLabel: 'Papan IHSG',
  },

  // ── "Apa itu <halaman>" — dari menu.ts ruas `ringkas` ────────────────────
  {
    id: 'halaman-indeks-dunia',
    kunci: ['indeks dunia', 'apa itu indeks dunia'],
    judul: 'Indeks Dunia',
    isi: 'Indeks Dunia menampilkan indeks utama dunia dan IHSG dalam satu layar — penutupan, perubahan, dan kalender bursa.',
    ke: '/indeks',
    keLabel: 'Buka Indeks Dunia',
  },
  {
    id: 'halaman-top-stocks',
    kunci: ['top stocks', 'apa itu top stocks'],
    judul: 'Top Stocks',
    isi: 'Top Stocks adalah papan peringkat harian: penggerak indeks, volume terbesar, dan kapitalisasi pasar.',
    ke: '/stocks',
    keLabel: 'Buka Top Stocks',
  },
  {
    id: 'halaman-top-broker',
    kunci: ['top broker', 'apa itu top broker'],
    judul: 'Top Broker',
    isi: 'Top Broker menampilkan broker paling aktif per hari — nilai transaksi, jumlah lot, dan arah bersihnya.',
    ke: '/broker',
    keLabel: 'Buka Top Broker',
  },
  {
    id: 'halaman-sektor-indeks',
    kunci: ['sektor dan indeks', 'apa itu sektor', 'halaman sektor'],
    judul: 'Sektor & Indeks',
    isi: 'Sektor & Indeks menampilkan sebelas sektor IDX dan indeks tematik, diurut berdasarkan kinerja.',
    ke: '/sector',
    keLabel: 'Buka Sektor & Indeks',
  },
  {
    id: 'halaman-chart',
    kunci: ['halaman chart', 'apa itu chart'],
    judul: 'Chart',
    isi: 'Chart menampilkan grafik lilin (candlestick) IHSG dengan rentang sampai 10 tahun dan penanda level kunci.',
    ke: '/chart',
    keLabel: 'Buka Chart',
  },
  {
    id: 'halaman-stock-detail',
    kunci: ['stock detail', 'apa itu stock detail'],
    judul: 'Stock Detail',
    isi: 'Stock Detail membedah satu emiten: harga, laporan keuangan, valuasi, dan arus asing dalam satu halaman.',
    ke: '/stock-detail',
    keLabel: 'Buka Stock Detail',
  },
  {
    id: 'halaman-peta-investor',
    kunci: ['peta investor', 'apa itu peta investor'],
    judul: 'Peta Investor',
    isi: 'Peta Investor menampilkan kepemilikan saham dari data KSEI — asing vs domestik, ritel vs institusi, dan grup konglomerat.',
    ke: '/peta-investor',
    keLabel: 'Buka Peta Investor',
  },
  {
    id: 'halaman-broker-summary',
    kunci: ['apa itu broker summary', 'halaman broker summary'],
    judul: 'Broker Summary',
    isi: 'Broker Summary menampilkan rekap transaksi broker per emiten, ditranskripsi dari setoran kontributor.',
    ke: '/broker-summary',
    keLabel: 'Buka Broker Summary',
  },
  {
    id: 'halaman-kalkulator',
    kunci: ['kalkulator', 'halaman kalkulator', 'apa itu kalkulator'],
    judul: 'Kalkulator',
    isi: 'Kalkulator menghitung average down, target ARA, risk-reward, dividen, dan titik pulih — hasilnya dibulatkan ke fraksi harga bursa.',
    ke: '/kalkulator',
    keLabel: 'Buka Kalkulator',
  },
  {
    id: 'halaman-radar',
    kunci: ['radar', 'radar watchlist', 'wdwl'],
    judul: 'Radar Watchlist',
    isi: 'Radar Watchlist adalah daftar pantau berbasis aturan — emiten yang memenuhi syarat tertentu, bukan tebakan atau rekomendasi.',
    ke: '/radar',
    keLabel: 'Buka Radar',
  },
  {
    id: 'halaman-seasonality',
    kunci: ['seasonality', 'apa itu seasonality', 'halaman seasonality'],
    judul: 'Halaman Seasonality',
    isi: 'Halaman Seasonality menampilkan pola musiman IHSG: bulan, hari dalam sepekan, dan rentang tahun yang bisa dipilih.',
    ke: '/seasonality',
    keLabel: 'Buka Seasonality',
  },
  {
    id: 'halaman-kabar',
    kunci: ['kabar pasar', 'apa itu kabar'],
    judul: 'Kabar Pasar',
    isi: 'Kabar Pasar mengumpulkan berita dan pengumuman resmi IDX, IPOT News, dan Kontan dalam satu aliran — PAPAN menautkan, tidak menyalin isinya.',
    ke: '/kabar',
    keLabel: 'Buka Kabar Pasar',
  },
  {
    id: 'halaman-bulletin',
    kunci: ['bulletin', 'bulletin arus pasar', 'arus pasar', 'terbitan'],
    judul: 'Bulletin Arus Pasar',
    isi: 'Bulletin Arus Pasar adalah arsip edisi Arus Pasar — tinjauan teknikal dan arus dana, lengkap dengan PDF-nya.',
    ke: '/bulletin',
    keLabel: 'Buka Bulletin',
  },
  {
    id: 'halaman-forum',
    kunci: ['halaman forum', 'apa itu forum'],
    judul: 'Forum',
    isi: 'Forum adalah ruang diskusi antar-anggota PAPAN, dikelompokkan per topik.',
    ke: '/forum',
    keLabel: 'Buka Forum',
  },
  {
    id: 'halaman-feedback',
    kunci: ['kritik dan saran', 'apa itu kritik saran'],
    judul: 'Kritik & Saran',
    isi: 'Kritik & Saran adalah jalur untuk menyampaikan koreksi data atau usulan fitur langsung ke redaksi PAPAN.',
    ke: '/feedback',
    keLabel: 'Buka Kritik & Saran',
  },
]

/** Huruf kecil, tanda baca dibuang, spasi dirapikan — sama dengan cara `tanyaPapan.ts` membersihkan input. */
function bersih(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Cari entri pengetahuan yang paling cocok dengan pertanyaan.
 *
 * Skornya jumlah kata kunci yang muncul sebagai substring di pertanyaan yang
 * sudah dibersihkan — BUKAN sekadar "ada satu kata kunci yang cocok". Dua
 * entri boleh berbagi kata kunci yang sama (mis. "seasonality" dipakai baik
 * oleh entri istilah maupun entri halaman); yang menang adalah yang
 * kecocokannya lebih banyak, jadi pertanyaan yang lebih spesifik ("apa itu
 * seasonality") jatuh ke entri yang lebih spesifik juga. Kalau tak ada satu
 * pun yang cocok, kembalikan `null` — jangan menebak entri terdekat.
 */
export function cariPengetahuan(pertanyaan: string): Entri | null {
  const t = bersih(pertanyaan)
  if (!t) return null
  const kata = t.split(' ')

  // Kata kunci SATU kata dicocokkan sebagai kata utuh (bukan substring) —
  // tanpa ini, kunci pendek seperti "ara" ikut cocok di dalam "sekarang".
  //
  // Kunci berupa FRASE dicocokkan sebagai KUMPULAN KATA, bukan potongan huruf
  // berurutan: semua katanya harus ada, urutannya bebas, kata lain boleh
  // menyelip. Versi pertama menuntut frasenya utuh dan berdampingan, dan itu
  // gagal pada cara orang benar-benar bertanya — kunci "data dari mana" tak
  // cocok dengan "data PAPAN dari mana" hanya karena satu kata menyelip di
  // tengah. Terukur: 9 dari 20 pertanyaan wajar tak terjawab, dan sebagian
  // besar entrinya SUDAH ADA, cuma tak tersentuh.
  const cocok = (k: string): boolean => {
    const kb = bersih(k)
    if (!kb.includes(' ')) return kata.includes(kb)
    return kb.split(' ').every((w) => kata.includes(w))
  }

  let terbaik: Entri | null = null
  let skorTerbaik = 0
  let panjangTerbaik = 0
  for (const entri of PENGETAHUAN) {
    const kena = entri.kunci.filter(cocok)
    const skor = kena.length
    // Seri dimenangkan kunci yang PALING PANJANG. Tanpa ini, entri umum
    // "tentang-papan" (kunci satu kata 'papan') mengalahkan entri spesifik
    // "hitung-akurasi" hanya karena urutannya lebih dulu di daftar —
    // pertanyaan yang lebih spesifik justru dijawab yang lebih umum.
    const panjang = kena.reduce((m, k) => Math.max(m, k.length), 0)
    if (skor > skorTerbaik || (skor === skorTerbaik && skor > 0 && panjang > panjangTerbaik)) {
      skorTerbaik = skor
      panjangTerbaik = panjang
      terbaik = entri
    }
  }
  return skorTerbaik > 0 ? terbaik : null
}
