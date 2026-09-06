import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { bandingkanBaris } from '../../lib/dasbor/useUrut'
import { fp } from '../../lib/dasbor/format'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import {
  useJagoPapan, saringTab, konfigTab, keCsvJagoPapan, TAB_JAGO_PAPAN, TAB_JAGO_PAPAN_BAWAAN,
  type RowJagoPapan, type TabJagoPapan,
} from '../../lib/dasbor/jagoPapan'
import './JagoPapan.css'

type UrutState = { kunci: keyof RowJagoPapan; arah: 'naik' | 'turun'; klik: (k: keyof RowJagoPapan) => void }

function thSort(s: UrutState, k: keyof RowJagoPapan, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

function unduhCsv(nama: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  URL.revokeObjectURL(url)
}

const fmtRp = (v: number | null) => (v == null ? '—' : `Rp${fRingkas(v)}`)
// Rupiah BERTANDA (net asing, foreign flow bisa negatif) — sign di depan
// "Rp", bukan di tengah angka (`Rp-500 Jt` terbaca janggal). Pola sama
// PanelAliranAsing.tsx.
const fmtRpS = (v: number | null) => (v == null ? '—' : (v >= 0 ? '+' : '-') + 'Rp' + fRingkas(Math.abs(v)))
const fmtLbr = (v: number | null) => (v == null ? '—' : fRingkas(v))
const fmtPct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`)

/**
 * Jago Papan (`/jago-papan`, docs/spek-dev-papan/spek_jago_papan.md) — empat
 * screener siap-pakai bertema momentum, satu tab satu tema. Angkanya dari
 * `lib/dasbor/jagoPapan.ts` (pracetak `data-idx/json/jago_papan/terbaru.json`,
 * bar final tutup pasar terakhir — tak ada pemilih tanggal, beda dari
 * Harian Papan).
 */
export function JagoPapan() {
  const data = useJagoPapan()
  const [tab, setTab] = useState<TabJagoPapan>(TAB_JAGO_PAPAN_BAWAAN)
  const cfg = konfigTab(tab)
  const [kunci, setKunci] = useState<keyof RowJagoPapan>(cfg.urutBawaan)
  const [arah, setArah] = useState<'naik' | 'turun'>(cfg.arahBawaan)

  // Ganti tab -> kembali ke urut bawaan tab itu, BUKAN menyisakan urutan tab
  // sebelumnya (kolom sortnya beda-beda per tab, mempertahankan kunci lama
  // bisa menunjuk kolom yang di tab baru kurang relevan).
  useEffect(() => {
    setKunci(cfg.urutBawaan)
    setArah(cfg.arahBawaan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const lolos = useMemo(() => (data ? saringTab(data.emiten, tab) : []), [data, tab])
  const urut = useMemo(() => [...lolos].sort((a, b) => bandingkanBaris(a, b, kunci, arah)), [lolos, kunci, arah])
  const s: UrutState = {
    kunci, arah,
    klik: (k) => {
      if (k === kunci) setArah((a) => (a === 'naik' ? 'turun' : 'naik'))
      else { setKunci(k); setArah('turun') }
    },
  }

  if (!data) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Jago Papan</h1></div>
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p className="lbl">Memuat data Jago Papan…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lantai jgp">
      <div className="vhead">
        <h1>Jago Papan</h1>
        <span className="sub">Empat screener siap-pakai bertema momentum — bukan rekomendasi beli.</span>
      </div>

      <div className="panel">
        <div className="panel-b jgp-kepala">
          {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css). Tab;
              info hasil + Unduh CSV di grup-kanan. */}
          <div className="bilah-kendali jgp-alat">
            <div className="grup-k">
              <div className="tabs" role="tablist">
                {TAB_JAGO_PAPAN.map((t) => (
                  <button
                    key={t.id} role="tab" aria-selected={tab === t.id}
                    className={'tab' + (tab === t.id ? ' on' : '')}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k grup-kanan">
              <span className="muted">Data penutupan <b>{data.tanggal}</b> · {urut.length} dari {data.n} emiten lolos</span>
              <button
                type="button" className="btn-p"
                onClick={() => unduhCsv(`jago-papan-${cfg.id}-${data.tanggal}.csv`, keCsvJagoPapan(urut))}
              >
                Unduh CSV
              </button>
            </div>
          </div>
          <p className="jgp-aturan"><b>Aturan:</b> {cfg.aturan}</p>
        </div>

        <div className="board-tbl-wrap">
          <table className="tbl jgp-tbl">
            <thead>
              <tr>
                {thSort(s, 'kode', 'Kode')}
                {thSort(s, 'harga', 'Harga', true)}
                {thSort(s, 'chg_1d', '1D %', true)}
                {thSort(s, 'ma5', 'MA5', true)}
                {thSort(s, 'ma20', 'MA20', true)}
                {thSort(s, 'mcap', 'Market Cap', true)}
                {thSort(s, 'value', 'Value', true)}
                {thSort(s, 'volume', 'Volume', true)}
                {thSort(s, 'vol_ma20', 'Volume MA20', true)}
                {thSort(s, 'near52w', 'Near 52W High', true)}
                {thSort(s, 'net_asing', 'Net Asing', true)}
                {thSort(s, 'net_asing_ma10', 'Net Asing MA10', true)}
                {thSort(s, 'net_asing_streak', 'Streak Asing', true)}
                {thSort(s, 'foreign_flow_kum', 'Foreign Flow', true)}
                {thSort(s, 'foreign_flow_ma20', 'Foreign Flow MA20', true)}
              </tr>
            </thead>
            <tbody>
              {urut.map((b) => <BarisJagoPapanTbl key={b.kode} b={b} />)}
            </tbody>
          </table>
        </div>

        {urut.length === 0 && (
          <p className="muted" style={{ padding: '10px 14px' }}>Tak ada emiten lolos aturan tab ini hari ini.</p>
        )}
      </div>

      <div className="asal">
        Empat daftar di atas adalah <b>penyaring</b>, bukan rekomendasi beli — ambang v1, bisa berubah. Emiten yang
        tidak diperdagangkan (volume 0) dikeluarkan dari semua tab. <b>Near 52W High</b> = harga penutupan dibagi
        harga penutupan tertinggi ±52 minggu terakhir (bukan harga intrahari tertinggi). <b>Net Asing</b> dalam
        rupiah resmi bursa, dihitung dari data <b>penutupan pasar</b> — bisa berbeda dari sumber lain yang mengambil
        data saat pasar masih berjalan. Lihat rapor backtest tiap tema di{' '}
        <Link to="/bt-papan">BT Papan</Link>.
      </div>
    </div>
  )
}

function BarisJagoPapanTbl({ b }: { b: RowJagoPapan }) {
  return (
    <tr>
      <td><Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link></td>
      <td className="r num">{keFraksi(b.harga, 'dekat').toLocaleString('id-ID')}</td>
      <td className={`r num ${b.chg_1d == null ? '' : b.chg_1d >= 0 ? 'up' : 'dn'}`}>{fp(b.chg_1d)}</td>
      <td className="r num">{b.ma5 == null ? '—' : keFraksi(b.ma5, 'dekat').toLocaleString('id-ID')}</td>
      <td className="r num">{b.ma20 == null ? '—' : keFraksi(b.ma20, 'dekat').toLocaleString('id-ID')}</td>
      <td className="r num">{fmtRp(b.mcap)}</td>
      <td className="r num">{fmtRp(b.value)}</td>
      <td className="r num" title={b.volume == null ? undefined : `${b.volume.toLocaleString('id-ID')} lembar`}>
        {fmtLbr(b.volume)}
      </td>
      <td className="r num">{fmtLbr(b.vol_ma20)}</td>
      <td className="r num">{fmtPct(b.near52w)}</td>
      <td className={`r num ${b.net_asing >= 0 ? 'up' : 'dn'}`} title={`Rp${b.net_asing.toLocaleString('id-ID')}`}>
        {fmtRpS(b.net_asing)}
      </td>
      <td className="r num">{fmtRpS(b.net_asing_ma10)}</td>
      <td className={`r num ${b.net_asing_streak === 0 ? '' : b.net_asing_streak > 0 ? 'up' : 'dn'}`}>
        {b.net_asing_streak}
      </td>
      <td className="r num">{fmtRpS(b.foreign_flow_kum)}</td>
      <td className="r num">{fmtRpS(b.foreign_flow_ma20)}</td>
    </tr>
  )
}
