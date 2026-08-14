import * as d3 from 'd3'
import { holderType, type GraphSelection, type HolderType, type InvestorMapEntry } from './petaInvestorData'
import { IKON_GRAFIK_BATANG, IKON_GLOBE, IKON_KLIK, IKON_LOKASI } from '../../components/dasbor/IkonMenu'

/**
 * SVG inline untuk string HTML tooltip (innerHTML, bukan JSX — jadi tidak
 * bisa pakai komponen IkonMenu langsung). Path & gaya stroke disalin dari
 * IkonMenu.tsx supaya bentuknya konsisten; `stroke:currentColor` biar ikut
 * warna teks induknya di tooltip.
 */
const ikonSvg = (d: string, size = 12) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="vertical-align:-2px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="${d}"/></svg>`

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
 * Palet simpul (#79): emiten amber, kategori investor beda HUE — biru
 * (institusi/CORP), hijau (individu/IND), abu redup (tipe tak terisi/OTH).
 * Tiga derajat abu versi lama tak terbedakan di graf nyata. Nilai warna hidup
 * sebagai token --node-* di lantai.css (dua tema) supaya kontras diatur per
 * tema; risiko hijau terbaca "naik" diterima sadar — simpul bukan angka arah.
 *
 * Diekspor karena legenda & tooltip di PetaInvestor.tsx memakai objek yang
 * SAMA — legenda yang menyalin nilai warnanya sendiri akan menyimpang
 * diam-diam dari graf.
 */
export const WARNA = {
  emiten: 'var(--amber)',
  institusi: 'var(--node-corp)',
  individu: 'var(--node-ind)',
  lain: 'var(--node-oth)',
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
 * Batas 12 sengaja TIDAK dikenakan ke emiten. Kode emiten IDX selalu 4
 * karakter — jauh lebih sempit dari nama investor (dipotong sampai 22
 * karakter) — jadi lebar labelnya selalu muat di ruang aman yang dijamin
 * forceCollide di sekitar tiap simpul (radius `size + 16` di
 * renderForceGraph, `size + 18` di renderFocusedGraph), TERLEPAS dari posisi
 * labelnya: renderForceGraph menaruh label emiten DI DALAM lingkaran (dy
 * 0.35em), sedangkan renderFocusedGraph menaruhnya DI BAWAH lingkaran (dy
 * `size + 11`) — sama seperti label investor. Yang berisiko menumpuk kalau
 * ambang 12 dihapus adalah label investor: lebih lebar DAN jauh lebih banyak
 * jumlahnya.
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
function drawNodeGlyph(node: d3.Selection<SVGGElement, GNode, SVGGElement, unknown>, dark: boolean) {
  node
    .append('circle')
    .attr('r', (d) => d.size)
    .attr('fill', (d) => warnaSimpul(d))
    // Ring 1px lebih terang dari isi (overlay putih semi-transparan — "lebih
    // terang" yang bebas hitung untuk fill apa pun) + bayangan sangat tipis.
    .attr('stroke', dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)')
    .attr('stroke-width', 1)
    .attr('filter', 'url(#pi-nshadow)')
    .attr('opacity', (d) => (d.kind === 'emiten' ? 0.97 : 0.94))
}

/**
 * Defs bersama kedua render (#96): panah mini 4.5px `userSpaceOnUse` (supaya
 * TIDAK ikut membesar dengan stroke-width — default `strokeWidth` membuat
 * panah edge tebal jadi segitiga besar kasar, persis yang mau dibuang) +
 * bayangan simpul sangat tipis.
 */
function defsPremium(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, dark: boolean) {
  const defs = svg.append('defs')
  defs
    .append('marker')
    .attr('id', 'pi-arr')
    .attr('viewBox', '0 -2 4 4')
    .attr('refX', 3.4)
    .attr('refY', 0)
    .attr('markerUnits', 'userSpaceOnUse')
    .attr('markerWidth', 4.5)
    .attr('markerHeight', 4.5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-2L4,0L0,2')
    .attr('fill', dark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.50)')
  defs
    .append('filter')
    .attr('id', 'pi-nshadow')
    .attr('x', '-60%')
    .attr('y', '-60%')
    .attr('width', '220%')
    .attr('height', '220%')
    .append('feDropShadow')
    .attr('dx', 0)
    .attr('dy', 0.8)
    .attr('stdDeviation', 1.4)
    .attr('flood-color', '#000')
    .attr('flood-opacity', dark ? 0.45 : 0.2)
}

/** Warna netral edge; intensitas per-edge diatur stroke-opacity (lihat linkOpacity). */
const warnaEdge = (dark: boolean) => (dark ? '#E7ECF4' : '#1E293B')
/** Opacity 0.25–0.5 di-scale dari % kepemilikan (pct ≥ 40 mentok 0.5). */
const linkOpacity = (d: GLink) => 0.25 + Math.min(1, (d.pct ?? 0) / 40) * 0.25
/** Ketebalan 0.6–2.5px dari % kepemilikan (dulu 0.5–6px — terlalu tebal seragam). */
const linkWidth = (d: GLink) => Math.max(0.6, Math.min(2.5, 0.6 + (d.pct ?? 0) * 0.03))

/**
 * Lengkung kuadratik halus satu arah (offset kontrol selalu tegak-lurus kiri
 * dari arah sumber→target, 12% jarak) dengan ujung dipangkas ke tepi lingkaran
 * — pangkal mulai di tepi simpul sumber, ujung berhenti 3px sebelum tepi
 * simpul target supaya panah mini tidak menusuk masuk lingkaran.
 */
function linkPath(d: GLink): string {
  const s = d.source as GNode
  const t = d.target as GNode
  const sx = s.x ?? 0
  const sy = s.y ?? 0
  const tx = t.x ?? 0
  const ty = t.y ?? 0
  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return ''
  const ux = dx / dist
  const uy = dy / dist
  const r0 = s.size ?? 4
  const r1 = (t.size ?? 4) + 3
  const ax = sx + ux * r0
  const ay = sy + uy * r0
  const bx = tx - ux * r1
  const by = ty - uy * r1
  const bend = dist * 0.12
  const mx = (ax + bx) / 2 - uy * bend
  const my = (ay + by) / 2 + ux * bend
  return `M${ax},${ay}Q${mx},${my} ${bx},${by}`
}

/**
 * Highlight neighborhood saat hover (#96): ring simpul jadi amber, edge
 * tetangga menyala (stroke-opacity naik), simpul & edge non-tetangga meredup
 * ke 0.15. Transisi 150ms ease-out dipasang lewat `style` (bukan atribut —
 * CSS transition hanya bereaksi ke perubahan properti style) — mikro-transisi
 * ini tetap dibiarkan di prefers-reduced-motion sesuai keputusan #96.
 * Namespace event `.sorot` supaya tidak menimpa penangan tooltip/label.
 */
function pasangSorotTetangga(
  node: d3.Selection<SVGGElement, GNode, SVGGElement, unknown>,
  link: d3.Selection<SVGPathElement, GLink, SVGGElement, unknown>,
  links: GLink[],
) {
  const idOf = (v: GLink['source']) => (typeof v === 'object' ? v.id : String(v))
  const adj = new Map<string, Set<string>>()
  for (const l of links) {
    const a = idOf(l.source)
    const b = idOf(l.target)
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  node.style('transition', 'opacity 150ms ease-out')
  node.select('circle').style('transition', 'stroke 150ms ease-out, stroke-width 150ms ease-out')
  link.style('transition', 'opacity 150ms ease-out, stroke-opacity 150ms ease-out')

  function nyala(this: SVGGElement, _e: unknown, d: GNode) {
    const n = adj.get(d.id)
    node.style('opacity', (o) => (o.id === d.id || n?.has(o.id) ? 1 : 0.15))
    link
      .style('opacity', (l) => (idOf(l.source) === d.id || idOf(l.target) === d.id ? 1 : 0.15))
      .style('stroke-opacity', (l) => (idOf(l.source) === d.id || idOf(l.target) === d.id ? 0.85 : null))
    d3.select(this).select('circle').style('stroke', 'var(--amber)').style('stroke-width', '1.5px')
  }
  function padam(this: SVGGElement) {
    node.style('opacity', null)
    link.style('opacity', null).style('stroke-opacity', null)
    d3.select(this).select('circle').style('stroke', null).style('stroke-width', null)
  }
  node.on('mouseover.sorot', nyala).on('mouseout.sorot', padam)
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
  const hint = `<div style="margin-top:7px;padding-top:5px;border-top:0.5px solid var(--border);font-size:9px;color:var(--accent);font-weight:600">${ikonSvg(IKON_KLIK, 11)} Klik untuk detail lengkap</div>`
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
    tooltip.innerHTML = `<b style="color:var(--amber)">${ikonSvg(IKON_GRAFIK_BATANG, 13)} ${code}</b><br><span style="color:var(--text3);font-size:10px">${d.fullName ?? ''}</span><br><br><b style="font-size:10px">Top pemegang saham:</b><table style="width:100%;margin-top:4px;font-size:11px">${rows}</table>${hint}`
  } else {
    const name = d.fullLabel ?? d.label
    const allCount = allData.filter((e) => e.holders.some((h) => h.name === name)).length
    tooltip.innerHTML = `<b style="color:${warnaSimpul(d)}">${name}</b><br><span style="color:var(--text3)">${d.cls || '—'} · ${d.lf === 'L' ? `${ikonSvg(IKON_LOKASI, 12)} Domestik` : `${ikonSvg(IKON_GLOBE, 12)} Asing`}</span><br><span style="color:var(--text3);font-size:10px">Memegang saham di ${allCount} emiten</span>${hint}`
  }
}

/**
 * Pasang perilaku pan+zoom d3 pada `svg`; transform diterapkan ke grup konten
 * `g`. SATU titik pasang untuk KEDUA mode render — akar bug "pertama buka gak
 * bisa digeser/zoom": zoom dulu hanya dipasang inline di renderForceGraph,
 * sedangkan renderFocusedGraph (render pertama lewat pencarian/klik emiten)
 * menggambar langsung ke svg tanpa zoom sama sekali; baru saat pindah ke graf
 * umum ("cabang lain") zoom terasa jalan. `onUser` dipanggil hanya untuk
 * gesture asli user (e.sourceEvent terisi) — dipakai auto-fit renderForceGraph
 * untuk membatalkan diri.
 */
function pasangZoom(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  onUser?: () => void,
) {
  const zoomB = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.15, 5])
    .on('zoom', (e) => {
      if (e.sourceEvent) onUser?.()
      g.attr('transform', e.transform)
    })
  svg.call(zoomB)
  return zoomB
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
  // #91b: tinggi ikut container (min-height .pi-graph via CSS), bukan 580 tetap.
  const H = wrap.clientHeight || 580
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
  defsPremium(svg, dark)

  const g = svg.append('g')
  // #91b: zoom disimpan di variabel supaya auto-fit bisa memakai transform yang
  // sama — pan/zoom manual user tetap jalan (dan membatalkan auto-fit).
  let userZoomed = false
  const zoomB = pasangZoom(svg, g, () => {
    userZoomed = true
  })

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
    // #91b: tarikan Y lebih kuat dari X sebanding rasio panel — awan node
    // menjadi elips selebar panel (bukan bola di tengah), auto-fit tinggal
    // membesarkan sampai pas. Di panel ~persegi efeknya netral.
    .force('x', d3.forceX(W / 2).strength(0.02))
    .force('y', d3.forceY(H / 2).strength(Math.min(0.3, 0.08 * (W / H))))
    .force(
      'collision',
      d3
        .forceCollide<GNode>()
        .radius((d) => d.size + 16)
        .strength(0.9),
    )

  const link = g
    .append('g')
    .selectAll<SVGPathElement, GLink>('path')
    .data(links)
    .enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', warnaEdge(dark))
    .attr('stroke-opacity', linkOpacity)
    .attr('stroke-width', linkWidth)
    .attr('stroke-linecap', 'round')
    .attr('marker-end', 'url(#pi-arr)')
    .attr('pointer-events', 'none')

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
    // Papan #klik-detail-nyantol: "Klik untuk detail lengkap" di dalam
    // tooltip (showTooltip) cuma teks HTML statis — satu-satunya klik yang
    // beneran jalan ada di node SVG (.on('click', ...) di bawah), yang
    // posisinya SELALU offset dari tooltip (tooltip digambar +14px dari
    // kursor). Tooltip berpindah tangan (pointer-events di CSS) ke kursor
    // yang gerak ke arah teks itu, jadi klik jatuh ke kanvas kosong di
    // belakang tooltip, bukan ke node. Fix: tooltip sendiri jadi target klik
    // yang meneruskan ke onSelect node yang lagi di-hover — dengan delay
    // sembunyi supaya kursor sempat pindah dari node ke tooltip tanpa
    // tooltip keburu hilang (mouseout node biasa langsung menyembunyikan).
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    let hovered: GNode | null = null

    node
      .on('mouseover', (e, d) => {
        clearTimeout(hideTimer)
        hovered = d
        showTooltip(tooltip, wrap, e, d, allData)
      })
      .on('mouseout', () => {
        hideTimer = setTimeout(() => {
          tooltip.style.display = 'none'
        }, 150)
      })

    tooltip.onmouseenter = () => clearTimeout(hideTimer)
    tooltip.onmouseleave = () => {
      tooltip.style.display = 'none'
    }
    tooltip.onclick = (e) => {
      e.stopPropagation()
      if (hovered) onSelect(nodeSelection(hovered))
    }
  }

  drawNodeGlyph(node, dark)

  const berlabel = idBerlabel(nodes)

  // Label emiten — mono kecil di dalam lingkaran, tinta kontras di atas amber.
  node
    .filter((d) => d.kind === 'emiten')
    .append('text')
    .text((d) => d.label)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', '8.5px')
    .attr('font-family', 'var(--mono)')
    .attr('fill', 'var(--amber-ink)')
    .attr('pointer-events', 'none')
    .attr('font-weight', 700)
    .attr('opacity', (d) => (berlabel.has(d.id) ? 1 : 0))

  // Label investor — di bawah node, halo tipis warna latar (paint-order
  // stroke) supaya tetap terbaca di atas edge yang lewat di belakangnya.
  node
    .filter((d) => d.kind !== 'emiten')
    .append('text')
    .text((d) => d.label)
    .attr('text-anchor', 'middle')
    .attr('dy', (d) => `${d.size + 11}px`)
    .attr('font-size', '7.5px')
    .attr('fill', 'var(--text2)')
    .attr('stroke', 'var(--bg3)')
    .attr('stroke-width', 2.5)
    .attr('stroke-linejoin', 'round')
    .attr('paint-order', 'stroke')
    .attr('pointer-events', 'none')
    .attr('font-weight', 500)
    .attr('opacity', (d) => (berlabel.has(d.id) ? 1 : 0))

  pasangUngkapLabel(node, berlabel)
  pasangSorotTetangga(node, link, links)

  sim.on('tick', () => {
    link.attr('d', linkPath)
    node.attr('transform', (d) => `translate(${d.x},${d.y})`)
  })

  // #91b: auto-fit — setelah simulasi stabil, zoom transform di-set supaya
  // bounding box seluruh node mengisi panel (padding 8%). Layout force sendiri
  // mengumpul di tengah kanvas; tanpa fit ini panel lebar menyisakan ruang
  // kosong besar kiri-kanan. Batal kalau user sudah pan/zoom manual.
  sim.on('end.fit', () => {
    if (userZoomed || !nodes.length) return
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const n of nodes) {
      const r = (n.size ?? 6) + 24 // + ruang label
      x0 = Math.min(x0, (n.x ?? 0) - r)
      y0 = Math.min(y0, (n.y ?? 0) - r)
      x1 = Math.max(x1, (n.x ?? 0) + r)
      y1 = Math.max(y1, (n.y ?? 0) + r)
    }
    const dx = x1 - x0
    const dy = y1 - y0
    if (dx < 10 || dy < 10) return
    const s = Math.min(2.5, 0.92 * Math.min(W / dx, H / dy))
    const t = d3.zoomIdentity.translate(W / 2 - (s * (x0 + x1)) / 2, H / 2 - (s * (y0 + y1)) / 2).scale(s)
    svg.transition().duration(450).call(zoomB.transform, t)
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
  // #91b: tinggi ikut container; ring & jarak diskalakan supaya panel besar
  // terisi (k=1 di ukuran lama 580 — tidak mengubah tampilan layar kecil).
  const H = wrap.clientHeight || 580
  const k = Math.max(1, Math.min(W, H) / 580)
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
      x: cx + 130 * k * Math.cos(a),
      y: cy + 130 * k * Math.sin(a),
    })
    links.push({ source: 'I_' + h.name, target: centerId, pct: h.pct })
  })

  const crossArr = [...crossMap.entries()]
  crossArr.forEach(([eCode, e], i) => {
    const a = (i / crossArr.length) * 2 * Math.PI - Math.PI / 2
    nodes.push({ id: 'E_' + eCode, label: eCode, kind: 'emiten', fullName: e.issuer, size: 8, x: cx + 240 * k * Math.cos(a), y: cy + 240 * k * Math.sin(a) })
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
  defsPremium(svg, dark)

  // Grup konten tunggal supaya pan+zoom (pasangZoom) tinggal menggeser satu
  // transform — dulu link & node digambar langsung ke svg tanpa grup, dan
  // itulah kenapa focused view tak pernah bisa di-zoom.
  const g = svg.append('g')
  pasangZoom(svg, g)

  const link = g
    .append('g')
    .selectAll<SVGPathElement, GLink>('path')
    .data(links)
    .join('path')
    .attr('fill', 'none')
    .attr('stroke', warnaEdge(dark))
    .attr('stroke-opacity', linkOpacity)
    .attr('stroke-width', linkWidth)
    .attr('stroke-linecap', 'round')
    .attr('marker-end', 'url(#pi-arr)')
    .attr('pointer-events', 'none')

  const sim = d3
    .forceSimulation<GNode>(nodes)
    .force(
      'link',
      d3
        .forceLink<GNode, GLink>(links)
        .id((d) => d.id)
        .distance(110 * k)
        .strength(0.6),
    )
    .force('charge', d3.forceManyBody().strength(-200 * k))
    .force(
      'collide',
      d3.forceCollide<GNode>((d) => d.size + 18),
    )
    .alphaDecay(0.04)
    .velocityDecay(0.85)

  const nodeG = g
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
  // negara (isAsia/isWest/isLocal, mis. 'SG'/'US') — data-idx/json/investor_map.json
  // yang dipakai sekarang cuma punya lf 'L'/'F' (bukan kode negara). Sejak
  // Task 12 pembedaan bentuk dibuang seluruhnya (semua simpul bundar), jadi
  // graf umum & focused view memang memakai glyph yang sama.
  drawNodeGlyph(nodeG, dark)

  const berlabel = idBerlabel(nodes)

  // Label di bawah node — kode emiten mono, semua diberi halo warna latar
  // (paint-order stroke) supaya terbaca di atas edge ring luar.
  nodeG
    .append('text')
    .text((d) => d.label)
    .attr('font-size', (d) => (d.id === centerId ? 12 : 9))
    .attr('font-weight', (d) => (d.id === centerId ? 700 : 600))
    .attr('font-family', (d) => (d.kind === 'emiten' ? 'var(--mono)' : null))
    .attr('fill', 'var(--text)')
    .attr('stroke', 'var(--bg)')
    .attr('stroke-width', 2.5)
    .attr('stroke-linejoin', 'round')
    .attr('paint-order', 'stroke')
    .attr('text-anchor', 'middle')
    .attr('dy', (d) => d.size + 11)
    .attr('pointer-events', 'none')
    .attr('opacity', (d) => (berlabel.has(d.id) ? 1 : 0))

  pasangUngkapLabel(nodeG, berlabel)
  pasangSorotTetangga(nodeG, link, links)

  sim.on('tick', () => {
    link.attr('d', linkPath)
    nodeG.attr('transform', (d) => `translate(${d.x},${d.y})`)
  })

  return sim
}
