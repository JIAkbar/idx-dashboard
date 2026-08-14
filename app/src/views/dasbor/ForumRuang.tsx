import { useEffect, useState, type FormEvent } from 'react'
import { IsiPesan } from '../../components/dasbor/IsiPesan'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfilSaya } from '../../lib/profilSaya'
import { useLoginModalOpsional } from '../../context/LoginModalContext'
import {
  ambilPesan, ambilRuang, kirimPesan, laporkanPesan, namaPenulis, waktuRelatif,
  ambilAliasPenulis,
  type Pesan, type RuangInfo,
} from '../../lib/forum'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

interface Utas extends Pesan {
  balasan: Pesan[]
}

/** Balasan bersarang SATU tingkat: `induk` yang menunjuk balasan lain (bukan
 *  pesan akar) tetap dikelompokkan di bawah akarnya — tak ada tingkat ke-3. */
function susunUtas(daftar: Pesan[]): Utas[] {
  const akarId = new Set(daftar.filter((p) => !p.induk).map((p) => p.id))
  const balasanMap = new Map<string, Pesan[]>()
  for (const p of daftar) {
    if (!p.induk) continue
    const targetAkar = akarId.has(p.induk) ? p.induk : (daftar.find((x) => x.id === p.induk)?.induk ?? p.induk)
    const arr = balasanMap.get(targetAkar) ?? []
    arr.push(p)
    balasanMap.set(targetAkar, arr)
  }
  return daftar
    .filter((p) => !p.induk)
    .map((p) => ({ ...p, balasan: (balasanMap.get(p.id) ?? []).sort((a, b) => a.dibuat_pada.localeCompare(b.dibuat_pada)) }))
}

function ringkas(s: string): string {
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

/**
 * Ruang forum (`/forum/:kunci`) — daftar pesan + balasan bersarang + kotak
 * tulis. Ruang emiten HANYA muncul kalau superadmin sudah membuat barisnya
 * di `forum_ruang` (RLS `ruang_kelola` menutup INSERT dari klien biasa) —
 * kalau `ambilRuang` balas `null`, halaman jujur bilang "belum dibuka",
 * BUKAN pura-pura menerima tulisan yang ujungnya ditolak Edge Function.
 */
export function ForumRuang() {
  const { kunci = '' } = useParams<{ kunci: string }>()
  const { session } = useAuth()
  const { profil } = useProfilSaya()
  const loginModal = useLoginModalOpsional()

  const [ruangInfo, setRuangInfo] = useState<RuangInfo | null>(null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  const [isi, setIsi] = useState('')
  const [balasKe, setBalasKe] = useState<Pesan | null>(null)
  const [mengirim, setMengirim] = useState(false)
  const [kirimGalat, setKirimGalat] = useState<string | null>(null)
  const [kuotaHabis, setKuotaHabis] = useState(false)
  const [sisaKuota, setSisaKuota] = useState<number | null>(null)
  const [catatanTertahan, setCatatanTertahan] = useState<string | null>(null)
  /** id penulis → alias, dari `forum_penulis` (server hanya membuka alias akun
   *  yang memang pernah menulis di forum — bukan seluruh tabel profil). */
  const [petaAlias, setPetaAlias] = useState<Record<string, string>>({})

  useEffect(() => {
    let batal = false
    setMemuat(true)
    setGalat(null)
    setBalasKe(null)
    Promise.all([ambilRuang(kunci), ambilPesan(kunci)])
      .then(([info, daftar]) => {
        if (batal) return
        setRuangInfo(info)
        setPesan(daftar)
        void muatAlias(daftar)
      })
      .catch((e: unknown) => { if (!batal) setGalat(e instanceof Error ? e.message : 'Gagal memuat ruang.') })
      .finally(() => { if (!batal) setMemuat(false) })
    return () => { batal = true }
  }, [kunci])

  /** Alias penulis dimuat terpisah dari pesannya: satu panggilan untuk semua
   *  penulis yang muncul, bukan satu per baris. */
  async function muatAlias(daftar: Pesan[]) {
    const ids = daftar.map((p) => p.penulis).filter((x): x is string => Boolean(x))
    if (ids.length === 0) return
    const peta = await ambilAliasPenulis(ids)
    setPetaAlias((lama) => ({ ...lama, ...peta }))
  }

  async function muatUlangPesan() {
    try {
      const baru = await ambilPesan(kunci)
      setPesan(baru)
      void muatAlias(baru)
    } catch {
      // gagal muat ulang bukan galat fatal — pesan yg baru terkirim sudah
      // dikonfirmasi lewat balasan Edge Function, daftar tinggal coba lagi nanti
    }
  }

  async function kirim(e: FormEvent) {
    e.preventDefault()
    const teks = isi.trim()
    if (teks.length < 2) return
    setMengirim(true)
    setKirimGalat(null)
    setKuotaHabis(false)
    setCatatanTertahan(null)
    const hasil = await kirimPesan(kunci, teks, balasKe?.id ?? null, session?.access_token)
    setMengirim(false)
    if (!hasil.ok) {
      setKirimGalat(hasil.galat ?? 'Pesan gagal terkirim.')
      if (hasil.kuota_habis) setKuotaHabis(true)
      return
    }
    setIsi('')
    setBalasKe(null)
    if (hasil.sisa_kuota != null) setSisaKuota(hasil.sisa_kuota)
    // Anonim: pesan yg ditahan TAK PERNAH muncul lagi di query biasa (RLS
    // `pesan_baca` cuma meloloskan baris disembunyikan milik `auth.uid()` —
    // anon tak punya auth.uid()) — satu-satunya kesempatan memberitahu
    // pengirimnya adalah catatan di balasan Edge Function ini, sekarang juga.
    if (hasil.disembunyikan) setCatatanTertahan(hasil.catatan ?? 'Pesan ditahan untuk diperiksa.')
    void muatUlangPesan()
  }

  async function lapor(id: string) {
    const alasan = window.prompt('Alasan melaporkan pesan ini (boleh dikosongkan):') ?? ''
    await laporkanPesan(id, alasan.trim() || 'Tidak ada alasan diberikan')
  }

  if (memuat) {
    return <div className="lantai"><div className="fd-empty"><p>Memuat ruang…</p></div></div>
  }

  if (!ruangInfo) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Forum</h1></div>
        <div className="fd-empty">
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p>Ruang <strong>{kunci}</strong> belum dibuka.</p>
          <p style={{ fontSize: 11, marginTop: 8, lineHeight: 1.7 }}>
            Ruang diskusi emiten dibuka superadmin saat pertama kali dibutuhkan.{' '}
            <Link to="/feedback">Ajukan lewat Kritik &amp; Saran</Link> kalau Anda ingin ruang ini dibuka.
          </p>
        </div>
      </div>
    )
  }

  const utas = susunUtas(pesan)

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>{ruangInfo.label}</h1>
        <span className="sub">{ruangInfo.keterangan || (ruangInfo.jenis === 'emiten' ? `Diskusi ${ruangInfo.kunci}` : '')}</span>
      </div>

      {galat && <div className="panel panel-b"><p className="muted">{galat}</p></div>}

      <div className="panel">
        <div className="panel-h"><span className="lbl">Diskusi ({pesan.length})</span></div>
        <div className="panel-b forum-thread">
          {utas.length === 0 && <p className="muted" style={{ fontSize: 12 }}>Belum ada pesan — jadilah yang pertama menulis.</p>}
          {utas.map((p) => (
            <div key={p.id} className="forum-msg-grup">
              <PesanBaris petaAlias={petaAlias} p={p} sesiId={session?.user.id} alias={profil?.alias}
                onBalas={() => setBalasKe(p)} onLapor={() => lapor(p.id)} />
              {p.balasan.length > 0 && (
                <div className="forum-balasan">
                  {p.balasan.map((b) => (
                    <PesanBaris key={b.id} petaAlias={petaAlias} p={b} sesiId={session?.user.id} alias={profil?.alias}
                      onBalas={() => setBalasKe(p)} onLapor={() => lapor(b.id)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {ruangInfo.aktif ? (
        <div className="panel">
          <div className="panel-h"><span className="lbl">Tulis Pesan</span></div>
          <form className="panel-b forum-compose" onSubmit={kirim}>
            {balasKe && (
              <div className="forum-balas-ke">
                <span>Membalas {namaPenulis(balasKe, session?.user.id, profil?.alias, petaAlias)}: &ldquo;{ringkas(balasKe.isi)}&rdquo;</span>
                <button type="button" className="bchip bchip-klik" style={{ cursor: 'pointer' }} onClick={() => setBalasKe(null)}>Batal</button>
              </div>
            )}
            <textarea
              className="inp" rows={3} maxLength={2000}
              placeholder={session ? 'Tulis pesan…' : 'Tulis sebagai tamu — nama samaran dibuat otomatis…'}
              value={isi} onChange={(e) => setIsi(e.target.value)}
            />
            <div className="forum-compose-bar">
              <span className="muted" style={{ fontSize: 11 }}>
                {session
                  ? 'Masuk sebagai anggota — tanpa batas kirim.'
                  : sisaKuota != null
                    ? `Sisa kirim tamu hari ini: ${sisaKuota}`
                    : 'Tamu bisa kirim 5 pesan/hari.'}
              </span>
              <button type="submit" className="btn-p" disabled={mengirim || isi.trim().length < 2}>
                {mengirim ? 'Mengirim…' : 'Kirim'}
              </button>
            </div>
            {catatanTertahan && (
              <p className="muted" style={{ fontSize: 11 }}>Pesan terkirim — ditahan untuk diperiksa: {catatanTertahan}</p>
            )}
            {kirimGalat && (
              <p style={{ fontSize: 11, color: 'var(--red)', margin: 0 }}>
                {kirimGalat}
                {kuotaHabis && loginModal && (
                  <> · <button type="button" className="bchip bchip-klik" style={{ cursor: 'pointer' }} onClick={() => loginModal.buka()}>Buat akun</button></>
                )}
              </p>
            )}
          </form>
        </div>
      ) : (
        <div className="panel panel-b"><p className="muted">Ruang ini sedang ditutup untuk pesan baru.</p></div>
      )}
    </div>
  )
}

function PesanBaris({ p, sesiId, alias, petaAlias, onBalas, onLapor }: {
  p: Pesan
  sesiId: string | undefined
  alias: string | null | undefined
  petaAlias: Record<string, string>
  onBalas: () => void
  onLapor: () => void
}) {
  return (
    <div className={'forum-msg' + (p.disembunyikan ? ' forum-msg-tertahan' : '')}>
      <div className="forum-msg-head">
        <span className="num" style={{ fontSize: 12 }}>{namaPenulis(p, sesiId, alias, petaAlias)}</span>
        <span className="muted" style={{ fontSize: 10.5 }}>{waktuRelatif(p.dibuat_pada)}</span>
      </div>
      {p.disembunyikan && (
        <p className="muted" style={{ fontSize: 10.5, color: 'var(--amber)', margin: '2px 0' }}>
          Ditahan untuk diperiksa{p.alasan_sembunyi ? `: ${p.alasan_sembunyi}` : ''}
        </p>
      )}
      <IsiPesan teks={p.isi} />
      <div className="forum-msg-aksi">
        <button type="button" className="bchip bchip-klik" style={{ cursor: 'pointer' }} onClick={onBalas}>Balas</button>
        <button type="button" className="bchip bchip-klik" style={{ cursor: 'pointer' }} onClick={onLapor}>Laporkan</button>
      </div>
    </div>
  )
}
