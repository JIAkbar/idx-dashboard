import { describe, expect, it } from 'vitest'
import { namaTampil } from './namaTampil'

describe('namaTampil', () => {
  it('alias ada → alias', () => {
    expect(namaTampil({ alias: 'Agitama', email: 'agit@papan.id' }, { user: { email: 'agit@papan.id' } })).toBe('Agitama')
  })

  it('alias kosong/null → email', () => {
    expect(namaTampil({ alias: null, email: 'agit@papan.id' }, null)).toBe('agit@papan.id')
    expect(namaTampil({ alias: '  ', email: 'agit@papan.id' }, null)).toBe('agit@papan.id')
  })

  it('profil belum termuat → email dari session', () => {
    expect(namaTampil(null, { user: { email: 'agit@papan.id' } })).toBe('agit@papan.id')
  })

  it('tak ada apa-apa → tanda strip', () => {
    expect(namaTampil(null, null)).toBe('—')
  })
})
