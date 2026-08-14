import { createContext, useContext, useState, type ReactNode } from 'react'

function tanggalHariIni(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface AdminTanggalValue {
  tanggal: string
  setTanggal: (t: string) => void
}

const AdminTanggalContext = createContext<AdminTanggalValue | undefined>(undefined)

/** Tanggal "panggung" aktif dibagi lintas tab admin (Unggah Harian ↔ Kurasi
 *  Setoran, #shell-tab) — pindah tab tidak mereset tanggal yang sedang
 *  dikerjakan. Provider dipasang sekali di AdminLayout, di atas <Outlet/>. */
export function AdminTanggalProvider({ children }: { children: ReactNode }) {
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  return <AdminTanggalContext.Provider value={{ tanggal, setTanggal }}>{children}</AdminTanggalContext.Provider>
}

export function useAdminTanggal() {
  const ctx = useContext(AdminTanggalContext)
  if (!ctx) throw new Error('useAdminTanggal harus dipakai di dalam AdminTanggalProvider')
  return ctx
}
