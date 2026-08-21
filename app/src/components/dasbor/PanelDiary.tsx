import { useMemo, useState } from 'react'
import { useIhsgOhlc } from '../../lib/dasbor/ihsgOhlc'
import {
  bulanDiary, performaIhsg, selDiary, tallyDiary, type KotakDiary,
} from '../../lib/dasbor/diaryPasar'
import { LangkahTanggal } from './LangkahTanggal'

/**
 * Panel "Diary Pasar" — kalender IHSG berwarna, tally hari naik/turun, dan
 * performa tujuh periode.
 *
 * Idenya dari tangkapan layar RTI Business yang Johan taruh di `data ide/`
 * (21 Agu 2026). Rumus & kalibrasinya di `lib/dasbor/diaryPasar.ts`; yang di
 * berkas ini murni penyajian.
 *
 * Datanya `ihsg_ohlc_ringkas.json` lewat `useIhsgOhlc()` — berkas yang SAMA
 * dengan yang sudah ditarik `LilinHarian`, jadi panel ini tak menambah satu
 * pun unduhan di Beranda.
 */

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum']

const fpoin = (v: number): string =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fpersen = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace('.', ',')}%`

function Sel({ k }: { k: KotakDiary | null }) {
  if (!k) return <td className="dia-sel dia-kosong" />
  const s = k.sel
  if (!s) {
    // Hari kerja tanpa data = bursa libur. Tetap diberi angka, tanpa warna:
    // menghapusnya dari kalender membuat pekan yang ada liburnya tampak
    // bergeser, dan mewarnainya abu-abu netral berarti mengaku tahu arah
    // hari yang tak pernah diperdagangkan.
    return <td className="dia-sel dia-libur" title="Bursa libur atau belum ada datanya">{k.hari}</td>
  }
  return (
    <td
      className={`dia-sel dia-${s.arah}`}
      title={`${s.tanggal} · ${fpersen(s.persen)} (${fpoin(s.poin)} poin) · tutup ${s.tutup.toLocaleString('id-ID')}`}
    >
      {k.hari}
    </td>
  )
}

export function PanelDiary() {
  const baris = useIhsgOhlc()
  // Geser bulan. 0 = bulan hari bursa terakhir, −1 = bulan sebelumnya. Tak
  // pernah maju melewati 0: bulan depan belum ada datanya sama sekali.
  const [geser, setGeser] = useState(0)

  const sel = useMemo(() => (baris ? selDiary(baris) : []), [baris])
  const tally = useMemo(() => tallyDiary(sel, 30), [sel])
  const performa = useMemo(() => (baris ? performaIhsg(baris) : []), [baris])

  const bulan = useMemo(() => {
    if (!sel.length) return null
    const akhir = new Date(`${sel[sel.length - 1].tanggal}T00:00:00Z`)
    akhir.setUTCMonth(akhir.getUTCMonth() + geser)
    return bulanDiary(sel, akhir.getUTCFullYear(), akhir.getUTCMonth() + 1)
  }, [sel, geser])

  if (!baris || !bulan || !tally) return null

  // Bulan terjauh yang datanya ada — batas mundur tombol langkah.
  const batasMundur = sel.length
    ? (() => {
      const a = new Date(`${sel[0].tanggal}T00:00:00Z`)
      const b = new Date(`${sel[sel.length - 1].tanggal}T00:00:00Z`)
      return -((b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()))
    })()
    : 0

  const maks = Math.max(...performa.map((p) => Math.abs(p.persen ?? 0)), 1)

  return (
    <section className="panel dia-panel" style={{ marginBottom: 12 }}>
      <div className="panel-h">
        <span className="lbl">Diary Pasar · IHSG</span>
        <span className="dia-nav">
        <LangkahTanggal
          arah="mundur"
          onClick={() => setGeser((g) => Math.max(batasMundur, g - 1))}
          disabled={geser <= batasMundur}
          ukuran="sebaris"
          label="Bulan sebelumnya"
        />
        <span className="dia-bulan-nama">{NAMA_BULAN[bulan.bulan - 1]} {bulan.tahun}</span>
        <LangkahTanggal
          arah="maju"
          onClick={() => setGeser((g) => Math.min(0, g + 1))}
          disabled={geser >= 0}
          ukuran="sebaris"
          label="Bulan berikutnya"
        />
        </span>
      </div>
      <div className="panel-b dia-isi">
        <div className="dia-kiri">
          <table className="dia-kal">
            <thead>
              <tr>{HARI_PENDEK.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {bulan.minggu.map((m, i) => (
                <tr key={i}>
                  {m.map((kotak, k) => <Sel key={k} k={kotak} />)}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="dia-tally">
            <div className="dia-tally-baris">
              <span className="dia-pil dia-naik">{tally.hariNaik} hari naik</span>
              <span className="num up">{fpoin(tally.poinNaik)} ({fpersen(tally.persenNaik)})</span>
            </div>
            <div className="dia-tally-baris">
              <span className="dia-pil dia-turun">{tally.hariTurun} hari turun</span>
              <span className="num down">{fpoin(tally.poinTurun)} ({fpersen(tally.persenTurun)})</span>
            </div>
            <div className="dia-tally-baris dia-bersih">
              <span className="sub">Kumulatif 30 hari ({tally.hari} hari bursa)</span>
              <span className={`num ${tally.poinBersih >= 0 ? 'up' : 'down'}`}>
                {fpoin(tally.poinBersih)} ({fpersen(tally.persenBersih)})
              </span>
            </div>
          </div>
        </div>

        <div className="dia-kanan">
          <span className="sub">Performa IHSG</span>
          {performa.map((p) => (
            <div className="dia-perf" key={p.id}>
              <span className="dia-perf-lbl">{p.id}</span>
              <span className="dia-perf-bar">
                {p.persen !== null && (
                  <i
                    className={p.persen >= 0 ? 'up' : 'down'}
                    style={{ width: `${(Math.abs(p.persen) / maks) * 100}%` }}
                  />
                )}
              </span>
              <span className={`num dia-perf-nilai ${p.persen === null ? '' : p.persen >= 0 ? 'up' : 'down'}`}>
                {p.persen === null ? '—' : fpersen(p.persen)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
