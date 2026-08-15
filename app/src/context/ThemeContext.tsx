import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
/** Pilihan yang dibuat orang — beda dari tema yang akhirnya tampil. */
export type ModeTema = Theme | 'sistem'

interface ThemeContextValue {
  /** Tema yang benar-benar tampil sekarang. */
  theme: Theme
  /** Pilihan tersimpan: 'sistem' berarti ikut setelan perangkat. */
  mode: ModeTema
  setMode: (m: ModeTema) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const KUNCI = 'papan-tema'
const KUERI = '(prefers-color-scheme: dark)'

function bacaMode(): ModeTema {
  try {
    const simpan = localStorage.getItem(KUNCI)
    if (simpan === 'light' || simpan === 'dark' || simpan === 'sistem') return simpan
  } catch {
    /* storage tak tersedia (private mode) — pakai default */
  }
  return 'dark'
}

function temaSistem(): Theme {
  return window.matchMedia(KUERI).matches ? 'dark' : 'light'
}

/**
 * Tema PAPAN — tiga pilihan: Terang, Sistem, Gelap.
 *
 * Sebelumnya cuma dua, dan sakelarnya membalik. Sakelar dua arah memaksa orang
 * memilih salah satu selamanya: yang perangkatnya berganti gelap saat malam
 * tetap melihat PAPAN terang, dan harus membalik sendiri dua kali sehari.
 * "Sistem" mengembalikan keputusan itu ke setelan yang sudah mereka atur
 * sekali di perangkatnya.
 *
 * Default tetap GELAP (keputusan 13 Agu 2026 — identitas PAPAN dark-first,
 * senada kulit bulletin V1), bukan "sistem": halaman gelap yang tiba-tiba
 * terbit putih di siang hari bukan kesan pertama yang dituju.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ModeTema>(bacaMode)
  const [theme, setTheme] = useState<Theme>(() => {
    const m = bacaMode()
    return m === 'sistem' ? temaSistem() : m
  })

  useEffect(() => {
    try {
      localStorage.setItem(KUNCI, mode)
    } catch {
      /* abaikan */
    }
    if (mode !== 'sistem') {
      setTheme(mode)
      return
    }
    // Mode sistem: ikuti setelan perangkat SEKARANG dan setiap kali berubah —
    // tanpa pendengar ini, memilih "Sistem" cuma berlaku sampai pergantian
    // gelap/terang berikutnya, lalu diam-diam basi.
    const mq = window.matchMedia(KUERI)
    const ikut = () => setTheme(mq.matches ? 'dark' : 'light')
    ikut()
    mq.addEventListener('change', ikut)
    return () => mq.removeEventListener('change', ikut)
  }, [mode])

  useEffect(() => {
    // Jaga html[data-tema] tetap sinkron. Skrip boot di index.html memasangnya
    // sekali sebelum React jalan (supaya halaman tidak terbit putih lalu
    // berkedip gelap); tanpa baris ini, mengganti tema tak mengubahnya dan
    // layar tunggu berikutnya memakai warna tema yang lama.
    document.documentElement.dataset.tema = theme
  }, [theme])

  function setMode(m: ModeTema) {
    setModeState(m)
  }

  /** Dipertahankan untuk laci mobile: membalik ke lawan dari yang TAMPAK,
   *  bukan dari yang tersimpan — dari mode sistem, sekali tekan berarti
   *  "kunci ke kebalikan yang sedang kulihat". */
  function toggleTheme() {
    setModeState(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider')
  return ctx
}
