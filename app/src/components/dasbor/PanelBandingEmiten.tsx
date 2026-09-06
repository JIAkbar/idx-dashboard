import { Fragment, useEffect, useMemo, useState } from 'react'
import { StockAutocomplete } from './StockAutocomplete'
import { TombolIkon } from './TombolIkon'
import { IKON_KAMERA, IKON_SILANG } from './IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import {
  fetchAsing,
  fetchFundamental,
  useStockIndex,
  type AsingHarian,
  type StockFundamental,
} from '../../lib/dasbor/stockDetailData'
import { useValuasiHistoris, valuasiEmiten } from '../../lib/dasbor/valuasiHistoris'
import { MAKS_BANDING, kalimatTanggal, susunBanding, unduhBandingPng } from '../../lib/dasbor/bandingEmiten'

/**
 * Panel/tab "Banding Emiten" — dipindah dari halaman Bedah Emiten (pensiun 21
 * Agu 2026, isinya digabung ke Stock Detail sebagai tab "Banding"). Sampai
 * lima emiten berdampingan, ruas yang dipilih karena artinya berubah ketika
 * disandingkan.
 *
 * Emiten jadi KOLOM, ruas jadi BARIS — sengaja, supaya tabel ini tak bisa
 * diurut jadi "peringkat emiten terbaik" (aturan sama dengan Screener). Yang
 * berupa deret (lintasan laba, kuartalan, laporan keuangan) sengaja tak ikut:
 * disandingkan sebagai satu angka, deret kehilangan bagian yang membuatnya
 * berarti. Seluruh susunan tabel & gambar PNG-nya ada di
 * `lib/dasbor/bandingEmiten.ts` (fungsi murni, sudah diuji) — berkas ini
 * cuma pengambil data & pengait UI.
 *
 * Mandiri: mengambil sendiri daftar emiten (`useStockIndex`) dan deret
 * valuasi historis (`useValuasiHistoris`) supaya pemanggilnya (tab "Banding")
 * cukup me-render `<PanelBandingEmiten awal={fd.ticker} />` — dan supaya
 * `valuasi_historis.json` cuma diunduh kalau tab ini benar-benar dibuka.
 */

interface BahanKolom {
  fd: StockFundamental | null
  asing: AsingHarian[] | null
}

export function PanelBandingEmiten({ awal }: { awal: string }) {
  const { index } = useStockIndex()
  const daftarValuasi = useValuasiHistoris()
  const { theme } = useTheme()
  const [kode, setKode] = useState<string[]>([awal])
  const [input, setInput] = useState('')
  const [pesan, setPesan] = useState<string | null>(null)
  const [bahan, setBahan] = useState<Record<string, BahanKolom>>({})
  const [memuat, setMemuat] = useState(false)

  // Emiten yang sedang dilihat di Stock Detail adalah pokok tab ini — ganti
  // emiten berarti banding dimulai ulang darinya, bukan menumpuk pilihan lama.
  useEffect(() => {
    setKode([awal])
    setPesan(null)
  }, [awal])

  useEffect(() => {
    const belum = kode.filter((k) => !(k in bahan))
    if (belum.length === 0) return
    let batal = false
    setMemuat(true)
    Promise.all(
      belum.map((k) =>
        Promise.all([fetchFundamental(k), fetchAsing(k)]).then(
          ([fd, asing]) => [k, { fd, asing: asing?.d ?? null }] as const,
        ),
      ),
    )
      .then((pasang) => {
        if (!batal) setBahan((p) => ({ ...p, ...Object.fromEntries(pasang) }))
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [kode, bahan])

  const tabel = useMemo(
    () => susunBanding(kode.map((k) => ({
      kode: k,
      fd: bahan[k]?.fd ?? null,
      deret: valuasiEmiten(daftarValuasi, k),
      asing: bahan[k]?.asing ?? null,
    }))),
    [kode, bahan, daftarValuasi],
  )

  function tambah(raw: string) {
    const k = raw.trim().toUpperCase().replace('.JK', '')
    if (!k) return
    if (kode.includes(k)) {
      setPesan(`${k} sudah ada di banding ini.`)
      return
    }
    if (kode.length >= MAKS_BANDING) {
      setPesan(`Banding dibatasi ${MAKS_BANDING} emiten — lepas salah satu dulu sebelum menambah ${k}.`)
      return
    }
    setKode((p) => [...p, k])
    setInput('')
    setPesan(null)
  }

  function lepas(k: string) {
    if (kode.length <= 1) {
      setPesan('Banding butuh sedikitnya satu emiten.')
      return
    }
    setKode((p) => p.filter((x) => x !== k))
    setPesan(null)
  }

  const belumTerpanen = tabel.kolom.filter((k) => !k.ada).map((k) => k.kode)

  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Banding Emiten</span></div>
      <div className="panel-b">
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
          Sampai lima emiten berdampingan, ruas yang dipilih karena artinya berubah ketika
          disandingkan. Yang berupa deret — lintasan laba, denyut kuartalan, laporan keuangan —
          sengaja tidak ikut: disandingkan sebagai satu angka, deret kehilangan bagian yang membuatnya
          berarti.
        </p>

        <div className="bdh-cmp-bilah">
          <span className="af-cari bdh-cmp-cari">
            <StockAutocomplete
              stocks={index?.stocks ?? []}
              value={input}
              onChange={setInput}
              onSelect={tambah}
              placeholder="Tambah pembanding: BUMI, BBCA…"
            />
          </span>
          <button
            type="button"
            className="chip-t"
            onClick={() => tambah(input)}
            disabled={kode.length >= MAKS_BANDING}
          >
            Tambah
          </button>
          <span className="bdh-cmp-hitung">{kode.length} dari {MAKS_BANDING}</span>
          <span className="ti-grup bdh-cmp-aksi">
            <TombolIkon
              d={IKON_KAMERA}
              label="Simpan banding sebagai gambar PNG"
              onClick={() => unduhBandingPng(tabel, theme)}
              disabled={memuat}
            />
          </span>
        </div>

        {pesan && <p className="bdh-cmp-pesan">{pesan}</p>}

        <div className="bdh-cmp-wrap">
          <table className="tbl bdh-cmp-tbl">
            <thead>
              <tr>
                <th>Ruas</th>
                {tabel.kolom.map((k) => (
                  <th key={k.kode} className="r">
                    <div className="bdh-cmp-th">
                      <span className="bdh-cmp-kode">{k.kode}</span>
                      <TombolIkon
                        d={IKON_SILANG}
                        label={`Lepas ${k.kode} dari banding`}
                        ariaLabel={`Lepas ${k.kode} dari banding emiten`}
                        ukuranIkon={11}
                        onClick={() => lepas(k.kode)}
                      />
                    </div>
                    <div className="bdh-cmp-nama">{k.ada ? k.nama : 'belum terpanen'}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabel.grup.map((g) => (
                <Fragment key={g.judul}>
                  <tr className="bdh-cmp-grup">
                    <th colSpan={tabel.kolom.length + 1}>{g.judul}</th>
                  </tr>
                  {g.baris.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      {b.sel.map((s, i) => (
                        <td
                          key={tabel.kolom[i].kode}
                          className={'r num' + (s.arah === 1 ? ' up' : s.arah === -1 ? ' dn' : '')}
                        >
                          {s.teks}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {belumTerpanen.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
            Berkas fundamental {belumTerpanen.join(', ')} belum tersedia — seluruh kolomnya ditulis
            "—". Itu berarti datanya belum terpanen, bukan angkanya nol.
          </p>
        )}

        <p style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 }}>
          {/* Prosa penjelas dibuang 7 Sep 2026 (Johan: "ada teks di footer di hapus
              gak bakal kebaca"). Yang tinggal cuma tanggalnya - satu-satunya bagian
              yang menjawab pertanyaan pembaca, bukan menjelaskan niat desainer. */}
          {kalimatTanggal(tabel)}.
        </p>
      </div>
    </div>
  )
}
