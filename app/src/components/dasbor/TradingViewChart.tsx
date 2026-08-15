import { useEffect, useId, useRef } from 'react'
import type { Theme } from '../../context/ThemeContext'

declare global {
  interface Window {
    TradingView: any
  }
}

interface TradingViewChartProps {
  symbol: string
  theme: Theme
}

/** tv.js dimuat on-demand (bukan lagi <script> statis di index.html — halaman
 * lain yang tidak pernah membuka Chart Indeks tak perlu ikut mengunduhnya).
 * Promise di-cache di modul: banyak instance TradingViewChart bisa hidup
 * berbarengan (ganti grup/simbol memasang ulang), tapi skrip cuma disisipkan
 * sekali per sesi. */
let tvScriptPromise: Promise<void> | null = null
function muatTvScript(): Promise<void> {
  if (window.TradingView) return Promise.resolve()
  tvScriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Gagal memuat tv.js'))
    document.head.appendChild(s)
  })
  return tvScriptPromise
}

/**
 * Wrapper widget TradingView Advanced Chart — port buildTVChart() index_live.html
 * baris 3539-3554. Widget ini tidak punya API resmi utk update simbol/tema di
 * versi ini, jadi tiap kali `symbol`/`theme` berubah, container di-reset dan
 * widget dibuat ulang (persis pola sumber: ganti innerHTML lalu `new
 * TradingView.widget(...)`).
 */
export function TradingViewChart({ symbol, theme }: TradingViewChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const boxId = useId()

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.innerHTML = `<div id="${boxId}" style="height:100%"></div>`

    let cancelled = false

    muatTvScript()
      .then(() => {
        if (cancelled) return
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval: 'D',
          timezone: 'Asia/Jakarta',
          theme,
          style: '1',
          locale: 'id',
          toolbar_bg: theme === 'dark' ? '#141920' : '#f1f3f6',
          enable_publishing: false,
          allow_symbol_change: true,
          save_image: false,
          container_id: boxId,
        })
      })
      // Gagal muat skrip pihak ketiga — panel tetap kosong, bukan crash.
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [symbol, theme, boxId])

  return <div ref={wrapRef} style={{ height: '100%' }} />
}
