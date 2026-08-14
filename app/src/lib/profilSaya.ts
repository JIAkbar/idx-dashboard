import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

export interface ProfilSaya {
  id: string
  email: string
  alias: string | null
  peran: 'superadmin' | 'kontributor'
  kuota_harian: number
  boleh_bedah: boolean
  aktif: boolean
}

/**
 * Profil baris sendiri (tabel `profil`, RLS: user cuma boleh baca baris
 * sendiri) — dasar UI sadar-peran di form unggah (kuota, izin Bedah) dan
 * guard superadmin di /admin/akun. `null` selagi memuat ATAU belum login.
 */
export function useProfilSaya() {
  const { session } = useAuth()
  const [profil, setProfil] = useState<ProfilSaya | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setProfil(null)
      setLoading(false)
      return
    }
    let batal = false
    setLoading(true)
    supabase
      .from('profil')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (!batal) {
          setProfil(data as ProfilSaya | null)
          setLoading(false)
        }
      })
    return () => {
      batal = true
    }
  }, [session])

  return { profil, loading }
}
