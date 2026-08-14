import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { jejakLogin } from '../lib/jejakLogin'
import { pesanAuth } from '../lib/pesanAuth'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // BUG (Alt+Tab mengosongkan modal, lihat catatan di bawah): supabase-js
      // memasang listener `visibilitychange` sendiri (GoTrueClient) dan
      // memanggil _recoverAndRefresh() SETIAP kali tab kembali fokus — bukan
      // cuma saat token betulan mau kedaluwarsa. Itu memicu event ini
      // (TOKEN_REFRESHED/SIGNED_IN) dengan objek `session` BARU walau user-nya
      // sama persis. Kalau kita selalu `setSession(newSession)`, referensi
      // `session` di context berubah tiap alt-tab → useProfilSaya (bergantung
      // pada `[session]`) retrigger effect-nya → `loading` sempat balik true
      // → halaman admin (AkunAdmin dkk, pola `if (profilLoading) return <p/>`)
      // me-remount SELURUH subtree-nya, termasuk modal form yang sedang
      // terbuka — state input di dalamnya hilang. Diukur di browser: sebelum
      // perbaikan ini, dispatch 'visibilitychange' ke 'visible' pada tab yang
      // sudah alt-tab keluar-masuk memicu remount FormTambahAkun (hitungan
      // mount effect naik); sesudah perbaikan, referensi session dipertahankan
      // untuk user yang sama sehingga tidak ada remount.
      //
      // Perbaikannya: pertahankan referensi `session` LAMA kalau user-nya
      // sama (hanya token yang disegarkan di belakang layar) — konsumen yang
      // depend on `[session]` tidak retrigger. Ganti referensi hanya kalau
      // usernya beda atau sesi benar-benar hilang (SIGNED_OUT → null).
      setSession((prev) => (prev && newSession && prev.user.id === newSession.user.id ? prev : newSession))
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    // Fase 4 — jejak login (IP & user agent dicatat di SERVER dari header
    // request, bukan dikirim dari sini). Fire-and-forget: kegagalan
    // pencatatan tidak boleh menghalangi proses masuk.
    jejakLogin(!error, email, data.user?.id)
    // Pesan Supabase berbahasa Inggris teknis; terjemahkan sebelum sampai ke
    // layar (lihat lib/pesanAuth.ts).
    return { error: pesanAuth(error?.message) }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
