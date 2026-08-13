import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { hitungYtdPct } from '../../lib/dasbor/ytd'
import { BarSesi, fmtMenit, useJamBursa } from './Kalender'

/**
 * Kepala "Gerbang Sesi" (#42 ronde 2, konsep B mockup modal-login-ronde2.html):
 * status sesi bursa live + jam WIB + bar sesi bersegmen 08:45→16:15.
 * Logika jam & sesi satu sumber dengan Kalender (`useJamBursa`/`BarSesi`),
 * tidak ditulis ulang. Komponen terpisah supaya tick per detik tidak
 * me-render ulang form. Saat bursa tutup jam detik DIGANTI info statis
 * pembukaan berikutnya (feedback #2); kelas .tutup mewarnai dot jadi abu.
 */
function SesiHead() {
  const { sessions, START, END, sesi, buka, cursorPct, jam, labelTutup } = useJamBursa()
  return (
    <div className={`login-sesi${buka ? '' : ' tutup'}`}>
      <div className="baris1">
        <span className="status"><i />{sesi?.[0] ?? 'Bursa Tutup'}</span>
        <span className="jam">
          {buka ? <>{jam} <small>WIB</small></> : <small>{labelTutup}</small>}
        </span>
      </div>
      <BarSesi sessions={sessions} aktif={sesi?.[0]} cursorPct={cursorPct} />
      <div className="seglbl"><span>{fmtMenit(START)}</span><span>{fmtMenit(END)}</span></div>
    </div>
  )
}

/**
 * Sparkline IHSG tahun berjalan (elemen konsep A mockup) — SVG polyline dari
 * seri `tanggalTersedia` useDataHarian (index.json), bukan Chart.js. Modal
 * bisa terbuka sebelum index.json termuat: saat seri belum ada render
 * placeholder "—", tinggi seksi sudah di-reserve CSS (min-height
 * .login-spark) jadi layout tidak lompat waktu data masuk.
 */
function SparkIhsg() {
  const { tanggalTersedia } = useDataHarian()
  const tahun = `${new Date().getFullYear()}-`
  const seri = tanggalTersedia.filter((d) => d.date_iso.startsWith(tahun))
  const W = 160
  const H = 44
  let body = <span className="v" style={{ color: 'var(--text3)' }}>—</span>
  if (seri.length >= 2) {
    const vals = seri.map((d) => d.ihsg)
    const min = Math.min(...vals)
    const span = Math.max(...vals) - min || 1
    const pts = vals
      .map((v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${(3 + (1 - (v - min) / span) * (H - 6)).toFixed(1)}`)
      .join(' ')
    const last = seri[seri.length - 1]
    // Reuse hitungYtdPct (ytd.ts) dengan daftar penuh — angka sama persis
    // dengan chip YTD di hero IndeksDunia, bukan hitungan basis sendiri.
    const ytd = hitungYtdPct(last.ihsg, tanggalTersedia) ?? 0
    body = (
      <>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pts} fill="none" stroke="var(--amber)" strokeWidth="1.8" />
          <polygon points={`${pts} ${W},${H} 0,${H}`} fill="var(--amber)" opacity=".14" />
        </svg>
        <span className="v">
          {last.ihsg.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
          <span className={ytd >= 0 ? 'up' : 'dn'}>
            {ytd >= 0 ? '+' : ''}{ytd.toFixed(2).replace('.', ',')}%
          </span>
        </span>
      </>
    )
  }
  return (
    <div className="login-spark">
      <span className="l">IHSG · Tahun Berjalan</span>
      {body}
    </div>
  )
}

/**
 * Gerbang login sebagai modal (bukan halaman terpisah — dipicu dari tombol
 * "Masuk" di Sidebar/MobileNav, lihat DasborLayout). Animasi entrance pola
 * yang sama dengan laci menu telepon (MobileNav): background pudar + kartu
 * naik — tidak disentuh redesain #42. Kepala sesi + sparkline cuma markup
 * tambahan di atas form; seluruh logika submit/error/state tetap sama.
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
          <SesiHead />
          <SparkIhsg />
          <div className="panel-h">
            <span className="lbl">Masuk — Area Admin</span>
            <button type="button" className="dd-btn" onClick={onClose}>Tutup</button>
          </div>
          <form className="panel-b" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="login-sub">Masuk untuk kelola unggahan orderbook &amp; edisi Arus Pasar.</p>
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
