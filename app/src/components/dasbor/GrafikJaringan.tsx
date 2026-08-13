import { useEffect, useRef } from 'react'
import type { GLink, GNode } from '../../lib/dasbor/graphRender'
import { renderFocusedGraph, renderForceGraph } from '../../lib/dasbor/graphRender'
import type { GraphSelection, InvestorMapEntry } from '../../lib/dasbor/petaInvestorData'
import { useTheme } from '../../context/ThemeContext'
import type { Simulation } from 'd3'

interface GrafikJaringanProps {
  /** Seluruh dataset (952 emiten) — dipakai tooltip & focused view untuk cari cross-holdings. */
  allData: InvestorMapEntry[]
  /** Emiten yang dirender sebagai node saat TIDAK focused (default: 10 pertama, atau portofolio investor yang diklik). Diabaikan kalau focusCode diisi. */
  emitenList: InvestorMapEntry[]
  /** Kalau diisi, graf beralih ke "focused view" 1 emiten di tengah (port piRenderFocused). */
  focusCode: string | null
  onSelect: (sel: GraphSelection | null) => void
}

/**
 * Wrapper React untuk graf D3 imperatif — port markup baris 51-60 +
 * piInit/piRender/piRenderFocused index_live.html. D3 memanipulasi DOM
 * langsung (bukan declarative React), jadi dibungkus useRef+useEffect;
 * simulation lama SELALU di-stop() sebelum render ulang / saat unmount
 * supaya tidak numpuk multiple force simulation berjalan bersamaan.
 */
export function GrafikJaringan({ allData, emitenList, focusCode, onSelect }: GrafikJaringanProps) {
  const graphRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GNode, GLink> | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const wrap = graphRef.current
    if (!wrap) return
    simRef.current?.stop()
    simRef.current = null
    let raf = 0

    function gambar() {
      if (!wrap) return
      // Penjaga lebar (papan #26): kedua fungsi render mengambil lebar wadah
      // untuk menaruh titik pusat & lebar SVG. Kalau dipanggil sebelum tata
      // letak siap, lebarnya 0 dan graf digambar untuk kanvas 900px semu lalu
      // meluber di telepon. Penjaga ditaruh SATU KALI di sini — titik panggil
      // tunggal kedua fungsi itu — bukan ditambal di masing-masing render.
      if (wrap.getBoundingClientRect().width < 2) {
        raf = requestAnimationFrame(gambar)
        return
      }
      // Papan #tooltip-nyantol: tooltip adalah elemen DOM PERSISTEN (sibling
      // dari `wrap`, bukan anak SVG yang ikut kehapus tiap render). Ganti mode
      // (fokus <-> umum) atau data (filter/tab/tema) memicu render ulang yang
      // menghapus node SVG lama LANGSUNG (innerHTML=''), jadi event
      // `mouseout` node yang biasanya menyembunyikan tooltip tidak sempat
      // terpicu — tooltip nyangkut dengan isi basi. Disembunyikan paksa di
      // SATU titik panggil render ini (bukan ditambal di tiap render*Graph)
      // supaya menutupi semua jalur transisi: klik node -> fokus, klik area
      // kosong -> keluar fokus, ganti tab/filter/tema.
      if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      const dark = theme === 'dark'
      simRef.current = focusCode
        ? renderFocusedGraph({ wrap, tooltip: null, dark, allData, code: focusCode, onSelect })
        : renderForceGraph({ wrap, tooltip: tooltipRef.current, dark, allData, emitenList, onSelect })
    }
    gambar()

    // #91b: render ulang saat ukuran container berubah (resize jendela /
    // panel detail buka-tutup) — graf mengisi panel penuh, simulasi force
    // pakai bound baru. Ambang 4px mencegah loop dari selisih pembulatan.
    const ukur = { w: wrap.getBoundingClientRect().width, h: wrap.getBoundingClientRect().height }
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      if (Math.abs(r.width - ukur.w) < 4 && Math.abs(r.height - ukur.h) < 4) return
      ukur.w = r.width
      ukur.h = r.height
      simRef.current?.stop()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(gambar)
    })
    ro.observe(wrap)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      simRef.current?.stop()
      simRef.current = null
    }
  }, [allData, emitenList, focusCode, theme, onSelect])

  return (
    <div className="pi-graph-wrap">
      <div className="pi-graph" ref={graphRef} />
      <div className="pi-tooltip" ref={tooltipRef} />
    </div>
  )
}
