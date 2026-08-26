import type { ReactNode } from 'react'
import type { AgregatBroker, HariBroker, ModeTransaksi } from '../../../lib/dasbor/brokerEmiten'
import { arusHarian, floorPriceBroker, tabelDuaSisi } from '../../../lib/dasbor/brokerEmiten'
import { ringkasSB, analisaKelompok } from '../../../lib/dasbor/brokerEmitenV2'
import { warnaBroker, warnaKelompok, namaBroker, LABEL_KELOMPOK } from '../../../lib/dasbor/kelompokBroker'
import { fmtB, fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'
import { keFraksi } from '../../../lib/fraksiHarga'
import { Sparkline } from './Sparkline'

const URUTAN_LEGENDA = ['asing', 'bumn', 'smart', 'ritel', 'afiliasi', 'lain'] as const

/** Port `labelAD()` mockup — badge Acc/Dist bertingkat dari besar-kecilnya % top-N.
 * Latar penuh (bukan dim) supaya lebih menonjol — permintaan Johan 23 Agu 2026;
 * `.bs2-badge-*` cuma penampilan (intensitas), warnanya tetap --green/--red. */
function LabelAD({ pct }: { pct: number }) {
  const a = Math.abs(pct)
  if (a < 6) return <span className="chip" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>Neutral</span>
  const arah = pct >= 0 ? 'Acc' : 'Dist'
  const besar = a < 15 ? 'Small' : a < 20 ? 'Normal' : 'Big'
  const tingkat = besar === 'Small' ? 'kecil' : besar === 'Normal' ? 'sedang' : 'besar'
  return <span className={`chip ${pct >= 0 ? 'up' : 'dn'} bs2-badge-${tingkat}`}>{besar} {arah}</span>
}

function KodeBroker({ kode }: { kode: string }) {
  return <span style={{ color: warnaBroker(kode), fontWeight: 600 }} title={namaBroker(kode)}>{kode}</span>
}

interface OverviewProps {
  hari: Array<[string, HariBroker]>
  agg: AgregatBroker[]
  mode: ModeTransaksi
  ukuran: 'nilai' | 'lot'
}

/**
 * Tab "Overview" — port `renderRingkasSB()`+`renderTabel()`+`renderFlow()`+
 * `renderAnalisis()`+`renderFloor()` mockup jadi satu komponen (satu grid2 +
 * satu grid3, sama seperti struktur DOM mockup `#tab-overview`).
 */
export function Overview({ hari, agg, mode, ukuran }: OverviewProps) {
  const ringkas = ringkasSB(agg)
  const { beli, jual } = tabelDuaSisi(agg, mode)
  const rataLot = [1, 2, 3, 4, 5].reduce((s, n) => s + ringkas.topLot(n), 0) / 5
  const rataVal = [1, 2, 3, 4, 5].reduce((s, n) => s + ringkas.topVal(n), 0) / 5
  const selisih = ringkas.pembeli.length - ringkas.penjual.length
  // Acc/Dist DIAMBIL dari sumber (`ringkas.accdist` per hari), bukan dihitung
  // ulang dari selisih jumlah broker. Terukur 23 Agu 2026 atas 2.318 hari
  // BUMI: rumus `n_beli - n_jual` memberi Dist 64,5% / Acc 31,6% /
  // Neutral 4,0%, sementara sumbernya memberi Dist 1.586 / Acc 732 tanpa
  // Neutral sama sekali — dua definisi untuk satu hal, dan yang di layar
  // bukan yang dipakai penyedia datanya.
  //
  // Kartu ini menggambarkan RENTANG sementara sumber hanya punya label per
  // hari, jadi yang dilaporkan jumlah harinya — bukan satu label agregat yang
  // seolah-olah datang dari sumber padahal karangan sendiri.
  const nAcc = hari.filter(([, h]) => h.ringkas?.accdist === 'Acc').length
  const nDist = hari.filter(([, h]) => h.ringkas?.accdist === 'Dist').length

  const arus = arusHarian(hari)
  const asingAda = hari.filter(([, h]) => h.asing)
  const negoAda = hari.filter(([, h]) => h.nego)
  const hariTerakhir = hari[hari.length - 1]?.[1]

  const kelompok = analisaKelompok(hari, agg, ukuran)
  const floor = floorPriceBroker(hari, 1000).slice(0, 12)

  return (
    <>
      <section className="panel">
        <div className="panel-h">
          <h2>Broker Summary</h2>
          <span className="lbl">{mode === 'net' ? 'Net' : 'Gross'} · {ukuran === 'nilai' ? 'Nilai' : 'Lot'}</span>
        </div>
        <div className="panel-b">
          <div className="bs2-legenda">
            {URUTAN_LEGENDA.map((k) => (
              <span key={k}><i style={{ background: warnaKelompok(k) }} />{LABEL_KELOMPOK[k]}</span>
            ))}
          </div>

          <div className="grid2">
            <div>
              <div className="grid3" style={{ marginBottom: 12 }}>
                <div className="vcard">
                  <span className="lbl">Net Volume</span>
                  <span className="v-num num">{fmtLot(ringkas.netVol)}</span>
                  <span className="v-note">Σ net pembeli</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Net Value</span>
                  <span className="v-num num">Rp {fmtB(ringkas.netVal)}</span>
                  <span className="v-note">Σ nilai net pembeli</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Average</span>
                  <span className="v-num num">{ringkas.netVol ? `Rp ${Math.round(ringkas.avg).toLocaleString('id-ID')}` : '—'}</span>
                  <span className="v-note">net value ÷ net volume</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Broker</span>
                  <span className="v-num num">{ringkas.pembeli.length} <span className="chip up" style={{ padding: '0 6px' }}>▲</span> {ringkas.penjual.length} <span className="chip dn" style={{ padding: '0 6px' }}>▼</span></span>
                  <span className="v-note bs2-note-badge">
                    <b className="chip bs2-badge-mini">selisih {selisih > 0 ? '+' : ''}{selisih}</b>
                    <b className="chip bs2-badge-mini" style={{ background: nAcc >= nDist ? 'var(--green)' : 'var(--red)', color: 'var(--amber-ink)' }}>{nAcc >= nDist ? 'Acc' : 'Dist'} {Math.max(nAcc, nDist)}/{hari.length}h</b>
                  </span>
                </div>
                <div className="vcard">
                  <span className="lbl">Nilai kotor</span>
                  <span className="v-num num">Rp {fmtB(agg.reduce((s, a) => s + a.beliNilai, 0))}</span>
                  <span className="v-note">Σ beli semua broker</span>
                </div>
              </div>
              <div className="board-tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Pembeli − penjual</th><th className="r">Lot</th><th className="r" title="Σ net lot Top-n dua sisi ÷ Σ net lot seluruh pembeli — konsentrasi net, bukan porsi volume">%</th><th className="r">Nilai net (B)</th><th className="r" title="lot × 100 × Average">Rp@Avg (B)</th><th className="r">Acc/Dist</th></tr></thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const lot = ringkas.topLot(n), val = ringkas.topVal(n)
                      const pct = ringkas.netVol ? (lot / ringkas.netVol) * 100 : 0
                      return (
                        <tr key={n}>
                          <td>Top {n}</td>
                          <td className="r num">{Math.round(lot).toLocaleString('id-ID')}</td>
                          <td className="r num">{pct.toFixed(1)}</td>
                          <td className="r num">{(val / 1e9).toFixed(1)}</td>
                          <td className="r num">{((lot * 100 * ringkas.avg) / 1e9).toFixed(1)}</td>
                          <td className="r">{<LabelAD pct={pct} />}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td title="rata-rata Top 1–5, perkiraan — bisa berbeda tipis dari sumber aslinya">Average</td>
                      <td className="r num">≈ {Math.round(rataLot).toLocaleString('id-ID')}</td>
                      <td className="r num">{ringkas.netVol ? ((rataLot / ringkas.netVol) * 100).toFixed(1) : '0.0'}</td>
                      <td className="r num">{(rataVal / 1e9).toFixed(1)}</td>
                      <td className="r num">{((rataLot * 100 * ringkas.avg) / 1e9).toFixed(1)}</td>
                      <td className="r"><LabelAD pct={ringkas.netVol ? (rataLot / ringkas.netVol) * 100 : 0} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid2">
              <div>
                <div className="sisi-h" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="lbl" style={{ color: 'var(--green)' }}>Beli</span>
                  <span className="lbl">{beli.length} broker</span>
                </div>
                <div className="board-tbl-wrap" style={{ maxHeight: 480, overflow: 'auto' }}>
                  <table className="tbl">
                    <thead><tr><th>BY</th><th className="r">Val</th><th className="r">Lot</th><th className="r">Avg</th></tr></thead>
                    <tbody>{beli.map((r) => (
                      <tr key={r.broker}><td><KodeBroker kode={r.broker} /></td><td className="r num">{fmtB(r.nilai)}</td><td className="r num">{fmtLot(r.lot)}</td><td className="r num">{r.avg ? Math.round(r.avg) : '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="sisi-h" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="lbl" style={{ color: 'var(--red)' }}>Jual</span>
                  <span className="lbl">{jual.length} broker</span>
                </div>
                <div className="board-tbl-wrap" style={{ maxHeight: 480, overflow: 'auto' }}>
                  <table className="tbl">
                    <thead><tr><th>SL</th><th className="r">Val</th><th className="r">Lot</th><th className="r">Avg</th></tr></thead>
                    <tbody>{jual.map((r) => (
                      <tr key={r.broker}><td><KodeBroker kode={r.broker} /></td><td className="r num">{fmtB(r.nilai)}</td><td className="r num">{fmtLot(r.lot)}</td><td className="r num">{r.avg ? Math.round(r.avg) : '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid3" style={{ marginTop: 14 }}>
        <section className="panel">
          <div className="panel-h"><h2>Market Flow</h2><span className="lbl">per hari</span></div>
          <div className="panel-b">
            <div className="bs2-flow-row">
              <div className="nama">Reguler<small>nilai transaksi/hari</small></div>
              <Sparkline nilai={arus.map((a) => a.beliNilai + a.jualNilai)} />
              <div className="tot num">Rp {fmtB(arus.reduce((s, a) => s + a.beliNilai + a.jualNilai, 0))}</div>
            </div>
            <div className="bs2-flow-row">
              <div className="nama">Asing<small>net nilai, {asingAda.length}/{hari.length} hari ber-data</small></div>
              {asingAda.length ? <Sparkline nilai={hari.map(([, h]) => h.asing ? h.asing.broker.reduce((s, r) => s + r[2] - r[4], 0) : 0)} /> : <span className="lbl" style={{ fontStyle: 'italic' }}>belum tersedia</span>}
              <div className="tot num">{asingAda.length ? `Rp ${fmtB(asingAda.reduce((s, [, h]) => s + h.asing!.broker.reduce((a, r) => a + r[2] - r[4], 0), 0))}` : <span className="bs2-na">n/a</span>}</div>
            </div>
            <div className="bs2-flow-row">
              <div className="nama">Nego<small>nilai, {negoAda.length}/{hari.length} hari ber-data</small></div>
              {negoAda.length ? <Sparkline nilai={hari.map(([, h]) => h.nego ? h.nego.broker.reduce((s, r) => s + r[2], 0) : 0)} /> : <span className="lbl" style={{ fontStyle: 'italic' }}>belum tersedia</span>}
              <div className="tot num">{negoAda.length ? `Rp ${fmtB(negoAda.reduce((s, [, h]) => s + h.nego!.broker.reduce((a, r) => a + r[2], 0), 0))}` : <span className="bs2-na">n/a</span>}</div>
            </div>
            <div className="bs2-flow-row">
              <div className="nama">Broker aktif<small>beli / jual</small></div>
              <Sparkline nilai={arus.map((a) => a.nBeli - a.nJual)} />
              <div className="tot num">{hariTerakhir?.ringkas.n_beli ?? 0}/{hariTerakhir?.ringkas.n_jual ?? 0}</div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Broker Analysis</h2><span className="lbl">net per kelompok</span></div>
          <div className="panel-b">
            <div className="bs2-kat">
              {kelompok.map((g) => (
                <div className="bs2-kat-baris" key={g.id}>
                  <div className="nama" style={{ color: warnaKelompok(g.id) }}>{g.label}<small>{g.ket}</small></div>
                  <Sparkline nilai={g.harian} />
                  <div className="n num">{g.jumlahBroker} brk</div>
                  <div className="net num" style={{ color: g.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{g.net >= 0 ? '+' : ''}{ukuran === 'nilai' ? fmtB(g.net) : fmtLot(g.net)}</div>
                </div>
              ))}
            </div>
            <p className="lbl" style={{ marginTop: 10, textTransform: 'none', letterSpacing: 0 }}>
              Pengelompokan kurasi awal 22 Agu 2026, bisa diubah per pengguna nanti. Yang belum dikurasi masuk Lainnya.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Floor price per broker</h2><span className="lbl">beli rata-rata terendah, ≥ 1.000 lot/hari</span></div>
          <div className="panel-b">
            {floor.length === 0 ? (
              <EmptyState>Tak ada broker dengan ≥1.000 lot dalam satu hari pada rentang ini.</EmptyState>
            ) : (
              <div className="board-tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Broker</th><th className="r">Floor</th><th className="r">Tanggal</th><th className="r">Lot hari itu</th></tr></thead>
                  <tbody>{floor.map((f) => (
                    <tr key={f.broker}>
                      <td><KodeBroker kode={f.broker} /></td>
                      <td className="r num">Rp {keFraksi(f.floor).toLocaleString('id-ID')}</td>
                      <td className="r num">{labelTanggal(f.tanggal)}</td>
                      <td className="r num">{fmtLot(f.lot)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="lbl" style={{ padding: '20px 0', textAlign: 'center', textTransform: 'none', letterSpacing: 0 }}>{children}</p>
}
