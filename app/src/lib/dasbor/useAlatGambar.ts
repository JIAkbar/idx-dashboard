/**
 * Bilah alat gambar (#185, TradingView-style) — orkestrasi state & interaksi,
 * dipisah dari `AlatGambar.tsx` (murni tampilan) dan dari `GrafikEmiten.tsx`
 * (chart) supaya tiap berkas tetap satu tanggung jawab. Pola pemisahan sama
 * dengan `DaftarInstans.tsx` (hook) vs `GrafikEmiten.tsx` (pemakainya).
 *
 * Kenapa klik-klik, BUKAN seret, untuk alat bertitik tetap (garis tren,
 * persegi, fibonacci, dst): `InteractionHandler` bawaan pustaka (FSM
 * tempel-titik) ternyata tak pernah menyelesaikan alat BERTITIK SATU (garis
 * horizontal/vertikal/teks) — cabang `idle` tak pernah memeriksa apakah
 * jumlah titik sudah cukup, jadi satu klik tak pernah dianggap selesai.
 * Daripada memakainya lalu menambal kasus itu di luar, hook ini menulis FSM
 * sendiri yang lebih pendek dan berlaku SERAGAM untuk 1 sampai 4 titik
 * (dites lewat semua 68 alat, bukan cuma tujuh yang jadi tombol utama) —
 * lihat `AlatGambar.tsx` untuk alasan kenapa cuma tujuh yang jadi tombol.
 * Konsekuensinya: menggambar selalu klik-klik-klik, tak ada pratinjau
 * "karet gelang" mengikuti kursor selagi titik berikutnya belum diklik —
 * penyederhanaan yang disengaja, gambar tetap muncul begitu titik
 * terakhirnya diklik.
 *
 * Kuas satu-satunya pengecualian: ia butuh SERET (jumlah titik tak
 * terhingga, ditentukan gerakan tangan, bukan jumlah klik), jadi jalurnya
 * terpisah — event mousedown/mousemove/mouseup mentah di kontainer kanvas,
 * bukan `chart.subscribeClick`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi, MouseEventParams, SeriesType, Time } from 'lightweight-charts'
import type { Anchor, SerializedDrawing } from 'lightweight-charts-drawing'
import { ALAT_UTAMA, muatPustakaGambar } from './gambarPustaka'
import { bacaGambarTersimpan, tulisGambarTersimpan, VERSI_GAMBAR, type GambarTersimpan } from './gambarGrafik'
import { keWaktuChart, dariWaktuChart } from './kerangkaWaktu'

type ModulPustaka = Awaited<ReturnType<typeof muatPustakaGambar>>
type Manager = InstanceType<ModulPustaka['DrawingManager']>

/** Id instans baru — sama polanya dengan `DaftarInstans.tsx`, disalin (bukan
 *  diimpor) karena keduanya sengaja tak saling bergantung. */
function idBaru(): string {
  return globalThis.crypto?.randomUUID?.() ?? `g${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const ANCHOR_ALAT_UTAMA = new Map(ALAT_UTAMA.map((a) => [a.id, a.anchor]))
const BUTUH_TEKS = new Set(ALAT_UTAMA.filter((a) => a.butuhTeks).map((a) => a.id))

/** Titik mousemove kuas cuma ditambah kalau bergeser >= ini piksel dari titik
 *  terakhir — tanpa jarak minimum, satu goresan sedetik bisa berisi ratusan
 *  titik (mousemove bisa menembak >100×/detik) tanpa menambah bentuk yang
 *  terlihat sama sekali. */
const JARAK_MIN_KUAS = 4

export interface UseAlatGambar {
  /** `null` sebelum pembaca menyentuh bilah (impor dinamis belum dipicu). */
  pustaka: ModulPustaka | null
  galat: string | null
  /** Id tipe alat pustaka yang aktif, atau `null` = mode pilih/pan. */
  alatAktif: string | null
  pilihAlat: (id: string | null) => void
  /** Ada gambar terpilih di kanvas — dipakai mengaktifkan tombol Hapus. */
  adaTerpilih: boolean
  hapusTerpilih: () => void
  /** Dipanggil dari `onPointerDownCapture`/`onFocusCapture` bilah — memicu
   *  unduhan pustaka SEKALI seumur sesi, sama pola dgn `mintaKatalog`. */
  mintaPustaka: () => void
}

export function useAlatGambar(opts: {
  chartRef: React.RefObject<IChartApi | null>
  seriesRef: React.RefObject<ISeriesApi<SeriesType> | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  kode: string
  /** Naik tiap seri harga dibuat ulang (lihat `GrafikEmiten.tsx`) — dipakai
   *  memasang ulang manager ke seri yang baru. */
  versiSeriHarga: number
}): UseAlatGambar {
  const { chartRef, seriesRef, containerRef, kode, versiSeriHarga } = opts

  const [pustaka, setPustaka] = useState<ModulPustaka | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [alatAktif, setAlatAktifState] = useState<string | null>(null)
  const [adaTerpilih, setAdaTerpilih] = useState(false)

  const managerRef = useRef<Manager | null>(null)
  const alatAktifRef = useRef<string | null>(null)
  const titikSedangRef = useRef<Anchor[]>([])
  const alatTertundaRef = useRef<string | null>(null)
  const kodeRef = useRef(kode)
  kodeRef.current = kode

  const mintaPustaka = useCallback(() => {
    if (pustaka || galat) return
    muatPustakaGambar()
      .then(setPustaka)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat alat gambar.'))
  }, [pustaka, galat])

  /** Ekspor manager -> `GambarTersimpan[]` -> localStorage EMITEN AKTIF SAAT
   *  INI (`kodeRef`, bukan `kode` dari closure — event manager bisa terlambat
   *  satu tick dari render). Dipanggil tiap `drawing:added/removed/updated`.
   *
   *  `drawing:updated` menembak di TIAP `mousemove` selagi menyeret titik
   *  (anchor-drag bawaan manager) — bisa >60×/detik. Ditunda 250ms (debounce,
   *  bukan throttle): yang penting keadaan AKHIR tersimpan begitu tangan
   *  berhenti, bukan tiap piksel antaranya. Tanpa ini seretan sebentar saja
   *  memicu puluhan `JSON.stringify`+`localStorage.setItem` yang tak berguna. */
  const tundaSimpanRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const simpanSekarang = useCallback(() => {
    if (tundaSimpanRef.current) clearTimeout(tundaSimpanRef.current)
    tundaSimpanRef.current = setTimeout(() => {
      const manager = managerRef.current
      if (!manager) return
      const daftar: GambarTersimpan[] = manager.exportDrawings().map((d: SerializedDrawing) => ({
        versi: VERSI_GAMBAR,
        type: d.type,
        id: d.id,
        anchors: d.anchors
          .map((a) => ({ waktu: dariWaktuChart(a.time) ?? '', harga: a.price }))
          .filter((a) => a.waktu !== ''),
        style: d.style as unknown as Record<string, unknown>,
        options: d.options as unknown as Record<string, unknown>,
      })).filter((g) => g.anchors.length > 0)
      tulisGambarTersimpan(kodeRef.current, daftar)
    }, 250)
  }, [])

  const pilihAlat = useCallback((id: string | null) => {
    if (id && !pustaka) {
      // Pustaka belum diunduh (klik pertama pembaca) — simpan niatnya,
      // `mintaPustaka` dipicu dari bilah (onPointerDownCapture), efek di
      // bawah menyelesaikannya begitu pustaka tiba.
      alatTertundaRef.current = id
      return
    }
    titikSedangRef.current = []
    alatAktifRef.current = id
    setAlatAktifState(id)
    managerRef.current?.setActiveTool(id)
    // Pindah ke alat gambar berarti keluar dari mode pilih — gambar yang
    // tadi terpilih tak boleh ikut terseret saat pembaca menempatkan titik
    // gambar yang BARU di kanvas yang sama.
    if (id) managerRef.current?.deselectAll()
  }, [pustaka])

  useEffect(() => {
    if (pustaka && alatTertundaRef.current) {
      const id = alatTertundaRef.current
      alatTertundaRef.current = null
      pilihAlat(id)
    }
  }, [pustaka, pilihAlat])

  const hapusTerpilih = useCallback(() => {
    const manager = managerRef.current
    const dipilih = manager?.getSelectedDrawing()
    if (dipilih) manager!.removeDrawing(dipilih.id)
  }, [])

  /* ---------------- Pasang manager ke chart+seri ---------------- */
  // Ikut `versiSeriHarga`: seri harga dibongkar-pasang ulang tiap jenis chart
  // (lilin/garis) ditukar (lihat GrafikEmiten.tsx), dan gambar yang menempel
  // pada seri LAMA harus dipindah ke seri BARU — `manager.attach()` melakukan
  // ini sendiri (mengiterasi seluruh gambar tersimpan dan attach ulang).
  useEffect(() => {
    if (!pustaka) return
    const chart = chartRef.current
    const series = seriesRef.current
    const container = containerRef.current
    if (!chart || !series || !container) return
    let manager = managerRef.current
    if (!manager) {
      manager = new pustaka.DrawingManager()
      managerRef.current = manager
      manager.on('drawing:selected', () => setAdaTerpilih(true))
      manager.on('drawing:deselected', () => setAdaTerpilih(false))
      manager.on('drawing:removed', () => setAdaTerpilih(false))
      manager.on('drawing:added', simpanSekarang)
      manager.on('drawing:removed', simpanSekarang)
      manager.on('drawing:updated', simpanSekarang)
    }
    manager.attach(chart, series, container)
  }, [pustaka, versiSeriHarga, chartRef, seriesRef, containerRef, simpanSekarang])

  /* ---------------- Muat ulang PER EMITEN ---------------- */
  // Gambar BBCA tak boleh muncul di TLKM — dibersihkan lalu diisi ulang dari
  // localStorage tiap `kode` berganti. `clearAll()` sengaja TIDAK memicu
  // `simpanSekarang` (manager cuma emit `drawing:cleared`, tak kita
  // dengarkan) — kalau didengarkan, membersihkan gambar emiten LAMA sebelum
  // pindah akan menimpa penyimpanannya sendiri jadi daftar kosong.
  useEffect(() => {
    const manager = managerRef.current
    if (!manager || !pustaka) return
    manager.clearAll()
    const registry = pustaka.getToolRegistry()
    const factory = (type: string, data: SerializedDrawing) =>
      registry.createDrawing(type, data.id, data.anchors, data.style, data.options)
    const serial: SerializedDrawing[] = bacaGambarTersimpan(kode).map((g) => ({
      id: g.id,
      type: g.type,
      anchors: g.anchors.map((a) => ({ time: keWaktuChart(a.waktu) as unknown as Time, price: a.harga })) as Anchor[],
      style: g.style as unknown as SerializedDrawing['style'],
      options: g.options as SerializedDrawing['options'],
    }))
    manager.importDrawings(serial, factory)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kode, pustaka])

  /* ---------------- Tempel titik: klik-klik (semua alat KECUALI kuas) ---------------- */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !pustaka) return
    const registry = pustaka.getToolRegistry()

    const saatKlik = (param: MouseEventParams<Time>) => {
      const alat = alatAktifRef.current
      if (!alat || alat === 'brush') return
      if (!param.point || param.time == null) return
      const harga = seriesRef.current?.coordinateToPrice(param.point.y)
      if (harga == null || !Number.isFinite(harga)) return

      titikSedangRef.current = [...titikSedangRef.current, { time: param.time, price: harga }]
      const perlu = ANCHOR_ALAT_UTAMA.get(alat) ?? registry.get(alat)?.requiredAnchors ?? 2
      if (titikSedangRef.current.length < perlu) return

      const anchors = titikSedangRef.current
      titikSedangRef.current = []
      let opsi: Record<string, unknown> = {}
      if (BUTUH_TEKS.has(alat)) {
        const teks = window.prompt('Teks anotasi:', '')
        if (teks === null) { pilihAlat(null); return } // dibatalkan dari kotak prompt
        opsi = { text: teks }
      }
      const gambar = registry.createDrawing(alat, idBaru(), anchors, undefined, opsi)
      if (gambar) managerRef.current?.addDrawing(gambar)
      pilihAlat(null) // sekali gambar selesai, kembali ke mode pilih
    }

    chart.subscribeClick(saatKlik)
    return () => chart.unsubscribeClick(saatKlik)
  }, [pustaka, chartRef, seriesRef, pilihAlat])

  /* ---------------- Kuas: seret mentah ---------------- */
  useEffect(() => {
    const container = containerRef.current
    const chart = chartRef.current
    if (!container || !chart || !pustaka) return
    let menggambar = false
    let titik: Anchor[] = []
    let pxTerakhir: { x: number; y: number } | null = null

    const keAnchor = (ev: MouseEvent): { a: Anchor; px: { x: number; y: number } } | null => {
      const r = container.getBoundingClientRect()
      const x = ev.clientX - r.left
      const y = ev.clientY - r.top
      const time = chart.timeScale().coordinateToTime(x)
      const harga = seriesRef.current?.coordinateToPrice(y)
      if (time == null || harga == null || !Number.isFinite(harga)) return null
      return { a: { time, price: harga }, px: { x, y } }
    }

    const turun = (ev: MouseEvent) => {
      if (alatAktifRef.current !== 'brush') return
      const t = keAnchor(ev)
      if (!t) return
      menggambar = true
      titik = [t.a]
      pxTerakhir = t.px
    }
    const gerak = (ev: MouseEvent) => {
      if (!menggambar) return
      const t = keAnchor(ev)
      if (!t) return
      if (pxTerakhir) {
        const jarak = Math.hypot(t.px.x - pxTerakhir.x, t.px.y - pxTerakhir.y)
        if (jarak < JARAK_MIN_KUAS) return
      }
      titik.push(t.a)
      pxTerakhir = t.px
    }
    const naik = () => {
      if (!menggambar) return
      menggambar = false
      if (titik.length >= 2) {
        const gambar = pustaka.getToolRegistry().createDrawing('brush', idBaru(), titik)
        if (gambar) managerRef.current?.addDrawing(gambar)
      }
      titik = []
      pxTerakhir = null
      pilihAlat(null)
    }

    container.addEventListener('mousedown', turun)
    container.addEventListener('mousemove', gerak)
    window.addEventListener('mouseup', naik)
    return () => {
      container.removeEventListener('mousedown', turun)
      container.removeEventListener('mousemove', gerak)
      window.removeEventListener('mouseup', naik)
    }
  }, [pustaka, chartRef, containerRef, seriesRef, pilihAlat])

  /* ---------------- Keyboard: Escape batal, Delete/Backspace hapus ---------------- */
  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (titikSedangRef.current.length > 0) { titikSedangRef.current = []; return }
        if (alatAktifRef.current) pilihAlat(null)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement | null
        const diInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        if (diInput) return
        const dipilih = managerRef.current?.getSelectedDrawing()
        if (dipilih) { e.preventDefault(); managerRef.current!.removeDrawing(dipilih.id) }
      }
    }
    document.addEventListener('keydown', saatTombol)
    return () => document.removeEventListener('keydown', saatTombol)
  }, [pilihAlat])

  return { pustaka, galat, alatAktif, pilihAlat, adaTerpilih, hapusTerpilih, mintaPustaka }
}
