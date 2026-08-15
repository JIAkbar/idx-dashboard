import { useEffect, useRef, useState, type FormEvent } from 'react'
import { IkonMenu, IKON_CENTANG, IKON_GAMBAR, IKON_PERINGATAN, IKON_SILANG } from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { LightboxGambar, type GambarLightbox } from '../../components/dasbor/LightboxGambar'
import { AlasanField } from '../../components/dasbor/AlasanField'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { alasanValid } from '../../lib/alasanValidasi'
import { useProfilSaya } from '../../lib/profilSaya'
import { daftarBedah, daftarBedahArsip, unggahBedah, urlScreenshots, type BedahArsipBaris } from '../../lib/supabaseEdisi'
import { pesanGalat } from '../../lib/pesanGalat'

function tanggalHariIni(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Ukuran berkas manusiawi — "348 KB", "1,2 MB". */
function ukuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Satu slot berkas Bedah: input file tersembunyi + tombol gaya Lantai
 *  (pola sama SlotBerkas RadarUnggah.tsx — file itu tidak diekspor, jadi
 *  disalin di sini per instruksi "meniru persis pola RadarUnggah.tsx"). */
function SlotBerkas({ label, file, onFile }: {
  label: string
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
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          if (f && !f.type.startsWith('image/')) {
            setErr('Berkas harus berupa gambar (PNG/JPG/WebP).')
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
          <IkonMenu d={IKON_GAMBAR} size={14} /> Pilih gambar…
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
 * Slot unggah sumber "Bedah Arus Saham" (item #7, revisi 14 Agu) — panel
 * mandiri di halaman admin, meniru pola RadarUnggah.tsx: screenshot Broker
 * Summary rentang (wajib salah satu) + Done Summary (opsional) per
 * emiten+tanggal, masuk bucket "screenshots" prefiks
 * bedah/{TICKER}/{tanggal}/{jenis}.{ext}. Produk PDF "Bedah Arus Saham"
 * dibangun paralel di luar app ini — komponen ini cuma jalur unggah sumber.
 */
export function BedahUnggah() {
  const { index } = useStockIndex()
  const { profil } = useProfilSaya()
  const superadmin = profil?.peran === 'superadmin'
  const [ticker, setTicker] = useState('')
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [broksum, setBroksum] = useState<File | null>(null)
  const [done, setDone] = useState<File | null>(null)
  const [alasan, setAlasan] = useState('')
  const [sudah, setSudah] = useState<string[] | null>(null)
  const [mengunggah, setMengunggah] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; pesan: string } | null>(null)
  const [muat, setMuat] = useState(0)

  const [arsip, setArsip] = useState<BedahArsipBaris[] | null>(null)
  const [lightbox, setLightbox] = useState<{ items: GambarLightbox[]; index: number } | null>(null)

  const kode = ticker.trim().toUpperCase()

  useEffect(() => {
    if (!kode) {
      setSudah(null)
      return
    }
    let batal = false
    setSudah(null)
    daftarBedah(kode, tanggal)
      .then((n) => !batal && setSudah(n))
      .catch(() => !batal && setSudah([]))
    return () => {
      batal = true
    }
  }, [kode, tanggal, muat])

  useEffect(() => {
    let batal = false
    daftarBedahArsip()
      .then((a) => !batal && setArsip(a))
      .catch(() => !batal && setArsip([]))
    return () => {
      batal = true
    }
  }, [muat])

  async function kirim(e: FormEvent) {
    e.preventDefault()
    if (!kode) {
      setStatus({ ok: false, pesan: 'Pilih emiten dulu.' })
      return
    }
    if (!broksum && !done) {
      setStatus({ ok: false, pesan: 'Pilih minimal satu berkas (Broker Summary rentang atau Done Summary).' })
      return
    }
    if (!alasanValid(alasan, superadmin)) {
      setStatus({ ok: false, pesan: 'Alasan wajib diisi (lihat penghitung karakter di bawah kolom alasan).' })
      return
    }
    setMengunggah(true)
    setStatus(null)
    try {
      const alasanKirim = alasan.trim()
      if (broksum) await unggahBedah(broksum, kode, tanggal, 'broksum-rentang', alasanKirim)
      if (done) await unggahBedah(done, kode, tanggal, 'done-summary', alasanKirim)
      setStatus({ ok: true, pesan: `Tersimpan untuk ${kode} · ${tanggal}: ${[broksum && 'broker summary', done && 'done summary'].filter(Boolean).join(' + ')}.` })
      setBroksum(null)
      setDone(null)
      setAlasan('')
      setMuat((m) => m + 1)
    } catch (err) {
      setStatus({ ok: false, pesan: pesanGalat(err, 'Gagal unggah.') })
    } finally {
      setMengunggah(false)
    }
  }

  async function bukaArsip(baris: BedahArsipBaris) {
    try {
      const urls = await urlScreenshots(baris.paths)
      const ada = baris.paths.filter((p) => urls[p])
      if (ada.length === 0) throw new Error('URL gambar tidak tersedia.')
      setLightbox({
        items: ada.map((p) => ({ src: urls[p], keterangan: `${baris.ticker} · ${p.split('/').slice(2).join('/')}` })),
        index: 0,
      })
    } catch {
      setStatus({ ok: false, pesan: 'Gagal memuat pratinjau arsip.' })
    }
  }

  return (
    <section className="panel">
      <div className="panel-h"><span className="lbl">Bedah Arus Saham — unggah sumber</span></div>
      <div className="panel-b">
        <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
          Screenshot Broker Summary rentang dan Done Summary per emiten + tanggal.
          Berkas ini bahan produk PDF "Bedah Arus Saham" yang dirakit di luar aplikasi ini.
        </p>
        <form onSubmit={kirim} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <div className="field">
            <span className="lbl">Emiten</span>
            <StockAutocomplete
              stocks={index?.stocks ?? []}
              value={ticker}
              onChange={setTicker}
              onSelect={setTicker}
              placeholder="Ketik kode / nama emiten…"
            />
          </div>
          <div className="field">
            <span className="lbl">Tanggal</span>
            <DatePicker value={tanggal} onChange={setTanggal} />
            {sudah && sudah.length > 0 && (
              <p className="af-dup" style={{ marginTop: 6 }}>
                <IkonMenu d={IKON_PERINGATAN} size={12} />
                <span>Sudah ada untuk {kode}: <b>{sudah.join(', ')}</b> — unggahan baru menggantikan berkas sejenis.</span>
              </p>
            )}
          </div>
          <SlotBerkas label="Broker Summary rentang — wajib salah satu" file={broksum} onFile={setBroksum} />
          <SlotBerkas label="Done Summary — opsional" file={done} onFile={setDone} />
          <AlasanField value={alasan} onChange={setAlasan} superadmin={superadmin} />
          <button type="submit" className="btn-p" disabled={mengunggah || !alasanValid(alasan, superadmin)}>
            {mengunggah ? 'Mengunggah…' : 'Unggah'}
          </button>
          {status && (
            <p className={status.ok ? 'muted' : 'af-err'} style={{ margin: 0, fontSize: 11.5 }}>
              {status.ok && <IkonMenu d={IKON_CENTANG} size={12} />} {status.pesan}
            </p>
          )}
        </form>

        {arsip && arsip.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="lbl" style={{ marginBottom: 6 }}>Arsip unggahan Bedah</p>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Emiten</th>
                  <th>Tanggal terakhir</th>
                  <th className="r">Berkas</th>
                  <th className="r">Lihat</th>
                </tr>
              </thead>
              <tbody>
                {arsip.map((b) => (
                  <tr key={b.ticker}>
                    <td className="tick">{b.ticker}</td>
                    <td>{b.tanggalTerakhir}</td>
                    <td className="r num">{b.jumlahBerkas}</td>
                    <td className="r">
                      <button type="button" className="af-centang af-lihat" onClick={() => bukaArsip(b)}>
                        <IkonMenu d={IKON_CENTANG} size={13} />
                        <span className="lihat-lbl">Lihat</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lightbox && (
        <LightboxGambar
          items={lightbox.items}
          index={lightbox.index}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  )
}
