/**
 * Panel mini "Detak hari ini" — satu batang per tarikan live (#157 A).
 *
 * Johan 9 Sep 2026, menunjuk daftar teks tape di kartu Whales: *"kurang efektif
 * ini lebih baik di munculkan di candle nya langsung"*. Daftar itu memaksa
 * membaca sembilan baris angka untuk menjawab pertanyaan yang bentuknya
 * visual — kapan ramai, kapan sepi. Satu batang per tarikan menjawabnya
 * sekali lihat.
 *
 * Tingginya PERTAMBAHAN lot pada satu jendela, bukan volume kumulatif:
 * kumulatif hanya bisa naik, jadi grafiknya berupa tangga yang tak pernah
 * menunjukkan sepi. Warnanya arah harga sepanjang jendela itu — dan jendela
 * yang tak punya harga di salah satu ujungnya digambar netral, bukan hijau:
 * "tak tahu" tidak boleh terlihat seperti "naik".
 *
 * Datanya dari tape yang SUDAH ada di memori halaman — nol permintaan
 * tambahan, nol endpoint baru, dan hilang saat halaman ditutup.
 */
import { useEffect, useRef, useState } from 'react'
import {
  ColorType, HistogramSeries, createChart,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from 'lightweight-charts'
import { bacaTokenTema } from '../../lib/dasbor/useChartJs'
import { jamDetikJakarta } from '../../lib/tanggalBursa'
import type { BarisTape } from '../../lib/dasbor/tapeLive'

const TINGGI = 90

export function DetakHariIni({ tape, tema, rupiah }: {
  tape: BarisTape[]
  tema: string
  /** Pemformat rupiah ringkas milik halaman — dipinjam, bukan disalin, supaya
   *  satu kartu tak pernah memakai dua konvensi angka. */
  rupiah: (n: number) => string
}) {
  const wadah = useRef<HTMLDivElement | null>(null)
  /** Batang yang sedang disorot. Nilai tape dicari dari stempelnya, bukan
   *  dititipkan ke seri: pustaka hanya menyimpan `value`, sedangkan yang perlu
   *  dibaca justru rupiah dan frekuensinya. */
  const [sorot, setSorot] = useState<{ b: BarisTape; x: number } | null>(null)
  const petaTape = useRef<Map<number, BarisTape>>(new Map())
  const chart = useRef<IChartApi | null>(null)
  const seri = useRef<ISeriesApi<'Histogram'> | null>(null)

  useEffect(() => {
    const el = wadah.current
    if (!el) return
    const teks = bacaTokenTema('--text3', '#8F98A6')
    const c = createChart(el, {
      width: el.clientWidth,
      height: TINGGI,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: teks, fontSize: 10 },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: { horzLine: { visible: false } },
      timeScale: {
        timeVisible: true, secondsVisible: true, borderVisible: false,
        // Sumbu jam WIB, bukan UTC: pustaka memformat stempel dalam UTC kalau
        // dibiarkan, dan "06:30" di bawah batang pukul setengah dua siang
        // adalah kebingungan yang tak perlu.
        tickMarkFormatter: (t: UTCTimestamp) => jamDetikJakarta(new Date((t as number) * 1000)).slice(0, 5),
      },
      localization: {
        timeFormatter: (t: UTCTimestamp) => jamDetikJakarta(new Date((t as number) * 1000)),
      },
    })
    const s = c.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    })
    chart.current = c
    seri.current = s
    const saatGeser = (p: { time?: unknown; point?: { x: number } }) => {
      const t = typeof p.time === 'number' ? p.time : null
      const b = t == null ? undefined : petaTape.current.get(t)
      if (b && p.point) setSorot({ b, x: p.point.x })
      else setSorot((cur) => (cur ? null : cur))
    }
    c.subscribeCrosshairMove(saatGeser)
    const ukur = new ResizeObserver(() => c.applyOptions({ width: el.clientWidth }))
    ukur.observe(el)
    return () => {
      c.unsubscribeCrosshairMove(saatGeser)
      ukur.disconnect(); c.remove(); chart.current = null; seri.current = null
    }
  }, [tema])

  useEffect(() => {
    const s = seri.current
    if (!s) return
    const naik = bacaTokenTema('--naik', '#38B77E')
    const turun = bacaTokenTema('--turun', '#E6635A')
    const datar = bacaTokenTema('--text3', '#8F98A6')
    // Tape disimpan terbaru-di-depan; sumbu waktu menuntut menaik. Stempel
    // dibulatkan ke detik — dua tarikan berjarak 10 detik tak akan bertabrakan.
    const data = [...tape]
      .sort((a, b) => a.pada - b.pada)
      .map((b) => ({
        time: Math.floor(b.pada / 1000) as UTCTimestamp,
        value: b.volume / 100,
        color: b.arah === 1 ? naik : b.arah === -1 ? turun : datar,
      }))
    s.setData(data)
    petaTape.current = new Map([...tape].map((b) => [Math.floor(b.pada / 1000), b]))
    chart.current?.timeScale().fitContent()
  }, [tape, tema])

  return (
    <div className="wp-detak-bungkus">
      <div ref={wadah} className="wp-detak" style={{ height: TINGGI }} />
      {sorot && (
        <div
          className="wp-fp-tip"
          style={{
            left: sorot.x > (wadah.current?.clientWidth ?? 0) / 2 ? undefined : sorot.x + 14,
            right: sorot.x > (wadah.current?.clientWidth ?? 0) / 2
              ? (wadah.current?.clientWidth ?? 0) - sorot.x + 14 : undefined,
            top: 4,
          }}
        >
          <div className="wp-fp-tip-judul">{jamDetikJakarta(new Date(sorot.b.pada))} WIB</div>
          <div>
            +{Math.round(sorot.b.volume / 100).toLocaleString('id-ID')} lot · Rp {rupiah(sorot.b.value)}
            {' · '}{sorot.b.frequency.toLocaleString('id-ID')} kali
            {sorot.b.jendela > 1 && ` · gabungan ${sorot.b.jendela} jendela`}
          </div>
        </div>
      )}
    </div>
  )
}
