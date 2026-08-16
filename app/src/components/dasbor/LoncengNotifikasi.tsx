import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IkonMenu, IKON_LONCENG } from './IkonMenu'
import { tandaiDibaca, tandaiSemuaDibaca, useNotifikasi, type NotifikasiRow } from '../../lib/notifikasi'

/** "3 jam lalu" — jam persis tak berguna di daftar kabar; yang dicari pembaca
 *  adalah "ini baru atau lama". */
function sejak(iso: string): string {
  const detik = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (detik < 60) return 'baru saja'
  const menit = Math.floor(detik / 60)
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari < 30) return `${hari} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Baris({ n, onBaca }: { n: NotifikasiRow; onBaca: (id: string) => void }) {
  // Pengumuman bersama (untuk=null) tak punya penanda baca per orang, jadi
  // tak pernah tampil sebagai "belum dibaca" — lihat lib/notifikasi.ts.
  const belum = n.untuk !== null && n.dibaca_pada === null
  const isi = (
    <>
      <span className="ntf-judul">{n.judul}</span>
      <span className="ntf-pesan">{n.pesan}</span>
      <span className="ntf-waktu">{sejak(n.dibuat_pada)}</span>
    </>
  )
  const kelas = `ntf-it${belum ? ' belum' : ''} ntf-${n.jenis}`
  return n.tautan
    ? <Link className={kelas} to={n.tautan} onClick={() => belum && onBaca(n.id)}>{isi}</Link>
    : <div className={kelas} onClick={() => belum && onBaca(n.id)}>{isi}</div>
}

/**
 * Lonceng notifikasi (#137 hasil kurasi + #123 kabar fitur baru).
 *
 * Isinya dimuat sekali saat panel DIBUKA, bukan dilanggankan realtime: kabar
 * kurasi tidak mendesak sampai perlu soket terbuka sepanjang sesi. Jumlah yang
 * belum dibaca ikut dimuat di awal supaya lencananya benar tanpa membuka panel.
 */
export function LoncengNotifikasi() {
  const { daftar, belumDibaca, muat } = useNotifikasi()
  const [buka, setBuka] = useState(false)
  const bungkus = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buka) return
    const luar = (e: MouseEvent) => {
      if (!bungkus.current?.contains(e.target as Node)) setBuka(false)
    }
    document.addEventListener('mousedown', luar)
    return () => document.removeEventListener('mousedown', luar)
  }, [buka])

  function baca(id: string) {
    void tandaiDibaca(id).then(muat).catch(() => {})
  }

  return (
    <div className="ntf-bungkus" ref={bungkus}>
      <button
        type="button"
        className={'dd-btn ntf-tombol' + (belumDibaca > 0 ? ' ada' : '')}
        aria-label={belumDibaca > 0 ? `${belumDibaca} kabar belum dibaca` : 'Kabar'}
        aria-expanded={buka}
        onClick={() => { setBuka((v) => !v); if (!buka) muat() }}
      >
        <IkonMenu d={IKON_LONCENG} size={14} />
        {belumDibaca > 0 && <span className="ntf-lencana">{belumDibaca > 9 ? '9+' : belumDibaca}</span>}
      </button>

      {buka && (
        <div className="ntf-panel">
          <div className="ntf-kepala">
            <span className="lbl">Kabar</span>
            {belumDibaca > 0 && (
              <button type="button" className="ntf-semua"
                onClick={() => void tandaiSemuaDibaca().then(muat).catch(() => {})}>
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="ntf-isi">
            {daftar === null && <p className="muted ntf-kosong">Memuat…</p>}
            {daftar !== null && daftar.length === 0 && (
              <p className="muted ntf-kosong">Belum ada kabar. Hasil kurasi setoranmu akan muncul di sini.</p>
            )}
            {daftar?.map((n) => <Baris key={n.id} n={n} onBaca={baca} />)}
          </div>
        </div>
      )}
    </div>
  )
}
