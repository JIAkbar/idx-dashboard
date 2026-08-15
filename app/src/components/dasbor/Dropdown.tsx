import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface OpsiDropdown {
  nilai: string
  label: string
}

interface DropdownProps {
  opsi: OpsiDropdown[]
  nilai: string
  onGanti: (nilai: string) => void
  ariaLabel?: string
  /** Label tombol saat `nilai` tidak ada di `opsi` (mis. Kalender menampilkan bulan berjalan di luar rentang data). */
  placeholder?: string
  /** Kunci interaksi selagi ada aksi in-flight (pola tombol Lantai lain, mis. Sakelar AkunAdmin.tsx). */
  disabled?: boolean
}

/**
 * Dropdown generik dari primitif `.dd`/`.dd-btn`/`.dd-menu`/`.dd-it` lantai.css
 * (#82) — satu komponen menggantikan semua `<select>` native + pola .dd manual
 * yang dulu diduplikasi di Kalender.tsx & BrokerSummary.tsx: buka/tutup klik
 * tombol, klik luar menutup, chevron berputar (CSS `.dd.open`), item terpilih
 * amber (`.sel`). Keyboard: Escape menutup, panah atas/bawah memindah fokus
 * antar item, Enter memilih (klik native tombol terfokus).
 */
export function Dropdown({ opsi, nilai, onGanti, ariaLabel, placeholder, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false)
  // Bug modal Tambah Akun (#3, 15 Agu 2026): dd-menu buka ke BAWAH baku dan
  // menutupi kontrol di bawahnya (mis. tombol submit) di modal pendek. Diukur
  // lewat getBoundingClientRect — kalau ruang bawah tak cukup DAN ruang atas
  // lebih luas, buka ke atas.
  const [bukaAtas, setBukaAtas] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Kueri dibuang tiap menu ditutup. Menyimpannya berarti membuka lagi
    // menampilkan daftar yang sudah tersaring oleh ketikan yang sudah dilupakan,
    // dan itu terbaca sebagai pilihan yang hilang.
    if (!open) { setQ(''); return }
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    // Menu punya max-height + scroll (#79C) — item terpilih bisa jauh di
    // bawah lipatan; gulirkan supaya langsung kelihatan saat menu dibuka.
    ref.current?.querySelector('.dd-it.sel')?.scrollIntoView({ block: 'nearest' })
    // Fokus lewat effect, BUKAN atribut autoFocus: menu selalu ter-mount
    // (disembunyikan CSS), jadi autoFocus akan menyambar fokus sekali saat
    // halaman dimuat dan tak pernah lagi saat menunya benar-benar dibuka.
    ref.current?.querySelector<HTMLInputElement>('.dd-cari')?.focus()
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  useLayoutEffect(() => {
    if (!open) { setBukaAtas(false); return }
    const wadah = ref.current
    const menu = wadah?.querySelector<HTMLElement>('.dd-menu')
    if (!wadah || !menu) return
    const rWadah = wadah.getBoundingClientRect()
    // Batas jatuh = kartu `.panel` terdekat (modal ATAU panel biasa) kalau
    // ada — dropdown dekat ujung modal pendek jangan menutupi kontrol di
    // bawahnya (submit dsb) walau viewport sendiri masih longgar (bug #3).
    // Tanpa `.panel` (dropdown lepas) baru pakai batas viewport.
    const batas = wadah.closest<HTMLElement>('.panel')
    const rBatas = batas?.getBoundingClientRect()
    const batasBawah = rBatas ? rBatas.bottom : window.innerHeight
    const batasAtas = rBatas ? rBatas.top : 0
    const ruangBawah = batasBawah - rWadah.bottom
    const ruangAtas = rWadah.top - batasAtas
    setBukaAtas(ruangBawah < menu.offsetHeight + 8 && ruangAtas > ruangBawah)
  }, [open])

  const label = opsi.find((o) => o.nilai === nilai)?.label ?? placeholder ?? '—'

  // Kotak cari muncul sendiri begitu daftarnya panjang, tanpa perlu disetel di
  // tiap pemanggil. Daftar akun tumbuh seiring kontributor bertambah — kalau
  // penyalaannya manual, yang terjadi adalah dropdown yang tadinya nyaman
  // pelan-pelan jadi tak terpakai tanpa ada yang sadar harus mengubah apa.
  const pakaiCari = opsi.length >= 10
  const kata = q.trim().toLowerCase()
  const tampil = kata ? opsi.filter((o) => o.label.toLowerCase().includes(kata)) : opsi

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      ref.current?.querySelector<HTMLButtonElement>('.dd-btn')?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (!open) {
      setOpen(true)
      return
    }
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.dd-it') ?? [])]
    if (!items.length) return
    // idx -1 (fokus masih di tombol) → panah bawah/atas sama-sama masuk ke item pertama.
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0)
    items[next].focus()
  }

  return (
    <div className={`dd${open ? ' open' : ''}${bukaAtas ? ' dd-atas' : ''}`} ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="dd-btn"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="dd-menu" role="listbox" aria-label={ariaLabel}>
        {pakaiCari && (
          <input
            className="dd-cari"
            value={q}
            placeholder="Cari…"
            aria-label={`Cari ${ariaLabel ?? 'pilihan'}`}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter mengambil hasil teratas: mengetik tiga huruf lalu menekan
              // Enter jauh lebih cepat daripada mengetik lalu meraih tetikus.
              if (e.key === 'Enter' && tampil[0]) {
                e.preventDefault()
                onGanti(tampil[0].nilai)
                setOpen(false)
              }
            }}
          />
        )}
        {pakaiCari && tampil.length === 0 && <p className="dd-kosong">Tak ada yang cocok.</p>}
        {tampil.map((o) => (
          <button
            key={o.nilai}
            type="button"
            role="option"
            aria-selected={o.nilai === nilai}
            className={`dd-it${o.nilai === nilai ? ' sel' : ''}`}
            onClick={() => {
              onGanti(o.nilai)
              setOpen(false)
              // Item yang barusan diklik ikut tersembunyi (menu display:none) —
              // tanpa ini fokus jatuh ke <body> dan navigasi keyboard mati.
              ref.current?.querySelector<HTMLButtonElement>('.dd-btn')?.focus()
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
