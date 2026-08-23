/**
 * Kelompok identitas broker — dasar pewarnaan Broker Summary v2. Port
 * LANGSUNG dari `KURASI`/`KELAS` di artifact rancangan "Arus Broker BUMI"
 * (mockup yang disetujui Johan, 22 Agu 2026) — enam kelompok, bukan lima:
 * `asing`, `bumn`, `smart` (Smart Money), `ritel`, `afiliasi` (grup/bandar),
 * `lain`. Kode di luar daftar jatuh ke `lain`, bukan galat.
 *
 * Warna sengaja BUKAN hijau/merah — dua warna itu sudah dipakai arti
 * beli/jual (`--beli`/`--jual` di lantai.css) di tabel yang sama; memakainya
 * ulang untuk identitas kelompok akan bentrok makna pada kolom yang
 * berdampingan. Nilai tokennya sendiri (`--k-*`) didefinisikan di
 * `lantai.css` (light & dark), sama seperti mockup.
 */

import { bacaTokenTema } from './useChartJs'

export type KelompokBroker = 'asing' | 'bumn' | 'smart' | 'ritel' | 'afiliasi' | 'lain'

export const LABEL_KELOMPOK: Record<KelompokBroker, string> = {
  asing: 'Asing',
  bumn: 'BUMN',
  smart: 'Smart Money',
  ritel: 'Ritel',
  afiliasi: 'Afiliasi grup / bandar',
  lain: 'Lainnya',
}

export const KETERANGAN_KELOMPOK: Record<KelompokBroker, string> = {
  asing: 'sekuritas berinduk luar negeri',
  bumn: 'sekuritas bank pelat merah',
  smart: 'institusi lokal non-ritel',
  ritel: 'basis nasabah perorangan besar',
  afiliasi: 'satu grup usaha dengan emiten — BUMI: belum ada yang terkurasi',
  lain: 'belum dikurasi',
}

/** Token CSS (`--k-*`, lantai.css) — jalan pintas dipakai warnaBroker(). */
const TOKEN_KELOMPOK: Record<KelompokBroker, string> = {
  asing: '--k-asing', bumn: '--k-bumn', smart: '--k-smart',
  ritel: '--k-ritel', afiliasi: '--k-afiliasi', lain: '--k-lain',
}

/** Nama kode → [kelompok, nama sekuritas] — kurasi awal 22 Agu 2026 (mockup). */
const KURASI: Record<string, [KelompokBroker, string]> = {
  // asing — sekuritas berinduk luar negeri
  AK: ['asing', 'UBS'], BK: ['asing', 'J.P. Morgan'], KZ: ['asing', 'CLSA'],
  RX: ['asing', 'Macquarie'], ZP: ['asing', 'Maybank'], YU: ['asing', 'CGS International'],
  TP: ['asing', 'OCBC'], AI: ['asing', 'UOB Kay Hian'], DR: ['asing', 'RHB'],
  BQ: ['asing', 'Korea Investment'], XA: ['asing', 'NH Korindo'], AG: ['asing', 'Kiwoom'],
  HD: ['asing', 'KGI'], GA: ['asing', 'Yuanta'], DP: ['asing', 'DBS Vickers'], RB: ['asing', 'Nikko'],
  // bumn — sekuritas bank pelat merah
  CC: ['bumn', 'Mandiri Sekuritas'], NI: ['bumn', 'BNI Sekuritas'],
  OD: ['bumn', 'BRI Danareksa'], DX: ['bumn', 'Bahana'],
  // smart — institusi lokal non-ritel
  LG: ['smart', 'Trimegah'], SQ: ['smart', 'BCA Sekuritas'], AZ: ['smart', 'Sucor'],
  SS: ['smart', 'Samuel'], HP: ['smart', 'Henan Putihrai'], MG: ['smart', 'Semesta Indovest'],
  AT: ['smart', 'Phintraco'], PO: ['smart', 'Pilarmas'], RF: ['smart', 'Buana Capital'],
  YJ: ['smart', 'Lotus Andalan'], GR: ['smart', 'Panin'], KI: ['smart', 'Ciptadana'],
  DH: ['smart', 'Sinarmas'], EP: ['smart', 'MNC'], CD: ['smart', 'Mega Capital'],
  LS: ['smart', 'Reliance'], ES: ['smart', 'Ekokapital'], MU: ['smart', 'Minna Padi'],
  MI: ['smart', 'Victoria'], AO: ['smart', 'Erdikha'], TF: ['smart', 'Universal Broker'],
  BR: ['smart', 'Trust'], FZ: ['smart', 'Waterfront'], IT: ['smart', 'Inti Fikasa'],
  SH: ['smart', 'Artha'], PC: ['smart', 'FAC'], ID: ['smart', 'Anugerah'],
  YB: ['smart', 'Jasa Utama'], ZR: ['smart', 'Bumiputera'], EL: ['smart', 'Evergreen'],
  RS: ['smart', 'Yulie'], PG: ['smart', 'Panca Global'], SF: ['smart', 'Surya Fajar'],
  AF: ['smart', 'Harita Kencana'], AP: ['smart', 'Pacific'],
  // ritel — basis nasabah perorangan besar
  PD: ['ritel', 'Indo Premier'], YP: ['ritel', 'Mirae Asset'], XC: ['ritel', 'Ajaib'],
  XL: ['ritel', 'Stockbit Sekuritas'], CP: ['ritel', 'Valbury'], KK: ['ritel', 'Phillip'],
  // afiliasi — kosong untuk BUMI di kurasi awal
  // ── Dua belas kode yang sebelumnya tampil tanpa nama (23 Agu 2026) ────────
  //
  // Namanya diambil dari data broker level pasar BURSA yang sudah kita panen
  // sendiri, bukan dari daftar pihak ketiga — sebelas dari dua belas ada di
  // sana lengkap dengan nama resminya. Golongannya diambil dari ruas `type`
  // pada rincian broker (Lokal/Asing/Pemerintah), diukur atas 62 berkas.
  //
  // Yang Lokal DIBIARKAN 'lain', bukan ditebak jadi 'smart' atau 'ritel':
  // sumbernya tak membedakan keduanya, dan menebaknya berarti mengarang
  // identitas yang lalu tampil sebagai fakta di layar.
  AR: ['lain', 'Binaartha Sekuritas'],
  BB: ['lain', 'Verdhana Sekuritas Indonesia'],
  BS: ['lain', 'Equity Sekuritas Indonesia'],
  FS: ['asing', 'Yuanta Sekuritas Indonesia'],
  IF: ['lain', 'Samuel Sekuritas Indonesia'],
  IU: ['lain', 'Indo Capital Sekuritas'],
  // JB tak pernah muncul di satu pun berkas broker bursa yang kita punya;
  // namanya dari penelusuran web, jadi keyakinannya lebih rendah daripada
  // sebelas lainnya. Ganti kalau ketemu di sumber resmi.
  JB: ['lain', 'BJB Sekuritas'],
  PI: ['lain', 'Magenta Kapital Sekuritas Indonesia'],
  QA: ['lain', 'Tuntun Sekuritas Indonesia'],
  RG: ['lain', 'Profindo Sekuritas Indonesia'],
  RO: ['lain', 'Pluang Maju Sekuritas'],
  TS: ['lain', 'Dwidana Sakti Sekuritas'],
}

/** Kelompok identitas kode broker; belum dikurasi → `lain`. */
export function kelompokBroker(kode: string): KelompokBroker {
  return KURASI[kode]?.[0] ?? 'lain'
}

/** Nama sekuritas dari kode; belum dikurasi → `'belum dikurasi'` (teks mockup). */
export function namaBroker(kode: string): string {
  return KURASI[kode]?.[1] ?? 'belum dikurasi'
}

/** Warna (var CSS `--k-*`) langsung dari kode broker. */
export function warnaBroker(kode: string): string {
  return warnaKelompok(kelompokBroker(kode))
}

/** Warna (var CSS `--k-*`) langsung dari kelompok — dipakai legenda/Broker Analysis. */
export function warnaKelompok(kelompok: KelompokBroker): string {
  return `var(${TOKEN_KELOMPOK[kelompok]})`
}

/** Kelas CSS `k-<kelompok>` — dipakai mewarnai teks kode broker di tabel (pola mockup). */
export function kelasBroker(kode: string): string {
  return `k-${kelompokBroker(kode)}`
}

/**
 * Warna NYATA (hex, bukan `var(...)`) — dipakai borderColor/backgroundColor
 * Chart.js, yang menggambar ke `<canvas>` dan tak bisa mengurai `var(...)`
 * (lihat `bacaTokenTema`). `warnaKelompok()`/`warnaBroker()` di atas TETAP
 * ada apa adanya untuk pemakai DOM/CSS (legenda, teks kode broker).
 */
export function warnaKelompokCanvas(kelompok: KelompokBroker): string {
  return bacaTokenTema(TOKEN_KELOMPOK[kelompok])
}

export function warnaBrokerCanvas(kode: string): string {
  return warnaKelompokCanvas(kelompokBroker(kode))
}
