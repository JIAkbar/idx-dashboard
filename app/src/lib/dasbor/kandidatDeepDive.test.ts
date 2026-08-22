import { describe, expect, it } from 'vitest'
import { ambilKandidat, petaKandidat, type DataKandidatDeepDive, type KandidatEmiten } from './kandidatDeepDive'

function emitenDasar(over: Partial<KandidatEmiten> = {}): KandidatEmiten {
  return {
    kode: 'DILD', skor: 6, sinyal: [{ nama: 'volume di atas normal', bukti: 'volume 1,7x normal' }],
    harga: 120, likuiditas: 1.2e9, ret10: 1.7, rvol_med: 1.7, efisiensi: 1.0, net_asing_20h: 8.8e6,
    tanggal: '2026-08-21',
    ...over,
  }
}

function dataDasar(emiten: KandidatEmiten[]): DataKandidatDeepDive {
  return {
    diperbarui: '2026-08-22 07:11', tanggal: '2026-08-21',
    ambang: { skor_min: 4, likuiditas_min: 1e9, jendela: 10 },
    catatan: 'penyaring, bukan peringkat', n: emiten.length, emiten,
  }
}

describe('petaKandidat', () => {
  it('memetakan kode ke entri', () => {
    const data = dataDasar([emitenDasar({ kode: 'DILD' }), emitenDasar({ kode: 'BUMI', skor: 4 })])
    const peta = petaKandidat(data)
    expect(peta.get('DILD')?.skor).toBe(6)
    expect(peta.get('BUMI')?.skor).toBe(4)
    expect(peta.size).toBe(2)
  })

  it('data null/kosong/rusak menghasilkan peta kosong, bukan lempar galat', () => {
    expect(petaKandidat(null).size).toBe(0)
    expect(petaKandidat(dataDasar([])).size).toBe(0)
    expect(petaKandidat({} as DataKandidatDeepDive).size).toBe(0)
  })
})

describe('ambilKandidat', () => {
  it('fetch gagal (404) mengembalikan null', async () => {
    const fetch404 = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
    await expect(ambilKandidat(fetch404)).resolves.toBeNull()
  })

  it('fetch lempar error jaringan mengembalikan null', async () => {
    const fetchGagal = (async () => { throw new Error('network down') }) as unknown as typeof fetch
    await expect(ambilKandidat(fetchGagal)).resolves.toBeNull()
  })

  it('fetch sukses mengembalikan isi apa adanya', async () => {
    const isi = dataDasar([emitenDasar()])
    const fetchOk = (async () => new Response(JSON.stringify(isi), { status: 200 })) as unknown as typeof fetch
    await expect(ambilKandidat(fetchOk)).resolves.toEqual(isi)
  })
})
