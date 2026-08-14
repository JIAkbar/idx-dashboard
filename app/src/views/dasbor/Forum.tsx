import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ambilRingkasanRuang, waktuRelatif, type RuangRingkasan } from '../../lib/forum'

/**
 * Daftar ruang Forum — kartu per ruang dari `forum_ringkasan()` (baca
 * publik, anon termasuk). Topik dulu, lalu ruang emiten (diurutkan di
 * lib/forum.ts). Kotak cari menyaring label/keterangan/kunci di klien —
 * jumlah ruang kecil, tak perlu query server terpisah.
 */
export function Forum() {
  const [ruang, setRuang] = useState<RuangRingkasan[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [cari, setCari] = useState('')

  useEffect(() => {
    let batal = false
    ambilRingkasanRuang()
      .then((r) => { if (!batal) setRuang(r) })
      .catch((e: unknown) => { if (!batal) setGalat(e instanceof Error ? e.message : 'Gagal memuat daftar ruang.') })
    return () => { batal = true }
  }, [])

  const tersaring = useMemo(() => {
    if (!ruang) return []
    const q = cari.trim().toLowerCase()
    if (!q) return ruang
    return ruang.filter((r) =>
      r.label.toLowerCase().includes(q) || (r.keterangan ?? '').toLowerCase().includes(q) || r.kunci.toLowerCase().includes(q))
  }, [ruang, cari])

  const topik = tersaring.filter((r) => r.jenis === 'topik')
  const emiten = tersaring.filter((r) => r.jenis === 'emiten')

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Forum</h1>
        <span className="sub">diskusi terbuka seputar pasar &amp; emiten</span>
      </div>

      <div className="field" style={{ maxWidth: 360 }}>
        <input
          className="inp" placeholder="Cari ruang…" value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
      </div>

      {galat && <div className="panel panel-b"><p className="muted">{galat}</p></div>}

      {!galat && ruang === null && <div className="fd-empty"><p>Memuat ruang…</p></div>}

      {ruang !== null && (
        <>
          {topik.length > 0 && (
            <>
              <span className="lbl">Topik</span>
              <div className="grid3">
                {topik.map((r) => <KartuRuang key={r.kunci} r={r} />)}
              </div>
            </>
          )}
          {emiten.length > 0 && (
            <>
              <span className="lbl">Ruang Emiten</span>
              <div className="grid3">
                {emiten.map((r) => <KartuRuang key={r.kunci} r={r} />)}
              </div>
            </>
          )}
          {tersaring.length === 0 && (
            <div className="fd-empty"><p>Tidak ada ruang yang cocok dengan pencarian.</p></div>
          )}
        </>
      )}
    </div>
  )
}

function KartuRuang({ r }: { r: RuangRingkasan }) {
  return (
    <Link to={`/forum/${r.kunci}`} className="panel vcard forum-ruang-kartu">
      <span className="num" style={{ fontSize: 15 }}>{r.label}</span>
      {r.keterangan && <span className="muted" style={{ fontSize: 12 }}>{r.keterangan}</span>}
      <span className="v-note">
        {r.jumlah} pesan{r.terakhir ? ` · ${waktuRelatif(r.terakhir)}` : ' · belum ada pesan'}
      </span>
    </Link>
  )
}
