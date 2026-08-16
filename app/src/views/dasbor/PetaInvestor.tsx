import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GrupKonglomerat } from '../../components/dasbor/GrupKonglomerat'
import { GrafikJaringan } from '../../components/dasbor/GrafikJaringan'
import { WARNA } from '../../lib/dasbor/graphRender'
import { getInvestorMap, usePetaInvestor, type GraphSelection, type InvestorMapEntry } from '../../lib/dasbor/petaInvestorData'
import { ByStock } from './peta-investor/ByStock'
import { ByInvestor } from './peta-investor/ByInvestor'
import { DetailPanel } from './peta-investor/DetailPanel'
import { PetaInvestorSearch, type PetaInvestorSearchHandle } from './peta-investor/PetaInvestorSearch'
import { exportEmiten, exportInvestor } from '../../lib/dasbor/exportPeta'
import { IkonMenu, IKON_JAM, IKON_PERINGATAN, IKON_ULANG, IKON_KLIK, IKON_PERLUAS } from '../../components/dasbor/IkonMenu'

/** Panah unduh ke tray — sama dengan IKON_UNDUH lokal Bulletin.tsx. */
const IKON_UNDUH = 'M12 4v10M7.5 10.5L12 15l4.5-4.5M5 19h14'

type ViewTab = 'grafik' | 'stock' | 'investor' | 'grup'

const DEFAULT_NODE_COUNT = 10
const INVESTOR_FOCUS_LIMIT = 60

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'grafik', label: 'Grafik Jaringan' },
  { id: 'stock', label: 'By Stock' },
  { id: 'investor', label: 'By Investor' },
  { id: 'grup', label: 'Grup Konglomerat' },
]

/** Legenda memakai objek WARNA yang SAMA dengan graf — bukan salinan nilai warnanya. */
const LEGENDA: { warna: string; teks: string }[] = [
  { warna: WARNA.emiten, teks: 'Emiten' },
  { warna: WARNA.institusi, teks: 'Institusi (CORP)' },
  { warna: WARNA.individu, teks: 'Individu (IND)' },
  { warna: WARNA.lain, teks: 'Tipe tak terisi (OTH)' },
]

/**
 * Panel "Peta Investor" — network graph kepemilikan saham IDX. Port markup
 * baris 2219-2369 + piInit/piSwitchView/piClickNode index_live.html
 * baris 4452-5141. Klik node graf, baris tabel By Stock/By Investor, atau
 * hasil pencarian semua lewat satu handleSelect (bukan pindah halaman —
 * semua switch ke sub-view Grafik Jaringan ter-fokus).
 */
export function PetaInvestor() {
  const { data, loading, error, retry } = usePetaInvestor()
  const [activeView, setActiveView] = useState<ViewTab>('grafik')
  const [searchValue, setSearchValue] = useState('')
  const [focusCode, setFocusCode] = useState<string | null>(null)
  /** Override daftar node graf umum saat investor diklik (portofolionya, s.d. 60 emiten). null = pakai default (10 emiten pertama). */
  const [investorFocusList, setInvestorFocusList] = useState<InvestorMapEntry[] | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<GraphSelection | null>(null)
  // Layar penuh kartu graf — Fullscreen API bawaan peramban, pola sama #51
  // (ChartIndeks): browser urus ESC/tumpukan/ukuran, kita cuma sinkronkan
  // label tombol lewat fullscreenchange (biar tetap benar saat keluar via Esc).
  const graphCardRef = useRef<HTMLDivElement>(null)
  const [fsAktif, setFsAktif] = useState(false)
  // Menu Export XLS — dua mode: emiten+cabang / investor.
  const [exportBuka, setExportBuka] = useState(false)
  // Tombol "Tampilkan" pindah ke baris tab (dulu berdesakan dgn kotak cari di
  // mobile) — logika go() tetap milik PetaInvestorSearch, dipicu via ref.
  const searchRef = useRef<PetaInvestorSearchHandle>(null)

  useEffect(() => {
    const onFsChange = () => setFsAktif(document.fullscreenElement === graphCardRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const defaultEmitenList = useMemo(() => (data ? data.slice(0, DEFAULT_NODE_COUNT) : []), [data])
  const emitenList = investorFocusList ?? defaultEmitenList
  const investorMap = useMemo(() => (data ? getInvestorMap(data) : []), [data])

  const handleSelect = useCallback(
    (sel: GraphSelection | null) => {
      if (!sel) {
        setSelectedDetail(null)
        return
      }
      setSelectedDetail(sel)
      setActiveView('grafik')
      if (sel.type === 'emiten') {
        setSearchValue(sel.code)
        setFocusCode(sel.code)
      } else {
        setSearchValue(sel.name.slice(0, 30))
        setFocusCode(null)
        if (data) {
          const theirs = data.filter((e) => e.holders.some((h) => h.name === sel.name)).slice(0, INVESTOR_FOCUS_LIMIT)
          setInvestorFocusList(theirs)
        }
      }
    },
    [data],
  )

  const handleClear = useCallback(() => {
    setSearchValue('')
    setFocusCode(null)
    setSelectedDetail(null)
    setInvestorFocusList(null)
  }, [])

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Peta Investor</h1>
        <span className="sub">jaringan kepemilikan KSEI · ≥1% · {data?.length ?? 0} emiten</span>
      </div>

      {loading && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_JAM} size={28} /></p>
          <p>Memuat data jaringan investor…</p>
        </div>
      )}

      {!loading && error && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p>Gagal memuat data investor.</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>{error}</p>
          <button type="button" className="btn-p" style={{ marginTop: 12 }} onClick={retry}>
            <IkonMenu d={IKON_ULANG} size={13} /> Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Enam kontrol satu baris: tiga tab, kotak cari, "Tampilkan",
              Export XLS. Tab di depan karena dialah yang menentukan ARTI
              kontrol sesudahnya — mencari di Grafik Jaringan dan mencari
              di By Investor menghasilkan hal berbeda, jadi urutan bacanya
              pun mengikuti: pilih tampilan dulu, baru cari di dalamnya.
              Kotak cari menyerap sisa lebar; di layar sempit dia yang
              membungkus turun lebih dulu karena paling butuh ruang.
              Tombol "Reset" dibuang: tombol X di dalam kotak cari sudah
              mengosongkannya, dan dua kontrol untuk satu tindakan cuma
              menimbulkan ragu mana yang benar. */}
          <div className="pi-toolbar">
            <div className="tabs" role="tablist" aria-label="Tampilan Peta Investor">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeView === t.id}
                  className={'tab' + (activeView === t.id ? ' on' : '')}
                  onClick={() => setActiveView(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <PetaInvestorSearch ref={searchRef} data={data} value={searchValue} onChange={setSearchValue} onSelect={handleSelect} onClear={handleClear} />
            <button type="button" className="pi-search-go" onClick={() => searchRef.current?.tampilkan()}>Tampilkan</button>
            <div className={`dd${exportBuka ? ' open' : ''}`} style={{ position: 'relative' }}>
              <button
                type="button"
                className="dd-btn"
                onClick={() => setExportBuka((v) => !v)}
                onBlur={() => setTimeout(() => setExportBuka(false), 200)}
                title="Unduh data Peta Investor sebagai berkas Excel"
              >
                <IkonMenu d={IKON_UNDUH} size={13} /> Export XLS
              </button>
              {exportBuka && (
                <div className="dd-menu" style={{ display: 'block', right: 0, left: 'auto' }}>
                  <button
                    type="button"
                    className="dd-it"
                    disabled={selectedDetail?.type !== 'emiten'}
                    style={selectedDetail?.type !== 'emiten' ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    onMouseDown={() => {
                      if (selectedDetail?.type === 'emiten') exportEmiten(data, selectedDetail.code)
                    }}
                  >
                    {selectedDetail?.type === 'emiten'
                      ? `Emiten ${selectedDetail.code} + cabang`
                      : 'Emiten + cabang (pilih emiten dulu)'}
                  </button>
                  <button
                    type="button"
                    className="dd-it"
                    disabled={selectedDetail?.type !== 'investor'}
                    style={selectedDetail?.type !== 'investor' ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    onMouseDown={() => {
                      if (selectedDetail?.type === 'investor') exportInvestor(data, selectedDetail.name)
                    }}
                  >
                    {selectedDetail?.type === 'investor'
                      ? `Portofolio ${selectedDetail.name.slice(0, 24)}`
                      : 'Portofolio investor (pilih investor dulu)'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {activeView === 'grup' && <GrupKonglomerat />}

          {activeView === 'grafik' && (
            <>
              <div className="panel pi-legend" style={{ padding: '10px 14px' }}>
                <span className="lbl">Legenda</span>
                {LEGENDA.map((l) => (
                  <span key={l.teks}><span className="pi-legend-dot" style={{ background: l.warna }} />{l.teks}</span>
                ))}
                <span className="pi-legend-hint">Ukuran simpul = % kepemilikan · label hanya 12 simpul terbesar, sisanya muncul saat diarahkan · <IkonMenu d={IKON_KLIK} size={11} /> klik untuk detail</span>
              </div>
              <div className="panel pi-graph-card" ref={graphCardRef}>
                <GrafikJaringan allData={data} emitenList={emitenList} focusCode={focusCode} onSelect={handleSelect}>
                  <button
                    type="button"
                    className="pi-fs-btn"
                    onClick={() => {
                      if (fsAktif) document.exitFullscreen?.().catch(() => {})
                      else graphCardRef.current?.requestFullscreen?.()?.catch(() => {})
                    }}
                    title={fsAktif ? 'Keluar layar penuh' : 'Layar penuh'}
                  >
                    {fsAktif ? <IkonMenu d="M6 6l12 12M18 6L6 18" size={13} /> : <IkonMenu d={IKON_PERLUAS} size={13} />}
                    <span>{fsAktif ? 'Keluar' : 'Layar Penuh'}</span>
                  </button>
                </GrafikJaringan>
                {selectedDetail && <DetailPanel allData={data} selected={selectedDetail} onClose={() => setSelectedDetail(null)} />}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>
                Data bersumber dari KSEI (Kustodian Sentral Efek Indonesia) · Kepemilikan ≥1% · Bukan saran investasi
              </div>
            </>
          )}

          {activeView === 'stock' && <ByStock data={data} onSelect={handleSelect} />}
          {activeView === 'investor' && <ByInvestor investorMap={investorMap} onSelect={handleSelect} />}
        </>
      )}
    </div>
  )
}
