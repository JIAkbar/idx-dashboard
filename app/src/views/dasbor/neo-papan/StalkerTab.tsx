import { useEffect, useMemo, useState } from 'react'
import { muatBrokerSemua, type BrokerHarianEmiten } from '../../../lib/dasbor/neoPapanData'
import { stalkerAgregasi, kodeBrokerUnik } from '../../../lib/dasbor/neoPapan'
import { fmtB, num, Kosong, Sumber } from './bersama'

const PERIODE = [1, 2, 3, 5, 10, 20, 60]

/**
 * Broker Stalker — Σ net beli/jual broker terpilih, lintas SELURUH emiten
 * yang punya arsip broker. Panen 2026 masih berjalan, jadi cakupannya wajib
 * dinyatakan (jumlah emiten & baris yang arsipnya belum menutupi seluruh
 * jendela) — bukan ditampilkan seolah lengkap.
 */
export function StalkerTab() {
  const [peta, setPeta] = useState<Map<string, BrokerHarianEmiten> | null>(null)
  const [dipilih, setDipilih] = useState<string[]>([])
  const [n, setN] = useState(5)

  useEffect(() => {
    let batal = false
    muatBrokerSemua().then((m) => { if (!batal) setPeta(m) })
    return () => { batal = true }
  }, [])

  const kodeBroker = useMemo(() => (peta ? kodeBrokerUnik(peta) : []), [peta])
  useEffect(() => {
    if (kodeBroker.length && dipilih.length === 0) setDipilih(kodeBroker.slice(0, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kodeBroker])

  const hasil = useMemo(() => (peta && dipilih.length ? stalkerAgregasi(peta, dipilih, n) : null), [peta, dipilih, n])

  if (peta === null) return <Kosong>Memuat arsip broker seluruh emiten…</Kosong>

  const toggle = (k: string) => setDipilih((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]))

  const Tabel = ({ judul, baris }: { judul: string; baris: typeof hasil extends null ? never : NonNullable<typeof hasil>['netBuy'] }) => (
    <div className="panel panel-b">
      <h3 style={{ marginTop: 0 }}>{judul}</h3>
      <div className="tbl">
        <table>
          <thead><tr><th>Emiten</th><th className="r">Net</th><th className="r">Beli</th><th className="r">Jual</th><th className="r">B.Avg</th><th className="r">S.Avg</th></tr></thead>
          <tbody>
            {baris.length === 0 ? (
              <tr><td colSpan={6} className="np-kosong">Tidak ada</td></tr>
            ) : baris.map((r) => (
              <tr key={r.emiten}>
                <td>
                  <b>{r.emiten}</b>
                  {hasil && r.cakupanHari < hasil.jendela.length && (
                    <span className="np-parsial" title="Arsip broker emiten ini belum menutupi seluruh jendela"> {r.cakupanHari}/{hasil.jendela.length}h</span>
                  )}
                </td>
                <td className={'r' + (r.net >= 0 ? ' up' : ' dn')}>{fmtB(r.net)}</td>
                <td className="r">{fmtB(r.beli)}</td>
                <td className="r">{fmtB(r.jual)}</td>
                <td className="r">{r.bavg != null ? num(r.bavg) : '—'}</td>
                <td className="r">{r.savg != null ? num(r.savg) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <section>
      <div className="panel panel-b">
        <h2>Broker Stalker</h2>
        <p className="np-sub">
          Net beli/jual broker terpilih di seluruh emiten yang sudah dipanen, pada N hari bursa terakhir.
          Cakupan: {peta.size} dari 963 emiten punya arsip broker.
        </p>
        <div className="np-baris">
          <span className="np-lbl">Broker</span>
          <div className="chips">
            {kodeBroker.map((k) => (
              <button key={k} type="button" className={'chip-t' + (dipilih.includes(k) ? ' on' : '')} onClick={() => toggle(k)}>{k}</button>
            ))}
          </div>
        </div>
        <div className="np-baris" style={{ marginTop: 8 }}>
          <span className="np-lbl">Jendela</span>
          {PERIODE.map((p) => (
            <button key={p} type="button" className={'chip-t' + (n === p ? ' on' : '')} onClick={() => setN(p)}>{p === 1 ? 'Hari ini' : `${p} hari`}</button>
          ))}
        </div>
      </div>

      {!hasil ? (
        <Kosong>Pilih minimal satu broker.</Kosong>
      ) : (
        <>
          <div className="np-2kol">
            <Tabel judul={`Stalking Net Buy — ${hasil.jendela[0] ?? ''} → ${hasil.jendela[hasil.jendela.length - 1] ?? ''}`} baris={hasil.netBuy} />
            <Tabel judul="Stalking Net Sell" baris={hasil.netSell} />
          </div>
          <Sumber>Rincian broker harian dari arsip Stockbit, pasar reguler seluruh investor, dijumlah lintas emiten.</Sumber>
        </>
      )}
    </section>
  )
}
