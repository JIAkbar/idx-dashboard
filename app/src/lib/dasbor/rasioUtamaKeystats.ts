/**
 * Rasio yang sumber UTAMANYA dirotasi ke keystats Stockbit.
 *
 * Dua gelombang, dua keputusan Johan (aturan 3c: sumber terlengkap jadi utama):
 *
 * * #36 A, 8 Sep 2026 — P/BV, P/S, Asset Turnover, Div Yield, Altman Z.
 * * #36 opsi 1, 13 Sep 2026 — kelompok laba TTM: P/E, EPS, ROE, Earnings Yield.
 *   Wasitnya laporan keuangan resmi bursa: EPS TTM keystats berada dalam ±5%
 *   dari laba yang diatribusikan ÷ saham bursa di 636 dari 725 emiten, sumber
 *   lama 479 dari 715. Titik belahnya definisi, bukan kesegaran: keystats
 *   memakai laba yang diatribusikan termasuk pos tak berulang, jadi emiten
 *   seperti UNVR tampil lebih murah (P/E 7,35 lawan 16,89 di sumber lama).
 * * #189 A, 14 Sep 2026 — P/E (Annualised) dan Forward P/E. Ruas lama
 *   `pe_annualised` ternyata P/E TTM berlabel lain (identik di 596 dari 600
 *   emiten), jadi ruas itu dirotasi TANPA cadangan: pemanggilnya memberi
 *   `lama` null. Forward P/E punya cadangan bertanda (70 emiten hanya punya
 *   angka lama). EPS Forward tak punya padanan di keystats dan tetap sumber lama.
 *
 * `der_q`, `price_fcf`, dan `f_score` tetap DITAHAN: skalanya, definisi arus
 * kasnya, dan implementasi Piotroski-nya berbeda — bukan soal laba TTM.
 * Angka pengukuran dan cakupannya ada di referensi proyek, bagian J16 dan J17.
 *
 * ## Sumber lama tidak dibuang
 *
 * Yang lama jadi CADANGAN bertanda. `pilihRasio` mengembalikan asalnya bersama
 * angkanya supaya layar bisa menyatakannya per angka — pola yang sama dengan
 * `LencanaTurunan`.
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
  pe: 'Current PE Ratio (TTM)',
  eps: 'Current EPS (TTM)',
  roe: 'Return on Equity (TTM)',
  earn_yield: 'Earnings Yield (TTM)',
  pe_annualised: 'Current PE Ratio (Annualised)',
  forward_pe: 'Forward PE Ratio',
} as const

export type RuasRotasi = keyof typeof PETA_KEYSTATS

export type AsalRasio = 'keystats' | 'cadangan-lama'

/** Peta rasio keystats apa adanya; null saat berkasnya tak ada. */
export type PetaRasio = Record<string, number | null> | null

export interface RasioTerpilih {
  nilai: number | null
  /** null kalau kedua sumber kosong — tak ada yang perlu ditandai. */
  asal: AsalRasio | null
}

/**
 * Pengali yang menyamakan satuan ruas LAMA dengan keystats. `roe` di berkas
 * fundamental berupa rasio (0,218), di keystats persen (21,5): median keystats
 * ÷ (lama × 100) 0,9836 atas 880 emiten (13 Sep 2026). Tanpa pengali ini angka
 * cadangan tampil 100× terlalu kecil tanpa satu pun galat.
 */
const SKALA_LAMA: Partial<Record<RuasRotasi, number>> = { roe: 100 }

/**
 * ROE 0 di keystats bukan laba nol: ke-49 emiten ber-ROE 0,00% (13 Sep 2026)
 * semuanya tanpa EPS dan ber-ROA 0,00% juga, dan 48 di antaranya punya ROE
 * bukan nol di sumber lama. Nol di ruas ini tanda "tak dihitung".
 */
function kosongDiKeystats(ruas: RuasRotasi, v: number): boolean {
  return ruas === 'roe' && v === 0
}

/**
 * P/E dari laba negatif tidak bermakna, dan sumber lama sudah mengosongkannya:
 * penyegar harga hanya menghitung P/E saat EPS positif. Keystats memuat angka
 * negatif untuk 290 emiten rugi (13 Sep 2026). Sumber lama TIDAK dipakai
 * sebagai gantinya: 42 dari 290 emiten itu masih memegang P/E positif yang
 * basi di sana, padahal sumber utama sudah menyatakan rugi.
 *
 * Berlaku untuk ketiga P/E sejak #189: P/E annualised keystats juga negatif
 * untuk 290 emiten (14 Sep 2026), dan Forward P/E sumber lama negatif di 4.
 */
function takBermakna(ruas: RuasRotasi, v: number): boolean {
  return (ruas === 'pe' || ruas === 'pe_annualised' || ruas === 'forward_pe') && v <= 0
}

/**
 * Angka utama dari keystats; kalau kosong, angka lama dipakai (dikali
 * `SKALA_LAMA` supaya satuannya sama) dan ditandai cadangan.
 *
 * Nol dari keystats dihitung sebagai nilai yang sah (rasio memang bisa nol);
 * yang dianggap "tak ada" hanya `null`/`undefined`/NaN, kecuali ROE (lihat
 * `kosongDiKeystats`). Membuang nol akan diam-diam memilih sumber lama untuk
 * emiten yang rasionya memang nol.
 *
 * P/E dari laba negatif dikembalikan `null` bertanda sumber utama, TANPA jatuh
 * ke cadangan (lihat `takBermakna`). P/E cadangan yang negatif dikembalikan
 * kosong tanpa asal: tak ada angka yang tayang, jadi tak ada yang ditandai.
 */
export function pilihRasio(
  ruas: RuasRotasi,
  lama: number | null | undefined,
  keystats: Record<string, number | null> | null | undefined,
): RasioTerpilih {
  const baru = keystats?.[PETA_KEYSTATS[ruas]]
  if (baru != null && Number.isFinite(baru) && !kosongDiKeystats(ruas, baru)) {
    return { nilai: takBermakna(ruas, baru) ? null : baru, asal: 'keystats' }
  }
  if (lama != null && Number.isFinite(lama)) {
    const v = lama * (SKALA_LAMA[ruas] ?? 1)
    return takBermakna(ruas, v) ? { nilai: null, asal: null } : { nilai: v, asal: 'cadangan-lama' }
  }
  return { nilai: null, asal: null }
}

/** Teks rasio keystats → angka: "5.32%" → 5,32 · "-17,434.73" → −17.434,73 ·
 *  "(3.2)" → −3,2 · kosong, "-", atau "N/A" → null. */
export function angka(v: unknown): number | null {
  if (v == null) return null
  const s = String(v).trim()
  if (s === '' || s === '-' || s === 'N/A') return null
  const neg = s.startsWith('(') && s.endsWith(')')
  const bersih = s.replace(/[()]/g, '').replace(/,/g, '').replace(/%/g, '').trim()
  const n = parseFloat(bersih)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

/** Peta rasio satu-ruas, untuk pemanggil yang cuma punya SATU angka keystats
 *  (kartu analisa membawa `pb_keystats`, `pe_keystats`, dan `roe_keystats`,
 *  bukan seluruh berkas 94 rasio).
 *
 *  Ada supaya nama ruas mentahnya tidak perlu dieja di halaman: satu tempat
 *  yang tahu ejaannya, sama seperti `pilihRasio`. Nilai berbentuk teks dibaca
 *  lewat `angka()`: kartu yang dibangun sebelum 13 Sep 2026 menyimpan
 *  `pb_keystats` sebagai teks ("2.88"), dan `Number.isFinite` menolak teks,
 *  sehingga P/BV kartu selalu jatuh ke cadangan tanpa satu pun galat. */
export function petaRasio(
  ruas: RuasRotasi,
  nilai: number | string | null | undefined,
): Record<string, number | null> | null {
  const n = typeof nilai === 'string' ? angka(nilai) : nilai
  return n != null && Number.isFinite(n) ? { [PETA_KEYSTATS[ruas]]: n } : null
}

/** Keterangan hover per asal — dipakai lencana di layar. */
export const JUDUL_ASAL: Record<AsalRasio, string> = {
  keystats:
    'Rasio resmi dari penyedia data pasar — sumber utama (lima rasio sejak 8 September 2026, kelompok laba TTM sejak 13 September 2026, P/E annualised dan forward sejak 14 September 2026)',
  'cadangan-lama':
    'Angka cadangan: penyedia utama tidak memuat rasio ini untuk emiten ini, jadi dipakai sumber lama',
}

/** Keterangan hover untuk rasio yang penyedia utamanya tak punya padanan sama sekali: angkanya dari
 *  sumber lama untuk semua emiten. Sejak #189 tinggal EPS Forward (keystats hanya memuat EPS annualised). */
export const JUDUL_TANPA_PADANAN =
  'Angka sumber lama: penyedia utama tidak memuat rasio ini, jadi dipakai sumber lama untuk semua emiten'
