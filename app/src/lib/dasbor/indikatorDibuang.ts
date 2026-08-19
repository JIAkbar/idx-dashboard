/* DIHASILKAN `node scripts/audit-indikator.mjs --tulis` — jangan disunting tangan.
   Vonis mekanis atas OHLC nyata (BBCA + ARCI), pustaka
   lightweight-charts-indicators 0.5.0.
   Laporan penuh 457 baris: docs/riset/audit-indikator.tsv.

   Kenapa daftar HASIL dan bukan penyaringan saat jalan: menghitung 457 rumus
   atas ribuan lilin di peramban demi menyaring menu berarti membayar seluruh
   biaya indikator yang justru sedang dibuang.

   Kenapa daftar BUANGAN dan bukan daftar IZIN: entri baru di versi pustaka
   berikutnya harus tetap muncul di menu. Daftar izin membuatnya lenyap
   diam-diam sampai ada yang ingat menjalankan audit ini lagi. */

/** Melempar galat, mengembalikan kunci plot yang tak diumumkannya, memberi
 *  waktu di luar deret lilin, atau nol nilai berhingga. Ditambahkan ke menu,
 *  ia muncul di legenda dan tak pernah menggambar apa pun. */
export const ID_RUSAK: ReadonlySet<string> = new Set([
  'volume-flow-indicator', // BBCA: 7407 nilai NaN/Infinity, nol berhingga
  'all-candlestick-patterns', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'binary-option-arrows', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'bullish-engulfing-finder', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'candlestick-reversal', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'cm-price-action', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'isolated-peak-bottom', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'reversal-candle-setup', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'wicked-fractals', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'predictive-channels', // BBCA: 12345 nilai NaN/Infinity, nol berhingga
  'tweezers-kangaroo-tail', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'swing-highs-lows-patterns', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'trend-line-auto', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'volume-footprint', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
  'hott-lott', // BBCA: 4938 nilai NaN/Infinity, nol berhingga
  'multiple-divergences', // BBCA: 2469 nilai NaN/Infinity, nol berhingga
])

/** Menggambar, tapi tak ada yang bisa dilihat: nilainya konstan sepanjang
 *  deret (garis lurus sempurna), atau ia overlay yang seluruh nilainya
 *  jatuh di luar pita harga emiten sehingga digambar di luar layar. */
export const ID_MATI: ReadonlySet<string> = new Set([
  'chop-zone', // BBCA: konstan 1.000000000 sepanjang 2469 titik
  'easy-trend-colors', // BBCA: overlay, 9756 nilainya seluruhnya di luar pita harga 2790-10950 — digambar di luar layar
  'tops-bottoms', // BBCA: overlay, 4938 nilainya seluruhnya di luar pita harga 2790-10950 — digambar di luar layar
])

/** Dibuang dari katalog. Keduanya sama tak bergunanya di layar; dipisah di
 *  atas supaya audit berikutnya bisa melihat mana yang berpindah kelompok. */
export const ID_DIBUANG: ReadonlySet<string> = new Set([...ID_RUSAK, ...ID_MATI])
