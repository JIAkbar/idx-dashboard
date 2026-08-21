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
import type { Anchor, DrawingStyle, SerializedDrawing } from 'lightweight-charts-drawing'
import { ALAT_UTAMA, muatPustakaGambar } from './gambarPustaka'
import {
  bacaGambarTersimpan, tulisGambarTersimpan, VERSI_GAMBAR,
  bacaGayaBawaan, tulisGayaBawaan, dashDariGaya, type GambarTersimpan, type GayaGambar,
} from './gambarGrafik'
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

/* ---------------- Magnet snap (#185 lanjutan, Johan 21 Agu: "magnet juga
   keluarkan ada magnet kuat dan magnet lemah") ----------------
 *
 * CATATAN JUJUR soal `SnapConfig`/`InteractionConfig` pustaka (keduanya ADA,
 * lihat `dist/index.d.ts`): keduanya cuma dipakai `InteractionHandler`
 * bawaan pustaka, dan komentar di atas berkas ini sudah menjelaskan kenapa
 * `saatKlik` di bawah SENGAJA menulis FSM sendiri, bukan memakai
 * `InteractionHandler` itu — jadi tak ada jalan untuk "meneruskan snapConfig
 * ke InteractionConfig" di sini, sesederhana itu tak ada pemanggilan
 * `InteractionConfig` sama sekali di seluruh berkas. Yang dilakukan di bawah
 * ini menuliskan ULANG semantik yang sama (`snapToPrice`+`snapToBar`, dua
 * ambang piksel PERSIS seperti spek: 8 lemah / 24 kuat) langsung di titik
 * tempat harga klik dibaca dari koordinat piksel. `snapToBar` sendiri tak
 * butuh kode tambahan sama sekali: `chart.subscribeClick` SELALU membalas
 * waktu BAR YANG SUDAH ADA (bukan waktu kontinu di bawah kursor) — tempel-ke-
 * bar itu bawaan cara alat ini menggambar (klik-klik, bukan seret), bukan
 * sesuatu yang perlu ditambahkan.
 */
export type KeadaanMagnet = '0' | 'lemah' | 'kuat'
const KUNCI_MAGNET = 'papan:alat-gambar-magnet'
const AMBANG_MAGNET: Record<'lemah' | 'kuat', number> = { lemah: 8, kuat: 24 }

function bacaMagnetTersimpan(): KeadaanMagnet {
  try {
    const v = localStorage.getItem(KUNCI_MAGNET)
    return v === 'lemah' || v === 'kuat' ? v : '0'
  } catch { return '0' }
}

/** Urutan putaran klik: mati -> lemah -> kuat -> mati. Fungsi murni supaya
 *  bisa diuji tanpa React/localStorage. */
export function magnetBerikutnya(sekarang: KeadaanMagnet): KeadaanMagnet {
  if (sekarang === '0') return 'lemah'
  if (sekarang === 'lemah') return 'kuat'
  return '0'
}

/**
 * Snapkan harga klik ke kandidat OHLC terdekat (bar yang sama, sudah lewat
 * `snapToBar` bawaan) kalau jaraknya di layar (piksel, lewat
 * `priceToCoordinate`) di bawah ambang keadaan magnet. `priceToCoordinate`
 * disuntik sebagai fungsi murni — tak menyentuh `ISeriesApi` sungguhan di
 * sini — supaya bisa diuji tanpa lightweight-charts.
 */
export function snapkanHarga(
  hargaKlik: number,
  yKlik: number,
  kandidat: number[],
  keadaan: KeadaanMagnet,
  priceToCoordinate: (harga: number) => number | null,
): number {
  if (keadaan === '0' || kandidat.length === 0) return hargaKlik
  const ambang = AMBANG_MAGNET[keadaan]
  let terbaik: { harga: number; jarak: number } | null = null
  for (const h of kandidat) {
    const y = priceToCoordinate(h)
    if (y == null) continue
    const jarak = Math.abs(y - yKlik)
    if (jarak <= ambang && (!terbaik || jarak < terbaik.jarak)) terbaik = { harga: h, jarak }
  }
  return terbaik !== null ? terbaik.harga : hargaKlik
}

/** Kandidat harga snap dari titik data SERI PADA bar yang diklik
 *  (`MouseEventParams.seriesData`, bukan `.data()` yang harus dicari manual
 *  per waktu) — bentuknya union (candle: open/high/low/close, garis: value),
 *  jadi dibaca longgar lewat ruas yang ADA. */
function kandidatHargaDariTitik(titik: unknown): number[] {
  if (!titik || typeof titik !== 'object') return []
  const o = titik as Record<string, unknown>
  const angka = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  return (['open', 'high', 'low', 'close', 'value'] as const)
    .filter((k) => angka(o[k]))
    .map((k) => o[k] as number)
}

/** Style pustaka dari gaya BAWAAN tersimpan (`gambarGrafik.ts`) — dipakai
 *  tiap gambar BARU dibuat, supaya "bawaan tebal 1, bukan yang tebal" (Johan)
 *  berlaku sejak klik pertama, bukan cuma sesudah pembaca membuka modal
 *  setelan sekali. */
function styleGambarBaru(): Partial<DrawingStyle> {
  const g = bacaGayaBawaan()
  return { lineColor: g.warna, lineWidth: g.tebal, lineDash: dashDariGaya(g.gaya) }
}

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
  /** Keadaan magnet snap — dipakai `saatKlik` di bawah, bukan diteruskan ke
   *  pustaka (lihat komentar "Magnet snap" di atas). */
  magnet: KeadaanMagnet
  /** Putar mati -> lemah -> kuat -> mati. */
  sikluskanMagnet: () => void
  /** Style gambar YANG SEDANG TERPILIH — `null` kalau tak ada yang terpilih.
   *  Dipakai modal setelan (GrafikEmiten.tsx) mem-prefill warna/tebal/gaya. */
  gayaTerpilih: DrawingStyle | null
  /** Terapkan patch warna/tebal/gaya ke gambar terpilih LEWAT API pustaka
   *  (`IDrawing.updateStyle`, bukan tulis-ulang localStorage — lihat
   *  komentar di badan fungsi) sekaligus mengingatnya sebagai bawaan gambar
   *  BERIKUTNYA. Tak berbuat apa-apa kalau tak ada yang terpilih. */
  terapkanGaya: (patch: Partial<GayaGambar>) => void
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
  const [magnet, setMagnetState] = useState<KeadaanMagnet>(bacaMagnetTersimpan)
  const [gayaTerpilih, setGayaTerpilih] = useState<DrawingStyle | null>(null)

  const managerRef = useRef<Manager | null>(null)
  const alatAktifRef = useRef<string | null>(null)
  const titikSedangRef = useRef<Anchor[]>([])
  const alatTertundaRef = useRef<string | null>(null)
  const kodeRef = useRef(kode)
  kodeRef.current = kode
  // Dibaca di `saatKlik` (closure efek, bukan re-subscribe tiap magnet
  // berganti) — pola sama dengan `alatAktifRef`.
  const magnetRef = useRef<KeadaanMagnet>(magnet)
  magnetRef.current = magnet

  const sikluskanMagnet = useCallback(() => {
    setMagnetState((m) => {
      const berikut = magnetBerikutnya(m)
      try { localStorage.setItem(KUNCI_MAGNET, berikut) } catch { /* mode privat */ }
      return berikut
    })
  }, [])

  /**
   * Pan/zoom chart (Johan, tangkapan layar 18 Agu: "waktu gambar kenapa
   * chart nya ikutan gerak"). Kanvas & bilah alat gambar berbagi kontainer
   * yang sama, jadi satu gerakan seret dibaca DUA KALI — sekali oleh
   * `chart.handleScroll` bawaan (pan), sekali oleh listener alat gambar. Dua
   * kondisi WAJIB mematikannya, bukan cuma satu: alat gambar aktif
   * (`alatAktifRef`, tempel-titik ATAU kuas), DAN sedang menyeret anchor
   * gambar yang SUDAH ADA (`seretAnchorRef`, drag-reshape bawaan manager —
   * ini berlaku juga saat `alatAktif` null / mode kursor).
   *
   * Nilai ASLI (`panAsliRef`) dibaca dari `chart.options()` SEKALI saat
   * pertama kali dimatikan, dipulihkan APA ADANYA saat kedua kondisi di atas
   * sama-sama lepas — bukan konstanta tertulis ulang di sini, supaya
   * `handleScroll:{vertTouchDrag:false}` dari `GrafikEmiten.tsx` (chart di
   * telepon: geser vertikal tetap milik HALAMAN, bukan chart) tetap hidup
   * sesudah pemulihan walau berkas ini tak tahu apa isinya.
   */
  const panAsliRef = useRef<{
    handleScroll: ReturnType<IChartApi['options']>['handleScroll']
    handleScale: ReturnType<IChartApi['options']>['handleScale']
  } | null>(null)
  const seretAnchorRef = useRef(false)
  const terapkanPan = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const matikan = alatAktifRef.current !== null || seretAnchorRef.current
    if (matikan) {
      if (!panAsliRef.current) {
        // `chart.options()` mengembalikan REFERENSI HIDUP ke state internal
        // lightweight-charts, BUKAN salinan — terukur langsung (log QA 18 Agu
        // 2026): begitu `applyOptions({handleScroll:false,...})` dipanggil
        // sesudahnya, objek yang SAMA ikut berubah jadi `false` juga, dan
        // pemulihan berikutnya menerapkan nilai yang sudah rusak. `structuredClone`
        // memutus tautan itu — WAJIB, bukan kehati-hatian berlebih.
        const o = chart.options()
        panAsliRef.current = structuredClone({ handleScroll: o.handleScroll, handleScale: o.handleScale })
      }
      chart.applyOptions({ handleScroll: false, handleScale: false })
    } else if (panAsliRef.current) {
      chart.applyOptions({ handleScroll: panAsliRef.current.handleScroll, handleScale: panAsliRef.current.handleScale })
      panAsliRef.current = null
    }
  }, [chartRef])

  // Jejak goresan kuas & jalur keluarnya — REF (bukan closure lokal di dalam
  // efek kuas) supaya Escape/klik-kanan (efek keyboard di bawah) bisa
  // menjangkau dan membatalkan goresan yang SEDANG berlangsung. Closure lokal
  // tak bisa dijangkau dari efek lain sama sekali.
  const kuasAktifRef = useRef(false)
  const titikKuasRef = useRef<Anchor[]>([])

  /** Batalkan APA PUN yang sedang berlangsung — dipanggil dari Escape & klik
   *  kanan. Titik klik-klik yang belum genap DIBUANG (bukan disimpan sebagai
   *  gambar setengah jadi), goresan kuas yang sedang ditarik DIHENTIKAN tanpa
   *  menjadi gambar. Pan TIDAK dipulihkan di sini — itu urusan `pilihAlat`,
   *  dipanggil terpisah oleh pemanggil kalau memang bermaksud keluar dari
   *  mode alat gambar sepenuhnya (lihat komentar di pemanggilnya). */
  const batalkanSedangDigambar = useCallback(() => {
    titikSedangRef.current = []
    kuasAktifRef.current = false
    titikKuasRef.current = []
  }, [])

  const mintaPustaka = useCallback(() => {
    if (pustaka || galat) return
    muatPustakaGambar()
      .then(setPustaka)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat alat gambar.'))
  }, [pustaka, galat])

  /**
   * Muat pustaka OTOMATIS kalau emiten ini punya gambar tersimpan —
   * `bacaGambarTersimpan` sendiri murah (satu `localStorage.getItem` + parse
   * JSON, bukan impor 2,7 MB), jadi memeriksanya di SETIAP kode tak melanggar
   * alasan impor dinamis (lihat `gambarPustaka.ts`).
   *
   * Tanpa efek ini, muat ulang halaman meninggalkan gambar yang sudah
   * disimpan TAK TERLIHAT sampai pembaca kebetulan menyentuh bilah alat
   * gambar — dan dari layar itu terbaca sebagai "gambarnya hilang", padahal
   * datanya utuh di localStorage (cuma belum digambar ulang). Terukur 18 Agu
   * 2026: garis horizontal yang baru disimpan lenyap dari layar sesudah
   * reload sampai bilah disentuh — persis kegagalan senyap yang dilarang
   * CLAUDE.md.
   */
  useEffect(() => {
    if (bacaGambarTersimpan(kode).length > 0) mintaPustaka()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kode])

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

  /**
   * Setelan gambar TERPILIH (#185 lanjutan, Johan 21 Agu: "line gak ada
   * setup modal warna ketebalan ketipisan"). Jalur API yang dipakai:
   * `IDrawing.updateStyle` — pustaka MEMANG menyediakannya (public, lihat
   * `Drawing`/`IDrawing` di `dist/index.d.ts`), jadi dipakai LANGSUNG, bukan
   * jalan mundur tulis-ulang localStorage lalu muat ulang gambarnya.
   * `updateStyle` sendiri cuma mengubah objek `Drawing` di memori (tak
   * memicu event manager `drawing:updated` — event itu cuma ditembak jalur
   * seret-anchor bawaan manager) jadi persistensinya dipanggil manual lewat
   * `simpanSekarang` di sini, sama seperti jalur seret.
   *
   * Patch juga diingat sebagai bawaan GAMBAR BERIKUTNYA (`tulisGayaBawaan`) —
   * itu jawaban "selalu berat bawaannya": begitu pembaca menyetel satu garis
   * jadi tebal 1, garis BARU sesudahnya ikut tebal 1 tanpa perlu disetel lagi.
   */
  const terapkanGaya = useCallback((patch: Partial<GayaGambar>) => {
    const manager = managerRef.current
    const dipilih = manager?.getSelectedDrawing()
    if (!dipilih) return
    tulisGayaBawaan({ ...bacaGayaBawaan(), ...patch })
    const stylePatch: Partial<DrawingStyle> = {}
    if (patch.warna !== undefined) stylePatch.lineColor = patch.warna
    if (patch.tebal !== undefined) stylePatch.lineWidth = patch.tebal
    if (patch.gaya !== undefined) stylePatch.lineDash = dashDariGaya(patch.gaya)
    dipilih.updateStyle(stylePatch)
    setGayaTerpilih(dipilih.style)
    simpanSekarang()
  }, [simpanSekarang])

  const pilihAlat = useCallback((id: string | null) => {
    if (id && !pustaka) {
      // Pustaka belum diunduh (klik pertama pembaca) — simpan niatnya,
      // `mintaPustaka` dipicu dari bilah (onPointerDownCapture), efek di
      // bawah menyelesaikannya begitu pustaka tiba.
      alatTertundaRef.current = id
      return
    }
    batalkanSedangDigambar()
    alatAktifRef.current = id
    setAlatAktifState(id)
    managerRef.current?.setActiveTool(id)
    // Pindah ke alat gambar berarti keluar dari mode pilih — gambar yang
    // tadi terpilih tak boleh ikut terseret saat pembaca menempatkan titik
    // gambar yang BARU di kanvas yang sama.
    if (id) managerRef.current?.deselectAll()
    // `id !== null` (alat gambar dipilih) MEMATIKAN pan; `id === null`
    // (kembali ke kursor) MEMULIHKANNYA — "keadaan bawaannya" (Johan). Kalau
    // sedang menyeret anchor gambar lain (`seretAnchorRef`), `terapkanPan`
    // sendiri yang menahannya tetap mati sampai seretan itu juga selesai.
    terapkanPan()
  }, [pustaka, batalkanSedangDigambar, terapkanPan])

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
      manager.on('drawing:selected', () => {
        setAdaTerpilih(true)
        setGayaTerpilih(manager!.getSelectedDrawing()?.style ?? null)
      })
      manager.on('drawing:deselected', () => { setAdaTerpilih(false); setGayaTerpilih(null) })
      manager.on('drawing:removed', () => { setAdaTerpilih(false); setGayaTerpilih(null) })
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
      const series = seriesRef.current
      const hargaMentah = series?.coordinateToPrice(param.point.y)
      if (hargaMentah == null || !Number.isFinite(hargaMentah)) return
      // Magnet (#185 lanjutan): snap ke OHLC bar yang sama — lihat komentar
      // "Magnet snap" di atas berkas ini soal kenapa ini BUKAN `snapConfig`
      // pustaka. `snapToBar` sendiri gratis (`param.time` selalu waktu bar
      // yang sudah ada); yang dihitung di sini cuma `snapToPrice`.
      const kandidat = series ? kandidatHargaDariTitik(param.seriesData.get(series)) : []
      const harga = snapkanHarga(hargaMentah, param.point.y, kandidat, magnetRef.current,
        (h) => series?.priceToCoordinate(h) ?? null)

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
      const gambar = registry.createDrawing(alat, idBaru(), anchors, styleGambarBaru(), opsi)
      if (gambar) managerRef.current?.addDrawing(gambar)
      pilihAlat(null) // sekali gambar selesai, kembali ke mode pilih
    }

    chart.subscribeClick(saatKlik)
    return () => chart.unsubscribeClick(saatKlik)
  }, [pustaka, chartRef, seriesRef, pilihAlat])

  /* ---------------- Kuas: seret mentah ---------------- */
  // Jejaknya di REF hoisted (`kuasAktifRef`/`titikKuasRef`), bukan closure
  // lokal — `batalkanSedangDigambar` (Escape/klik-kanan) harus bisa
  // menjangkaunya dari LUAR efek ini untuk menghentikan goresan yang sedang
  // ditarik. `pxTerakhir` tetap closure lokal (murni jarak-piksel-minimum,
  // tak pernah perlu dibatalkan dari luar).
  useEffect(() => {
    const container = containerRef.current
    const chart = chartRef.current
    if (!container || !chart || !pustaka) return
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
      kuasAktifRef.current = true
      titikKuasRef.current = [t.a]
      pxTerakhir = t.px
    }
    const gerak = (ev: MouseEvent) => {
      if (!kuasAktifRef.current) return
      const t = keAnchor(ev)
      if (!t) return
      if (pxTerakhir) {
        const jarak = Math.hypot(t.px.x - pxTerakhir.x, t.px.y - pxTerakhir.y)
        if (jarak < JARAK_MIN_KUAS) return
      }
      titikKuasRef.current.push(t.a)
      pxTerakhir = t.px
    }
    const naik = () => {
      if (!kuasAktifRef.current) return
      const titik = titikKuasRef.current
      kuasAktifRef.current = false
      titikKuasRef.current = []
      pxTerakhir = null
      if (titik.length >= 2) {
        const gambar = pustaka.getToolRegistry().createDrawing('brush', idBaru(), titik, styleGambarBaru())
        if (gambar) managerRef.current?.addDrawing(gambar)
      }
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

  /* ---------------- Pan mati selagi menyeret ANCHOR gambar yang sudah ada ---------------- */
  // Berlaku independen dari `alatAktif` — mode KURSOR (alatAktif null) yang
  // justru paling sering dipakai menyeret titik gambar lama. Meniru cek yang
  // sama dengan `DrawingManager.handleMouseDown` bawaan pustaka (hitTestAnchor
  // pada gambar terpilih) — bukan menyalin state internalnya, cuma bertanya
  // pertanyaan yang sama lewat API publik `hitTestAnchor`.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !pustaka) return

    const turun = (ev: MouseEvent) => {
      const manager = managerRef.current
      if (!manager?.getSelectedDrawing()) return
      const r = container.getBoundingClientRect()
      const kena = manager.hitTestAnchor({ x: ev.clientX - r.left, y: ev.clientY - r.top })
      if (kena === null) return
      seretAnchorRef.current = true
      terapkanPan()
    }
    const naik = () => {
      if (!seretAnchorRef.current) return
      seretAnchorRef.current = false
      terapkanPan()
    }

    container.addEventListener('mousedown', turun)
    window.addEventListener('mouseup', naik)
    return () => {
      container.removeEventListener('mousedown', turun)
      window.removeEventListener('mouseup', naik)
    }
  }, [pustaka, containerRef, terapkanPan])

  /**
   * Keyboard: Escape membatalkan, Delete/Backspace menghapus.
   *
   * Escape DUA TAHAP — sengaja, bukan kelalaian: tahap pertama membuang
   * titik/goresan yang BELUM genap tapi alat gambarnya tetap terpilih (siap
   * menggambar bentuk berikutnya, pan tetap mati — itu memang keadaannya
   * selagi alat gambar aktif). Tahap kedua (Escape lagi, atau tak ada apa pun
   * yang sedang digambar) baru keluar sepenuhnya ke kursor lewat `pilihAlat`,
   * dan DI SITULAH pan dipulihkan. Jalur ini juga yang mencegah "chart hang"
   * kalau Escape ditekan di tengah goresan kuas (mouse masih tertekan): efek
   * kuas sendiri tak pernah tahu Escape ditekan, jadi `batalkanSedangDigambar`
   * WAJIB menjangkau `kuasAktifRef` dari sini — tanpa itu goresannya baru
   * berhenti saat tombol tetikus benar-benar dilepas.
   */
  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (titikSedangRef.current.length > 0 || kuasAktifRef.current) {
          batalkanSedangDigambar()
          return
        }
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
  }, [pilihAlat, batalkanSedangDigambar])

  /**
   * Klik kanan membatalkan alat gambar SEPENUHNYA (bukan dua tahap seperti
   * Escape) — konvensi umum aplikasi chart, dan lebih penting: jalur keluar
   * kedua supaya pan tak pernah terjebak mati kalau pembaca lebih terbiasa
   * klik kanan daripada Escape. `preventDefault` cuma selagi alat gambar
   * benar-benar aktif — di mode kursor, menu klik-kanan bawaan peramban
   * (mis. "Simpan gambar sebagai…") tetap harus jalan seperti biasa.
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const saatKlikKanan = (e: MouseEvent) => {
      if (!alatAktifRef.current) return
      e.preventDefault()
      batalkanSedangDigambar()
      pilihAlat(null)
    }
    container.addEventListener('contextmenu', saatKlikKanan)
    return () => container.removeEventListener('contextmenu', saatKlikKanan)
  }, [containerRef, pilihAlat, batalkanSedangDigambar])

  return {
    pustaka, galat, alatAktif, pilihAlat, adaTerpilih, hapusTerpilih, mintaPustaka,
    magnet, sikluskanMagnet, gayaTerpilih, terapkanGaya,
  }
}
