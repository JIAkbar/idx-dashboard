import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { muatKepemilikan, type Kepemilikan } from '../../../lib/dasbor/neoPapanData'
import { fmtB, num, TOKEN_SERI, Kosong, KvGrid, Kv, Sumber } from './bersama'

/** Balance Position — kepemilikan per tipe investor (KSEI), bulanan. */
export function BalanceTab({ kode }: { kode: string }) {
  const [ks, setKs] = useState<Kepemilikan | null | undefined>(undefined)

  useEffect(() => {
    let batal = false
    setKs(undefined)
    muatKepemilikan(kode).then((d) => { if (!batal) setKs(d) })
    return () => { batal = true }
  }, [kode])

  const bulan = useMemo(() => (ks ? Object.keys(ks.bulan).sort() : []), [ks])
  const jenisKode = useMemo(() => (ks ? Object.keys(ks.jenis) : []), [ks])
  const ki = useMemo(() => (ks ? Object.fromEntries(ks.kolom.map((c, i) => [c, i])) : {}), [ks])

  const configLembar = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!ks || !bulan.length) return null
    const abu = bacaTokenTema('--text2')
    // DUA tumpuk berdampingan per bulan (Lokal | Asing), warna per TIPE
    // investor — 18 lapis dalam SATU tumpuk tak terbaca (spek §6, diverifikasi
    // visual di 412px). Warna tipe sama di kedua sisi; sisi dibedakan posisi
    // batang + label tooltip, legenda cukup 9 entri tipe.
    const warnaTipe = (i: number) => bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length])
    const datasets = [
      ...jenisKode.map((t, i) => ({
        label: ks.jenis[t], backgroundColor: warnaTipe(i),
        data: bulan.map((b) => ks.bulan[b][ki['lokal_' + t]] ?? 0), stack: 'lokal',
      })),
      ...jenisKode.map((t, i) => ({
        label: 'Asing · ' + ks.jenis[t], backgroundColor: warnaTipe(i),
        data: bulan.map((b) => ks.bulan[b][ki['asing_' + t]] ?? 0), stack: 'asing',
      })),
    ]
    return {
      type: 'bar',
      data: { labels: bulan, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: abu, boxWidth: 10, font: { size: 9 },
              // satu entri per TIPE (set lokal); set asing warnanya sama
              filter: (item) => !String(item.text).startsWith('Asing · '),
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const it = items[0]
                const sisi = String(it.dataset.label).startsWith('Asing · ') ? 'Asing' : 'Lokal'
                return `${it.label} — ${sisi}`
              },
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: { color: abu, maxTicksLimit: 10 }, grid: { display: false } },
          y: { stacked: true, ticks: { color: abu, callback: (v) => fmtB(Number(v)) }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [ks, bulan, jenisKode, ki])
  const refLembar = useChartCanvas(configLembar)

  const configPorsi = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!ks || !bulan.length) return null
    const abu = bacaTokenTema('--text2')
    const lokal = bulan.map((b) => ks.bulan[b][ki.lokal_total] ?? 0)
    const asing = bulan.map((b) => ks.bulan[b][ki.asing_total] ?? 0)
    return {
      type: 'bar',
      data: {
        labels: bulan,
        datasets: [
          { label: 'Lokal', data: lokal.map((v, i) => (v + asing[i] ? v / (v + asing[i]) * 100 : 0)), backgroundColor: bacaTokenTema('--green'), stack: 'p' },
          { label: 'Asing', data: asing.map((v, i) => (v + lokal[i] ? v / (v + lokal[i]) * 100 : 0)), backgroundColor: bacaTokenTema('--blue'), stack: 'p' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: abu, boxWidth: 10, font: { size: 9 } } } },
        scales: {
          x: { stacked: true, ticks: { color: abu, maxTicksLimit: 10 }, grid: { display: false } },
          y: { stacked: true, max: 100, ticks: { color: abu, callback: (v) => v + '%' }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [ks, bulan, ki])
  const refPorsi = useChartCanvas(configPorsi)

  if (ks === undefined) return <Kosong>Memuat…</Kosong>
  if (!ks || !bulan.length) return <Kosong>Data kepemilikan KSEI emiten ini belum ada di arsip.</Kosong>

  const last = ks.bulan[bulan[bulan.length - 1]]
  const lok = last[ki.lokal_total], asg = last[ki.asing_total], tercatat = last[ki.lembar_tercatat]

  const persenScripless = tercatat ? num((lok + asg) / tercatat * 100, 1) : null

  return (
    <section className="panel panel-b">
      {/* Format judul NeoBDM (spek §6): % scripless langsung di judul supaya
          cakupan datanya terbaca sebelum angka apa pun di bawahnya. */}
      <h2>{kode} | Balance Position Analysis{persenScripless != null ? ` [${persenScripless}% scripless]` : ''}</h2>
      <p className="np-sub">Kepemilikan per tipe investor dari KSEI, bulanan {bulan[0]} → {bulan[bulan.length - 1]}.</p>

      <KvGrid>
        <Kv label="Tercatat scripless (KSEI)" value={fmtB(lok + asg)} />
        <Kv label="Dari saham tercatat" value={tercatat ? num((lok + asg) / tercatat * 100, 2) + '%' : '—'} />
        <Kv label="Porsi asing" value={lok + asg ? num(asg / (lok + asg) * 100, 2) + '%' : '—'} />
        <Kv label="Porsi lokal" value={lok + asg ? num(lok / (lok + asg) * 100, 2) + '%' : '—'} />
      </KvGrid>

      <div className="chart-wrap" style={{ height: 300, marginTop: 10 }}><canvas ref={refLembar} /></div>
      <div className="chart-wrap" style={{ height: 140, marginTop: 10 }}><canvas ref={refPorsi} /></div>

      <div className="np-peringatan">
        Angka ini hanya mencakup saham yang tercatat scripless di KSEI — untuk emiten ini {tercatat ? num((lok + asg) / tercatat * 100, 2) : '—'}%
        dari saham tercatat. &quot;Porsi asing&quot; di sini berarti porsi dari yang tercatat di KSEI, bukan dari seluruh saham beredar.
      </div>

      <Sumber>Kepemilikan bulanan resmi KSEI, per tipe investor.</Sumber>
    </section>
  )
}
