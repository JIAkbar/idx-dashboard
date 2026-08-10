import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/admin" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError(error)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-band">
          <div className="login-brand">ARUS PASAR</div>
          <div className="login-eyebrow">Area Admin</div>
        </div>
        <form className="login-body" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Kata sandi
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Memproses…' : 'Masuk'}
          </button>
          <Link to="/" className="login-back">← Kembali ke dasbor publik</Link>
        </form>
      </div>
    </div>
  )
}
