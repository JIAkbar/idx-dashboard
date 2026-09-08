import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Ruas yang ditulis penyegar harga harian wajib punya pembaca di aplikasi.
 *
 * Kegagalan yang diuji di sini sudah terjadi dan berlangsung 17 hari tanpa
 * satu pun galat: pemanen mulai menulis `pbv` dan `harga_pada` tiap hari
 * bursa, layar tak pernah membacanya, dan halaman terus memajang P/BV dari
 * harga bulan lalu sambil menulis tanggal panen laporan keuangan sebagai
 * "terakhir diperbarui". Data benar, tampilan salah, nol alarm.
 *
 * Ujinya sengaja kasar — cuma "ada yang menyebut nama ruasnya" — karena yang
 * dijaga bukan cara pemakaiannya melainkan keberadaan pemakainya sama sekali.
 */
const RUAS_WAJIB_TERBACA = ['pbv', 'harga_pada', 'harga_disegarkan'] as const

function berkasSumber(dir: string, hasil: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama)
    if (statSync(jalur).isDirectory()) berkasSumber(jalur, hasil)
    else if (/\.(ts|tsx)$/.test(nama) && !nama.endsWith('.test.ts')) hasil.push(jalur)
  }
  return hasil
}

describe('ruas hasil penyegaran harga', () => {
  const sumber = berkasSumber(join(__dirname, '..', '..'))

  it.each(RUAS_WAJIB_TERBACA)('`%s` dibaca setidaknya satu berkas aplikasi', (ruas) => {
    const pemakai = sumber.filter((f) => readFileSync(f, 'utf8').includes(ruas))
    expect(pemakai.length, `tak ada berkas app/src yang menyebut \`${ruas}\``).toBeGreaterThan(0)
  })
})
