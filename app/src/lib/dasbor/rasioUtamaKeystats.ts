/**
 * Lima rasio yang sumber UTAMANYA dirotasi ke keystats Stockbit (#36 A).
 *
 * Keputusan Johan 8 Sep 2026 sesudah tabel pembanding 3b (12 ruas × 15
 * emiten): kelompok "aman sekarang" dirotasi, kelompok pe/eps/roe/der_q/
 * price_fcf/f_score DITAHAN.
 *
 * ## Kenapa cuma lima, dan kenapa enam lainnya tidak
 *
 * Median rasio keystats÷lama nyaris 1,00 untuk hampir semua ruas, tapi
 * SEBARANNYA yang menentukan. Lima ruas di sini rapat di seluruh sampel.
 * Enam yang ditahan tidak:
 *
 * * `eps` — UNVR 97,93 (lama) vs 221,63 (keystats) = 2,26×; SMGR 1,65×.
 * * `pe` — bergerak berlawanan di emiten yang SAMA (UNVR 17,21 vs 7,53),
 *   karena pe = harga ÷ eps: satu perselisihan yang sama, bukan dua.
 * * `f_score` — berselisih SISTEMATIS (median 1,40; ACES 2 vs 6): dua
 *   implementasi Piotroski yang berbeda, bukan beda skala.
 *
 * Akar keduanya satu: dua sumber memakai laba TTM yang berbeda. Itu kelas
 * jebakan yang sudah tercatat di CLAUDE.md — kuartal diskret vs interim
 * kumulatif, yang kalau digabung memberi angka nyaris dua kali lipat tanpa
 * satu pun galat. Memilih sumber yang salah di situ menggandakan laba di
 * layar; karena itu ia menunggu keputusan definisi, bukan diputuskan di sini.
 *
 * ## Sumber lama tidak dibuang
 *
 * Aturan 3c: yang terlengkap jadi utama, yang lama jadi CADANGAN bertanda.
 * `pilihRasio` mengembalikan asalnya bersama angkanya supaya layar bisa
 * menyatakannya per angka — pola yang sama dengan `LencanaTurunan`.
 */

/** Nama rasio di berkas keystats, per ruas fundamental yang dirotasi. */
export const PETA_KEYSTATS = {
  // Ruas di berkas fundamental bernama `pb`, bukan `pbv` - kunci di sini
  // sengaja mengikuti NAMA RUASNYA supaya pemanggil tak perlu menerjemahkan.
  pb: 'Current Price to Book Value',
  ps: 'Current Price to Sales (TTM)',
  asset_turnover: 'Asset Turnover (TTM)',
  dividend_yield: 'Dividend Yield',
  altman_z: 'Altman Z-Score (Modified)',
} as const

export type RuasRotasi = keyof typeof PETA_KEYSTATS

export type AsalRasio = 'keystats' | 'cadangan-lama'

export interface RasioTerpilih {
  nilai: number | null
  /** null kalau kedua sumber kosong — tak ada yang perlu ditandai. */
  asal: AsalRasio | null
}

/**
 * Angka utama dari keystats; kalau kosong, angka lama dipakai APA ADANYA dan
 * ditandai cadangan.
 *
 * Nol dari keystats dihitung sebagai nilai yang sah (rasio memang bisa nol);
 * yang dianggap "tak ada" hanya `null`/`undefined`/NaN. Membuang nol akan
 * diam-diam memilih sumber lama untuk emiten yang rasionya memang nol.
 */
export function pilihRasio(
  ruas: RuasRotasi,
  lama: number | null | undefined,
  keystats: Record<string, number | null> | null | undefined,
): RasioTerpilih {
  const baru = keystats?.[PETA_KEYSTATS[ruas]]
  if (baru != null && Number.isFinite(baru)) return { nilai: baru, asal: 'keystats' }
  if (lama != null && Number.isFinite(lama)) return { nilai: lama, asal: 'cadangan-lama' }
  return { nilai: null, asal: null }
}

/** Keterangan hover per asal — dipakai lencana di layar. */
export const JUDUL_ASAL: Record<AsalRasio, string> = {
  keystats:
    'Rasio resmi dari penyedia data pasar — sumber utama sejak 8 September 2026',
  'cadangan-lama':
    'Angka cadangan: penyedia utama tidak memuat rasio ini untuk emiten ini, jadi dipakai sumber lama',
}
