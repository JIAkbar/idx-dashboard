import { useEffect, useMemo, useState } from 'react'
import { muatBrokerHarian, type BrokerHarianEmiten } from '../../../lib/dasbor/neoPapanData'
import { agregasiBroker, avgHarga } from '../../../lib/dasbor/neoPapan'
import { warnaBrokerCanvas } from '../../../lib/dasbor/kelompokBroker'
import { fmtB, num, pct, Kosong, Sumber } from './bersama'

/** Bandingkan akumulasi broker pada dua sub-rentang tanggal dalam jendela arsip. */
export function CompareTab({ kode }: { kode: string }) {
  const [data, setData] = useState<BrokerHarianEmiten | null | undefined>(undefined)

  useEffect(() => {
    let batal = false
    setData(undefined)
    muatBrokerHarian(kode).then((d) => { if (!batal) setData(d) })
    return () => { batal = true }
  }, [kode])

  const tanggal = useMemo(() => (data ? Object.keys(data.hari).sort() : []), [data])
  const tengah = Math.max(0, Math.floor(tanggal.length / 2))
  const [kiri, setKiri] = useState<[string, string]>(['', ''])
  const [kanan, setKanan] = useState<[string, string]>(['', ''])

  useEffect(() => {
    if (!tanggal.length) return
    setKiri([tanggal[0], tanggal[Math.max(0, tengah - 1)]])
    setKanan([tanggal[tengah], tanggal[tanggal.length - 1]])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const rentangKiri = useMemo(() => tanggal.filter((t) => t >= kiri[0] && t <= kiri[1]), [tanggal, kiri])
  const rentangKanan = useMemo(() => tanggal.filter((t) => t >= kanan[0] && t <= kanan[1]), [tanggal, kanan])
  const aggKiri = useMemo(() => (data ? agregasiBroker(data.hari, rentangKiri) : []), [data, rentangKiri])
  const aggKanan = useMemo(() => (data ? agregasiBroker(data.hari, rentangKanan) : []), [data, rentangKanan])

  const gabung = useMemo(() => {
    const kiriMap = new Map(aggKiri.map((a) => [a.kode, a]))
    const kananMap = new Map(aggKanan.map((a) => [a.kode, a]))
    const kode2 = new Set([...kiriMap.keys(), ...kananMap.keys()])
    return [...kode2].map((k) => {
      const l = kiriMap.get(k), r = kananMap.get(k)
      return {
        kode: k,
        netKiri: l?.net ?? 0, netKanan: r?.net ?? 0,
        bavgKiri: l ? avgHarga(l.beliNilai, l.beliLot) : null, savgKiri: l ? avgHarga(l.jualNilai, l.jualLot) : null,
        bavgKanan: r ? avgHarga(r.beliNilai, r.beliLot) : null, savgKanan: r ? avgHarga(r.jualNilai, r.jualLot) : null,
      }
    }).sort((a, b) => (b.netKiri + b.netKanan) - (a.netKiri + a.netKanan))
  }, [aggKiri, aggKanan])

  if (data === undefined) return <Kosong>Memuat…</Kosong>
  if (!data || tanggal.length < 2) return <Kosong>Rincian broker emiten ini belum tersedia — panen arsip broker masih berjalan.</Kosong>

  return (
    <section className="panel panel-b">
      <h2>{kode} — Compare Inventory</h2>
      <p className="np-sub">
        Bandingkan akumulasi per broker pada dua sub-rentang tanggal, dari jendela arsip yang tersedia
        ({tanggal[0]} → {tanggal[tanggal.length - 1]}).
      </p>

      <div className="np-baris">
        <span className="np-lbl">Kiri</span>
        <select className="inp" value={kiri[0]} onChange={(e) => setKiri([e.target.value, kiri[1]])}>{tanggal.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="inp" value={kiri[1]} onChange={(e) => setKiri([kiri[0], e.target.value])}>{tanggal.map((t) => <option key={t}>{t}</option>)}</select>
        <span className="np-lbl">Kanan</span>
        <select className="inp" value={kanan[0]} onChange={(e) => setKanan([e.target.value, kanan[1]])}>{tanggal.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="inp" value={kanan[1]} onChange={(e) => setKanan([kanan[0], e.target.value])}>{tanggal.map((t) => <option key={t}>{t}</option>)}</select>
      </div>

      <div className="tbl" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Broker</th>
              <th className="r">Net kiri</th><th className="r">B.Avg kiri</th><th className="r">S.Avg kiri</th>
              <th className="r">Net kanan</th><th className="r">B.Avg kanan</th><th className="r">S.Avg kanan</th>
              <th className="r">Perubahan</th><th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {gabung.slice(0, 30).map((x) => (
              <tr key={x.kode}>
                <td><b style={{ color: warnaBrokerCanvas(x.kode) }}>{x.kode}</b></td>
                <td className={'r' + (x.netKiri >= 0 ? ' up' : ' dn')}>{fmtB(x.netKiri)}</td>
                <td className="r">{x.bavgKiri != null ? num(x.bavgKiri) : '—'}</td>
                <td className="r">{x.savgKiri != null ? num(x.savgKiri) : '—'}</td>
                <td className={'r' + (x.netKanan >= 0 ? ' up' : ' dn')}>{fmtB(x.netKanan)}</td>
                <td className="r">{x.bavgKanan != null ? num(x.bavgKanan) : '—'}</td>
                <td className="r">{x.savgKanan != null ? num(x.savgKanan) : '—'}</td>
                <td className="r">{x.netKiri ? pct((x.netKanan - x.netKiri) / Math.abs(x.netKiri) * 100) : '—'}</td>
                <td className={'r' + (x.netKiri + x.netKanan >= 0 ? ' up' : ' dn')}>{fmtB(x.netKiri + x.netKanan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sumber>Rincian broker harian dari arsip Stockbit, pasar reguler seluruh investor.</Sumber>
    </section>
  )
}
