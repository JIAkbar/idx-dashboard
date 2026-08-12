import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Placeholder statis buat pita ticker rim modal (#39 opsi 2) — modal bisa
 * muncul independen dari halaman dasbor manapun, sebelum data indeks hari itu
 * ke-load, jadi dekorasi ini TIDAK fetch data (over-engineering buat elemen
 * dekoratif). Angka contoh wajar: IHSG ~5.500-5.900, saham blue-chip biasa.
 */
const TICKER_PLACEHOLDER: { nama: string; nilai: number; delta: number }[] = [
  { nama: 'IHSG', nilai: 5687.42, delta: 0.38 },
  { nama: 'BBCA', nilai: 9850, delta: 0.51 },
  { nama: 'BBRI', nilai: 4320, delta: -0.46 },
  { nama: 'TLKM', nilai: 3180, delta: 0.32 },
  { nama: 'ASII', nilai: 4980, delta: -0.6 },
]

/** Reuse persis kelas `.dasbor-tk`/`.dasbor-num`/`up`/`dn` dari pita header
 * (PitaKurs.tsx) — cuma bungkusnya (`.login-tk-rim`) yang beda: lebih pendek
 * & lebih cepat karena kartu modal ~320px, bukan full-width. */
function TickerRim() {
  const deret = TICKER_PLACEHOLDER.map((x, i) => (
    <span className="dasbor-tk" key={i}>
      <b>{x.nama}</b>
      <span className="dasbor-num">
        {x.nilai.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={'dasbor-num ' + (x.delta >= 0 ? 'up' : 'dn')}>
        {x.delta >= 0 ? '▲' : '▼'} {x.delta >= 0 ? '+' : '−'}
        {Math.abs(x.delta).toFixed(2).replace('.', ',')}%
      </span>
      <span className="dasbor-tk-sep">|</span>
    </span>
  ))
  return (
    <div className="login-tk-rim" aria-hidden="true">
      <div className="login-tk-rim-track">
        {deret}
        {deret}
      </div>
    </div>
  )
}

/**
 * Gerbang login sebagai modal (bukan halaman terpisah — dipicu dari tombol
 * "Masuk" di Sidebar/MobileNav, lihat DasborLayout). Animasinya pola yang
 * sama dengan laci menu telepon (MobileNav): background pudar + kartu naik,
 * bukan modal statis. Pita ticker di atas kartu (`TickerRim`) cuma dekorasi
 * tambahan, tidak mengubah animasi entrance yang sudah ada.
 */
export function LoginModal({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) { setError(error); return }
    onClose()
    navigate('/admin')
  }

  return (
    <div className="dasbor-modal-bg" onClick={onClose}>
      <div className="lantai dasbor-modal" role="dialog" aria-modal="true" aria-label="Masuk" onClick={(e) => e.stopPropagation()}>
        <div className="panel">
          <TickerRim />
          <div className="panel-h">
            <span className="lbl">Masuk — Area Admin</span>
            <button type="button" className="dd-btn" onClick={onClose}>Tutup</button>
          </div>
          <form className="panel-b" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <span className="lbl">Email</span>
              <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <span className="lbl">Kata sandi</span>
              <input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--red)' }}>{error}</p>}
            <button type="submit" className="btn-p" disabled={submitting}>
              {submitting ? 'Memproses…' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
