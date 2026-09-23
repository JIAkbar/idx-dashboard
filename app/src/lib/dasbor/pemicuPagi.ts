/**
 * Sakelar per pemicu Kartu Pagi (#236 opsi A). Disimpan di localStorage,
 * pola sama dengan `watchlist.ts` — satu-satunya modul yang menyentuh kunci
 * ini, komponen tak perlu tahu bentuk penyimpanannya.
 */

export type Pemicu = 'pembeli-berganti' | 'tembus-ma20' | 'asing-beruntun' | 'dekat-stop'

export const URUTAN_PEMICU: Pemicu[] = ['pembeli-berganti', 'tembus-ma20', 'asing-beruntun', 'dekat-stop']

export const LABEL_PEMICU: Record<Pemicu, string> = {
  'pembeli-berganti': 'Pembeli terbesar berganti',
  'tembus-ma20': 'Tembus MA20',
  'asing-beruntun': 'Asing beruntun ≥ 5 hari',
  'dekat-stop': 'Mendekati stop (< 3%)',
}

export type SetelanPemicu = Record<Pemicu, boolean>

const KUNCI = 'papan-pemicu-pagi'

function bawaan(): SetelanPemicu {
  return { 'pembeli-berganti': true, 'tembus-ma20': true, 'asing-beruntun': true, 'dekat-stop': true }
}

/** Muat setelan tersimpan. Kunci tak dikenal/rusak diabaikan; bawaan = keempatnya aktif. */
export function muatPemicu(): SetelanPemicu {
  try {
    const raw = localStorage.getItem(KUNCI)
    if (!raw) return bawaan()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return bawaan()
    const hasil = bawaan()
    for (const p of URUTAN_PEMICU) {
      if (typeof (parsed as Record<string, unknown>)[p] === 'boolean') hasil[p] = (parsed as Record<string, boolean>)[p]
    }
    return hasil
  } catch {
    return bawaan()
  }
}

export function simpanPemicu(setelan: SetelanPemicu): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(setelan))
  } catch {
    /* localStorage tak tersedia — perubahan cuma hidup di state React sesi ini */
  }
}
