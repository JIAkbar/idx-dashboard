import { Link } from 'react-router-dom'
import { TombolIkon } from '../../../components/dasbor/TombolIkon'
import { IKON_SILANG } from '../../../components/dasbor/IkonMenu'
import { holderType, type GraphSelection, type InvestorMapEntry } from '../../../lib/dasbor/petaInvestorData'
import { afiliasiUntukEmiten } from '../../../lib/dasbor/brokerAfiliasi'
import { IkonMenu, IKON_GLOBE, IKON_LOKASI } from '../../../components/dasbor/IkonMenu'

interface DetailPanelProps {
  allData: InvestorMapEntry[]
  selected: GraphSelection
  onClose: () => void
}

const TYPE_LABEL: Record<'CORP' | 'IND' | 'OTH', string> = { CORP: 'CORPORATE', IND: 'INDIVIDUAL', OTH: 'TIPE TAK TERISI' }
/* TYPE_COLOR lama (#60a5fa/#4ade80/#a78bfa) dan warna bendera lokal/asing
   (#818cf8/#34d399) dibuang: hijau dikunci untuk arah angka, dan tiga warna
   kategori di panel ini bertabrakan dengan palet graf yang sekarang cuma satu
   aksen. Kedua badge jadi .bchip netral — teksnya sudah menyebutkan kategori. */
const PCT_CLR = 'var(--amber)'

/** Panel detail di sisi kanan graf (desktop) / bawah (mobile). Port piShowPanel() index_live.html baris 162-231, sebagai JSX bukan string-innerHTML. */
export function DetailPanel({ allData, selected, onClose }: DetailPanelProps) {
  if (selected.type === 'emiten') {
    const em = allData.find((x) => x.code === selected.code)
    if (!em) return null
    const afiliasi = afiliasiUntukEmiten(em.code)
    return (
      <div className="pi-panel">
        <div className="pi-panel-head">
          <div>
            <div className="pi-panel-eyebrow">EMITEN</div>
            <div className="pi-panel-title" style={{ color: 'var(--amber)' }}>{em.code}</div>
            <div className="pi-panel-sub">{em.issuer}</div>
          </div>
          <TombolIkon d={IKON_SILANG} label="Tutup panel" onClick={onClose} />
        </div>
        <div className="pi-panel-body">
          <div className="pi-panel-section-label">IDX 1% SHAREHOLDERS</div>
          {em.holders.map((h) => (
            <div className="pi-panel-row" key={h.name}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pi-panel-row-name">{h.name}</div>
                <div className="pi-panel-row-badges">
                  <span className="bchip">{TYPE_LABEL[holderType(h.cls)]}</span>
                  <span className="bchip">{h.lf === 'F' ? 'ASING' : 'LOKAL'}</span>
                </div>
              </div>
              <div className="pi-panel-row-pct num" style={{ color: PCT_CLR }}>{h.pct}%</div>
            </div>
          ))}
          <div className="pi-panel-section-label" style={{ marginTop: 14 }}>BROKER TERAFILIASI</div>
          {afiliasi.length === 0 ? (
            <p className="muted" style={{ fontSize: 10, lineHeight: 1.5, margin: '4px 0 0' }}>
              Belum ada sekuritas yang tercatat satu grup usaha dengan {em.code} (kurasi redaksi
              — hanya afiliasi publik berkeyakinan tinggi yang dimasukkan).
            </p>
          ) : (
            <>
              {afiliasi.map((a) => (
                <div className="pi-panel-row" key={a.kode}>
                  <span
                    className="bchip"
                    style={{ marginRight: 0, fontWeight: 700, color: 'var(--amber)', borderColor: 'var(--amber)' }}
                  >{a.kode}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pi-panel-row-name">{a.sekuritas}</div>
                    <div className="pi-panel-row-badges" style={{ flexWrap: 'wrap', rowGap: 3 }}>
                      <span className="bchip">GRUP {a.grup.toUpperCase()}</span>
                      {/* saham segrup broker ini — emiten yang sedang dibuka ditandai amber */}
                      {a.emiten.map((t) => (
                        <Link
                          key={t}
                          className="bchip"
                          to={`/grafik?kode=${t}`}
                          style={t === em.code
                            ? { color: 'var(--amber)', borderColor: 'var(--amber)', fontWeight: 700 }
                            : undefined}
                        >{t}</Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {/* Nilai edukasinya: aktivitas broker segrup di saham grupnya sendiri
                  adalah jejak klasik penampung internal — pembaca diarahkan
                  mengeceknya di Broker Summary, bukan disimpulkan di sini. */}
              <p className="muted" style={{ fontSize: 10, lineHeight: 1.5, margin: '8px 0 0' }}>
                Sekuritas satu grup usaha dengan {em.code} (kurasi redaksi). Pantau kode ini
                di Broker Summary — akumulasi lewat broker segrup sering menandai penampungan internal.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  const holdings = allData
    .filter((e) => e.holders.some((h) => h.name === selected.name))
    .map((e) => ({ code: e.code, issuer: e.issuer, pct: e.holders.find((h) => h.name === selected.name)?.pct ?? 0 }))
    .sort((a, b) => b.pct - a.pct)
  const flag = selected.lf === 'F' ? <><IkonMenu d={IKON_GLOBE} size={11} /> Asing</> : <><IkonMenu d={IKON_LOKASI} size={11} /> Domestik</>

  return (
    <div className="pi-panel">
      <div className="pi-panel-head">
        <div>
          <div className="pi-panel-eyebrow">INVESTOR</div>
          <div className="pi-panel-title">{selected.name}</div>
          <div className="pi-panel-sub">{selected.cls || '—'} · {flag}</div>
        </div>
        <TombolIkon d={IKON_SILANG} label="Tutup panel" onClick={onClose} />
      </div>
      <div className="pi-panel-body">
        <div className="pi-panel-section-label">PORTOFOLIO SAHAM ({holdings.length} emiten)</div>
        {holdings.map((h) => (
          <div className="pi-panel-row" key={h.code}>
            <Link className="bchip" to={`/grafik?kode=${h.code}`} style={{ marginRight: 0 }}>{h.code}</Link>
            <div className="pi-panel-row-issuer" title={h.issuer}>{h.issuer}</div>
            <div className="pi-panel-row-pct num" style={{ color: PCT_CLR }}>{h.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
