import * as d3 from 'd3'
import { holderType, type GraphSelection, type HolderType, type InvestorMapEntry } from './petaInvestorData'

/**
 * Render D3 force-directed graph murni (tanpa React) — dipanggil dari
 * useEffect komponen GrafikJaringan.tsx. Dipisah dari komponen supaya
 * useEffect-nya tetap ringkas & fungsi ini gampang di-reason-in isolasi.
 * Port piRender()/piRenderFocused()/piShowTip() index_live.html
 * baris 23-143, 584-686.
 */

export interface GNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  kind: 'emiten' | 'investor'
  size: number
  fullName?: string
  fullLabel?: string
  cls?: string
  lf?: string
}

export interface GLink extends d3.SimulationLinkDatum<GNode> {
  pct?: number
}

interface RenderParams {
  wrap: HTMLDivElement
  tooltip: HTMLDivElement | null
  dark: boolean
  allData: InvestorMapEntry[]
  onSelect: (sel: GraphSelection | null) => void
}

/**
 * Palet simpul: SATU aksen amber untuk emiten, sisanya derajat abu-biru.
 * Hijau & merah sengaja TIDAK ada di sini — keduanya dikunci untuk arah angka
 * (naik/turun) di seluruh dasbor; memakainya sebagai kategori simpul membuat
 * "investor individu" terbaca seperti "naik".
 *
 * Diekspor karena legenda di PetaInvestor.tsx memakai objek yang SAMA — legenda
 * yang menyalin nilai warnanya sendiri akan menyimpang diam-diam dari graf.
 */
export const WARNA = {
  emiten: 'var(--amber)',
  institusi: 'var(--text2)',
  individu: 'var(--text3)',
  lain: 'var(--line2)',
} as const

/** Kategori investor persis mengikuti holderType() yang dipakai tabel By Stock/By Investor — satu definisi, bukan dua. */
const WARNA_TIPE: Record<HolderType, string> = { CORP: WARNA.institusi, IND: WARNA.individu, OTH: WARNA.lain }

export function warnaSimpul(d: { kind: string; cls?: string }): string {
  return d.kind === 'emiten' ? WARNA.emiten : WARNA_TIPE[holderType(d.cls ?? '')]
}

/** Jumlah simpul yang dilabeli permanen. Graf yang melabeli SEMUA simpul selalu berakhir tak terbaca, dan itu bukan soal ukuran font. */
const LABEL_TERBESAR = 12

/**
 * id simpul terbesar (menurut `size`) yang boleh dilabeli permanen; sisanya
 * transparan sampai diarahkan/disentuh. Urutan sama-besar dipertahankan apa
 * adanya (Array#sort stabil) sehingga emiten — yang selalu didorong ke array
 * lebih dulu — menang atas investor berukuran sama.
 */
export function idTerbesar(nodes: GNode[], n: number = LABEL_TERBESAR): Set<string> {
  return new Set(
    [...nodes]
      .sort((a, b) => b.size - a.size)
      .slice(0, n)
      .map((d) => d.id),
  )
}

/**
 * Simpul yang dilabeli permanen: SEMUA emiten + 12 investor terbesar.
 *
 * Batas 12 sengaja TIDAK dikenakan ke emiten. Kode emiten digambar DI DALAM
 * lingkarannya sendiri, dan forceCollide (radius `size + 16`) menjamin dua
 * lingkaran tak pernah bertumpuk — jadi label emiten secara konstruksi tidak
 * bisa ikut menimbulkan tumpukan label yang jadi alasan batas ini ada. Yang
 * menumpuk adalah label investor yang mengambang di bawah simpul.
 *
 * Diukur langsung sebelum aturan ini dipakai: dengan ambang 12 untuk SEMUA
 * simpul, cuma 1 dari 10 emiten yang berlabel (ukuran investor = pct×0,4,
 * mencapai 14 sementara emiten tetap 10; 857 holder di dataset memegang >25%).
 * Peta kepemilikan yang menyembunyikan kode emitennya sendiri tidak bisa dibaca
 * sama sekali — kodenya justru satu-satunya jangkar orientasi di layar ini.
 */
function idBerlabel(nodes: GNode[]): Set<string> {
  const set = idTerbesar(nodes.filter((d) => d.kind !== 'emiten'))
  for (const d of nodes) if (d.kind === 'emiten') set.add(d.id)
  return set
}

function cssVar(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

function nodeSelection(d: GNode): GraphSelection {
  if (d.kind === 'emiten') return { type: 'emiten', code: d.id.replace('E_', '') }
  return { type: 'investor', name: d.fullLabel ?? d.label, cls: d.cls ?? '', lf: d.lf ?? '' }
}

/**
 * Semua simpul bundar — dulu emiten lingkaran, investor belah ketupat, pemilik
 * manfaat bintang. Bentuk campur itu memaksa pembaca menghafal tiga bentuk
 * SEKALIGUS empat warna untuk informasi yang sama (tipe holder); satu bentuk +
 * satu sumbu warna sudah cukup. Radius = `size` untuk semua, sama dengan
 * radius yang dipakai gaya tolak-tabrakan (forceCollide `size + 16`).
 */
function drawNodeGlyph(node: d3.Selection<SVGGElement, GNode, SVGGElement, unknown>, nodeStroke: string) {
  node
    .append('circle')
    .attr('r', (d) => d.size)
    .attr('fill', (d) => warnaSimpul(d))
    .attr('stroke', nodeStroke)
    .attr('stroke-width', (d) => (d.kind === 'emiten' ? 1.5 : 1.2))
    .attr('opacity', (d) => (d.kind === 'emiten' ? 0.95 : 0.92))
}

/** Ungkap label simpul non-terbesar saat diarahkan atau disentuh. Nama peristiwa dinamai (`.label`) supaya TIDAK menimpa penangan tooltip yang memakai `mouseover`/`mouseout` polos. */
function pasangUngkapLabel(node: d3.Selection<SVGGElement, GNode, SVGGElement, unknown>, berlabel: Set<string>) {
  function tampil(this: SVGGElement) {
    d3.select(this).selectAll('text').attr('opacity', 1)
  }
  node
    .on('mouseover.label', tampil)
    .on('touchstart.label', tampil)
    .on('mouseout.label', function (this: SVGGElement, _e: unknown, d: GNode) {
      d3.select(this)
        .selectAll('text')
        .attr('opacity', berlabel.has(d.id) ? 1 : 0)
    })
}

function showTooltip(tooltip: HTMLDivElement, wrap: HTMLDivElement, e: MouseEvent, d: GNode, allData: InvestorMapEntry[]) {
  const wr = wrap.getBoundingClientRect()
  const x = e.clientX - wr.left + 14
  const y = e.clientY - wr.top + 14
  tooltip.style.left = Math.min(x, wr.width - 240) + 'px'
  tooltip.style.top = Math.min(y, wr.height - 130) + 'px'
  tooltip.style.display = 'block'
  const hint = `<div style="margin-top:7px;padding-top:5px;border-top:0.5px solid var(--border);font-size:9px;color:var(--accent);font-weight:600">👆 Klik untuk detail lengkap</div>`
  if (d.kind === 'emiten') {
    const code = d.id.replace('E_', '')
    const em = allData.find((x) => x.code === code)
    const pctColor = 'var(--amber)'
    const rows = em
      ? em.holders
          .slice(0, 4)
          .map((h) => `<tr><td style="padding:2px 0">${h.name}</td><td style="padding-left:8px;text-align:right;color:${pctColor};white-space:nowrap"><b>${h.pct}%</b></td></tr>`)
          .join('')
      : ''
    tooltip.innerHTML = `<b style="color:var(--amber)">📊 ${code}</b><br><span style="color:var(--text3);font-size:10px">${d.fullName ?? ''}</span><br><br><b style="font-size:10px">Top pemegang saham:</b><table style="width:100%;margin-top:4px;font-size:11px">${rows}</table>${hint}`
  } else {
    const name = d.fullLabel ?? d.label
    const allCount = allData.filter((e) => e.holders.some((h) => h.name === name)).length
    tooltip.innerHTML = `<b style="color:${warnaSimpul(d)}">${name}</b><br><span style="color:var(--text3)">${d.cls || '—'} · ${d.lf === 'L' ? '🇮🇩 Domestik' : '🌐 Asing'}</span><br><span style="color:var(--text3);font-size:10px">Memegang saham di ${allCount} emiten</span>${hint}`
  }
}

function dragBehavior(sim: d3.Simulation<GNode, GLink>, pinnedId?: string) {
  return d3
    .drag<SVGGElement, GNode>()
    .on('start', (e, d) => {
      if (!e.active) sim.alphaTarget(0.04).restart()
      d.fx = d.x
      d.fy = d.y
    })
    .on('drag', (e, d) => {
      d.fx = e.x
      d.fy = e.y
    })
    .on('end', (e, d) => {
      if (!e.active) sim.alphaTarget(0)
      if (d.id !== pinnedId) {
        d.fx = null
        d.fy = null
      }
    })
}

/** Graf umum multi-emiten (default: 10 emiten pertama, atau portofolio investor yang diklik s.d. 60 emiten). Port piRender() baris 29-124. */
export function renderForceGraph(params: RenderParams & { emitenList: InvestorMapEntry[] }): d3.Simulation<GNode, GLink> | null {
  const { wrap, tooltip, dark, allData, emitenList, onSelect } = params
  wrap.innerHTML = ''
  const W = wrap.clientWidth || 900
  const H = 580
  const nodes: GNode[] = []
  const links: GLink[] = []
  const seenInv = new Set<string>()

  emitenList.forEach((e) => {
    nodes.push({ id: 'E_' + e.code, label: e.code, kind: 'emiten', fullName: e.issuer, size: 10 })
  })
  emitenList.forEach((e) => {
    e.holders.forEach((h) => {
      const iid = 'I_' + h.name
      if (!seenInv.has(iid)) {
        seenInv.add(iid)
        nodes.push({
          id: iid,
          label: h.name.length > 22 ? h.name.slice(0, 20) + '…' : h.name,
          fullLabel: h.name,
          kind: 'investor',
          cls: h.cls,
          lf: h.lf,
          size: Math.max(4, Math.min(14, h.pct * 0.4)),
        })
      }
      links.push({ source: iid, target: 'E_' + e.code, pct: h.pct })
    })
  })
  if (!nodes.length) return null

  const svg = d3.select(wrap).append('svg').attr('width', W).attr('height', H)
  const linkStroke = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.45)'
  const arrowFill = dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.55)'
  const nodeStroke = cssVar(wrap, '--card') || (dark ? '#181e28' : '#fff')

  svg
    .append('defs')
    .append('marker')
    .attr('id', 'pi-arr')
    .attr('viewBox', '0 -3 6 6')
    .attr('refX', 14)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-3L6,0L0,3')
    .attr('fill', arrowFill)

  const g = svg.append('g')
  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (e) => g.attr('transform', e.transform)),
  )

  const sim = d3
    .forceSimulation<GNode>(nodes)
    .alphaDecay(0.04)
    .velocityDecay(0.85)
    .force(
      'link',
      d3
        .forceLink<GNode, GLink>(links)
        .id((d) => d.id)
        .distance((d) => 90 + 10 / Math.max(d.pct ?? 0.1, 0.1))
        .strength(0.35),
    )
    .force('charge', d3.forceManyBody().strength(-90))
    .force('center', d3.forceCenter(W / 2, H / 2).strength(0.03))
    .force(
      'collision',
      d3
        .forceCollide<GNode>()
        .radius((d) => d.size + 16)
        .strength(0.9),
    )

  const link = g
    .append('g')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', linkStroke)
    .attr('stroke-width', (d) => Math.max(0.5, (d.pct ?? 0) / 25))
    .attr('marker-end', 'url(#pi-arr)')

  const node = g
    .append('g')
    .selectAll<SVGGElement, GNode>('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('cursor', 'pointer')
    .call(dragBehavior(sim))
    .on('click', (e, d) => {
      e.stopPropagation()
      onSelect(nodeSelection(d))
    })

  if (tooltip) {
    node
      .on('mouseover', (e, d) => showTooltip(tooltip, wrap, e, d, allData))
      .on('mouseout', () => {
        tooltip.style.display = 'none'
      })
  }

  drawNodeGlyph(node, nodeStroke)

  const berlabel = idBerlabel(nodes)

  // Label emiten — di dalam lingkaran, tinta kontras di atas amber.
  node
    .filter((d) => d.kind === 'emiten')
    .append('text')
    .text((d) => d.label)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', '8.5px')
    .attr('fill', 'var(--amber-ink)')
    .attr('pointer-events', 'none')
    .attr('font-weight', 800)
    .attr('opacity', (d) => (berlabel.has(d.id) ? 1 : 0))

  // Label investor — di bawah node, warna ikut token tema.
  node
    .filter((d) => d.kind !== 'emiten')
    .append('text')
    .text((d) => d.label)
    .attr('text-anchor', 'middle')
    .attr('dy', (d) => `${d.size + 11}px`)
    .attr('font-size', '7.5px')
    .attr('fill', 'var(--text2)')
    .attr('pointer-events', 'none')
    .attr('font-weight', 500)
    .attr('opacity', (d) => (berlabel.has(d.id) ? 1 : 0))

  pasangUngkapLabel(node, berlabel)

  sim.on('tick', () => {
    link
      .attr('x1', (d) => (d.source as GNode).x ?? 0)
      .attr('y1', (d) => (d.source as GNode).y ?? 0)
      .attr('x2', (d) => (d.target as GNode).x ?? 0)
      .attr('y2', (d) => (d.target as GNode).y ?? 0)
    node.attr('transform', (d) => `translate(${d.x},${d.y})`)
  })

  svg.on('click', () => onSelect(null))

  return sim
}

/**
 * "Focused view" — 1 emiten di tengah (dipin), ring pemegang saham utama,
 * ring luar cross-holdings. Port piRenderFocused() baris 584-686.
 */
export function renderFocusedGraph(params: RenderParams & { code: string }): d3.Simulation<GNode, GLink> | null {
  const { wrap, dark, allData, code, onSelect } = params
  const em = allData.find((x) => x.code === code)
  if (!em) return null
  wrap.innerHTML = ''
  const W = wrap.clientWidth || 900
  const H = 580
  const cx = W / 2
  const cy = H / 2
  const centerId = 'E_' + code

  const holders = em.holders.slice(0, 6)
  const crossMap = new Map<string, InvestorMapEntry>()
  holders.forEach((h) => {
    allData
      .filter((e) => e.code !== code && e.holders.some((hh) => hh.name === h.name))
      .slice(0, 4)
      .forEach((e) => {
        if (!crossMap.has(e.code)) crossMap.set(e.code, e)
      })
  })

  const nodes: GNode[] = [{ id: centerId, label: code, kind: 'emiten', fullName: em.issuer, size: 18, fx: cx, fy: cy }]
  const links: GLink[] = []

  holders.forEach((h, i) => {
    const a = (i / holders.length) * 2 * Math.PI - Math.PI / 2
    nodes.push({
      id: 'I_' + h.name,
      label: h.name.length > 22 ? h.name.slice(0, 20) + '…' : h.name,
      fullLabel: h.name,
      kind: 'investor',
      cls: h.cls,
      lf: h.lf,
      size: Math.max(6, Math.min(16, h.pct * 0.5)),
      x: cx + 130 * Math.cos(a),
      y: cy + 130 * Math.sin(a),
    })
    links.push({ source: 'I_' + h.name, target: centerId, pct: h.pct })
  })

  const crossArr = [...crossMap.entries()]
  crossArr.forEach(([eCode, e], i) => {
    const a = (i / crossArr.length) * 2 * Math.PI - Math.PI / 2
    nodes.push({ id: 'E_' + eCode, label: eCode, kind: 'emiten', fullName: e.issuer, size: 8, x: cx + 240 * Math.cos(a), y: cy + 240 * Math.sin(a) })
  })

  holders.forEach((h) => {
    crossArr.forEach(([eCode, e]) => {
      if (e.holders.some((hh) => hh.name === h.name)) links.push({ source: 'I_' + h.name, target: 'E_' + eCode })
    })
  })

  const svg = d3
    .select(wrap)
    .append('svg')
    .attr('width', '100%')
    .attr('height', H)
    .style('background', 'var(--bg)')
    .on('click', () => onSelect(null))

  const link = svg
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', 'var(--line2)')
    .attr('stroke-opacity', 0.9)
    .attr('stroke-width', 1)

  const sim = d3
    .forceSimulation<GNode>(nodes)
    .force(
      'link',
      d3
        .forceLink<GNode, GLink>(links)
        .id((d) => d.id)
        .distance(110)
        .strength(0.6),
    )
    .force('charge', d3.forceManyBody().strength(-200))
    .force(
      'collide',
      d3.forceCollide<GNode>((d) => d.size + 18),
    )
    .alphaDecay(0.04)
    .velocityDecay(0.85)

  const nodeStroke = cssVar(wrap, '--card') || (dark ? '#181e28' : '#fff')
  const nodeG = svg
    .append('g')
    .selectAll<SVGGElement, GNode>('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(dragBehavior(sim, centerId))
    .on('click', (e, d) => {
      e.stopPropagation()
      onSelect(nodeSelection(d))
    })

  // ponytail: sumber (piRenderFocused) membedakan bentuk investor pakai kode
  // negara (isAsia/isWest/isLocal, mis. 'SG'/'US') — data/investor_map.json
  // yang dipakai sekarang cuma punya lf 'L'/'F' (bukan kode negara). Sejak
  // Task 12 pembedaan bentuk dibuang seluruhnya (semua simpul bundar), jadi
  // graf umum & focused view memang memakai glyph yang sama.
  drawNodeGlyph(nodeG, nodeStroke)

  const berlabel = idBerlabel(nodes)

  nodeG
    .append('text')
    .text((d) => d.label)
    .attr('font-size', (d) => (d.id === centerId ? 12 : 9))
    .attr('font-weight', (d) => (d.id === centerId ? 800 : 600))
    .attr('fill', 'var(--text)')
    .attr('text-anchor', 'middle')
    .attr('dy', (d) => d.size + 11)
    .attr('pointer-events', 'none')
    .attr('opacity', (d) => (berlabel.has(d.id) ? 1 : 0))

  pasangUngkapLabel(nodeG, berlabel)

  sim.on('tick', () => {
    link
      .attr('x1', (d) => (d.source as GNode).x ?? 0)
      .attr('y1', (d) => (d.source as GNode).y ?? 0)
      .attr('x2', (d) => (d.target as GNode).x ?? 0)
      .attr('y2', (d) => (d.target as GNode).y ?? 0)
    nodeG.attr('transform', (d) => `translate(${d.x},${d.y})`)
  })

  return sim
}
