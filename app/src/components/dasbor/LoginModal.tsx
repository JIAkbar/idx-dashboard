import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { KolomSandi } from './KolomSandi'
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

/** Nomor WhatsApp pengelola PAPAN, format internasional tanpa tanda plus
 *  (0899… → 62899…) — bentuk yang diminta wa.me. */
const WA_ADMIN = '628990447098'
/** Channel pengumuman PAPAN — rilis fitur publik & halaman baru diumumkan di
 *  sini. Disisipkan ke dalam pesan registrasi (WA_PESAN), bukan jadi tautan
 *  tersendiri di modal. */
const WA_CHANNEL = 'https://whatsapp.com/channel/0029VbBJN5y7j6gB0S4zFW1R'
/** Isi pesan yang sudah terketik saat tombol daftar ditekan. Tautan channel
 *  ikut di dalamnya, bukan berdiri sebagai tautan sendiri di modal: begitu
 *  pesan terkirim, calon kontributor punya link itu di riwayat chatnya sendiri
 *  dan bisa membukanya kapan pun tanpa kembali ke halaman ini. */
const WA_PESAN = [
  'Halo, saya mau Registrasi PAPAN — Pusat Analisa Pasar Nusantara.',
  '',
  'Nama saya: ',
  '',
  `Channel kabar fitur PAPAN: ${WA_CHANNEL}`,
].join('\n')

/**
 * Isi panel "Benefit kontributor".
 *
 * Semua butir di bawah adalah yang BENAR-BENAR berlaku hari ini, diambil dari
 * dua tabel yang menegakkannya: `akses_halaman` (halaman mana terbuka setelah
 * login, dan jenjang minimum tiap halaman) dan `jenjang` (kuota + hak tiap
 * tier). Tidak ada janji fitur yang belum jalan — halaman pendaftaran yang
 * menjanjikan lebih dari yang ditegakkan server akan ketahuan di hari pertama.
 */
const BENEFIT_LOGIN = [
  ['Radar WDWL', 'Layar pantau emiten yang sedang diawasi, plus arsip pemindaian lama.'],
  ['Peta Investor', 'Pemegang saham di atas 1% dari data KSEI: siapa masuk, siapa keluar.'],
  ['Broker Summary', 'Arus broker harian — inventory, kuadran, nego, dan alur dana.'],
  ['Bedah Arus Saham', 'PDF satu emiten satu edisi: bacaan orderbook + distribusi harga.'],
  ['Forum tanpa batas', 'Tamu dibatasi 5 pesan sehari. Akun aktif menulis sepuasnya.'],
  // Butir ini menyebut yang PALING membedakan PAPAN, jadi ditaruh terakhir —
  // posisi yang paling diingat dalam daftar. Kalimatnya sengaja menyebut
  // "frekuensi historis", bukan "prediksi": angkanya memang dihitung dari
  // kejadian masa lalu, dan menjanjikan lebih dari itu akan jadi janji palsu
  // yang ketahuan pada perdagangan pertama.
  ['Sistem terukur, bukan feeling',
    'Tiap emiten dinilai lima komponen — teknikal, arus broker, risk/reward, likuiditas, kepekaan IHSG — lalu diuji ke frekuensi historisnya: berapa sering setup serupa berakhir naik.'],
]

/** [nama, kuota harian, hak tambahan] — urut tier 0..5. */
const BENEFIT_JENJANG = [
  ['Pemula', 1, 'Semua halaman anggota'],
  ['Perunggu', 2, 'Riwayat kontribusi + lencana'],
  ['Perak', 3, 'Ekspor XLS Peta Investor'],
  ['Emas', 5, 'Probabilitas & VolVal + arsip PDF lama'],
  ['Platinum', 8, 'Boleh setor bahan Bedah'],
  ['Diamond', 12, 'Nama di bulletin + usul emiten prioritas'],
] as const

/**
 * Panel benefit — dipakai sebagai muka kedua modal masuk, bukan halaman
 * terpisah: orang yang berhenti di gerbang login justru sedang bertanya
 * "kenapa saya harus punya akun", jadi jawabannya harus ada di layar yang
 * sama, bukan di balik satu klik keluar.
 */
function PanelBenefit({ kembali }: { kembali: () => void }) {
  return (
    <div className="panel-b login-benefit">
      <p className="login-sub" style={{ marginBottom: 4 }}>
        Akun PAPAN tidak dijual. Kamu mendapatkannya dengan menyetor orderbook —
        makin banyak setoran yang lolos kurasi, makin banyak yang terbuka.
      </p>

      <div className="lb-blok">
        <span className="lb-judul">Langsung terbuka begitu akun aktif</span>
        <ul>
          {BENEFIT_LOGIN.map(([nama, ket]) => (
            <li key={nama}><b>{nama}</b><span>{ket}</span></li>
          ))}
        </ul>
      </div>

      <div className="lb-blok">
        <span className="lb-judul">Naik jenjang → kuota &amp; hak ikut naik</span>
        <ul className="lb-jenjang">
          {BENEFIT_JENJANG.map(([nama, kuota, hak]) => (
            <li key={nama}>
              <span className="lb-tier">{nama}</span>
              <span className="lb-kuota">{kuota}/hari</span>
              <span className="lb-hak">{hak}</span>
            </li>
          ))}
        </ul>
        <p className="lb-kaki">
          Jenjang naik sendiri dari <b>jumlah setoran yang disetujui</b> kurasi dan akurasinya —
          bukan dari lama berlangganan. Aliasmu tercantum di kolofon PDF tiap edisi yang memuat setoranmu.
        </p>
      </div>

      {/* Tombol utama panel: kuning selebar panel (keputusan 15 Agu) — panel
          benefit ujungnya tetap mengajak masuk, jadi jalan kembali ke formulir
          pantas jadi ajakan paling menonjol, bukan tombol kecil rata kanan. */}
      <button type="button" className="btn-p lb-kembali" onClick={kembali}>
        Kembali ke masuk
      </button>
      <a
        className="login-daftar"
        href={`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(WA_PESAN)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Siap bergabung? <b>Daftar lewat WhatsApp</b>
      </a>
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
  /** Modal punya dua muka: formulir masuk dan daftar benefit. */
  const [benefit, setBenefit] = useState(false)

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
          {/* Status bursa & sparkline adalah konteks untuk MASUK, bukan untuk
              membaca daftar benefit — dan di telepon keduanya memakan lebih
              dari separuh tinggi layar, menyisakan jendela sempit yang harus
              digulir terus. Disembunyikan saat panel benefit terbuka. */}
          {!benefit && <><SesiHead /><SparkIhsg /></>}
          <div className="panel-h">
            <span className="lbl">{benefit ? 'Benefit kontributor' : 'Masuk Dashboard'}</span>
            <span className="login-aksi">
              {!benefit && (
                <button type="button" className="dd-btn" onClick={() => setBenefit(true)}>
                  Benefit kontributor
                </button>
              )}
              {/* Di panel benefit, "Tutup" berarti kembali ke formulir masuk —
                  bukan menutup gerbangnya. Orang yang membuka daftar benefit
                  sedang menimbang, bukan hendak pergi. */}
              <button type="button" className="dd-btn" onClick={benefit ? () => setBenefit(false) : onClose}>
                Tutup
              </button>
            </span>
          </div>
          {benefit ? <PanelBenefit kembali={() => setBenefit(false)} /> : (
          <form className="panel-b" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="login-sub">Masuk untuk kelola Data dan Arus Pasar.</p>
            <div className="field">
              <span className="lbl">Email</span>
              <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <KolomSandi label="Kata sandi" nilai={password} onGanti={setPassword} autoComplete="current-password" />
            {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--red)' }}>{error}</p>}
            <button type="submit" className="btn-p" disabled={submitting}>
              {submitting ? 'Memproses…' : 'Masuk'}
            </button>
            {/* Pendaftaran mandiri sengaja TIDAK dibuka: akun kontributor lahir
                dari kurasi manual — kuota, izin Bedah, dan alias untuk kredit
                PDF semuanya ditentukan superadmin. Jadi tombol ini membuka
                percakapan, bukan formulir. */}
            <a
              className="login-daftar"
              href={`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(WA_PESAN)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Belum punya akun? <b>Daftar lewat WhatsApp</b>
            </a>
          </form>
          )}
        </div>
      </div>
    </div>
  )
}
