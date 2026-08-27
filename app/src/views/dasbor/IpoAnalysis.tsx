import { useMemo, useState } from 'react'
import { IkonMenu, IKON_CARI, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { KonteksData } from '../../components/dasbor/KonteksData'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { useUrut } from '../../lib/dasbor/useUrut'
import { fp } from '../../lib/dasbor/format'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import {
  useIpo, agregatPerTahun, agregatKeseluruhan, tahunUnik,
  type BarisIpo, type HorizonAgregat, type UnderwriterRapor,
} from '../../lib/dasbor/ipo'
import './IpoAnalysis.css'

/** Fraksi (0..1) → persen TANPA tanda plus — win rate itu proporsi, bukan
 *  perubahan; `+55%` terbaca seperti return (temuan review visual 27 Agu). */
function fPersen(v: number | null, d = 0): string {
  return v == null ? '—' : `${(v * 100).toFixed(d).replace('.', ',')}%`
}

function kelasSign(v: number | null): 'up' | 'dn' | '' {
  return v == null ? '' : v > 0 ? 'up' : v < 0 ? 'dn' : ''
}

/** Satu baris horizon di dalam kartu tahun/ringkasan — label, win rate, n. */
function BarisHorizon({ label, h }: { label: string; h: HorizonAgregat }) {
  return (
    <div className="ipo-hrow">
      <span className="muted">{label}</span>
      <span className={`num ${kelasSign(h.win)}`}>{fPersen(h.win)}</span>
      <span className="muted ipo-hrow-n">n={h.n}</span>
    </div>
  )
}

type Tab = 'tabel' | 'penjamin'

/**
 * IPO Papan (`/ipo`, spek §G) — kartu ringkas per tahun + tabel IPO + rapor
 * penjamin emisi. Angkanya SUDAH dihitung sisi Node (`app/scripts/bangun-ipo.mjs`
 * → `data-idx/json/ipo.json`); berkas ini cuma saring/urut/format, pola sama
 * `Screener.tsx`.
 */
export function IpoAnalysis() {
  const data = useIpo()
  const [tab, setTab] = useState<Tab>('tabel')
  const [tahunAktif, setTahunAktif] = useState('semua')
  const [cariPenjamin, setCariPenjamin] = useState('')

  const emiten = data?.emiten ?? []
  const tahunAgg = useMemo(() => agregatPerTahun(emiten), [emiten])
  const keseluruhan = useMemo(() => agregatKeseluruhan(emiten), [emiten])
  const daftarTahun = useMemo(() => tahunUnik(emiten), [emiten])

  const barisTabel = useMemo(
    () => (tahunAktif === 'semua' ? emiten : emiten.filter((e) => String(e.tahun) === tahunAktif)),
    [emiten, tahunAktif],
  )
  const sTabel = useUrut<BarisIpo>(barisTabel, 'tanggal_listing', 'turun')

  const penjaminSaring = useMemo(() => {
    const q = cariPenjamin.trim().toUpperCase()
    const list = data?.underwriter ?? []
    return q ? list.filter((u) => u.nama.includes(q)) : list
  }, [data, cariPenjamin])
  const sPenjamin = useUrut<UnderwriterRapor>(penjaminSaring, 'n', 'turun')

  if (!data) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>IPO Papan</h1></div>
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Memuat data IPO…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lantai">
      <div className="vhead">
        <div>
          <h1>IPO Papan</h1>
          <span className="sub">{data.n} emiten tercatat sejak listing perdana, dengan rapor penjamin emisi.</span>
        </div>
      </div>
      <KonteksData tanggal={data.tanggal} />

      <div className="panel">
        <div className="panel-b">
          <p className="lbl" style={{ marginBottom: 8 }}>Ringkasan seluruh tahun</p>
          <div className="rasio">
            <div>
              <span className="lbl">Total IPO</span>
              <div className="v num">{keseluruhan.n}</div>
              <span className="sub">{data.dilewati} profil dilewati</span>
            </div>
            <div>
              <span className="lbl">Win rate 1D</span>
              <div className={`v num ${kelasSign(keseluruhan.h1d.win)}`}>{fPersen(keseluruhan.h1d.win)}</div>
              <span className="sub">n={keseluruhan.h1d.n}</span>
            </div>
            <div>
              <span className="lbl">Win rate 1W</span>
              <div className={`v num ${kelasSign(keseluruhan.h1w.win)}`}>{fPersen(keseluruhan.h1w.win)}</div>
              <span className="sub">n={keseluruhan.h1w.n}</span>
            </div>
            <div>
              <span className="lbl">Win rate 1M</span>
              <div className={`v num ${kelasSign(keseluruhan.h1m.win)}`}>{fPersen(keseluruhan.h1m.win)}</div>
              <span className="sub">n={keseluruhan.h1m.n}</span>
            </div>
            <div>
              <span className="lbl">Win rate Kini</span>
              <div className={`v num ${kelasSign(keseluruhan.hkini.win)}`}>{fPersen(keseluruhan.hkini.win)}</div>
              <span className="sub">n={keseluruhan.hkini.n}</span>
            </div>
          </div>
        </div>

        <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="lbl" style={{ marginBottom: 8 }}>Per tahun listing — angka = win rate (porsi IPO yang return-nya positif pada horizon itu)</p>
          <div className="grid3 ipo-tahun-grid">
            {tahunAgg.map((t) => (
              <div className="vcard" key={t.tahun}>
                <span className="lbl">{t.tahun}</span>
                <span className="v-num num">{t.n} IPO</span>
                <div className="ipo-hlist">
                  <BarisHorizon label="1D" h={t.h1d} />
                  <BarisHorizon label="1W" h={t.h1w} />
                  <BarisHorizon label="1M" h={t.h1m} />
                  <BarisHorizon label="Kini" h={t.hkini} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-b ipo-tabs-bar">
          <div className="tabs" role="tablist" aria-label="Tampilan IPO Papan">
            <button type="button" role="tab" aria-selected={tab === 'tabel'} className={`tab${tab === 'tabel' ? ' on' : ''}`} onClick={() => setTab('tabel')}>
              Tabel
            </button>
            <button type="button" role="tab" aria-selected={tab === 'penjamin'} className={`tab${tab === 'penjamin' ? ' on' : ''}`} onClick={() => setTab('penjamin')}>
              Penjamin Emisi
            </button>
          </div>
          {tab === 'tabel' && (
            <Dropdown
              ariaLabel="Saring tahun"
              placeholder="Semua tahun"
              nilai={tahunAktif}
              onGanti={setTahunAktif}
              opsi={[{ nilai: 'semua', label: 'Semua tahun' }, ...daftarTahun.map((th) => ({ nilai: String(th), label: String(th) }))]}
            />
          )}
          {tab === 'penjamin' && (
            <span className="af-cari">
              <IkonMenu d={IKON_CARI} size={13} />
              <input className="inp" type="search" placeholder="Cari penjamin emisi…" value={cariPenjamin} onChange={(e) => setCariPenjamin(e.target.value)} />
            </span>
          )}
        </div>

        {tab === 'tabel' && <TabelIpo s={sTabel} />}
        {tab === 'penjamin' && <TabelPenjamin s={sPenjamin} />}
      </div>

      <div className="asal">
        Data <b>{data.tanggal}</b> · <b>{data.n}</b> IPO tercatat, <b>{data.dilewati}</b> profil dilewati (tanpa tanggal/harga
        listing yang valid) · diperbarui {data.diperbarui}. Harga IPO & penjamin emisi dari profil publik emiten. Return
        dihitung dari harga penutupan yang <b>sudah disesuaikan</b> aksi korporasi (bukan harga mentah saat listing) —
        untuk IPO yang jauh lebih tua dari arsip harga, perbandingan langsung ke harga IPO bisa meleset. <b>1D/1W/1M</b> =
        harga pada bar ke-1/5/21 sejak bar pertama yang tanggalnya ≥ tanggal listing; <b>Kini</b> = bar terakhir arsip.
        <b> Win</b> = return &gt; 0.
      </div>
    </div>
  )
}

function thSortTabel(s: ReturnType<typeof useUrut<BarisIpo>>, k: keyof BarisIpo, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

function TabelIpo({ s }: { s: ReturnType<typeof useUrut<BarisIpo>> }) {
  return (
    <div className="board-tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {thSortTabel(s, 'kode', 'Kode')}
            {thSortTabel(s, 'tanggal_listing', 'Tgl Listing')}
            {thSortTabel(s, 'harga_ipo', 'Harga IPO', true)}
            {thSortTabel(s, 'dana', 'Dana', true)}
            {thSortTabel(s, 'return_1d', 'Return 1D', true)}
            {thSortTabel(s, 'return_1w', 'Return 1W', true)}
            {thSortTabel(s, 'return_1m', 'Return 1M', true)}
            {thSortTabel(s, 'return_kini', 'Return Kini', true)}
            <th>Penjamin Emisi</th>
          </tr>
        </thead>
        <tbody>
          {s.urut.map((e) => (
            <tr key={e.kode}>
              <td><span className="tick">{e.kode}</span></td>
              <td title={e.nama ?? undefined}>{e.tanggal_listing}</td>
              <td className="r num">{e.harga_ipo.toLocaleString('id-ID')}</td>
              <td className="r num">{e.dana == null ? '—' : `Rp${fRingkas(e.dana)}`}</td>
              <td className={`r num ${kelasSign(e.return_1d)}`}>{fp(e.return_1d)}</td>
              <td className={`r num ${kelasSign(e.return_1w)}`}>{fp(e.return_1w)}</td>
              <td className={`r num ${kelasSign(e.return_1m)}`}>{fp(e.return_1m)}</td>
              <td className={`r num ${kelasSign(e.return_kini)}`}>{fp(e.return_kini)}</td>
              <td className="ipo-uw-cell">
                {e.underwriters.length === 0
                  ? <span className="muted">—</span>
                  : e.underwriters.map((u) => <span key={u} className="chip-t">{u}</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.urut.length === 0 && <p className="muted" style={{ padding: '10px 14px' }}>Tak ada IPO di tahun ini.</p>}
    </div>
  )
}

function thSortPenjamin(s: ReturnType<typeof useUrut<UnderwriterRapor>>, k: keyof UnderwriterRapor, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

function TabelPenjamin({ s }: { s: ReturnType<typeof useUrut<UnderwriterRapor>> }) {
  return (
    <div className="board-tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {thSortPenjamin(s, 'nama', 'Penjamin Emisi')}
            {thSortPenjamin(s, 'n', 'n IPO', true)}
            <th className="r">Win 1D</th>
            <th className="r">Median 1D</th>
            <th className="r">Win 1W</th>
            <th className="r">Median 1W</th>
            <th className="r">Win 1M</th>
            <th className="r">Median 1M</th>
            <th className="r">Win Kini</th>
            <th className="r">Median Kini</th>
          </tr>
        </thead>
        <tbody>
          {s.urut.map((u) => (
            <tr key={u.nama}>
              <td>{u.nama}</td>
              <td className="r num">{u.n}</td>
              <td className={`r num ${kelasSign(u.h1d.win)}`}>{fPersen(u.h1d.win)}</td>
              <td className={`r num ${kelasSign(u.h1d.median)}`}>{fp(u.h1d.median)}</td>
              <td className={`r num ${kelasSign(u.h1w.win)}`}>{fPersen(u.h1w.win)}</td>
              <td className={`r num ${kelasSign(u.h1w.median)}`}>{fp(u.h1w.median)}</td>
              <td className={`r num ${kelasSign(u.h1m.win)}`}>{fPersen(u.h1m.win)}</td>
              <td className={`r num ${kelasSign(u.h1m.median)}`}>{fp(u.h1m.median)}</td>
              <td className={`r num ${kelasSign(u.hkini.win)}`}>{fPersen(u.hkini.win)}</td>
              <td className={`r num ${kelasSign(u.hkini.median)}`}>{fp(u.hkini.median)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.urut.length === 0 && <p className="muted" style={{ padding: '10px 14px' }}>Tak ada penjamin emisi cocok.</p>}
    </div>
  )
}
