import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ambilVonis, barisSahamDariHakim, jumlahH1, jumlahTpSl, rataPersenTertimbang, tanggalPreset,
  type BerkasJejak, type PresetJejak, type RingkasH1, type RingkasTpSl,
} from './nilaiJejak'

/**
 * Uji KECOCOKAN — inti antrean #7.
 *
 * Sampai 5 Sep 2026 halaman menghitung win rate sendiri di peramban sementara
 * `nilai_jejak.py` menghitungnya di sisi panen, dengan aturan yang berbeda
 * pada kasus ambigu. Sekarang halaman cuma membaca. Uji ini yang membuktikan
 * tak ada kalkulator kedua yang diam-diam hidup lagi: angka yang dirakit
 * modul pembaca untuk satu tanggal harus SAMA PERSIS dengan berkas penilaian
 * yang sudah tersegel untuk tanggal itu.
 *
 * Kalau suatu saat seseorang menambahkan hitungan di peramban "supaya lebih
 * cepat", uji ini merah sebelum angkanya sempat tayang.
 */
const AKAR = join(__dirname, '..', '..', '..', '..', 'data-idx', 'json')
const BERKAS = join(AKAR, 'nilai_jejak.json')
const DIR_PENILAIAN = join(AKAR, 'penilaian')

const ada = existsSync(BERKAS)
const jejak: BerkasJejak | null = ada ? JSON.parse(readFileSync(BERKAS, 'utf-8')) : null

describe('pembaca nilai jejak', () => {
  it('berkas hakim ada dan membawa ketiga definisi', () => {
    expect(jejak, 'nilai_jejak.json harus ada — halaman tak punya cadangan hitungan').not.toBeNull()
    const t = jejak!.perTanggal[0]
    expect(Object.keys(t.definisi).sort()).toEqual(['openTinggi', 'tpSl', 'tutupTutup'])
    expect(t.preset[0].saham.length).toBeGreaterThan(0)
  })

  it('angka yang dirakit pembaca = berkas penilaian tersegel (tanggal tutup terakhir)', () => {
    const tutup = jejak!.perTanggal.filter((t) => t.jendelaTutup)
    expect(tutup.length, 'harus ada tanggal berjendela tutup').toBeGreaterThan(0)
    const t = tutup[tutup.length - 1]
    const p = join(DIR_PENILAIAN, `${t.tanggal}.json`)
    expect(existsSync(p), `penilaian/${t.tanggal}.json harus ada`).toBe(true)
    const segel = JSON.parse(readFileSync(p, 'utf-8'))

    // Yang dirakit pembaca dari rincian per preset — jalur yang BENAR-BENAR
    // dipakai halaman, bukan ruas agregat yang kebetulan sudah jadi.
    const dirakit = jumlahTpSl(t.preset.map((x) => x.definisi.tpSl))
    expect(dirakit.menang).toBe(segel.menang)
    expect(dirakit.kalah).toBe(segel.kalah)
    expect(dirakit.gantung).toBe(segel.gantung)
    expect(dirakit.tak_masuk).toBe(segel.tak_masuk)
    expect(dirakit.ambigu).toBe(segel.ambigu)
    expect(dirakit.menangDariTuntas).toBeCloseTo(segel.menangDariTuntas, 1)
    expect(dirakit.menangDariSemua).toBeCloseTo(segel.menangDariSemua, 1)
  })

  /**
   * Dua berkas ini disegel SEBELUM aturan jeda ada (5 Sep 2026), yaitu pada
   * hari terakhir jendelanya sendiri — saat bar hari itu belum lengkap untuk
   * semua emiten. Angkanya karena itu beda dari hitungan hari ini:
   *
   *   2026-08-27 — segel 41 menang / 29 menggantung, kini 42 / 28
   *
   * Segelnya TIDAK ditimpa: catatan yang sudah terbit tak boleh berubah
   * diam-diam, dan koreksi berupa berkas terpisah (aturan yang sama dengan
   * J14). Yang diperbaiki penyebabnya — `nilai_jejak.py` kini menuntut satu
   * hari bursa JEDA sesudah jendela tutup sebelum menyegel. Daftar ini tidak
   * boleh bertambah; kalau bertambah, aturan jedanya bocor lagi.
   */
  const SEGEL_PRA_JEDA = new Set(['2026-08-27.json'])

  it('tiap berkas penilaian tersegel cocok dengan rincian di berkas hakim', () => {
    const berkas = readdirSync(DIR_PENILAIAN).filter((f) => f.endsWith('.json'))
    expect(berkas.length).toBeGreaterThan(0)
    const menyimpang: string[] = []
    for (const f of berkas) {
      const segel = JSON.parse(readFileSync(join(DIR_PENILAIAN, f), 'utf-8'))
      const t = jejak!.perTanggal.find((x) => x.tanggal === segel.tanggal)
      if (!t) continue
      const dirakit = jumlahTpSl(t.preset.map((x) => x.definisi.tpSl))
      if (dirakit.menang !== segel.menang || dirakit.kalah !== segel.kalah) {
        menyimpang.push(f)
        continue
      }
      expect(SEGEL_PRA_JEDA.has(f), `${f} cocok — keluarkan dari daftar pengecualian`).toBe(false)
    }
    expect(menyimpang.sort(), 'segel yang menyimpang harus persis yang sudah didokumentasikan')
      .toEqual([...SEGEL_PRA_JEDA].sort())
  })
})

describe('penjumlahan tak pernah menilai ulang', () => {
  const h1 = (menang: number, kalah: number, takTerukur: number, rataPersen?: number): RingkasH1 =>
    ({ menang, kalah, takTerukur, winRate: menang + kalah ? (menang / (menang + kalah)) * 100 : null, rataPersen })

  it('winRate H+1 memakai pembagi menang+kalah saja', () => {
    const g = jumlahH1([h1(3, 1, 5), h1(1, 1, 0)])
    expect(g).toEqual({ menang: 4, kalah: 2, takTerukur: 5, winRate: (4 / 6) * 100 })
  })

  it('tak terukur TIDAK dihitung kalah', () => {
    // Kalau tak-terukur pernah bocor jadi kalah, angka ini jatuh ke 50%.
    expect(jumlahH1([h1(1, 0, 1)]).winRate).toBe(100)
  })

  it('TP/SL melaporkan DUA win rate, dan tak masuk ikut pembagi yang kedua', () => {
    const t: RingkasTpSl = {
      menang: 6, kalah: 2, gantung: 1, tak_masuk: 1, ambigu: 0,
      menangDariTuntas: 75, menangDariSemua: 60,
    }
    const g = jumlahTpSl([t])
    expect(g.menangDariTuntas).toBe(75)          // 6 / (6+2)
    expect(g.menangDariSemua).toBe(60)           // 6 / 10
    expect(g.menangDariSemua).toBeLessThan(g.menangDariTuntas!)
  })

  it('rata-rata persen DITIMBANG jumlah terukur, bukan rata-rata dari rata-rata', () => {
    // 20 sinyal +1% dan 1 sinyal +21% → tertimbang mendekati +1,95%,
    // rata-rata polos akan memberi +11%.
    const r = rataPersenTertimbang([h1(20, 0, 0, 1), h1(1, 0, 0, 21)])
    expect(r).toBeCloseTo((20 * 1 + 1 * 21) / 21, 6)
    expect(r).toBeLessThan(3)
  })
})

describe('baris saham', () => {
  const pj: PresetJejak = {
    preset: 'x', n: 2,
    saham: [
      { kode: 'AAAA', tpSl: 'menang', openTinggi: 'kalah', tutupTutup: 'menang', persen: 1.5 },
      { kode: 'BBBB', tpSl: 'tak_masuk', openTinggi: 'menang', tutupTutup: 'kalah', persen: -2 },
    ],
    definisi: {
      openTinggi: { menang: 1, kalah: 1, takTerukur: 0, winRate: 50 },
      tutupTutup: { menang: 1, kalah: 1, takTerukur: 0, winRate: 50, rataPersen: -0.25 },
      tpSl: { menang: 1, kalah: 0, gantung: 0, tak_masuk: 1, ambigu: 0, menangDariTuntas: 100, menangDariSemua: 50 },
    },
  }

  it('vonis datang dari hakim; skor/target dari berkas rekomendasi', () => {
    const ket = new Map([['AAAA', { skor: 0.9, tp1: 120, sl: 90 }]])
    const b = barisSahamDariHakim('2026-09-01', pj, ket)
    expect(b).toHaveLength(2)
    expect(b[0]).toMatchObject({ kode: 'AAAA', tpSl: 'menang', skor: 0.9, tp1: 120 })
    // Sinyal tanpa keterangan tetap muncul dengan vonisnya — vonisnya yang
    // penting, keterangannya cuma kolom tambahan.
    expect(b[1]).toMatchObject({ kode: 'BBBB', tpSl: 'tak_masuk', skor: null, tp1: null })
  })

  it('ambilVonis memilih definisi yang benar', () => {
    const b = barisSahamDariHakim('2026-09-01', pj, new Map())
    expect(ambilVonis(b[0], 'tpSl')).toBe('menang')
    expect(ambilVonis(b[0], 'openTinggi')).toBe('kalah')
    expect(ambilVonis(b[0], 'tutupTutup')).toBe('menang')
  })
})

describe('irisan tanggal', () => {
  it('mengambil N tanggal TERAKHIR, terbaru dulu', () => {
    if (!jejak) return
    const p = jejak.perTanggal[0].preset[0].preset
    const semua = tanggalPreset(jejak, p, 999)
    const dua = tanggalPreset(jejak, p, 2)
    expect(dua).toHaveLength(Math.min(2, semua.length))
    expect(dua[0].tanggal).toBe(semua[0].tanggal)
    if (semua.length > 1) expect(dua[0].tanggal > dua[1].tanggal).toBe(true)
  })
})
