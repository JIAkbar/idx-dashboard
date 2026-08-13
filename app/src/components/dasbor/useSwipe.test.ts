import { describe, expect, it } from 'vitest'
import { arahSwipe } from './useSwipe'

describe('arahSwipe (#97)', () => {
  it('swipe kiri ≥40px = maju (1)', () => expect(arahSwipe(-40, 0)).toBe(1))
  it('swipe kanan ≥40px = mundur (-1)', () => expect(arahSwipe(55, -10)).toBe(-1))
  it('di bawah threshold = null', () => expect(arahSwipe(-39, 0)).toBeNull())
  it('dominan vertikal = null (scroll halaman)', () => expect(arahSwipe(45, 60)).toBeNull())
})
