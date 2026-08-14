import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { alasanKunci, alasanSingkat, bolehBukaKunci, type AlasanKunci, type HalamanSaya } from '../lib/aksesHalaman'
import { daftarJenjang, type JenjangRow } from '../lib/jenjang'

interface AksesHalamanValue {
  /** `null` selagi memuat/gagal — `boleh()`/`alasan()` fail-open selama ini. */
  daftar: HalamanSaya[] | null
  boleh: (kunci: string) => boolean
  alasan: (kunci: string) => AlasanKunci
  alasanRingkas: (kunci: string) => string
}

const Ctx = createContext<AksesHalamanValue | undefined>(undefined)

/**
 * Satu sumber hasil `halaman_saya()` (RPC, sekali per sesi) dipakai bersama
 * PenjagaHalaman (guard rute) & badge gembok Sidebar/LaciMobile — supaya
 * cuma satu request, bukan satu per halaman/menu. Dipasang membungkus SELURUH
 * <Routes/> di App.tsx (di dalam AuthProvider, di luar ThemeProvider) supaya
 * tersedia baik di rute dasbor publik maupun /admin.
 */
export function AksesHalamanProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const [daftar, setDaftar] = useState<HalamanSaya[] | null>(null)
  const [jenjang, setJenjang] = useState<JenjangRow[]>([])

  useEffect(() => {
    if (authLoading) return
    let batal = false
    supabase.rpc('halaman_saya').then(({ data, error }) => {
      if (batal) return
      setDaftar(error ? [] : ((data ?? []) as HalamanSaya[]))
    })
    // Tabel `jenjang` cuma boleh dibaca yang login (RLS) — anon dilewati
    // supaya tak ada request yang pasti ditolak server tiap pengunjung publik.
    if (session) {
      daftarJenjang().then((j) => !batal && setJenjang(j)).catch(() => {})
    }
    return () => {
      batal = true
    }
  }, [session, authLoading])

  function namaTier(tier: number): string {
    return jenjang.find((j) => j.tier === tier)?.nama ?? `tier ${tier}`
  }

  const value: AksesHalamanValue = {
    daftar,
    boleh: (kunci) => bolehBukaKunci(daftar, kunci),
    alasan: (kunci) => alasanKunci(daftar, kunci, Boolean(session), namaTier),
    alasanRingkas: (kunci) => alasanSingkat(daftar, kunci, Boolean(session), namaTier),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAksesHalaman() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAksesHalaman harus dipakai di dalam AksesHalamanProvider')
  return ctx
}
