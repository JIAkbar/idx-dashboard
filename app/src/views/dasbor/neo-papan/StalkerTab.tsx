import { useEffect, useMemo, useState } from 'react'
import {
  muatBrokerSemua, muatBrokerTahunanBanyak, muatDaftarKode,
  type BrokerHarianEmiten,
} from '../../../lib/dasbor/neoPapanData'
import {
  konsistensiNet, kodeBrokerUnik, stalkerAgregasiV2,
  type BarisStalkerV2, type HariStalkerV2, type InvestorStalker,
} from '../../../lib/dasbor/neoPapan'
import { DropdownMulti, type OpsiMulti } from '../../../components/dasbor/DropdownMulti'
import { LABEL_RENTANG } from '../../../lib/dasbor/periode'
import { HARI_BURSA } from '../../../lib/dasbor/rentang'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import { namaBroker, warnaBroker } from '../../../lib/dasbor/kelompokBroker'
import { useRingkasKartu } from '../../../lib/dasbor/kartuRingkas'
import { fmtB, num, Kosong, Sumber } from './bersama'

/**
 * Broker Stalker V2 — Σ net beli/jual broker terpilih lintas seluruh emiten
 * berarsip (spek_neo_papan_revisi.md §2 + PENAJAMAN #1).
 *
 * Routing sumber (inti perbaikan "preset 60d bohong" — broker_harian cuma
 * jendela geser 20 hari):
 * - ≤20 hari & investor ALL  → `broker_harian/*.json` (murah, ter-cache).
 * - >20 hari / Asing / Domestik → `broker_tahunan/{kode}/{tahun}.json` lewat
 *   `muatBrokerTahunanBanyak` (reuse `muatRentang`). Unduhannya RATUSAN MB —
 *   karena itu dipicu TOMBOL eksplisit berlabel taksiran ukurannya, bukan
 *   otomatis, dan judul tabel selalu menampilkan rentang SEBENARNYA.
 */

/** Keluarga hari-granular (1-20 hari, khas stalking harian) + kosakata baku
 *  modul rentang (spek konsistensi §2): '60 hari'→b3, '1 tahun'→y1, dan
 *  preset panjang y3/y5/y10 menyusul arsip broker 2016-2026. Label rentang
 *  baku dieja LABEL_RENTANG (#170), bukan di sini. */
const PRESET_JENDELA = [
  { id: '1', label: 'Hari ini' },
  { id: '2', label: '2 hari' },
  { id: '3', label: '3 hari' },
  { id: '5', label: '5 hari' },
  { id: '10', label: '10 hari' },
  { id: '20', label: '20 hari' },
  { id: 'b3', label: LABEL_RENTANG.b3 },
  { id: 'ytd', label: LABEL_RENTANG.ytd },
  { id: 'y1', label: LABEL_RENTANG.y1 },
  { id: 'y3', label: LABEL_RENTANG.y3 },
  { id: 'y5', label: LABEL_RENTANG.y5 },
  { id: 'y10', label: LABEL_RENTANG.y10 },
] as const
type IdJendela = (typeof PRESET_JENDELA)[number]['id']
/** Preset kosakata baku yang jendelanya dihitung hari BURSA via HARI_BURSA. */
const JENDELA_BAKU = new Set(['b3', 'y1', 'y3', 'y5', 'y10'])

const BARIS_PER_HAL = 25
const SPARK_N = 12

type KunciUrut = 'emiten' | 'net' | 'beli' | 'jual' | 'bavg' | 'savg' | 'porsiVol' | 'konsist' | 'posisi'

interface BarisTampil extends BarisStalkerV2 {
  konsist: number
  /** (close − bavg)/bavg × 100; null tanpa harga/bavg. */
  posisi: number | null
}

/** Sparkline net harian — batang mini, skala per-baris (pola Strip TraderPapan). */
function Spark({ seri }: { seri: Array<{ net: number }> }) {
  const ekor = seri.slice(-SPARK_N)
  const puncak = Math.max(1, ...ekor.map((s) => Math.abs(s.net)))
  return (
    <span className="np-spark" aria-hidden="true">
      {ekor.map((s, i) => (
        <span key={i} className={s.net >= 0 ? 'up' : 'dn'}
          style={{ height: `${Math.max(8, (Math.abs(s.net) / puncak) * 100)}%` }} />
      ))}
    </span>
  )
}

export function StalkerTab() {
  const [peta20, setPeta20] = useState<Map<string, BrokerHarianEmiten> | null>(null)
  const [totalEmiten, setTotalEmiten] = useState<number | null>(null)
  const [dipilih, setDipilih] = useState<string[]>([])
  const [jendelaId, setJendelaId] = useState<IdJendela>('5')
  const [investor, setInvestor] = useState<InvestorStalker>('all')
  // jalur berat: data tahunan per kunci query yang SUDAH dimuat + progresnya
  const [tahunan, setTahunan] = useState<{ kunci: string; peta: Map<string, { hari: Record<string, HariStalkerV2> }> } | null>(null)
  const [progres, setProgres] = useState<{ selesai: number; total: number } | null>(null)
  // saring & urut & halaman (dipakai kedua tabel)
  const [fEmiten, setFEmiten] = useState('')
  const [fNet, setFNet] = useState('')
  const [fBeli, setFBeli] = useState('')
  const [fJual, setFJual] = useState('')
  const [urut, setUrut] = useState<{ kunci: KunciUrut; arah: 'naik' | 'turun' } | null>(null)
  const [halBuy, setHalBuy] = useState(1)
  const [halSell, setHalSell] = useState(1)

  const ringkasKartu = useRingkasKartu()
  const hargaKini = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of ringkasKartu?.emiten ?? []) if (e.harga != null) m.set(e.kode, e.harga)
    return m
  }, [ringkasKartu])

  useEffect(() => {
    let batal = false
    muatBrokerSemua().then((m) => { if (!batal) setPeta20(m) })
    muatDaftarKode().then((k) => { if (!batal) setTotalEmiten(k.length) })
    return () => { batal = true }
  }, [])

  const kodeBroker = useMemo(() => (peta20 ? kodeBrokerUnik(peta20) : []), [peta20])
  const opsiBroker = useMemo<OpsiMulti[]>(() => kodeBroker.map((k) => {
    const nama = namaBroker(k)
    return { nilai: k, label: nama === 'belum dikurasi' ? k : `${k} — ${nama}` }
  }), [kodeBroker])
  useEffect(() => {
    if (kodeBroker.length && dipilih.length === 0) setDipilih(kodeBroker.slice(0, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kodeBroker])

  // Kalender union broker_harian — hari bursa terakhir yang terpanen.
  const kalender20 = useMemo(() => {
    if (!peta20) return []
    const set = new Set<string>()
    for (const e of peta20.values()) for (const t of Object.keys(e.hari)) set.add(t)
    return [...set].sort()
  }, [peta20])
  const hariAkhir = kalender20[kalender20.length - 1] ?? ''

  const butuhTahunan = investor !== 'all' || JENDELA_BAKU.has(jendelaId) || jendelaId === 'ytd'

  /** Rentang tanggal jalur tahunan (kalender, sebelum diiris jadi hari bursa). */
  const rentangTahunan = useMemo(() => {
    if (!hariAkhir) return null
    if (jendelaId === 'ytd') return { dari: `${hariAkhir.slice(0, 4)}-01-01`, sampai: hariAkhir }
    // Hari bursa → hari kalender: ×1.45 + slack (akhir pekan + libur bursa).
    const nHari = JENDELA_BAKU.has(jendelaId)
      ? Math.ceil(HARI_BURSA[jendelaId as 'b3' | 'y1' | 'y3' | 'y5' | 'y10'] * 1.45) + 8
      : Math.ceil(Number(jendelaId) * 1.7) + 4
    const d = new Date(`${hariAkhir}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - nHari)
    return { dari: d.toISOString().slice(0, 10), sampai: hariAkhir }
  }, [jendelaId, hariAkhir])

  const kunciTahunan = rentangTahunan ? `${rentangTahunan.dari}~${rentangTahunan.sampai}` : ''
  const tahunTersentuh = rentangTahunan
    ? Number(rentangTahunan.sampai.slice(0, 4)) - Number(rentangTahunan.dari.slice(0, 4)) + 1
    : 1

  const muatTahunan = async () => {
    if (!rentangTahunan || !totalEmiten) return
    setProgres({ selesai: 0, total: totalEmiten })
    const kodes = await muatDaftarKode()
    const peta = await muatBrokerTahunanBanyak(
      kodes, rentangTahunan.dari, rentangTahunan.sampai,
      (selesai, total) => setProgres({ selesai, total }),
    )
    setTahunan({ kunci: kunciTahunan, peta })
    setProgres(null)
  }

  const hasil = useMemo(() => {
    if (!dipilih.length) return null
    if (!butuhTahunan) {
      if (!peta20) return null
      const n = Number(jendelaId)
      const jendela = kalender20.slice(-n)
      // HariBroker broker_harian sudah berbentuk HariStalkerV2 (ringkas.totalLot
      // + baris broker objek) — dipakai langsung tanpa salinan.
      return stalkerAgregasiV2(peta20 as unknown as Map<string, { hari: Record<string, HariStalkerV2> }>, dipilih, jendela, 'all')
    }
    if (!tahunan || tahunan.kunci !== kunciTahunan) return null
    const set = new Set<string>()
    for (const e of tahunan.peta.values()) for (const t of Object.keys(e.hari)) set.add(t)
    let jendela = [...set].sort()
    if (JENDELA_BAKU.has(jendelaId)) jendela = jendela.slice(-HARI_BURSA[jendelaId as 'b3' | 'y1' | 'y3' | 'y5' | 'y10'])
    else if (jendelaId !== 'ytd') jendela = jendela.slice(-Number(jendelaId))
    return stalkerAgregasiV2(tahunan.peta, dipilih, jendela, investor)
  }, [peta20, tahunan, kunciTahunan, dipilih, jendelaId, investor, butuhTahunan, kalender20])

  // reset halaman tiap parameter/saringan/urutan berubah
  useEffect(() => { setHalBuy(1); setHalSell(1) },
    [fEmiten, fNet, fBeli, fJual, urut, dipilih, jendelaId, investor])

  /** Operator angka prefix tunggal: `>1000000000`, `<0`, atau angka polos (≥). */
  const lolosAngka = (v: number, f: string): boolean => {
    const s = f.trim()
    if (!s) return true
    const op = s[0] === '>' || s[0] === '<' ? s[0] : '>'
    const angka = Number((s[0] === '>' || s[0] === '<' ? s.slice(1) : s).replace(/[._\s]/g, ''))
    if (!Number.isFinite(angka)) return true
    return op === '>' ? v >= angka : v <= angka
  }

  const olah = (baris: BarisStalkerV2[]): BarisTampil[] => {
    let r: BarisTampil[] = baris.map((b) => {
      const harga = hargaKini.get(b.emiten)
      return {
        ...b,
        konsist: konsistensiNet(b.seriHarian),
        posisi: harga != null && b.bavg ? ((harga - b.bavg) / b.bavg) * 100 : null,
      }
    })
    const q = fEmiten.trim().toUpperCase()
    if (q) r = r.filter((b) => b.emiten.includes(q))
    r = r.filter((b) => lolosAngka(b.net, fNet) && lolosAngka(b.beli, fBeli) && lolosAngka(b.jual, fJual))
    if (urut) {
      const { kunci, arah } = urut
      const tanda = arah === 'naik' ? 1 : -1
      r = [...r].sort((a, b) => {
        const va = kunci === 'konsist' ? a.konsist : a[kunci as keyof BarisTampil]
        const vb = kunci === 'konsist' ? b.konsist : b[kunci as keyof BarisTampil]
        // null selalu di ujung, apa pun arah urutnya
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb)) * tanda
        return ((va as number) - (vb as number)) * tanda
      })
    }
    return r
  }

  const klikUrut = (kunci: KunciUrut) =>
    setUrut((u) => (u?.kunci === kunci ? (u.arah === 'turun' ? { kunci, arah: 'naik' } : null) : { kunci, arah: 'turun' }))

  if (peta20 === null) return <Kosong>Memuat arsip broker seluruh emiten…</Kosong>

  const toggle = (k: string) => setDipilih((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]))

  const Th = ({ kunci, label, kanan = true }: { kunci: KunciUrut; label: string; kanan?: boolean }) => (
    <th className={kanan ? 'r' : ''}>
      <button type="button" className="th-sort" onClick={() => klikUrut(kunci)}>
        {label}{urut?.kunci === kunci ? (urut.arah === 'turun' ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )

  const Tabel = ({ judul, baris, hal, setHal }: {
    judul: string; baris: BarisTampil[]; hal: number; setHal: (f: (n: number) => number) => void
  }) => {
    const nHal = Math.max(1, Math.ceil(baris.length / BARIS_PER_HAL))
    const tampil = baris.slice((hal - 1) * BARIS_PER_HAL, hal * BARIS_PER_HAL)
    return (
      <div className="panel panel-b">
        <h3 style={{ marginTop: 0 }}>{judul}</h3>
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <Th kunci="emiten" label="Emiten" kanan={false} />
                <Th kunci="net" label="Net" />
                <Th kunci="beli" label="Beli" />
                <Th kunci="jual" label="Jual" />
                <Th kunci="bavg" label="B.Avg" />
                <Th kunci="savg" label="S.Avg" />
                <Th kunci="posisi" label="vs B.Avg" />
                <Th kunci="porsiVol" label="Porsi Vol" />
                <Th kunci="konsist" label="Konsist" />
                <th>Harian</th>
              </tr>
            </thead>
            <tbody>
              {tampil.length === 0 ? (
                <tr><td colSpan={10} className="np-kosong">Tidak ada</td></tr>
              ) : tampil.map((r) => (
                <tr key={r.emiten}>
                  <td>
                    <b>{r.emiten}</b>
                    {hasil && r.cakupanHari < hasil.jendela.length && (
                      <span className="np-parsial" title="Arsip broker emiten ini belum menutupi seluruh jendela"> {r.cakupanHari}/{hasil.jendela.length}h</span>
                    )}
                    {investor !== 'all' && r.cakupanInvestor < r.cakupanHari && (
                      <span className="np-parsial" title="Varian investor ini belum ter-backfill di semua hari emiten ini"> inv {r.cakupanInvestor}/{r.cakupanHari}</span>
                    )}
                    {dipilih.length > 1 && r.brokerAktif.length > 0 && (
                      <span className="np-broker-badges">
                        {r.brokerAktif.map((k) => (
                          <span key={k} style={{ color: warnaBroker(k) }} title={namaBroker(k) !== 'belum dikurasi' ? namaBroker(k) : undefined}>{k}</span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={'r' + (r.net >= 0 ? ' up' : ' dn')}>{fmtB(r.net)}</td>
                  <td className="r">{fmtB(r.beli)}</td>
                  <td className="r">{fmtB(r.jual)}</td>
                  <td className="r">{r.bavg != null ? num(r.bavg) : '—'}</td>
                  <td className="r">{r.savg != null ? num(r.savg) : '—'}</td>
                  <td className={'r' + (r.posisi == null ? '' : r.posisi >= 0 ? ' up' : ' dn')}>
                    {r.posisi == null ? '—' : `${r.posisi >= 0 ? '+' : ''}${num(r.posisi, 1)}%`}
                  </td>
                  <td className="r">{r.porsiVol == null ? '—' : `${num(r.porsiVol * 100, 1)}%`}</td>
                  <td className="r">{r.konsist}/{r.seriHarian.length}</td>
                  <td><Spark seri={r.seriHarian} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {nHal > 1 && (
          <div className="np-hal">
            <button type="button" className="chip-t" disabled={hal <= 1} onClick={() => setHal((n) => n - 1)}>‹</button>
            <span className="muted">{hal}/{nHal} · {baris.length.toLocaleString('id-ID')} baris</span>
            <button type="button" className="chip-t" disabled={hal >= nHal} onClick={() => setHal((n) => n + 1)}>›</button>
          </div>
        )}
      </div>
    )
  }

  const perluMuat = butuhTahunan && (!tahunan || tahunan.kunci !== kunciTahunan)

  return (
    <section>
      <div className="panel panel-b">
        <h2>Broker Stalker</h2>
        <p className="np-sub">
          Net beli/jual broker terpilih di seluruh emiten yang sudah dipanen.
          Cakupan: {peta20.size} dari {totalEmiten ?? '…'} emiten terdaftar punya arsip broker.
        </p>
        <div className="np-baris">
          <span className="np-lbl">Broker</span>
          <DropdownMulti label="Broker" ariaLabel="Pilih broker" opsi={opsiBroker} nilai={dipilih} onGanti={setDipilih} ringkasKosong="Belum ada" />
        </div>
        {dipilih.length > 0 && (
          <div className="np-baris np-chips-aktif">
            {dipilih.map((k) => (
              <button key={k} type="button" className="chip-t on np-chip-broker" onClick={() => toggle(k)}>
                <span className="np-chip-titik" style={{ background: warnaBroker(k) }} aria-hidden="true" />
                {k} ✕
              </button>
            ))}
          </div>
        )}
        <div className="np-baris" style={{ marginTop: 8 }}>
          <span className="np-lbl">Jendela</span>
          <PemilihRentang
            opsi={PRESET_JENDELA.map((p) => ({ id: p.id, label: p.label }))}
            nilai={jendelaId}
            onGanti={(id) => setJendelaId(id as IdJendela)}
          />
        </div>
        <div className="np-baris">
          <span className="np-lbl">Investor</span>
          {([
            ['all', 'Semua'],
            ['asing', 'Asing (klien)'],
            ['domestik', 'Domestik'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={'chip-t' + (investor === id ? ' on' : '')}
              title={id === 'asing'
                ? 'Investor-type ASING dari varian panen (klien luar negeri lintas broker) — BUKAN identitas kepemilikan sekuritasnya'
                : id === 'domestik' ? 'Domestik = Semua − Asing, per broker per hari' : 'Seluruh investor'}
              onClick={() => setInvestor(id)}>{label}</button>
          ))}
        </div>
        <div className="np-baris">
          <span className="np-lbl">Saring</span>
          <input className="inp np-f" value={fEmiten} onChange={(e) => setFEmiten(e.target.value)} placeholder="Emiten…" aria-label="Saring emiten" />
          <input className="inp np-f" value={fNet} onChange={(e) => setFNet(e.target.value)} placeholder="Net: >1000000000" aria-label="Saring net" />
          <input className="inp np-f" value={fBeli} onChange={(e) => setFBeli(e.target.value)} placeholder="Beli: >…" aria-label="Saring beli" />
          <input className="inp np-f" value={fJual} onChange={(e) => setFJual(e.target.value)} placeholder="Jual: <…" aria-label="Saring jual" />
        </div>
      </div>

      {perluMuat ? (
        <Kosong>
          {progres ? (
            <>Memuat arsip tahunan… {progres.selesai}/{progres.total} emiten</>
          ) : (
            <>
              Jendela ini butuh arsip broker tahunan — unduhan ±{tahunTersentuh * 270} MB (terkompresi)
              untuk {totalEmiten ?? '…'} emiten, sekali per rentang per sesi.
              <br />
              <button type="button" className="btn-p" style={{ marginTop: 10 }} onClick={muatTahunan}>
                Muat data {jendelaId === 'ytd' ? 'YTD' : JENDELA_BAKU.has(jendelaId) ? PRESET_JENDELA.find((o) => o.id === jendelaId)?.label : `${jendelaId} hari`}
                {investor !== 'all' ? ` · investor ${investor}` : ''}
              </button>
            </>
          )}
        </Kosong>
      ) : !hasil ? (
        <Kosong>Pilih minimal satu broker.</Kosong>
      ) : (
        <>
          <div className="np-2kol">
            <Tabel
              judul={`Stalking Net Buy — ${hasil.jendela[0] ?? ''} → ${hasil.jendela[hasil.jendela.length - 1] ?? ''} (${hasil.jendela.length} hari bursa${investor !== 'all' ? ` · ${investor}` : ''})`}
              baris={olah(hasil.netBuy)} hal={halBuy} setHal={(f) => setHalBuy(f)}
            />
            <Tabel judul="Stalking Net Sell" baris={olah(hasil.netSell)} hal={halSell} setHal={(f) => setHalSell(f)} />
          </div>
          <Sumber>
            Rincian broker harian dari arsip, pasar reguler, dijumlah lintas emiten.
            {investor !== 'all' && ' Label "Asing" = investor-type klien luar negeri, bukan identitas kepemilikan sekuritas.'}
            {' '}vs B.Avg memakai harga kartu terakhir; Porsi Vol = rata harian Σ lot beli broker terpilih ÷ total lot pasar emiten itu.
          </Sumber>
        </>
      )}
    </section>
  )
}
