import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { IkonMenu, IKON_CENTANG, IKON_GAMBAR, IKON_PERINGATAN, IKON_SILANG, IKON_TAMBAH, IKON_TONG } from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { LightboxGambar, type GambarLightbox } from '../../components/dasbor/LightboxGambar'
import { AlasanField } from '../../components/dasbor/AlasanField'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { useAuth } from '../../context/AuthContext'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { alasanValid } from '../../lib/alasanValidasi'
import { useProfilSaya } from '../../lib/profilSaya'
import {
  daftarBedah,
  daftarBedahArsip,
  hapusScreenshot,
  tickerBedahTerakhirSaya,
  unggahBedah,
  urlScreenshots,
  type BedahArsipBaris,
} from '../../lib/supabaseEdisi'
import { pesanGalat } from '../../lib/pesanGalat'
import { tanggalBursaTerakhir as tanggalHariIni } from '../../lib/tanggalBursa'
import { PanduanScreenshot } from './PanduanScreenshot'


/** Ukuran berkas manusiawi — "348 KB", "1,2 MB". */
function ukuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** localStorage key kunci "emiten sedang dikerjakan" — per akun, pola sama
 *  `kunciSambutan`/`kunciBeku` di lib/sambutan.ts (`namespace:userId`). */
function kunciEmitenAktif(userId: string): string {
  return `bedah-emiten:${userId}`
}

/** "bedah/AADI/2026-08-14/broksum-rentang.png" → "Broker Summary rentang". */
function labelJenisBedah(path: string): string {
  const jenis = (path.split('/').pop() ?? '').split('.')[0]
  if (jenis === 'broksum-rentang') return 'Broker Summary rentang'
  if (jenis === 'done-summary') return 'Done Summary'
  return jenis
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
  const { session } = useAuth()
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
  /** Ticker arsip yang sedang dibuka (daftar tanggalnya terlihat). */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  /** Berkas yang sedang minta konfirmasi hapus (modal) — null = tertutup. */
  const [hapusTarget, setHapusTarget] = useState<{ ticker: string; tanggal: string; path: string } | null>(null)
  const [menghapus, setMenghapus] = useState(false)

  /**
   * Emiten "sedang dikerjakan" — KEMUDAHAN ANTARMUKA saja, BUKAN aturan
   * keamanan: server tidak menegakkan ini sama sekali (kebijakan storage
   * Bedah tetap mengizinkan emiten mana pun, kapan pun). Alurnya: pilih
   * emiten sekali, lalu tiap tanggal berikutnya tinggal ganti tanggal tanpa
   * memilih ulang emiten. Terkunci begitu satu unggahan sukses, disimpan di
   * localStorage per akun supaya bertahan lewat reload; tombol "+ Tambah
   * emiten" (`modeTambah`) membuka lagi pilihannya tanpa membuang emiten lama
   * (arsipnya tetap ada, tinggal dibuka lagi dari tabel arsip di bawah).
   */
  const [terkunci, setTerkunci] = useState<string | null>(null)
  const [modeTambah, setModeTambah] = useState(false)

  const emitenBebas = modeTambah || !terkunci
  const kode = (emitenBebas ? ticker : terkunci ?? '').trim().toUpperCase()

  function kunciKeEmiten(kodeBaru: string) {
    setTerkunci(kodeBaru)
    setModeTambah(false)
    if (session) localStorage.setItem(kunciEmitenAktif(session.user.id), kodeBaru)
  }

  // Resolve kunci emiten SEKALI per sesi login: localStorage dulu, kalau
  // kosong (browser baru/dibersihkan) jatuh ke emiten Bedah terakhir milik
  // akun ini. Tidak menimpa `terkunci` kalau sudah terisi (mis. dari unggahan
  // barusan) — efek ini cuma titik BERANGKAT, bukan pengawas berkelanjutan.
  useEffect(() => {
    if (!session) return
    let batal = false
    const kunci = kunciEmitenAktif(session.user.id)
    const tersimpan = localStorage.getItem(kunci)
    if (tersimpan) {
      setTerkunci(tersimpan)
      return
    }
    tickerBedahTerakhirSaya()
      .then((t) => {
        if (batal || !t) return
        localStorage.setItem(kunci, t)
        setTerkunci(t)
      })
      .catch(() => {})
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolusi awal saja, lihat komentar di atas
  }, [session?.user.id])

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
      kunciKeEmiten(kode)
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

  /** Buka lightbox berisi SEMUA berkas emiten ini (lintas tanggal), mulai dari
   *  `pathAwal` kalau diklik dari baris tanggal tertentu — supaya ‹ › tetap
   *  bisa menjelajah seluruh arsip emiten, bukan cuma satu tanggal. */
  async function bukaArsip(baris: BedahArsipBaris, pathAwal?: string) {
    try {
      const semuaPaths = baris.tanggalList.flatMap((t) => t.paths)
      const urls = await urlScreenshots(semuaPaths)
      const ada = semuaPaths.filter((p) => urls[p])
      if (ada.length === 0) throw new Error('URL gambar tidak tersedia.')
      setLightbox({
        items: ada.map((p) => ({ src: urls[p], keterangan: `${baris.ticker} · ${p.split('/').slice(2).join('/')}` })),
        index: pathAwal ? Math.max(0, ada.indexOf(pathAwal)) : 0,
      })
    } catch {
      setStatus({ ok: false, pesan: 'Gagal memuat pratinjau arsip.' })
    }
  }

  function toggleExpand(ticker: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  /** Hapus satu berkas arsip — urutan baris-dulu-berkas-belakangan dan
   *  pemeriksaan RLS sudah ditangani `hapusScreenshot()`, dipakai apa adanya. */
  async function jalankanHapus(target: { ticker: string; tanggal: string; path: string }) {
    setMenghapus(true)
    try {
      await hapusScreenshot([target.path])
      setStatus({ ok: true, pesan: `${labelJenisBedah(target.path)} ${target.ticker} · ${target.tanggal} dihapus.` })
      setMuat((m) => m + 1)
    } catch (err) {
      setStatus({ ok: false, pesan: pesanGalat(err, 'Gagal hapus.') })
    } finally {
      setMenghapus(false)
      setHapusTarget(null)
    }
  }

  return (
    <>
      <PanduanScreenshot superadmin={superadmin} defaultBuka={false} bedah />
      <section className="panel">
        <div className="panel-h"><span className="lbl">Bedah Arus Saham — unggah sumber</span></div>
        <div className="panel-b">
        <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
          Studi satu emiten <b>lintas waktu</b> — beda dari setoran harian (satu emiten, satu tanggal),
          di sini satu emiten boleh disetor untuk <b>beberapa tanggal</b>: rentang broker summary + done
          summary per tanggal jadi bahan produk PDF "Bedah Arus Saham" yang dirakit di luar aplikasi ini.
        </p>
        <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
          Hasilnya dikreditkan atas nama kontributor yang menyetornya — kredit &amp; jenjang ikut
          setoran yang <b>disetujui</b>, terlepas dari apakah akhirnya dimuat di edisi.
        </p>
        <form onSubmit={kirim} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <div className="field">
            <span className="lbl">Emiten</span>
            {!emitenBebas && terkunci ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="chip up" style={{ fontFamily: 'var(--mono)' }}>Sedang mengerjakan: {terkunci}</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {arsip?.find((b) => b.ticker === terkunci)?.tanggalList.length ?? 0} tanggal tersimpan
                </span>
                <button type="button" className="dd-btn" onClick={() => { setModeTambah(true); setTicker('') }}>
                  <IkonMenu d={IKON_TAMBAH} size={12} /> Tambah emiten
                </button>
              </div>
            ) : (
              <>
                <StockAutocomplete
                  stocks={index?.stocks ?? []}
                  value={ticker}
                  onChange={setTicker}
                  onSelect={setTicker}
                  placeholder="Ketik kode / nama emiten…"
                />
                {terkunci && (
                  <button
                    type="button"
                    className="dd-btn"
                    style={{ marginTop: 6 }}
                    onClick={() => { setModeTambah(false); setTicker('') }}
                  >
                    Batal, kembali ke {terkunci}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="field">
            <span className="lbl">Tanggal</span>
            <DatePicker value={tanggal} onChange={setTanggal} />
            {sudah && sudah.length > 0 && (
              <p className="af-dup" style={{ marginTop: 6 }}>
                <IkonMenu d={IKON_PERINGATAN} size={12} />
                <span>
                  Sudah ada untuk {kode} · {tanggal}: <b>{sudah.join(', ')}</b> — unggahan baru menggantikan berkas
                  sejenis di tanggal ini saja. Tanggal lain untuk {kode} tetap bebas disetor.
                </span>
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
                  <th className="r">Tanggal</th>
                  <th className="r">Berkas</th>
                  <th className="r">Buka</th>
                </tr>
              </thead>
              <tbody>
                {arsip.map((b) => {
                  const terbuka = expanded.has(b.ticker)
                  return (
                    <Fragment key={b.ticker}>
                      <tr>
                        <td className="tick">{b.ticker}</td>
                        <td className="r num">{b.tanggalList.length}</td>
                        <td className="r num">{b.jumlahBerkas}</td>
                        <td className="r">
                          <button type="button" className="af-centang af-lihat" onClick={() => toggleExpand(b.ticker)}>
                            <IkonMenu d={IKON_CENTANG} size={13} />
                            <span className="lihat-lbl">{terbuka ? 'Tutup' : 'Buka'}</span>
                          </button>
                        </td>
                      </tr>
                      {terbuka && b.tanggalList.map((t) => (
                        <tr key={`${b.ticker}-${t.tanggal}`}>
                          <td colSpan={4} style={{ paddingLeft: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span className="muted" style={{ fontSize: 11, minWidth: 76 }}>{t.tanggal}</span>
                              {t.paths.map((p) => (
                                <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <button
                                    type="button"
                                    className="dd-btn"
                                    style={{ fontSize: 10.5, padding: '4px 8px' }}
                                    onClick={() => bukaArsip(b, p)}
                                  >
                                    {labelJenisBedah(p)}
                                  </button>
                                  <button
                                    type="button"
                                    className="dd-btn"
                                    style={{ padding: '4px 6px', color: 'var(--red)', borderColor: 'var(--red)' }}
                                    title={`Hapus ${labelJenisBedah(p)}`}
                                    aria-label={`Hapus ${labelJenisBedah(p)} — ${b.ticker} ${t.tanggal}`}
                                    onClick={() => setHapusTarget({ ticker: b.ticker, tanggal: t.tanggal, path: p })}
                                  >
                                    <IkonMenu d={IKON_TONG} size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
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

      {hapusTarget && (
        <ModalKecil
          label={`Hapus ${labelJenisBedah(hapusTarget.path)} — ${hapusTarget.ticker}?`}
          onClose={() => { if (!menghapus) setHapusTarget(null) }}
        >
          <p style={{ margin: 0, fontSize: 12.5 }}>
            Berkas <b>{labelJenisBedah(hapusTarget.path)}</b> untuk <b>{hapusTarget.ticker}</b> tanggal{' '}
            {hapusTarget.tanggal} akan dihapus permanen dari penyimpanan.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-p af-btn-keluar" disabled={menghapus} onClick={() => jalankanHapus(hapusTarget)}>
              {menghapus ? 'Menghapus…' : 'Hapus'}
            </button>
            <button type="button" className="dd-btn" disabled={menghapus} onClick={() => setHapusTarget(null)}>Batal</button>
          </div>
        </ModalKecil>
      )}
    </section>
    </>
  )
}
