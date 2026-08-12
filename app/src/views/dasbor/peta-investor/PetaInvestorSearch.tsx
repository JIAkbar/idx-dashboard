import { useState } from 'react'
import { searchPetaInvestor, type GraphSelection, type InvestorMapEntry } from '../../../lib/dasbor/petaInvestorData'

interface PetaInvestorSearchProps {
  data: InvestorMapEntry[]
  value: string
  onChange: (v: string) => void
  onSelect: (sel: GraphSelection) => void
  onClear: () => void
}

/* Empat warna latar penuh (ungu/hijau/hijau/biru) diganti .bchip netral: warna
   di sini tidak menambah informasi apa pun di atas teksnya sendiri, dan dua di
   antaranya hijau — dikunci untuk arah angka. */
function categoryBadge(cls: string) {
  if (/pemilik|benefi/i.test(cls)) return <span className="bchip">Pemilik Manfaat</span>
  if (/direksi|komisar|board|director|commissioner/i.test(cls)) return <span className="bchip">Direksi</span>
  if (/individual|person|natural/i.test(cls)) return <span className="bchip">Individu</span>
  return <span className="bchip">Investor</span>
}

function highlight(name: string, q: string) {
  const idx = name.toUpperCase().indexOf(q)
  if (idx < 0) return name
  return (
    <>
      {name.slice(0, idx)}
      <b style={{ color: 'var(--accent)' }}>{name.slice(idx, idx + q.length)}</b>
      {name.slice(idx + q.length)}
    </>
  )
}

/** Search box + dropdown hasil (emiten & investor). Port pi-search + piSearchInput/piShowDrop/piSearchSelect/piSearchGo/piSearchClear index_live.html baris 4450-4581. */
export function PetaInvestorSearch({ data, value, onChange, onSelect, onClear }: PetaInvestorSearchProps) {
  const [open, setOpen] = useState(false)
  const q = value.trim().toUpperCase()
  const { emitenHits, investorHits } = open ? searchPetaInvestor(data, q) : { emitenHits: [], investorHits: [] }

  function selectEmiten(code: string) {
    setOpen(false)
    onSelect({ type: 'emiten', code })
  }
  function selectInvestor(hit: { name: string; cls: string; lf: string }) {
    setOpen(false)
    onSelect({ type: 'investor', name: hit.name, cls: hit.cls, lf: hit.lf })
  }

  function go() {
    setOpen(false)
    if (!q) { onClear(); return }
    const exact = data.find((e) => e.code === q)
    if (exact) { selectEmiten(exact.code); return }
    const partial = data.find((e) => e.code.startsWith(q))
    if (partial) { selectEmiten(partial.code); return }
    const byName = data.find((e) => e.issuer.toUpperCase().includes(q))
    if (byName) { selectEmiten(byName.code); return }
    setOpen(true)
  }

  return (
    <div className="pi-head-actions">
      <div className="pi-srch-container">
        <input
          className="pi-search"
          type="text"
          placeholder="Cari emiten atau investor..."
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={(e) => { if (e.key === 'Enter') go() }}
        />
        {value && (
          <span className="pi-search-x" onMouseDown={() => { onClear(); setOpen(false) }}>✕</span>
        )}
        {open && q && (
          <div className="pi-search-drop">
            {!emitenHits.length && !investorHits.length && (
              <div className="pi-drop-empty">Tidak ditemukan</div>
            )}
            {emitenHits.length > 0 && (
              <>
                <div className="pi-drop-label">Emiten</div>
                {emitenHits.map((e) => (
                  <div key={e.code} className="pi-drop-item" onMouseDown={() => selectEmiten(e.code)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pi-drop-item-title">{e.code}</div>
                      <div className="pi-drop-item-sub">{e.holders.length} pemegang saham</div>
                    </div>
                    <span className="bchip" style={{ color: 'var(--amber)', borderColor: 'var(--amber)' }}>Emiten</span>
                  </div>
                ))}
              </>
            )}
            {investorHits.length > 0 && (
              <>
                <div className="pi-drop-label">Pemegang Saham</div>
                {investorHits.map((hit) => (
                  <div key={hit.name} className="pi-drop-item" onMouseDown={() => selectInvestor(hit)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pi-drop-item-title" style={{ fontWeight: 700, fontSize: 12 }}>{highlight(hit.name, q)}</div>
                      <div className="pi-drop-item-sub">{hit.count === 1 ? '1 emiten' : `${hit.count} kepemilikan`}</div>
                    </div>
                    {categoryBadge(hit.cls)}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <button type="button" className="pi-search-go" onClick={go}>Tampilkan</button>
      <button type="button" className="pi-search-reset" onClick={() => { onClear(); setOpen(false) }}>Reset</button>
    </div>
  )
}
