/**
 * Kelompok identitas broker — dasar pewarnaan Broker Summary v2
 * (docs/riset/gedanggoreng-bongkar.md §3). Kurasi awal 22 Agu 2026, 17 kode
 * dari 88+ yang pernah muncul di data BUMI — kode di luar daftar jatuh ke
 * `lain`, bukan galat. Daftarnya sengaja pendek dan gampang diperluas: cukup
 * tambah baris di `KODE_KELOMPOK`, pemanggil (tabel, chart) tak perlu
 * berubah.
 *
 * Warna sengaja BUKAN hijau/merah — dua warna itu sudah dipakai arti
 * beli/jual (`--beli`/`--jual` di lantai.css) di tabel yang sama; memakainya
 * ulang untuk identitas kelompok akan bentrok makna pada kolom yang
 * berdampingan (persis kenapa mockup broker-summary-mockup.template.html
 * juga menghindarinya untuk token `--k-*`).
 */

export type KelompokBroker = 'asing' | 'institusi' | 'ritel' | 'mix' | 'lain'

export const LABEL_KELOMPOK: Record<KelompokBroker, string> = {
  asing: 'Foreign / Smartmoney',
  institusi: 'Institutional / Whale',
  ritel: 'Retail',
  mix: 'Mix',
  lain: 'Lainnya',
}

export const WARNA_KELOMPOK: Record<KelompokBroker, string> = {
  asing: '#3B82F6',
  institusi: '#8B5CF6',
  ritel: '#14B8A6',
  mix: '#D9A017',
  lain: '#8C94A1',
}

const KODE_KELOMPOK: Record<string, KelompokBroker> = {
  BK: 'asing', ZP: 'asing', AK: 'asing', KZ: 'asing', RX: 'asing',
  NI: 'institusi', OD: 'institusi', DR: 'institusi', HD: 'institusi',
  YP: 'ritel', PD: 'ritel', XC: 'ritel', CC: 'ritel',
  DH: 'mix', GR: 'mix', LG: 'mix', MG: 'mix',
}

/** Kelompok identitas kode broker; belum dikurasi → `lain`. */
export function kelompokBroker(kode: string): KelompokBroker {
  return KODE_KELOMPOK[kode] ?? 'lain'
}

/** Warna langsung dari kode broker — jalan pintas `WARNA_KELOMPOK[kelompokBroker(kode)]`. */
export function warnaBroker(kode: string): string {
  return WARNA_KELOMPOK[kelompokBroker(kode)]
}
