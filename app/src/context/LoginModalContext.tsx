import { createContext, useContext, type ReactNode } from 'react'

interface LoginModalValue {
  buka: () => void
}

const Ctx = createContext<LoginModalValue | undefined>(undefined)

/** Dipasang DasborLayout (pemilik state `loginOpen`) — biar halaman/komponen
 *  bersarang mana pun (mis. kartu kerangka terkunci PenjagaHalaman.tsx) bisa
 *  memicu modal Masuk yang sama tanpa gali prop lewat banyak lapis. */
export function LoginModalProvider({ buka, children }: { buka: () => void; children: ReactNode }) {
  return <Ctx.Provider value={{ buka }}>{children}</Ctx.Provider>
}

/** `undefined` kalau dipanggil di luar DasborLayout — pemanggil harus
 *  toleransi itu (mis. sembunyikan tombol Masuk kalau context tak ada). */
export function useLoginModalOpsional(): LoginModalValue | undefined {
  return useContext(Ctx)
}
