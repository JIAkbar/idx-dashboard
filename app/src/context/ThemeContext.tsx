import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const KUNCI = 'papan-tema'

/**
 * Default GELAP (keputusan user 13 Agu 2026 — identitas PAPAN dark-first,
 * senada kulit bulletin V1). Pilihan toggle disimpan ke localStorage supaya
 * user yang memilih terang tidak perlu toggle ulang tiap reload.
 * (Perilaku lama port index_live: default light tanpa persist — diganti sadar.)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const simpan = localStorage.getItem(KUNCI)
      if (simpan === 'light' || simpan === 'dark') return simpan
    } catch {
      /* storage tak tersedia (private mode) — pakai default */
    }
    return 'dark'
  })

  useEffect(() => {
    try {
      localStorage.setItem(KUNCI, theme)
    } catch {
      /* abaikan */
    }
  }, [theme])

  function toggleTheme() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider')
  return ctx
}
