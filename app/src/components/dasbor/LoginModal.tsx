import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Gerbang login sebagai modal (bukan halaman terpisah — dipicu dari tombol
 * "Masuk" di Sidebar/MobileNav, lihat DasborLayout). Animasinya pola yang
 * sama dengan laci menu telepon (MobileNav): background pudar + kartu naik,
 * bukan modal statis.
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
