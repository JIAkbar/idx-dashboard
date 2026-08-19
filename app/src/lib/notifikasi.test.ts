import { beforeEach, describe, expect, it, vi } from 'vitest'
import { daftarNotifikasi, tandaiSemuaDibaca } from './notifikasi'
import { supabase } from './supabase'

vi.mock('./supabase', () => {
  const auth = { getUser: vi.fn() }
  const from = vi.fn()
  return { supabase: { auth, from } }
})

beforeEach(() => { vi.clearAllMocks() })

/** Query builder Supabase palsu: tiap metode mencatat argumennya lalu
 *  mengembalikan diri sendiri (chainable), `then` menutup rantai seperti
 *  `await` sungguhan. */
function queryPalsu(hasil: { data: unknown; error: unknown }) {
  const panggilan: Record<string, unknown[]> = {}
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'or', 'order', 'limit', 'eq', 'is', 'update']) {
    b[m] = (...a: unknown[]) => { panggilan[m] = a; return b }
  }
  b.then = (resolve: (v: typeof hasil) => void) => resolve(hasil)
  return { b, panggilan }
}

const UID_JOHAN = 'uid-johan'

describe('daftarNotifikasi', () => {
  it('kueri mengandung .or(untuk.eq.<uid>,untuk.is.null) — bukan .select("*") polos', async () => {
    // Regresi bf552eb4: versi lama tak memfilter apa pun di kueri dan
    // mengandalkan RLS, yang tembus untuk superadmin (notifikasi_kelola_superadmin
    // bertipe ALL) — lonceng menampilkan notifikasi pribadi SEMUA kontributor.
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: UID_JOHAN } },
    } as never)
    const { b, panggilan } = queryPalsu({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(b as never)

    await daftarNotifikasi()

    expect(panggilan.or).toEqual([`untuk.eq.${UID_JOHAN},untuk.is.null`])
  })

  it('tanpa user login → kosong, tak memanggil Supabase sama sekali', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null } } as never)
    const hasil = await daftarNotifikasi()
    expect(hasil).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('tandaiSemuaDibaca', () => {
  it('menyaring .eq("untuk", uid) — kunci yang SAMA dengan daftarNotifikasi', async () => {
    // Bug B: dulu kueri ini dan daftarNotifikasi() memang sudah sama-sama
    // memakai uid, tapi karena daftarNotifikasi() tak pernah memfilter apa
    // pun, baris yang tampil di panel bukan baris yang cocok dengan filter
    // ini — tombol "Tandai semua" cocok NOL baris, sukses tanpa efek,
    // lencana tetap menyala. Mengunci kesamaan kunci ini mencegah keduanya
    // bercerai lagi diam-diam.
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: UID_JOHAN } },
    } as never)
    const { b, panggilan } = queryPalsu({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(b as never)

    await tandaiSemuaDibaca()

    expect(panggilan.eq).toEqual(['untuk', UID_JOHAN])
    expect(panggilan.is).toEqual(['dibaca_pada', null])
  })
})
