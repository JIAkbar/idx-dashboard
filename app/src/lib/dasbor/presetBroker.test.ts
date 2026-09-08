import { describe, it, expect } from 'vitest'
import { mulaiPreset, presetBerlaku, PRESET_BROKER } from './brokerEmitenV2'
import { pakaiDropdown, AMBANG_PIL } from '../../components/dasbor/PemilihRentang'

// Hari bursa 2026: Senin–Jumat, 1 Januari libur. Sengaja dimulai 2 Jan supaya
// preset YTD (yang mentahnya 1 Januari) tidak pernah jatuh tepat di hari ada.
const HARI_2026 = (() => {
  const out: string[] = []
  const d = new Date('2026-01-01T12:00:00Z')
  while (d.toISOString().slice(0, 10) <= '2026-09-08') {
    const iso = d.toISOString().slice(0, 10)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6 && iso !== '2026-01-01') out.push(iso)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
})()

describe('mulaiPreset', () => {
  it('YTD mulai di hari BERDATA pertama, bukan 1 Januari yang libur', () => {
    // Inilah bug yang membuat panah geser diam: 2026-01-01 tak ada di daftar
    // hari berdata, jadi indexOf(dari) menjawab -1 dan tombolnya tak berbuat apa-apa.
    expect(mulaiPreset('ytd', '2026-09-08', HARI_2026)).toBe('2026-01-02')
    expect(HARI_2026.includes(mulaiPreset('ytd', '2026-09-08', HARI_2026))).toBe(true)
  })

  it('setiap preset selalu jatuh di hari yang benar-benar ada datanya', () => {
    for (const p of PRESET_BROKER) {
      const mulai = mulaiPreset(p.id, '2026-09-08', HARI_2026)
      expect(HARI_2026.includes(mulai), `preset ${p.id} -> ${mulai}`).toBe(true)
    }
  })

  it('preset lebih panjang daripada arsipnya jatuh ke hari terawal yang ada', () => {
    expect(mulaiPreset('y2', '2026-09-08', HARI_2026)).toBe(HARI_2026[0])
  })

  it('Hari Ini berarti satu hari: mulai = akhir', () => {
    expect(mulaiPreset('hariini', '2026-09-08', HARI_2026)).toBe('2026-09-08')
  })

  it('tanpa daftar hari berdata, tanggal kalender mentah dikembalikan apa adanya', () => {
    expect(mulaiPreset('ytd', '2026-09-08')).toBe('2026-01-01')
  })
})

describe('presetBerlaku', () => {
  const akhir = HARI_2026[HARI_2026.length - 1]

  it('rentang hasil klik preset dikenali kembali sebagai rentang yang sama', () => {
    for (const p of PRESET_BROKER) {
      const mulai = mulaiPreset(p.id, akhir, HARI_2026)
      const kena = presetBerlaku(mulai, akhir, HARI_2026)
      expect(kena, `preset ${p.id}`).not.toBe('')
      // Bukan `toBe(p.id)`: di arsip yang lebih pendek daripada presetnya, YTD,
      // 1 Tahun, dan 2 Tahun semuanya jatuh di hari terawal yang sama. Yang
      // dijanjikan fungsi ini rentangnya, bukan nama yang dipilih di antara
      // beberapa nama untuk satu rentang yang identik.
      expect(mulaiPreset(kena as typeof p.id, akhir, HARI_2026)).toBe(mulai)
    }
  })

  it('rentang bebas tidak menyalakan preset mana pun', () => {
    // Dulu tampilannya menambal ini dengan tebakan tetap `preset ?? 'b1'`,
    // sehingga setiap geseran panah menyala sebagai "1 Bulan".
    expect(presetBerlaku('2026-03-11', '2026-04-15', HARI_2026)).toBe('')
  })

  it('ujung kanan yang bergeser mundur juga tidak menyalakan preset', () => {
    const sebelum = HARI_2026[HARI_2026.length - 2]
    expect(presetBerlaku(sebelum, sebelum, HARI_2026)).toBe('')
  })

  it('daftar kosong menjawab kosong, bukan melempar', () => {
    expect(presetBerlaku('2026-01-02', '2026-09-08', [])).toBe('')
  })
})

describe('pakaiDropdown', () => {
  it('auto: menu hanya di layar sempit dan hanya kalau pilihannya lebih dari ambang', () => {
    expect(pakaiDropdown('auto', true, AMBANG_PIL + 1)).toBe(true)
    expect(pakaiDropdown('auto', true, AMBANG_PIL)).toBe(false)
    expect(pakaiDropdown('auto', false, 9)).toBe(false)
  })

  it('pil dan dropdown memaksa bentuknya, lebar layar diabaikan', () => {
    expect(pakaiDropdown('pil', true, 9)).toBe(false)
    expect(pakaiDropdown('dropdown', false, 2)).toBe(true)
  })
})
