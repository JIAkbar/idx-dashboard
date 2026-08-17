import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { muatDaftarHariBursa, tanggalBursaTerakhir as tanggalHariIni } from '../lib/tanggalBursa'


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

  // Daftar hari bursa sungguhan dimuat sekali di sini karena provider ini
  // membungkus SEMUA tab admin — satu permintaan melayani Unggah dan Kurasi.
  // Gagal muat diabaikan: hariBursa() tetap menjawab dengan akhir pekan +
  // tanggal merah, dan layar tak boleh berhenti karena satu JSON.
  //
  // ponytail: tanggal awal di atas sudah dihitung sebelum daftarnya datang dan
  // TIDAK dihitung ulang setelahnya. Tanggal merah yang sudah terdaftar sudah
  // ikut sejak awal; yang meleset cuma libur dadakan yang belum tercatat di
  // HOLIDAYS — perbaiki dengan menghitung ulang kalau itu benar-benar terjadi.
  useEffect(() => { muatDaftarHariBursa().catch(() => {}) }, [])

  return <AdminTanggalContext.Provider value={{ tanggal, setTanggal }}>{children}</AdminTanggalContext.Provider>
}

export function useAdminTanggal() {
  const ctx = useContext(AdminTanggalContext)
  if (!ctx) throw new Error('useAdminTanggal harus dipakai di dalam AdminTanggalProvider')
  return ctx
}
