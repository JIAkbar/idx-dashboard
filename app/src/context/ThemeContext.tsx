import { createContext, useContext, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * Port dari setTheme()/toggleTheme() index_live.html baris 3394-3406.
 * Catatan: kode asli TIDAK menyimpan pilihan ke localStorage — theme selalu
 * reset ke "light" (default `<html data-theme="light">`) tiap reload. Port
 * ini sengaja mempertahankan perilaku itu apa adanya, bukan menambah fitur
 * persist yang tidak ada di sumber.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

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
