import { useEffect, useRef, useState, type FormEvent } from 'react'
import { IkonMenu, IKON_CENTANG, IKON_GAMBAR, IKON_PERINGATAN, IKON_SILANG } from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { daftarRadar, unggahRadar } from '../../lib/supabaseEdisi'
import { useProfilSaya } from '../../lib/profilSaya'
import { AksesDitolak } from './AdminLayout'
import { pesanGalat } from '../../lib/pesanGalat'
import { tanggalBursaTerakhir as tanggalHariIni } from '../../lib/tanggalBursa'


/** Ukuran berkas manusiawi — "348 KB", "1,2 MB". */
function ukuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Satu slot berkas radar: input file tersembunyi + tombol gaya Lantai
 *  (pola PilihGambar AdminHome, disederhanakan — tanpa thumbnail/heuristik). */
function SlotBerkas({ label, accept, cocok, file, onFile }: {
  label: string
  accept: string
  /** Validasi MIME di batas kepercayaan form; pesan error kalau tak cocok. */
  cocok: (f: File) => string | null
  file: File | null
  onFile: (f: File | null) => void
}) {
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          const pesan = f ? cocok(f) : null
          if (pesan) {
            setErr(pesan)
            e.target.value = ''
            onFile(null)
            return
          }
          setErr('')
          onFile(f)
        }}
      />
      {!file ? (
        <button type="button" className="dd-btn af-pilih" onClick={() => inputRef.current?.click()}>
          <IkonMenu d={IKON_GAMBAR} size={14} /> Pilih berkas…
        </button>
      ) : (
        <div className="af-file">
          <div className="af-file-baris">
            <span className="nama" title={file.name}>{file.name}</span>
            <span className="uk">{ukuranBerkas(file.size)}</span>
            <button
              type="button"
              className="buang"
              aria-label="Buang pilihan"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = ''
                setErr('')
                onFile(null)
              }}
            >
              <IkonMenu d={IKON_SILANG} size={12} />
            </button>
          </div>
        </div>
      )}
      {err && <p className="af-err">{err}</p>}
    </div>
  )
}

/**
 * Slot unggah sumber Radar WDWL (#radar) — panel mandiri di halaman admin:
 * screenshot tabel WD Watch List (wdwl.png) + PDF chart RBU (rbu.pdf) per
 * tanggal, masuk bucket "screenshots" prefiks radar/{tanggal}/. Transkripsi
 * ke data-idx/radar/r_*.json terjadi di luar app (alur sama dengan
 * screenshot orderbook → edisi bulletin).
 *
 * Khusus superadmin — Radar adalah produk kurasi, kontributor tidak menyetor
 * bahannya. Tab disembunyikan di AdminLayout kalau bukan superadmin; guard
 * di sini jaga-jaga akses langsung lewat URL/bookmark.
 */
export function RadarUnggah() {
  const { profil } = useProfilSaya()
  const superadmin = profil?.peran === 'superadmin'
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [wdwl, setWdwl] = useState<File | null>(null)
  const [rbu, setRbu] = useState<File | null>(null)
  const [sudah, setSudah] = useState<string[] | null>(null)
  const [mengunggah, setMengunggah] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; pesan: string } | null>(null)
  const [muat, setMuat] = useState(0)

  useEffect(() => {
    let batal = false
    setSudah(null)
    daftarRadar(tanggal)
      .then((n) => !batal && setSudah(n))
      .catch(() => !batal && setSudah([]))
    return () => {
      batal = true
    }
  }, [tanggal, muat])

  async function kirim(e: FormEvent) {
    e.preventDefault()
    if (!wdwl && !rbu) {
      setStatus({ ok: false, pesan: 'Pilih minimal satu berkas (wdwl.png atau rbu.pdf).' })
      return
    }
    setMengunggah(true)
    setStatus(null)
    try {
      if (wdwl) await unggahRadar(wdwl, tanggal, 'wdwl')
      if (rbu) await unggahRadar(rbu, tanggal, 'rbu')
      setStatus({ ok: true, pesan: `Tersimpan untuk ${tanggal}: ${[wdwl && 'wdwl', rbu && 'rbu'].filter(Boolean).join(' + ')}.` })
      setWdwl(null)
      setRbu(null)
      setMuat((m) => m + 1)
    } catch (err) {
      setStatus({ ok: false, pesan: pesanGalat(err, 'Gagal unggah.') })
    } finally {
      setMengunggah(false)
    }
  }

  if (!superadmin) return <AksesDitolak pesan="Halaman ini khusus superadmin." />

  return (
    <section className="panel">
      <div className="panel-h"><span className="lbl">Radar WDWL — unggah sumber</span></div>
      <div className="panel-b">
        <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
          Screenshot tabel WD Watch List (PNG) dan PDF chart RBU per tanggal edisi.
          Berkas ditranskripsi jadi arsip halaman Radar di luar aplikasi ini.
        </p>
        <form onSubmit={kirim} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <div className="field">
            <span className="lbl">Tanggal edisi</span>
            <DatePicker value={tanggal} onChange={setTanggal} />
            {sudah && sudah.length > 0 && (
              <p className="af-dup" style={{ marginTop: 6 }}>
                <IkonMenu d={IKON_PERINGATAN} size={12} />
                <span>Sudah ada: <b>{sudah.join(', ')}</b> — unggahan baru menggantikan berkas sejenis.</span>
              </p>
            )}
          </div>
          <SlotBerkas
            label="wdwl.png — screenshot tabel Watch List"
            accept="image/*"
            cocok={(f) => (f.type.startsWith('image/') ? null : 'Berkas harus berupa gambar (PNG/JPG/WebP).')}
            file={wdwl}
            onFile={setWdwl}
          />
          <SlotBerkas
            label="rbu.pdf — chart RBU (MetaStock)"
            accept="application/pdf,.pdf"
            cocok={(f) => (f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? null : 'Berkas harus berupa PDF.')}
            file={rbu}
            onFile={setRbu}
          />
          <button type="submit" className="btn-p" disabled={mengunggah}>
            {mengunggah ? 'Mengunggah…' : 'Unggah'}
          </button>
          {status && (
            <p className={status.ok ? 'muted' : 'af-err'} style={{ margin: 0, fontSize: 11.5 }}>
              {status.ok && <IkonMenu d={IKON_CENTANG} size={12} />} {status.pesan}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}
