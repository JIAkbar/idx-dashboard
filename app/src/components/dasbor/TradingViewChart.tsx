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

/**
 * Wrapper widget TradingView Advanced Chart — port buildTVChart() index_live.html
 * baris 3539-3554. Widget ini tidak punya API resmi utk update simbol/tema di
 * versi ini, jadi tiap kali `symbol`/`theme` berubah, container di-reset dan
 * widget dibuat ulang (persis pola sumber: ganti innerHTML lalu `new
 * TradingView.widget(...)`). tv.js dimuat async di index.html; kalau
 * window.TradingView belum siap saat efek jalan, retry tiap 150ms sampai ada.
 */
export function TradingViewChart({ symbol, theme }: TradingViewChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const boxId = useId()

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.innerHTML = `<div id="${boxId}" style="height:100%"></div>`

    let cancelled = false
    let poll: ReturnType<typeof setInterval> | undefined

    function init() {
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
    }

    if (window.TradingView) {
      init()
    } else {
      poll = setInterval(() => {
        if (window.TradingView) {
          if (poll) clearInterval(poll)
          init()
        }
      }, 150)
    }

    return () => {
      cancelled = true
      if (poll) clearInterval(poll)
    }
  }, [symbol, theme, boxId])

  return <div ref={wrapRef} style={{ height: '100%' }} />
}
