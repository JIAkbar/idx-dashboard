import type { ModeTema } from '../../context/ThemeContext'

const IKON: Record<ModeTema, string> = {
  light: 'M12 8.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4',
  sistem: 'M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM9 20h6M12 16v4',
  dark: 'M20.5 14.6A8.5 8.5 0 019.4 3.5a8.5 8.5 0 1011.1 11.1z',
}

const LABEL: Array<[ModeTema, string, string]> = [
  ['light', 'Terang', 'Selalu terang'],
  ['sistem', 'Sistem', 'Ikut setelan perangkat'],
  ['dark', 'Gelap', 'Selalu gelap'],
]

/**
 * Pemilih tema tiga pilihan, disusun bertumpuk supaya muat di rail selebar
 * 76px. Bukan sakelar dua arah lagi: sakelar memaksa orang memilih satu tema
 * selamanya, sementara "Sistem" mengembalikan keputusannya ke setelan yang
 * sudah mereka atur sekali di perangkat.
 *
 * Ketiganya selalu terlihat — pemilih yang menyembunyikan pilihan lain di
 * balik satu ikon membuat orang harus menekan berkali-kali untuk tahu apa
 * saja yang ada.
 */
export function PilihTema({ mode, setMode }: { mode: ModeTema; setMode: (m: ModeTema) => void }) {
  return (
    <div className="pilih-tema" role="radiogroup" aria-label="Tema tampilan">
      {LABEL.map(([nilai, teks, ket]) => (
        <button
          key={nilai}
          type="button"
          role="radio"
          aria-checked={mode === nilai}
          className={'pilih-tema-it' + (mode === nilai ? ' on' : '')}
          title={ket}
          onClick={() => setMode(nilai)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d={IKON[nilai]} fill="none" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{teks}</span>
        </button>
      ))}
    </div>
  )
}
