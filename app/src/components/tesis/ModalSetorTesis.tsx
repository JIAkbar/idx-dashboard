import { useMemo, useState } from 'react'
import { ModalKecil } from '../dasbor/ModalKecil'
import { useAuth } from '../../context/AuthContext'
import {
  ALASAN_MAKS, ALASAN_MIN, HORIZON_TESIS, kirimTesis, periksaTesis, tanggalSinyalSekarang,
  pesanGalat, useSisaKuotaTesis, type ArahTesis, type HorizonTesis, type TesisBaru,
} from '../../lib/tesis'
import { keFraksi } from '../../lib/fraksiHarga'

/**
 * Formulir setor tesis — pengganti unggah tangkapan layar (antrean #3).
 *
 * Yang membedakannya dari formulir setoran lama: tak ada kurator. Begitu
 * terkirim, tesis ini dinilai mesin dengan aturan yang sama dengan rekam jejak
 * PAPAN sendiri, dan **tak bisa disunting lagi** — itu yang membuat angkanya
 * berarti. Karena itu tiga hal ditulis di layar sebelum tombol kirim, bukan
 * sesudahnya: hari sinyal yang dipakai, bahwa hari sinyal tak ikut dinilai,
 * dan bahwa tesis tak bisa diubah.
 */
export function ModalSetorTesis({ kode, harga, onTutup, onTerkirim }: {
  kode: string
  /** Penutupan hari sinyal, kalau halaman sudah memilikinya. */
  harga?: number | null
  onTutup: () => void
  onTerkirim?: () => void
}) {
  const { session } = useAuth()
  const [kirim, setKirim] = useState(0)
  const sisaKuota = useSisaKuotaTesis(kirim)

  const tanggalSinyal = useMemo(() => tanggalSinyalSekarang(), [])
  const acuan = harga && harga > 0 ? harga : null

  const [arah, setArah] = useState<ArahTesis>('naik')
  const [bawah, setBawah] = useState(acuan ? String(acuan) : '')
  const [atas, setAtas] = useState(acuan ? String(acuan) : '')
  const [target, setTarget] = useState('')
  const [stop, setStop] = useState('')
  const [horizon, setHorizon] = useState<HorizonTesis>(5)
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [sudah, setSudah] = useState(false)

  const angka = (s: string) => (s.trim() === '' ? NaN : Number(s))
  const calon: Partial<TesisBaru> = {
    kode, arah, tanggal_sinyal: tanggalSinyal,
    masuk_bawah: angka(bawah), masuk_atas: angka(atas),
    target: angka(target), stop: angka(stop),
    horizon_hari: horizon, alasan,
  }
  const salah = periksaTesis(calon)
  const sisaHuruf = ALASAN_MAKS - alasan.trim().length

  async function simpan() {
    if (!session?.user?.id || salah) return
    setSibuk(true)
    setGalat(null)
    try {
      await kirimTesis(calon as TesisBaru, session.user.id)
      setSudah(true)
      setKirim((n) => n + 1)
      onTerkirim?.()
    } catch (e) {
      const pesan = pesanGalat(e)
      // Dua penolakan server yang paling mungkin, diterjemahkan ke kalimat
      // yang bisa ditindaklanjuti. Sisanya ditampilkan apa adanya — pesan
      // server yang disembunyikan membuat penyetor menebak.
      setGalat(/row-level security|violates/i.test(pesan)
        ? 'Ditolak server: kuota hari ini habis, atau akun sedang tak aktif.'
        : /does not exist|schema cache/i.test(pesan)
          ? 'Fitur tesis belum aktif — tabelnya belum dipasang di basis data.'
          : pesan)
    } finally {
      setSibuk(false)
    }
  }

  if (sudah) {
    return (
      <ModalKecil label={`Tesis ${kode} tersimpan`} onClose={onTutup}>
        <p>Tesis kamu masuk antrean penilaian. Hasilnya keluar setelah <b>{horizon} hari bursa</b> berlalu,
          dinilai mesin — bukan dikurasi orang.</p>
        <p className="muted" style={{ fontSize: 12 }}>
          Masih bisa dibatalkan sampai bursa berikutnya buka. Sesudah itu ia jadi rekam jejak dan tak bisa
          diubah, menang atau kalah.
        </p>
        <button type="button" className="dd-btn" onClick={onTutup}>Tutup</button>
      </ModalKecil>
    )
  }

  return (
    <ModalKecil label={`Setor tesis · ${kode}`} onClose={onTutup}>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Hari sinyal <b>{tanggalSinyal}</b> — hari itu sendiri <b>tidak</b> ikut dinilai; jendelanya mulai hari
        bursa berikutnya. Tesis yang sudah terkirim tak bisa disunting.
        {sisaKuota != null && <> Sisa kuota hari ini: <b>{sisaKuota}</b>.</>}
      </p>

      <div className="grup-k" style={{ gap: 8 }}>
        <span className="grup-lbl">Arah</span>
        {(['naik', 'turun'] as ArahTesis[]).map((a) => (
          <button key={a} type="button" className={`chip-t${arah === a ? ' on' : ''}`} onClick={() => setArah(a)}>
            {a === 'naik' ? 'Naik' : 'Turun'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <label className="lbl">Area masuk bawah
          <input className="inp" inputMode="decimal" value={bawah} onChange={(e) => setBawah(e.target.value)} />
        </label>
        <label className="lbl">Area masuk atas
          <input className="inp" inputMode="decimal" value={atas} onChange={(e) => setAtas(e.target.value)} />
        </label>
        <label className="lbl">Target
          <input className="inp" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="lbl">Batas rugi
          <input className="inp" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} />
        </label>
      </div>
      {acuan != null && (
        <p className="muted" style={{ fontSize: 11, margin: 0 }}>
          Penutupan {tanggalSinyal}: <b>{keFraksi(acuan, 'dekat').toLocaleString('id-ID')}</b>
        </p>
      )}

      <div className="grup-k" style={{ gap: 8 }}>
        <span className="grup-lbl">Horizon</span>
        {HORIZON_TESIS.map((h) => (
          <button key={h} type="button" className={`chip-t${horizon === h ? ' on' : ''}`} onClick={() => setHorizon(h)}>
            {h} hari
          </button>
        ))}
      </div>

      <label className="lbl">Alasan
        <textarea
          className="inp" rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)}
          placeholder={`Kenapa kamu yakin — minimal ${ALASAN_MIN} karakter`}
        />
      </label>
      <p className="muted" style={{ fontSize: 11, margin: 0 }}>{sisaHuruf} karakter tersisa</p>

      {salah && alasan.length + bawah.length > 0 && (
        <p className="dn" style={{ fontSize: 12, margin: 0 }}>{salah}</p>
      )}
      {galat && <p className="dn" style={{ fontSize: 12, margin: 0 }}>{galat}</p>}

      <div className="grup-k grup-kanan" style={{ gap: 8 }}>
        <button type="button" className="dd-btn" onClick={onTutup}>Batal</button>
        <button type="button" className="dd-btn on" disabled={Boolean(salah) || sibuk || sisaKuota === 0} onClick={() => void simpan()}>
          {sibuk ? 'Mengirim…' : 'Kirim tesis'}
        </button>
      </div>
      {sisaKuota === 0 && (
        <p className="muted" style={{ fontSize: 11, margin: 0 }}>Kuota tesis hari ini sudah habis.</p>
      )}
    </ModalKecil>
  )
}
