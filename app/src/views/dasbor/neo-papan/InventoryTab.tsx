import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { muatBrokerHarian, type BrokerHarianEmiten } from '../../../lib/dasbor/neoPapanData'
import { agregasiBroker, kumulatifBroker, topNet, avgHarga } from '../../../lib/dasbor/neoPapan'
import { warnaBrokerCanvas } from '../../../lib/dasbor/kelompokBroker'
import { fmtB, num, Kosong, Sumber } from './bersama'

/**
 * Inventory Chart — net kumulatif per broker sepanjang jendela arsip yang
 * ada (5 net buyer & 5 net seller terbesar), tabel lengkap di bawahnya.
 * Jendela dibatasi oleh isi arsip broker emiten ini (tidak selalu sepanjang
 * rentang candle yang dipilih di atas — broker biasanya jauh lebih pendek).
 */
export function InventoryTab({ kode }: { kode: string }) {
  const [data, setData] = useState<BrokerHarianEmiten | null | undefined>(undefined)

  useEffect(() => {
    let batal = false
    setData(undefined)
    muatBrokerHarian(kode).then((d) => { if (!batal) setData(d) })
    return () => { batal = true }
  }, [kode])

  const tanggal = useMemo(() => (data ? Object.keys(data.hari).sort() : []), [data])
  const agg = useMemo(() => (data ? agregasiBroker(data.hari, tanggal) : []), [data, tanggal])
  const { pembeli, penjual } = useMemo(() => topNet(agg, 5), [agg])
  const terpilih = useMemo(() => [...pembeli, ...penjual].map((a) => a.kode), [pembeli, penjual])
  const kum = useMemo(() => (data ? kumulatifBroker(tanggal, data.hari, terpilih) : null), [data, tanggal, terpilih])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!kum || !kum.tanggal.length) return null
    const abu = bacaTokenTema('--text2')
    return {
      type: 'line',
      data: {
        labels: kum.tanggal,
        datasets: kum.seri.map((s) => ({
          label: s.broker, data: s.nilai, borderColor: warnaBrokerCanvas(s.broker),
          borderWidth: pembeli.some((p) => p.kode === s.broker) ? 2.2 : 1.4,
          borderDash: penjual.some((p) => p.kode === s.broker) ? [4, 3] : [],
          pointRadius: 0, tension: 0.1,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { color: abu, boxWidth: 12, font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: abu, maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: abu, callback: (v) => fmtB(Number(v)) }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [kum, pembeli, penjual])
  const ref = useChartCanvas(config)

  if (data === undefined) return <Kosong>Memuat…</Kosong>
  if (!data) return <Kosong>Rincian broker emiten ini belum tersedia — panen arsip broker masih berjalan.</Kosong>

  const semua = [...agg].sort((a, b) => b.net - a.net)

  return (
    <section className="panel panel-b">
      <h2>{kode} — Inventory Chart</h2>
      <p className="np-sub">
        Net kumulatif (beli − jual) per broker, {tanggal[0]} → {tanggal[tanggal.length - 1]}
        {' '}({tanggal.length} hari bursa yang ada arsipnya) — garis solid pembeli, putus-putus penjual.
      </p>
      {config ? <div className="chart-wrap" style={{ height: 320 }}><canvas ref={ref} /></div> : <Kosong>Tak ada broker aktif pada jendela ini.</Kosong>}

      <div className="tbl" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Broker</th><th className="r">Net</th><th className="r">Beli</th><th className="r">Jual</th><th className="r">B.Avg</th><th className="r">S.Avg</th></tr></thead>
          <tbody>
            {semua.map((a) => (
              <tr key={a.kode}>
                <td><b style={{ color: warnaBrokerCanvas(a.kode) }}>{a.kode}</b></td>
                <td className={'r' + (a.net >= 0 ? ' up' : ' dn')}>{fmtB(a.net)}</td>
                <td className="r">{fmtB(a.beliNilai)}</td>
                <td className="r">{fmtB(a.jualNilai)}</td>
                <td className="r">{avgHarga(a.beliNilai, a.beliLot) != null ? num(avgHarga(a.beliNilai, a.beliLot)!) : '—'}</td>
                <td className="r">{avgHarga(a.jualNilai, a.jualLot) != null ? num(avgHarga(a.jualNilai, a.jualLot)!) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sumber>Rincian broker harian dari arsip Stockbit, pasar reguler seluruh investor.</Sumber>
    </section>
  )
}
